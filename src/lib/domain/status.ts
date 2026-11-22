import { BOOKING_STATUSES, type BookingStatus } from "./types";

/**
 * The booking workflow is a straight line:
 *
 *   Pending -> Confirmed -> In Progress -> Completed
 *
 * An admin may move a booking one step forward, or one step back to correct a
 * mistake (a rollback must carry a note so the history explains itself).
 * Jumping steps is rejected: every booking passes through every stage, which
 * is what makes the notification sequence the devotee receives trustworthy.
 */

export function statusIndex(status: BookingStatus): number {
  return BOOKING_STATUSES.indexOf(status);
}

export function nextStatus(status: BookingStatus): BookingStatus | null {
  return BOOKING_STATUSES[statusIndex(status) + 1] ?? null;
}

export function previousStatus(status: BookingStatus): BookingStatus | null {
  const i = statusIndex(status);
  return i > 0 ? BOOKING_STATUSES[i - 1] : null;
}

export function allowedTransitions(status: BookingStatus): BookingStatus[] {
  return [nextStatus(status), previousStatus(status)].filter((s): s is BookingStatus => s !== null);
}

export function isRollback(from: BookingStatus, to: BookingStatus): boolean {
  return statusIndex(to) < statusIndex(from);
}

export type TransitionCheck = { ok: true } | { ok: false; reason: string };

export function checkTransition(
  from: BookingStatus,
  to: BookingStatus,
  opts: { note?: string } = {},
): TransitionCheck {
  if (from === to) return { ok: false, reason: `Booking is already ${to}.` };
  if (!allowedTransitions(from).includes(to)) {
    return {
      ok: false,
      reason: `Cannot move from ${from} to ${to}. Bookings move one step at a time (${BOOKING_STATUSES.join(" → ")}).`,
    };
  }
  if (isRollback(from, to) && !opts.note?.trim()) {
    return { ok: false, reason: "Moving a booking back needs a short note explaining why." };
  }
  return { ok: true };
}

/** Label for the primary "advance" button on a booking. */
export function advanceLabel(status: BookingStatus): string | null {
  switch (status) {
    case "Pending":
      return "Confirm booking";
    case "Confirmed":
      return "Start puja";
    case "In Progress":
      return "Mark completed";
    default:
      return null;
  }
}
