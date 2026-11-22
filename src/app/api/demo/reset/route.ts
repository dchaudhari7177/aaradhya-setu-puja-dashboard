import { getRepository } from "@/server/db";
import { ApiError, route } from "@/server/errors";
import { generateSeed } from "@/server/seed-data";

/**
 * POST /api/demo/reset: restore the demo dataset, so a reviewer can play with
 * the workflow freely. Disabled when DEMO_RESET=off.
 */
export const POST = route(async () => {
  if (process.env.DEMO_RESET === "off") throw new ApiError(403, "disabled", "Demo reset is disabled on this deployment.");
  const repo = await getRepository();
  const { bookings, notifications } = generateSeed();
  await repo.reset(bookings, notifications);
  return Response.json({ ok: true, bookings: bookings.length, notifications: notifications.length });
});
