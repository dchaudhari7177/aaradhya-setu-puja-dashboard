import { statusChangeSchema } from "@/lib/domain/validation";
import { changeStatus } from "@/server/bookings-service";
import { getRepository } from "@/server/db";
import { route } from "@/server/route";

/**
 * PATCH /api/bookings/:id/status
 * Body: { status, expectedStatus, note?, pandit?, videoUrl? }
 *
 * 200 with { booking, notification }   on success
 * 409 conflict                          if the booking changed since the admin loaded it
 * 422 invalid_transition                if the move skips a step or a rollback has no note
 */
export const PATCH = route<RouteContext<"/api/bookings/[id]/status">>(async (request, { params, actor }) => {
  const { id } = await params;
  const change = statusChangeSchema.parse(await request.json());
  const repo = await getRepository();
  return Response.json(await changeStatus({ repo, actor: actor.name }, id, change));
});
