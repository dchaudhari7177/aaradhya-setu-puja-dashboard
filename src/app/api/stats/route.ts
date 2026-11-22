import { connection } from "next/server";
import { getRepository } from "@/server/db";
import { route } from "@/server/route";

/** GET /api/stats: KPI numbers for the dashboard header. */
export const GET = route(async () => {
  await connection(); // always computed per request, never prerendered
  const repo = await getRepository();
  return Response.json(await repo.stats());
});
