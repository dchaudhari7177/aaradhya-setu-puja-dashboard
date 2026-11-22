import { getRepository } from "@/server/db";
import { route } from "@/server/route";

/** GET /api/notifications?limit=100: the latest WhatsApp messages across all bookings. */
export const GET = route(async (request: Request) => {
  const raw = Number(new URL(request.url).searchParams.get("limit") ?? 100);
  const limit = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), 500) : 100;
  const repo = await getRepository();
  return Response.json({ items: await repo.listNotifications({ limit }) });
});
