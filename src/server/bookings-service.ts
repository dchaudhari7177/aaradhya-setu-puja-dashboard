import { findPuja } from "@/lib/domain/catalog";
import { checkTransition, isRollback } from "@/lib/domain/status";
import { NOTIFICATION_TEMPLATES, renderNotification, templateForStatus } from "@/lib/domain/templates";
import type { Booking, NotificationRecord, NotificationTemplateKey } from "@/lib/domain/types";
import type { CreateBookingData, StatusChangeData } from "@/lib/domain/validation";
import { ApiError, invalidTransition, notFound } from "./errors";
import { ConflictError, type BookingRepository } from "./repository";
import { whatsapp, type MessagingProvider } from "./whatsapp";

/**
 * Business rules live here, between the HTTP handlers and the storage port:
 * workflow validation, pandit assignment, and the notification that follows
 * every forward status change.
 */

export interface ServiceContext {
  repo: BookingRepository;
  now?: () => Date;
  actor?: string;
  messaging?: MessagingProvider;
}

const clock = (ctx: ServiceContext) => (ctx.now ? ctx.now() : new Date());

export async function createBooking(ctx: ServiceContext, input: CreateBookingData) {
  const puja = findPuja(input.pujaSlug);
  if (!puja) throw new ApiError(400, "validation_failed", "Unknown puja.", { pujaSlug: "Choose a puja from the list" });

  const at = clock(ctx).toISOString();
  const booking = await ctx.repo.create({
    devotee: input.devotee,
    puja: { slug: puja.slug, name: puja.name, category: puja.category },
    temple: puja.temple,
    pujaDate: input.pujaDate,
    amount: input.amount,
    status: "Pending",
    sankalpNames: input.sankalpNames,
    ...(input.wish ? { wish: input.wish } : {}),
    history: [{ from: null, to: "Pending", at, by: ctx.actor ?? "Admin", note: "Booking created" }],
    createdAt: at,
    updatedAt: at,
  });

  const notification = await notify(ctx, booking, "booking_received");
  return { booking, notification };
}

export async function changeStatus(ctx: ServiceContext, id: string, change: StatusChangeData) {
  const current = await ctx.repo.get(id);
  if (!current) throw notFound(`Booking ${id}`);
  if (current.status !== change.expectedStatus) {
    throw new ConflictError(`Booking is now ${current.status}.`, current);
  }

  const verdict = checkTransition(current.status, change.status, { note: change.note });
  if (!verdict.ok) throw invalidTransition(verdict.reason);

  // A confirmed booking always has a pandit: use the one chosen, the one
  // already assigned, or the temple's first listed pandit.
  const pandit =
    change.status === "Confirmed"
      ? change.pandit ?? current.pandit ?? findPuja(current.puja.slug)?.pandits[0]
      : change.pandit;

  const at = clock(ctx).toISOString();
  const booking = await ctx.repo.updateStatus(current.id, {
    expected: current.status,
    event: {
      from: current.status,
      to: change.status,
      at,
      by: ctx.actor ?? "Admin",
      ...(change.note ? { note: change.note } : {}),
    },
    set: { pandit, videoUrl: change.videoUrl, updatedAt: at },
  });
  if (!booking) throw notFound(`Booking ${id}`);

  // Rollbacks are admin corrections: the devotee is not messaged about them.
  const notification = isRollback(current.status, change.status)
    ? null
    : await notify(ctx, booking, templateForStatus(change.status));

  return { booking, notification };
}

/** Renders a template for the booking, sends it through the provider and records the outcome either way. */
export async function notify(
  ctx: ServiceContext,
  booking: Booking,
  template: NotificationTemplateKey,
): Promise<NotificationRecord> {
  const message = renderNotification(template, booking);
  const provider = ctx.messaging ?? whatsapp;
  let result: Awaited<ReturnType<MessagingProvider["send"]>>;
  try {
    result = await provider.send(booking.devotee.phone, message);
  } catch (err) {
    result = { ok: false, error: err instanceof Error ? err.message : "Provider error" };
  }
  return ctx.repo.addNotification({
    bookingId: booking.id,
    channel: "whatsapp",
    to: booking.devotee.phone,
    devoteeName: booking.devotee.name,
    template,
    message,
    status: result.ok ? "sent" : "failed",
    ...(result.ok ? { providerMessageId: result.providerMessageId } : { error: result.error }),
    createdAt: clock(ctx).toISOString(),
  });
}

/** Re-sends the message for a booking's current stage (used after a failed delivery). */
export async function resendLatest(ctx: ServiceContext, id: string, template?: NotificationTemplateKey) {
  const booking = await ctx.repo.get(id);
  if (!booking) throw notFound(`Booking ${id}`);
  const key = template ?? templateForStatus(booking.status);
  if (!(key in NOTIFICATION_TEMPLATES)) throw new ApiError(400, "validation_failed", "Unknown template.");
  return notify(ctx, booking, key);
}
