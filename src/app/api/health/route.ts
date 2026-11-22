import { connection } from "next/server";
import { getRepository } from "@/server/db";
import { route } from "@/server/errors";

/** GET /api/health: which database is in use and whether it answers. */
export const GET = route(async () => {
  await connection();
  const started = Date.now();
  const repo = await getRepository();
  const bookings = await repo.count();
  return Response.json({ ok: true, driver: repo.driver, bookings, latencyMs: Date.now() - started });
});
