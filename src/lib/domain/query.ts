import { addDaysISO, todayIST } from "../format";
import {
  BOOKING_STATUSES,
  type Booking,
  type BookingListQuery,
  type BookingListResult,
  type DashboardStats,
  type SortField,
  type StatusCounts,
} from "./types";

/**
 * Reference implementation of search / filter / sort / paginate over an
 * in-memory list. The in-memory and Firestore adapters use it directly; the
 * MongoDB adapter translates the same query into a database query, and the
 * contract tests assert both produce identical results.
 */

export function emptyCounts(): StatusCounts {
  return { All: 0, Pending: 0, Confirmed: 0, "In Progress": 0, Completed: 0 };
}

export function normalizeSearch(q: string | undefined): string {
  return (q ?? "").trim().toLowerCase();
}

/** Digits-only form of a search, so "98765 43210" finds +919876543210. */
export function searchDigits(q: string): string {
  const digits = q.replace(/\D/g, "");
  return digits.length >= 4 && digits.length >= q.replace(/[\s+\-()]/g, "").length ? digits : "";
}

export function matchesSearch(b: Booking, q: string): boolean {
  if (!q) return true;
  const digits = searchDigits(q);
  if (digits && b.devotee.phone.includes(digits)) return true;
  return [b.id, b.devotee.name, b.puja.name, b.temple.name, b.temple.city, b.devotee.city].some((f) =>
    f.toLowerCase().includes(q),
  );
}

function matchesNonStatusFilters(b: Booking, query: BookingListQuery, q: string): boolean {
  if (query.puja && b.puja.slug !== query.puja) return false;
  if (query.from && b.pujaDate < query.from) return false;
  if (query.to && b.pujaDate > query.to) return false;
  return matchesSearch(b, q);
}

const STATUS_ORDER = Object.fromEntries(BOOKING_STATUSES.map((s, i) => [s, i]));

export function sortValue(b: Booking, field: SortField): string | number {
  switch (field) {
    case "pujaDate":
      return b.pujaDate;
    case "amount":
      return b.amount;
    case "devotee":
      return b.devotee.name.toLowerCase();
    case "id":
      return b.id;
    case "status":
      return STATUS_ORDER[b.status];
    case "createdAt":
    default:
      return b.createdAt;
  }
}

export function compareBookings(field: SortField, order: "asc" | "desc") {
  const dir = order === "asc" ? 1 : -1;
  return (a: Booking, b: Booking) => {
    const va = sortValue(a, field);
    const vb = sortValue(b, field);
    if (va < vb) return -dir;
    if (va > vb) return dir;
    // Stable tie-break on booking ID so pagination never shows a row twice.
    return a.id < b.id ? -dir : a.id > b.id ? dir : 0;
  };
}

export function applyListQuery(all: Booking[], query: BookingListQuery): BookingListResult {
  const q = normalizeSearch(query.q);
  const counts = emptyCounts();
  const matched: Booking[] = [];

  for (const b of all) {
    if (!matchesNonStatusFilters(b, query, q)) continue;
    counts.All++;
    counts[b.status]++;
    if (!query.status || b.status === query.status) matched.push(b);
  }

  matched.sort(compareBookings(query.sort, query.order));
  const total = matched.length;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const start = (query.page - 1) * query.pageSize;

  return {
    items: matched.slice(start, start + query.pageSize),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages,
    counts,
  };
}

export function computeStats(all: Booking[], notificationsSent: number, now: Date = new Date()): DashboardStats {
  const today = todayIST(now);
  const weekEnd = addDaysISO(today, 7);
  const byStatus = { Pending: 0, Confirmed: 0, "In Progress": 0, Completed: 0 };
  let totalRevenue = 0;
  let completedRevenue = 0;
  let todayCount = 0;
  let upcomingWeekCount = 0;

  for (const b of all) {
    byStatus[b.status]++;
    totalRevenue += b.amount;
    if (b.status === "Completed") completedRevenue += b.amount;
    if (b.pujaDate === today) todayCount++;
    if (b.pujaDate >= today && b.pujaDate <= weekEnd && b.status !== "Completed") upcomingWeekCount++;
  }

  return {
    totalBookings: all.length,
    totalRevenue,
    completedRevenue,
    byStatus,
    todayCount,
    upcomingWeekCount,
    notificationsSent,
  };
}
