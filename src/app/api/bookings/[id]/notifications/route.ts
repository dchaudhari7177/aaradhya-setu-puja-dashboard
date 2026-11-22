import { z } from "zod";
import { NOTIFICATION_TEMPLATES } from "@/lib/domain/templates";
import type { NotificationTemplateKey } from "@/lib/domain/types";
import { resendLatest } from "@/server/bookings-service";
import { getRepository } from "@/server/db";
import { route } from "@/server/route";

/** GET /api/bookings/:id/notifications: WhatsApp messages for one booking, newest first. */
export const GET = route<RouteContext<"/api/bookings/[id]/notifications">>(async (_request, { params }) => {
  const { id } = await params;
  const repo = await getRepository();
  return Response.json({ items: await repo.listNotifications({ bookingId: id, limit: 50 }) });
});

const resendSchema = z.object({
  template: z
    .enum(Object.keys(NOTIFICATION_TEMPLATES) as [NotificationTemplateKey, ...NotificationTemplateKey[]])
    .optional(),
});

/** POST /api/bookings/:id/notifications: re-send the message for the booking's current stage. */
export const POST = route<RouteContext<"/api/bookings/[id]/notifications">>(async (request, { params, actor }) => {
  const { id } = await params;
  const text = await request.text();
  const { template } = resendSchema.parse(text ? JSON.parse(text) : {});
  const repo = await getRepository();
  return Response.json(
    { notification: await resendLatest({ repo, actor: actor.name }, id, template) },
    { status: 201 },
  );
});
