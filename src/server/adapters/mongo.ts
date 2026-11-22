import type { QueryFilter, SortOrder as MongoSortOrder } from "mongoose";
import { addDaysISO, todayIST } from "@/lib/format";
import { emptyCounts, normalizeSearch, searchDigits } from "@/lib/domain/query";
import { statusIndex } from "@/lib/domain/status";
import {
  BOOKING_STATUSES,
  type Booking,
  type BookingListQuery,
  type BookingStatus,
  type DashboardStats,
  type NotificationRecord,
  type SortField,
} from "@/lib/domain/types";
import {
  BOOKING_ID_START,
  ConflictError,
  formatBookingId,
  type BookingRepository,
  type StatusUpdate,
} from "../repository";
import { connectMongo } from "./mongo-connection";
import { BookingModel, CounterModel, NotificationModel, type BookingDoc, type NotificationDoc } from "./mongo-models";

const SORT_COLUMN: Record<SortField, string> = {
  createdAt: "createdAt",
  pujaDate: "pujaDate",
  amount: "amount",
  devotee: "nameKey",
  id: "bookingId",
  status: "statusRank",
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Builds the Mongo filter for everything except the status tab (counts are grouped by status separately). */
export function buildBaseFilter(query: Omit<BookingListQuery, "page" | "pageSize">): QueryFilter<BookingDoc> {
  const filter: QueryFilter<BookingDoc> = {};
  if (query.puja) filter["puja.slug"] = query.puja;
  if (query.from || query.to) {
    filter.pujaDate = {};
    if (query.from) filter.pujaDate.$gte = query.from;
    if (query.to) filter.pujaDate.$lte = query.to;
  }
  const q = normalizeSearch(query.q);
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    const or: QueryFilter<BookingDoc>[] = [
      { bookingId: rx },
      { "devotee.name": rx },
      { "puja.name": rx },
      { "temple.name": rx },
      { "temple.city": rx },
      { "devotee.city": rx },
    ];
    const digits = searchDigits(q);
    if (digits) or.push({ "devotee.phone": new RegExp(escapeRegex(digits)) });
    filter.$or = or;
  }
  return filter;
}

type LeanBooking = BookingDoc & { _id: unknown };

