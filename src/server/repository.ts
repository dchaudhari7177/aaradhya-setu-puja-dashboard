import type {
  Booking,
  BookingListQuery,
  BookingListResult,
  BookingStatus,
  DashboardStats,
  NotificationRecord,
  StatusEvent,
} from "@/lib/domain/types";

/**
 * Storage port. The service layer only talks to this interface, so the app can
 * run on MongoDB (default), Firestore, or an in-memory store for tests without
 * any change above this line.
 */
export interface BookingRepository {
  readonly driver: "mongodb" | "firestore" | "memory";

  list(query: BookingListQuery): Promise<BookingListResult>;
  get(id: string): Promise<Booking | null>;
  /** Allocates the next booking ID atomically and stores the booking. */
  create(data: Omit<Booking, "id">): Promise<Booking>;
  /**
   * Compare-and-set status update: succeeds only if the stored status still
   * equals `expected`. Returns null when the booking does not exist and throws
   * ConflictError when someone else changed it first.
   */
  updateStatus(id: string, change: StatusUpdate): Promise<Booking | null>;
  stats(now?: Date): Promise<DashboardStats>;
  /** Every booking matching the filters, unpaginated (CSV export). */
  exportAll(query: Omit<BookingListQuery, "page" | "pageSize">): Promise<Booking[]>;

  addNotification(n: Omit<NotificationRecord, "id">): Promise<NotificationRecord>;
  listNotifications(opts: { bookingId?: string; limit: number }): Promise<NotificationRecord[]>;

  count(): Promise<number>;
  /** Replaces all data (seed / demo reset). */
  reset(bookings: Booking[], notifications: Omit<NotificationRecord, "id">[]): Promise<void>;
}

export interface StatusUpdate {
  expected: BookingStatus;
  event: StatusEvent;
  set: { pandit?: string; videoUrl?: string; updatedAt: string };
}

export class ConflictError extends Error {
  constructor(
    message: string,
    readonly current?: Booking,
  ) {
    super(message);
    this.name = "ConflictError";
  }
}

export const BOOKING_ID_PREFIX = "AS-";
export const BOOKING_ID_START = 100001;

export function formatBookingId(seq: number): string {
  return `${BOOKING_ID_PREFIX}${seq}`;
}
