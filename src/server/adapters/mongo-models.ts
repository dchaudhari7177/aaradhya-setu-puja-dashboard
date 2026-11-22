import mongoose, { Schema, type Model, type Types } from "mongoose";
import { BOOKING_STATUSES, type Booking, type BookingStatus, type NotificationRecord } from "@/lib/domain/types";

/** Stored shape of a booking. Mirrors the API `Booking`, with real Dates and two denormalised sort keys. */
export interface BookingDoc {
  bookingId: string;
  devotee: Booking["devotee"];
  nameKey: string;
  puja: Booking["puja"];
  temple: Booking["temple"];
  pujaDate: string;
  amount: number;
  status: BookingStatus;
  statusRank: number;
  pandit?: string;
  sankalpNames: string[];
  wish?: string;
  videoUrl?: string;
  history: { from: BookingStatus | null; to: BookingStatus; at: Date; by: string; note?: string }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationDoc extends Omit<NotificationRecord, "id" | "createdAt"> {
  _id: Types.ObjectId;
  createdAt: Date;
}

const statusEventSchema = new Schema(
  {
    from: { type: String, enum: [...BOOKING_STATUSES, null], default: null },
    to: { type: String, enum: BOOKING_STATUSES, required: true },
    at: { type: Date, required: true },
    by: { type: String, required: true },
    note: String,
  },
  { _id: false },
);

const bookingSchema = new Schema<BookingDoc>(
  {
    bookingId: { type: String, required: true, unique: true },
    devotee: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: String,
      city: { type: String, required: true },
      gotra: String,
    },
    /** Lower-cased name, so sorting by devotee is case-insensitive without a collation. */
    nameKey: { type: String, required: true },
    puja: {
      slug: { type: String, required: true },
      name: { type: String, required: true },
      category: { type: String, enum: ["Puja", "Chadhava"], required: true },
    },
    temple: { name: { type: String, required: true }, city: { type: String, required: true } },
    pujaDate: { type: String, required: true }, // YYYY-MM-DD, sorts lexicographically
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: BOOKING_STATUSES, required: true },
    /** Position in the workflow, so "sort by status" follows the workflow rather than the alphabet. */
    statusRank: { type: Number, required: true },
    pandit: String,
    sankalpNames: { type: [String], default: [] },
    wish: String,
    videoUrl: String,
    history: { type: [statusEventSchema], default: [] },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  { versionKey: false, collection: "bookings" },
);

// Indexes for the dashboard's default views: newest first, by status tab, and by puja date.
bookingSchema.index({ createdAt: -1, bookingId: -1 });
bookingSchema.index({ status: 1, createdAt: -1 });
bookingSchema.index({ pujaDate: 1, status: 1 });
bookingSchema.index({ "puja.slug": 1, pujaDate: 1 });

const notificationSchema = new Schema<NotificationDoc>(
  {
    bookingId: { type: String, required: true },
    channel: { type: String, enum: ["whatsapp"], required: true },
    to: { type: String, required: true },
    devoteeName: { type: String, required: true },
    template: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, enum: ["sent", "failed"], required: true },
    providerMessageId: String,
    error: String,
    createdAt: { type: Date, required: true },
  },
  { versionKey: false, collection: "notifications" },
);
notificationSchema.index({ bookingId: 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1 });

const counterSchema = new Schema({ _id: String, seq: Number }, { versionKey: false, collection: "counters" });

// Reuse compiled models across Next.js hot reloads.
export const BookingModel: Model<BookingDoc> =
  (mongoose.models.Booking as Model<BookingDoc>) ?? mongoose.model<BookingDoc>("Booking", bookingSchema);
export const NotificationModel: Model<NotificationDoc> =
  (mongoose.models.Notification as Model<NotificationDoc>) ??
  mongoose.model<NotificationDoc>("Notification", notificationSchema);
export const CounterModel: Model<{ _id: string; seq: number }> =
  (mongoose.models.Counter as Model<{ _id: string; seq: number }>) ??
  mongoose.model<{ _id: string; seq: number }>("Counter", counterSchema);