function toBooking(doc: LeanBooking): Booking {
  return {
    id: doc.bookingId,
    devotee: {
      name: doc.devotee.name,
      phone: doc.devotee.phone,
      ...(doc.devotee.email ? { email: doc.devotee.email } : {}),
      city: doc.devotee.city,
      ...(doc.devotee.gotra ? { gotra: doc.devotee.gotra } : {}),
    },
    puja: { slug: doc.puja.slug, name: doc.puja.name, category: doc.puja.category },
    temple: { name: doc.temple.name, city: doc.temple.city },
    pujaDate: doc.pujaDate,
    amount: doc.amount,
    status: doc.status,
    ...(doc.pandit ? { pandit: doc.pandit } : {}),
    sankalpNames: [...(doc.sankalpNames ?? [])],
    ...(doc.wish ? { wish: doc.wish } : {}),
    ...(doc.videoUrl ? { videoUrl: doc.videoUrl } : {}),
    history: (doc.history ?? []).map((h) => ({
      from: h.from ?? null,
      to: h.to,
      at: new Date(h.at).toISOString(),
      by: h.by,
      ...(h.note ? { note: h.note } : {}),
    })),
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

function toDoc(b: Booking): BookingDoc {
  return {
    bookingId: b.id,
    devotee: b.devotee,
    nameKey: b.devotee.name.toLowerCase(),
    puja: b.puja,
    temple: b.temple,
    pujaDate: b.pujaDate,
    amount: b.amount,
    status: b.status,
    statusRank: statusIndex(b.status),
    pandit: b.pandit,
    sankalpNames: b.sankalpNames,
    wish: b.wish,
    videoUrl: b.videoUrl,
    history: b.history.map((h) => ({ ...h, at: new Date(h.at) })),
    createdAt: new Date(b.createdAt),
    updatedAt: new Date(b.updatedAt),
  };
}

function toNotification(doc: NotificationDoc): NotificationRecord {
  return {
    id: String(doc._id),
    bookingId: doc.bookingId,
    channel: "whatsapp",
    to: doc.to,
    devoteeName: doc.devoteeName,
    template: doc.template,
    message: doc.message,
    status: doc.status,
    ...(doc.providerMessageId ? { providerMessageId: doc.providerMessageId } : {}),
    ...(doc.error ? { error: doc.error } : {}),
    createdAt: new Date(doc.createdAt).toISOString(),
  };
}

function sortSpec(field: SortField, order: "asc" | "desc"): Record<string, MongoSortOrder> {
  const dir = order === "asc" ? 1 : -1;
  // Booking ID tie-break keeps pagination stable when many rows share a sort value.
  return { [SORT_COLUMN[field]]: dir, bookingId: dir };
}

export class MongoRepository implements BookingRepository {
  readonly driver = "mongodb" as const;

  async list(query: BookingListQuery) {
    await connectMongo();
    const base = buildBaseFilter(query);
    const filter = query.status ? { ...base, status: query.status } : base;

    const [items, total, grouped] = await Promise.all([
      BookingModel.find(filter)
        .sort(sortSpec(query.sort, query.order))
        .skip((query.page - 1) * query.pageSize)
        .limit(query.pageSize)
        .lean<LeanBooking[]>(),
      BookingModel.countDocuments(filter),
      BookingModel.aggregate<{ _id: BookingStatus; n: number }>([
        { $match: base },
        { $group: { _id: "$status", n: { $sum: 1 } } },
      ]),
    ]);

    const counts = emptyCounts();
    for (const g of grouped) {
      counts[g._id] = g.n;
      counts.All += g.n;
    }
    return {
      items: items.map(toBooking),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      counts,
    };
  }

  async get(id: string) {
    await connectMongo();
    const doc = await BookingModel.findOne({ bookingId: id.toUpperCase() }).lean<LeanBooking>();
    return doc ? toBooking(doc) : null;
  }

  async create(data: Omit<Booking, "id">) {
    await connectMongo();
    // Atomic counter: concurrent creates can never receive the same booking ID.
    const counter = await CounterModel.findOneAndUpdate(
      { _id: "booking" },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" },
    ).lean();
    const booking: Booking = { ...data, id: formatBookingId(BOOKING_ID_START - 1 + (counter?.seq ?? 1)) };
    await BookingModel.create(toDoc(booking));
    return booking;
  }

  async updateStatus(id: string, change: StatusUpdate) {
    await connectMongo();
    const bookingId = id.toUpperCase();
    const set: Record<string, unknown> = {
      status: change.event.to,
      statusRank: statusIndex(change.event.to),
      updatedAt: new Date(change.set.updatedAt),
    };
    if (change.set.pandit) set.pandit = change.set.pandit;
    if (change.set.videoUrl) set.videoUrl = change.set.videoUrl;

    // Compare-and-set: the filter includes the status the admin saw, so a
    // concurrent change makes this match nothing instead of overwriting it.
    const updated = await BookingModel.findOneAndUpdate(
      { bookingId, status: change.expected },
      { $set: set, $push: { history: { ...change.event, at: new Date(change.event.at) } } },
      { returnDocument: "after" },
    ).lean<LeanBooking>();
    if (updated) return toBooking(updated);

    const current = await BookingModel.findOne({ bookingId }).lean<LeanBooking>();
    if (!current) return null;
    throw new ConflictError(`Booking is now ${current.status}.`, toBooking(current));
  }

  async stats(now: Date = new Date()): Promise<DashboardStats> {
    await connectMongo();
    const today = todayIST(now);
    const weekEnd = addDaysISO(today, 7);
    const [grouped, todayCount, upcomingWeekCount, notificationsSent] = await Promise.all([
      BookingModel.aggregate<{ _id: BookingStatus; n: number; revenue: number }>([
        { $group: { _id: "$status", n: { $sum: 1 }, revenue: { $sum: "$amount" } } },
      ]),
      BookingModel.countDocuments({ pujaDate: today }),
      BookingModel.countDocuments({ pujaDate: { $gte: today, $lte: weekEnd }, status: { $ne: "Completed" } }),
      NotificationModel.countDocuments({ status: "sent" }),
    ]);
    const byStatus = Object.fromEntries(BOOKING_STATUSES.map((s) => [s, 0])) as Record<BookingStatus, number>;
    let totalBookings = 0;
    let totalRevenue = 0;
    let completedRevenue = 0;
    for (const g of grouped) {
      byStatus[g._id] = g.n;
      totalBookings += g.n;
      totalRevenue += g.revenue;
      if (g._id === "Completed") completedRevenue = g.revenue;
    }
    return {
      totalBookings,
      totalRevenue,
      completedRevenue,
      byStatus,
      todayCount,
      upcomingWeekCount,
      notificationsSent,
    };
  }

  async exportAll(query: Omit<BookingListQuery, "page" | "pageSize">) {
    await connectMongo();
    const base = buildBaseFilter(query);
    const filter = query.status ? { ...base, status: query.status } : base;
    const docs = await BookingModel.find(filter)
      .sort(sortSpec(query.sort, query.order))
      .limit(10_000)
      .lean<LeanBooking[]>();
    return docs.map(toBooking);
  }

  async addNotification(n: Omit<NotificationRecord, "id">) {
    await connectMongo();
    const doc = await NotificationModel.create({ ...n, createdAt: new Date(n.createdAt) });
    return toNotification(doc.toObject() as NotificationDoc);
  }

  async listNotifications({ bookingId, limit }: { bookingId?: string; limit: number }) {
    await connectMongo();
    const docs = await NotificationModel.find(bookingId ? { bookingId: bookingId.toUpperCase() } : {})
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean<NotificationDoc[]>();
    return docs.map(toNotification);
  }

  async count() {
    await connectMongo();
    return BookingModel.estimatedDocumentCount();
  }

  async reset(bookings: Booking[], notifications: Omit<NotificationRecord, "id">[]) {
    await connectMongo();
    await Promise.all([BookingModel.deleteMany({}), NotificationModel.deleteMany({}), CounterModel.deleteMany({})]);
    await BookingModel.syncIndexes();
    await NotificationModel.syncIndexes();
    if (bookings.length) await BookingModel.insertMany(bookings.map(toDoc));
    if (notifications.length) {
      await NotificationModel.insertMany(notifications.map((n) => ({ ...n, createdAt: new Date(n.createdAt) })));
    }
    const maxSeq = Math.max(0, ...bookings.map((b) => Number(b.id.replace(/\D/g, "")) - (BOOKING_ID_START - 1)));
    await CounterModel.updateOne({ _id: "booking" }, { $set: { seq: maxSeq } }, { upsert: true });
  }
}
