import { z } from "zod";
import { NOTIFICATION_TEMPLATES } from "@/lib/domain/templates";
import type { NotificationTemplateKey } from "@/lib/domain/types";
import { resendLatest } from "@/server/bookings-service";
import { getRepository } from "@/server/db";
import { route } from "@/server/errors";

/** GET /api/bookings/:id/notifications: WhatsApp messages for one booking, newest first. */
export const GET = route(async (_request: Request, ctx: RouteContext<"/api/bookings/[id]/notifications">) => {
  const { id } = await ctx.params;
  const repo = await getRepository();
  return Response.json({ items: await repo.listNotifications({ bookingId: id, limit: 50 }) });
});

const resendSchema = z.object({
  template: z
    .enum(Object.keys(NOTIFICATION_TEMPLATES) as [NotificationTemplateKey, ...NotificationTemplateKey[]])
    .optional(),
});

/** POST /api/bookings/:id/notifications: re-send the message for the booking's current stage. */
export const POST = route(async (request: Request, ctx: RouteContext<"/api/bookings/[id]/notifications">) => {
  const { id } = await ctx.params;
  const text = await request.text();
  const { template } = resendSchema.parse(text ? JSON.parse(text) : {});
  const repo = await getRepository();
  return Response.json({ notification: await resendLatest({ repo }, id, template) }, { status: 201 });
});
