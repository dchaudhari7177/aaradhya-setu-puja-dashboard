import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { adminApp, serviceAccount } from "../firebase-admin";
import { applyListQuery, computeStats } from "@/lib/domain/query";
import type { Booking, BookingListQuery, NotificationRecord } from "@/lib/domain/types";
import {
  BOOKING_ID_START,
  ConflictError,
  formatBookingId,
  type BookingRepository,
  type StatusUpdate,
} from "../repository";

/**
 * Firestore adapter.
 *
 * Firestore has no substring search and needs a composite index for every
 * filter + sort combination, so instead of a fan of indexes this adapter reads
 * the bookings collection and applies the shared, tested `applyListQuery`.
 * That is the right call for an internal dashboard with thousands of rows; past
 * that, search would move to a dedicated index (Algolia / Typesense) and this
 * adapter would query by status + date with cursors.
 *
 * Booking IDs come from a counter document updated in a transaction, and
 * status changes are compare-and-set inside a transaction, matching the MongoDB
 * adapter's guarantees.
 */

export function firestoreConfigured(): boolean {
  return Boolean(serviceAccount() || process.env.FIRESTORE_EMULATOR_HOST);
}

function db(): Firestore {
  const g = globalThis as typeof globalThis & { __firestore?: Firestore };
  if (g.__firestore) return g.__firestore;
  const firestore = getFirestore(adminApp());
  firestore.settings({ ignoreUndefinedProperties: true });
  return (g.__firestore = firestore);
}

const BOOKINGS = "bookings";
const NOTIFICATIONS = "notifications";
const COUNTERS = "counters";

export class FirestoreRepository implements BookingRepository {
  readonly driver = "firestore" as const;

  private async all(): Promise<Booking[]> {
    const snap = await db().collection(BOOKINGS).get();
    return snap.docs.map((d) => d.data() as Booking);
  }

  async list(query: BookingListQuery) {
    return applyListQuery(await this.all(), query);
  }

  async get(id: string) {
    const doc = await db().collection(BOOKINGS).doc(id.toUpperCase()).get();
    return doc.exists ? (doc.data() as Booking) : null;
  }

  async create(data: Omit<Booking, "id">) {
    const firestore = db();
    return firestore.runTransaction(async (tx) => {
      const counterRef = firestore.collection(COUNTERS).doc("booking");
      const counter = await tx.get(counterRef);
      const seq = ((counter.data()?.seq as number | undefined) ?? 0) + 1;
      const booking: Booking = { ...data, id: formatBookingId(BOOKING_ID_START - 1 + seq) };
      tx.set(counterRef, { seq });
      tx.create(firestore.collection(BOOKINGS).doc(booking.id), booking);
      return booking;
    });
  }

  async updateStatus(id: string, change: StatusUpdate) {
    const firestore = db();
    const ref = firestore.collection(BOOKINGS).doc(id.toUpperCase());
    return firestore.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      const current = snap.data() as Booking;
      if (current.status !== change.expected) throw new ConflictError(`Booking is now ${current.status}.`, current);
      const next: Booking = {
        ...current,
        status: change.event.to,
        pandit: change.set.pandit ?? current.pandit,
        videoUrl: change.set.videoUrl ?? current.videoUrl,
        updatedAt: change.set.updatedAt,
        history: [...current.history, change.event],
      };
      tx.set(ref, next);
      return next;
    });
  }

  async stats(now?: Date) {
    const [bookings, sent] = await Promise.all([
      this.all(),
      db().collection(NOTIFICATIONS).where("status", "==", "sent").count().get(),
    ]);
    return computeStats(bookings, sent.data().count, now);
  }

  async exportAll(query: Omit<BookingListQuery, "page" | "pageSize">) {
    return applyListQuery(await this.all(), { ...query, page: 1, pageSize: Number.MAX_SAFE_INTEGER }).items;
  }

  async addNotification(n: Omit<NotificationRecord, "id">) {
    const ref = await db().collection(NOTIFICATIONS).add(n);
    return { ...n, id: ref.id };
  }

  async listNotifications({ bookingId, limit }: { bookingId?: string; limit: number }) {
    const col = db().collection(NOTIFICATIONS);
    if (bookingId) {
      // Equality-only query: no composite index needed. A booking has a handful of messages, so sort here.
      const snap = await col.where("bookingId", "==", bookingId.toUpperCase()).get();
      return snap.docs
        .map((d) => ({ ...(d.data() as Omit<NotificationRecord, "id">), id: d.id }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    }
    const snap = await col.orderBy("createdAt", "desc").limit(limit).get();
    return snap.docs.map((d) => ({ ...(d.data() as Omit<NotificationRecord, "id">), id: d.id }));
  }

  async count() {
    const snap = await db().collection(BOOKINGS).count().get();
    return snap.data().count;
  }

  async reset(bookings: Booking[], notifications: Omit<NotificationRecord, "id">[]) {
    const firestore = db();
    for (const name of [BOOKINGS, NOTIFICATIONS, COUNTERS]) {
      const refs = await firestore.collection(name).listDocuments();
      for (let i = 0; i < refs.length; i += 400) {
        const batch = firestore.batch();
        refs.slice(i, i + 400).forEach((r) => batch.delete(r));
        await batch.commit();
      }
    }
    const writes: [string, string | null, object][] = [
      ...bookings.map((b): [string, string, object] => [BOOKINGS, b.id, b]),
      ...notifications.map((n): [string, null, object] => [NOTIFICATIONS, null, n]),
    ];
    for (let i = 0; i < writes.length; i += 400) {
      const batch = firestore.batch();
      for (const [col, id, data] of writes.slice(i, i + 400)) {
        const ref = id ? firestore.collection(col).doc(id) : firestore.collection(col).doc();
        batch.set(ref, data);
      }
      await batch.commit();
    }
    const maxSeq = Math.max(0, ...bookings.map((b) => Number(b.id.replace(/\D/g, "")) - (BOOKING_ID_START - 1)));
    await firestore.collection(COUNTERS).doc("booking").set({ seq: maxSeq });
  }
}
