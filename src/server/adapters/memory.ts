import { applyListQuery, computeStats } from "@/lib/domain/query";
import type { Booking, NotificationRecord } from "@/lib/domain/types";
import {
  BOOKING_ID_START,
  ConflictError,
  formatBookingId,
  type BookingRepository,
  type StatusUpdate,
} from "../repository";

const clone = <T>(v: T): T => structuredClone(v);

/** In-process store. Used by unit tests, and as the reference the other adapters are checked against. */
export class MemoryRepository implements BookingRepository {
  readonly driver = "memory" as const;
  private bookings = new Map<string, Booking>();
  private notifications: NotificationRecord[] = [];
  private seq = BOOKING_ID_START - 1;
  private notifSeq = 0;

  async list(query: Parameters<BookingRepository["list"]>[0]) {
    return clone(applyListQuery([...this.bookings.values()], query));
  }

  async get(id: string) {
    const b = this.bookings.get(id.toUpperCase());
    return b ? clone(b) : null;
  }

  async create(data: Omit<Booking, "id">) {
    const booking: Booking = { ...clone(data), id: formatBookingId(++this.seq) };
    this.bookings.set(booking.id, booking);
    return clone(booking);
  }

  async updateStatus(id: string, change: StatusUpdate) {
    const current = this.bookings.get(id.toUpperCase());
    if (!current) return null;
    if (current.status !== change.expected) {
      throw new ConflictError(`Booking is now ${current.status}.`, clone(current));
    }
    const next: Booking = {
      ...current,
      status: change.event.to,
      pandit: change.set.pandit ?? current.pandit,
      videoUrl: change.set.videoUrl ?? current.videoUrl,
      updatedAt: change.set.updatedAt,
      history: [...current.history, change.event],
    };
    this.bookings.set(next.id, next);
    return clone(next);
  }

  async stats(now?: Date) {
    const sent = this.notifications.filter((n) => n.status === "sent").length;
    return computeStats([...this.bookings.values()], sent, now);
  }

  async exportAll(query: Parameters<BookingRepository["exportAll"]>[0]) {
    return clone(applyListQuery([...this.bookings.values()], { ...query, page: 1, pageSize: Number.MAX_SAFE_INTEGER }).items);
  }

  async addNotification(n: Omit<NotificationRecord, "id">) {
    const record = { ...clone(n), id: `ntf_${(++this.notifSeq).toString().padStart(6, "0")}` };
    this.notifications.push(record);
    return clone(record);
  }

  async listNotifications({ bookingId, limit }: { bookingId?: string; limit: number }) {
    return clone(
      this.notifications
        .filter((n) => !bookingId || n.bookingId === bookingId.toUpperCase())
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.id.localeCompare(a.id)))
        .slice(0, limit),
    );
  }

  async count() {
    return this.bookings.size;
  }

  async reset(bookings: Booking[], notifications: Omit<NotificationRecord, "id">[]) {
    this.bookings = new Map(bookings.map((b) => [b.id, clone(b)]));
    this.notifications = [];
    this.notifSeq = 0;
    const maxSeq = Math.max(BOOKING_ID_START - 1, ...bookings.map((b) => Number(b.id.replace(/\D/g, ""))));
    this.seq = maxSeq;
    for (const n of notifications) await this.addNotification(n);
  }
}
