import { getRepository } from "@/server/db";
import { notFound, route } from "@/server/errors";

/** GET /api/bookings/:id: one booking with its full status history and WhatsApp log. */
export const GET = route(async (_request: Request, ctx: RouteContext<"/api/bookings/[id]">) => {
  const { id } = await ctx.params;
  const repo = await getRepository();
  const [booking, notifications] = await Promise.all([
    repo.get(id),
    repo.listNotifications({ bookingId: id, limit: 50 }),
  ]);
  if (!booking) throw notFound(`Booking ${id}`);
  return Response.json({ booking, notifications });
});
