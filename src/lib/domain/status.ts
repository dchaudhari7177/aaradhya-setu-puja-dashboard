import { formatPujaDate, formatShortDate } from "../format";
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
  opts: { note?: string; pujaDate?: string; today?: string } = {},
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
  if (to === "In Progress" && opts.pujaDate && opts.today && !canStartOn(opts.pujaDate, opts.today)) {
    return {
      ok: false,
      reason: `This puja is scheduled for ${formatPujaDate(opts.pujaDate)}. It can be started on the puja day.`,
    };
  }
  return { ok: true };
}

/** A puja is performed on its date: it cannot be marked started before that day (IST). */
export function canStartOn(pujaDate: string, today: string): boolean {
  return pujaDate <= today;
}

export interface NextAction {
  to: BookingStatus;
  label: string;
  enabled: boolean;
  reason?: string;
}

/** The forward action an admin can take on a booking today, if any. */
export function nextAction(booking: { status: BookingStatus; pujaDate: string }, today: string): NextAction | null {
  const to = nextStatus(booking.status);
  const label = advanceLabel(booking.status);
  if (!to || !label) return null;
  if (to === "In Progress" && !canStartOn(booking.pujaDate, today)) {
    return { to, label, enabled: false, reason: `Starts ${formatShortDate(booking.pujaDate)}` };
  }
  return { to, label, enabled: true };
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
