import { getRepository } from "@/server/db";
import { notFound } from "@/server/errors";
import { route } from "@/server/route";

/** GET /api/bookings/:id: one booking with its full status history and WhatsApp log. */
export const GET = route<RouteContext<"/api/bookings/[id]">>(async (_request, { params }) => {
  const { id } = await params;
  const repo = await getRepository();
  const [booking, notifications] = await Promise.all([
    repo.get(id),
    repo.listNotifications({ bookingId: id, limit: 50 }),
  ]);
  if (!booking) throw notFound(`Booking ${id}`);
  return Response.json({ booking, notifications });
});
