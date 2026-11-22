import { fieldErrors, parseListQuery } from "@/lib/domain/validation";
import { toCsv } from "@/lib/csv";
import { getRepository } from "@/server/db";
import { ApiError, route } from "@/server/errors";

/** GET /api/bookings/export?<same filters as the list>: CSV of every matching booking. */
export const GET = route(async (request: Request) => {
  const parsed = parseListQuery(new URL(request.url).searchParams);
  if (!parsed.success) throw new ApiError(400, "invalid_query", "Invalid export parameters.", fieldErrors(parsed.error));
  const repo = await getRepository();
  const rows = await repo.exportAll(parsed.data);

  const csv = toCsv(
    ["Booking ID", "Devotee", "Phone", "City", "Puja", "Category", "Temple", "Puja Date", "Amount (INR)", "Status", "Pandit", "Created At"],
    rows.map((b) => [
      b.id,
      b.devotee.name,
      b.devotee.phone,
      b.devotee.city,
      b.puja.name,
      b.puja.category,
      `${b.temple.name}, ${b.temple.city}`,
      b.pujaDate,
      b.amount,
      b.status,
      b.pandit ?? "",
      b.createdAt,
    ]),
  );
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="puja-bookings-${stamp}.csv"`,
    },
  });
});
