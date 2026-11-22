import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "@/server/adapters/memory";
import { changeStatus, createBooking, resendLatest } from "@/server/bookings-service";
import { ApiError } from "@/server/errors";
import { ConflictError } from "@/server/repository";
import { createBookingSchema, statusChangeSchema, type StatusChangeInput } from "@/lib/domain/validation";

let repo: MemoryRepository;
let tick = 0;
const ctx = () => ({ repo, now: () => new Date(Date.UTC(2026, 10, 22, 10, 0, tick++)) });

const input = (phone = "9876543210") =>
  createBookingSchema.parse({
    devotee: { name: "Meera Krishnan", phone, city: "Mumbai" },
    pujaSlug: "rudrabhishek",
    pujaDate: "2026-11-24",
    amount: 2100,
    sankalpNames: ["Meera Krishnan"],
  });

const move = (id: string, body: StatusChangeInput) => changeStatus(ctx(), id, statusChangeSchema.parse(body));

beforeEach(async () => {
  repo = new MemoryRepository();
  await repo.reset([], []);
  tick = 0;
});

describe("createBooking", () => {
  it("creates a Pending booking with a sequential ID and messages the devotee", async () => {
    const { booking, notification } = await createBooking(ctx(), input());
    expect(booking.id).toBe("AS-100001");
    expect(booking.status).toBe("Pending");
    expect(booking.temple.name).toBe("Kashi Vishwanath Temple");
    expect(booking.history).toHaveLength(1);
    expect(notification).toMatchObject({ template: "booking_received", status: "sent", to: "+919876543210" });
    expect((await createBooking(ctx(), input())).booking.id).toBe("AS-100002");
  });
});

describe("changeStatus", () => {
  it("walks the full workflow, sending one templated message per stage", async () => {
    const { booking } = await createBooking(ctx(), input());
    const confirmed = await move(booking.id, { status: "Confirmed", expectedStatus: "Pending" });
    expect(confirmed.booking.pandit).toBe("Pt. Shivnarayan Tiwari"); // auto-assigned from the temple's list
    await move(booking.id, { status: "In Progress", expectedStatus: "Confirmed" });
    const done = await move(booking.id, {
      status: "Completed",
      expectedStatus: "In Progress",
      videoUrl: "https://youtu.be/abc123",
    });

    expect(done.booking.status).toBe("Completed");
    expect(done.booking.history.map((h) => h.to)).toEqual(["Pending", "Confirmed", "In Progress", "Completed"]);
    expect(done.notification?.message).toContain("https://youtu.be/abc123");

    const log = await repo.listNotifications({ bookingId: booking.id, limit: 10 });
    expect(log.map((n) => n.template)).toEqual(["puja_completed", "puja_started", "booking_confirmed", "booking_received"]);
  });

  it("keeps an explicitly chosen pandit", async () => {
    const { booking } = await createBooking(ctx(), input());
    const res = await move(booking.id, { status: "Confirmed", expectedStatus: "Pending", pandit: "Pt. Raghav Mishra" });
    expect(res.booking.pandit).toBe("Pt. Raghav Mishra");
    expect(res.notification?.message).toContain("Pt. Raghav Mishra");
  });

  it("records rollbacks with their note but does not message the devotee", async () => {
    const { booking } = await createBooking(ctx(), input());
    await move(booking.id, { status: "Confirmed", expectedStatus: "Pending" });
    const back = await move(booking.id, { status: "Pending", expectedStatus: "Confirmed", note: "Devotee asked to change the date" });
    expect(back.notification).toBeNull();
    expect(back.booking.history.at(-1)).toMatchObject({ from: "Confirmed", to: "Pending", note: "Devotee asked to change the date" });
    expect(await repo.listNotifications({ bookingId: booking.id, limit: 10 })).toHaveLength(2);
  });

  it("rejects skipped steps with a 422 and stale updates with a conflict", async () => {
    const { booking } = await createBooking(ctx(), input());
    await expect(move(booking.id, { status: "Completed", expectedStatus: "Pending" })).rejects.toMatchObject({
      status: 422,
      code: "invalid_transition",
    });
    await move(booking.id, { status: "Confirmed", expectedStatus: "Pending" });
    await expect(move(booking.id, { status: "Confirmed", expectedStatus: "Pending" })).rejects.toBeInstanceOf(ConflictError);
  });

  it("returns 404 for unknown bookings", async () => {
    await expect(move("AS-999999", { status: "Confirmed", expectedStatus: "Pending" })).rejects.toBeInstanceOf(ApiError);
  });
});

describe("notification delivery", () => {
  it("stores failed deliveries and can resend", async () => {
    const { booking, notification } = await createBooking(ctx(), input("9876500000")); // simulated undeliverable
    expect(notification.status).toBe("failed");
    expect(notification.error).toMatch(/not a WhatsApp user/);

    await repo.reset(
      [{ ...booking, devotee: { ...booking.devotee, phone: "+919876543210" } }],
      [],
    );
    const retry = await resendLatest(ctx(), booking.id);
    expect(retry).toMatchObject({ status: "sent", template: "booking_received" });
  });

  it("records provider exceptions as failures instead of losing the status change", async () => {
    const { booking } = await createBooking(ctx(), input());
    const res = await changeStatus(
      {
        ...ctx(),
        messaging: {
          name: "broken",
          send: async () => {
            throw new Error("timeout");
          },
        },
      },
      booking.id,
      statusChangeSchema.parse({ status: "Confirmed", expectedStatus: "Pending" }),
    );
    expect(res.booking.status).toBe("Confirmed");
    expect(res.notification).toMatchObject({ status: "failed", error: "timeout" });
  });
});
