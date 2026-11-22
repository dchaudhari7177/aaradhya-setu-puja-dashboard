import { beforeAll, describe, expect, it } from "vitest";

/**
 * Exercises the real route handlers (HTTP layer: parsing, status codes, error
 * shape) against the in-memory driver seeded with the demo data.
 */
process.env.DB_DRIVER = "memory";

const list = await import("@/app/api/bookings/route");
const detail = await import("@/app/api/bookings/[id]/route");
const status = await import("@/app/api/bookings/[id]/status/route");
const notifications = await import("@/app/api/bookings/[id]/notifications/route");
const exportCsv = await import("@/app/api/bookings/export/route");

const url = (path: string) => `http://test.local${path}`;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) }) as never;
const json = (method: string, body: unknown) =>
  ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) satisfies RequestInit;

let pendingId: string;

beforeAll(async () => {
  const res = await list.GET(new Request(url("/api/bookings?status=Pending&pageSize=1")));
  pendingId = (await res.json()).items[0].id;
});

describe("GET /api/bookings", () => {
  it("returns a page, totals and status counts", async () => {
    const res = await list.GET(new Request(url("/api/bookings?pageSize=5&sort=amount&order=desc")));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(5);
    expect(body.counts.All).toBe(body.total);
    const amounts = body.items.map((b: { amount: number }) => b.amount);
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
  });

  it("rejects unknown sort fields with 400 and field details", async () => {
    const res = await list.GET(new Request(url("/api/bookings?sort=password&page=0")));
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe("invalid_query");
    expect(Object.keys(error.details)).toEqual(expect.arrayContaining(["sort", "page"]));
  });
});

describe("POST /api/bookings", () => {
  it("creates a booking and returns 201 with Location and the WhatsApp record", async () => {
    const res = await list.POST(
      new Request(
        url("/api/bookings"),
        json("POST", {
          devotee: { name: "Kavya Iyer", phone: "+91 99000 11223", city: "Chennai" },
          pujaSlug: "navagraha-shanti",
          pujaDate: "2026-12-01",
          amount: 2501,
          sankalpNames: ["Kavya Iyer"],
        }),
      ),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(res.headers.get("Location")).toBe(`/api/bookings/${body.booking.id}`);
    expect(body.booking).toMatchObject({ status: "Pending", temple: { city: "Kumbakonam" } });
    expect(body.notification).toMatchObject({ template: "booking_received", status: "sent", to: "+919900011223" });
  });

  it("returns every invalid field at once", async () => {
    const res = await list.POST(new Request(url("/api/bookings"), json("POST", { devotee: {}, amount: -5 })));
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe("validation_failed");
    expect(Object.keys(error.details)).toEqual(
      expect.arrayContaining(["devotee.name", "devotee.phone", "devotee.city", "pujaSlug", "pujaDate", "amount"]),
    );
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await list.POST(new Request(url("/api/bookings"), { method: "POST", body: "{nope" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("bad_json");
  });
});

describe("PATCH /api/bookings/:id/status", () => {
  it("advances the booking and logs a WhatsApp message", async () => {
    const res = await status.PATCH(
      new Request(url(`/api/bookings/${pendingId}/status`), json("PATCH", { status: "Confirmed", expectedStatus: "Pending" })),
      ctx(pendingId),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.booking.status).toBe("Confirmed");
    expect(body.booking.pandit).toBeTruthy();
    expect(body.notification.template).toBe("booking_confirmed");

    const thread = await (await notifications.GET(new Request(url("/")), ctx(pendingId))).json();
    expect(thread.items[0].template).toBe("booking_confirmed");
  });

  it("returns 409 with the current booking when the status is stale", async () => {
    const res = await status.PATCH(
      new Request(url("/"), json("PATCH", { status: "Confirmed", expectedStatus: "Pending" })),
      ctx(pendingId),
    );
    expect(res.status).toBe(409);
    const { error } = await res.json();
    expect(error.code).toBe("conflict");
    expect(error.details.current.status).toBe("Confirmed");
  });

  it("returns 422 for skipped steps and 404 for unknown bookings", async () => {
    const skip = await status.PATCH(
      new Request(url("/"), json("PATCH", { status: "Completed", expectedStatus: "Confirmed" })),
      ctx(pendingId),
    );
    expect(skip.status).toBe(422);
    const missing = await status.PATCH(
      new Request(url("/"), json("PATCH", { status: "Confirmed", expectedStatus: "Pending" })),
      ctx("AS-999999"),
    );
    expect(missing.status).toBe(404);
  });
});

describe("GET /api/bookings/:id and export", () => {
  it("returns the booking with its messages, case-insensitively", async () => {
    const res = await detail.GET(new Request(url("/")), ctx(pendingId.toLowerCase()));
    const body = await res.json();
    expect(body.booking.id).toBe(pendingId);
    expect(body.notifications.length).toBeGreaterThan(0);
  });

  it("exports filtered bookings as CSV", async () => {
    const res = await exportCsv.GET(new Request(url("/api/bookings/export?status=Completed")));
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toMatch(/attachment; filename="puja-bookings-/);
    const rows = (await res.text()).trim().split("\r\n");
    expect(rows[0]).toContain("Booking ID,Devotee,Phone");
    expect(rows.slice(1).every((r) => r.includes(",Completed,"))).toBe(true);
  });
});
