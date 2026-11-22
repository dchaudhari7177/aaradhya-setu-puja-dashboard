/**
 * Core domain types shared by the API, the storage adapters and the UI.
 * Everything that crosses the network is a plain JSON-safe object: dates are
 * ISO strings, and the puja date is a calendar date ("YYYY-MM-DD") because a
 * puja happens on a day in IST, not at an instant.
 */

export const BOOKING_STATUSES = ["Pending", "Confirmed", "In Progress", "Completed"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type OfferingCategory = "Puja" | "Chadhava";

export interface Devotee {
  name: string;
  phone: string; // E.164, e.g. +919876543210
  email?: string;
  city: string;
  gotra?: string;
}

export interface StatusEvent {
  from: BookingStatus | null; // null for the creation event
  to: BookingStatus;
  at: string; // ISO timestamp
  by: string; // who made the change ("Admin", "System", ...)
  note?: string;
}

export interface Booking {
  id: string; // human friendly booking ID, e.g. "AS-100042"
  devotee: Devotee;
  puja: { slug: string; name: string; category: OfferingCategory };
  temple: { name: string; city: string };
  pujaDate: string; // YYYY-MM-DD
  amount: number; // INR, whole rupees
  status: BookingStatus;
  pandit?: string;
  sankalpNames: string[];
  wish?: string;
  videoUrl?: string;
  history: StatusEvent[];
  createdAt: string;
  updatedAt: string;
}

export type NotificationTemplateKey = "booking_received" | "booking_confirmed" | "puja_started" | "puja_completed";

export interface NotificationRecord {
  id: string;
  bookingId: string;
  channel: "whatsapp";
  to: string;
  devoteeName: string;
  template: NotificationTemplateKey;
  message: string;
  status: "sent" | "failed";
  providerMessageId?: string;
  error?: string;
  createdAt: string;
}

export const SORT_FIELDS = ["createdAt", "pujaDate", "amount", "devotee", "id", "status"] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortOrder = "asc" | "desc";

export interface BookingListQuery {
  q?: string;
  status?: BookingStatus;
  puja?: string; // puja slug
  from?: string; // puja date >= from (YYYY-MM-DD)
  to?: string; // puja date <= to (YYYY-MM-DD)
  sort: SortField;
  order: SortOrder;
  page: number;
  pageSize: number;
}

export type StatusCounts = Record<BookingStatus | "All", number>;

export interface BookingListResult {
  items: Booking[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** Counts per status for the current search/filters, ignoring the status filter itself (powers the status tabs). */
  counts: StatusCounts;
}

export interface DashboardStats {
  totalBookings: number;
  totalRevenue: number;
  completedRevenue: number;
  byStatus: Record<BookingStatus, number>;
  todayCount: number;
  upcomingWeekCount: number;
  notificationsSent: number;
}
