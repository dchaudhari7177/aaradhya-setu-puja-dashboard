import { createBookingSchema, parseListQuery } from "@/lib/domain/validation";
import { createBooking } from "@/server/bookings-service";
import { getRepository } from "@/server/db";
import { ApiError } from "@/server/errors";
import { route } from "@/server/route";
import { fieldErrors } from "@/lib/domain/validation";

/**
 * GET /api/bookings?q=&status=&puja=&from=&to=&sort=&order=&page=&pageSize=
 * Paginated, filtered, sorted list plus per-status counts for the tabs.
 */
export const GET = route(async (request: Request) => {
  const parsed = parseListQuery(new URL(request.url).searchParams);
  if (!parsed.success) {
    throw new ApiError(400, "invalid_query", "Invalid list parameters.", fieldErrors(parsed.error));
  }
  const repo = await getRepository();
  return Response.json(await repo.list(parsed.data));
});

/** POST /api/bookings: create a booking (starts as Pending and messages the devotee). */
export const POST = route(async (request, { actor }) => {
  const body = createBookingSchema.parse(await request.json());
  const repo = await getRepository();
  const result = await createBooking({ repo, actor: actor.name }, body);
  return Response.json(result, { status: 201, headers: { Location: `/api/bookings/${result.booking.id}` } });
});
