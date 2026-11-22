import { describe, expect, it } from "vitest";
import { allowedTransitions, checkTransition, nextStatus, previousStatus } from "@/lib/domain/status";
import { renderNotification, renderTemplate, templateForStatus } from "@/lib/domain/templates";
import { createBookingSchema, parseListQuery, statusChangeSchema } from "@/lib/domain/validation";
import { addDaysISO, formatINR, formatINRCompact, formatPujaDate, todayIST } from "@/lib/format";
import { toCsv } from "@/lib/csv";
import type { Booking } from "@/lib/domain/types";

describe("status workflow", () => {
  it("moves one step at a time in both directions", () => {
    expect(nextStatus("Pending")).toBe("Confirmed");
    expect(nextStatus("Completed")).toBeNull();
    expect(previousStatus("Pending")).toBeNull();
    expect(allowedTransitions("Confirmed")).toEqual(["In Progress", "Pending"]);
  });

  it("rejects skipping steps and no-op moves", () => {
    expect(checkTransition("Pending", "Completed").ok).toBe(false);
    expect(checkTransition("Confirmed", "Confirmed").ok).toBe(false);
    expect(checkTransition("Pending", "Confirmed").ok).toBe(true);
  });

  it("requires a note to roll back", () => {
    expect(checkTransition("In Progress", "Confirmed")).toMatchObject({ ok: false });
    expect(checkTransition("In Progress", "Confirmed", { note: "   " })).toMatchObject({ ok: false });
    expect(checkTransition("In Progress", "Confirmed", { note: "Started by mistake" })).toEqual({ ok: true });
  });
});

const booking: Booking = {
  id: "AS-100042",
  devotee: { name: "Meera Krishnan", phone: "+919876543210", city: "Mumbai" },
  puja: { slug: "rudrabhishek", name: "Rudrabhishek", category: "Puja" },
  temple: { name: "Kashi Vishwanath Temple", city: "Varanasi" },
  pujaDate: "2026-11-24",
  amount: 2100,
  status: "Confirmed",
  pandit: "Pt. Raghav Mishra",
  sankalpNames: [],
  history: [],
  createdAt: "2026-11-20T10:00:00.000Z",
  updatedAt: "2026-11-20T10:00:00.000Z",
};

describe("notification templates", () => {
  it("maps each status to its message", () => {
    expect(templateForStatus("Pending")).toBe("booking_received");
    expect(templateForStatus("Confirmed")).toBe("booking_confirmed");
    expect(templateForStatus("In Progress")).toBe("puja_started");
    expect(templateForStatus("Completed")).toBe("puja_completed");
  });

  it("fills devotee name, puja name and booking ID", () => {
    const msg = renderNotification("booking_confirmed", booking);
    expect(msg).toContain("Namaste Meera");
    expect(msg).toContain("*Rudrabhishek*");
    expect(msg).toContain("AS-100042");
    expect(msg).toContain("Tue, 24 Nov 2026");
    expect(msg).toContain("Pt. Raghav Mishra");
    expect(msg).not.toMatch(/\{\{/);
  });

  it("never leaks raw placeholders when a value is missing", () => {
    const msg = renderNotification("puja_completed", { ...booking, videoUrl: undefined });
    expect(msg).toContain("will be shared shortly");
    expect(renderTemplate("Hi {{ devoteeName }} {{unknown}}!", {})).toBe("Hi Devotee !");
  });
});

describe("validation", () => {
  const valid = {
    devotee: { name: "Meera Krishnan", phone: "+91 98765-43210", city: "Mumbai", email: "" },
    pujaSlug: "rudrabhishek",
    pujaDate: "2026-11-24",
    amount: "2100",
  };

  it("normalises phone numbers to E.164 and coerces the amount", () => {
    const parsed = createBookingSchema.parse(valid);
    expect(parsed.devotee.phone).toBe("+919876543210");
    expect(parsed.devotee.email).toBeUndefined();
    expect(parsed.amount).toBe(2100);
    expect(parsed.sankalpNames).toEqual([]);
  });

  it.each(["09876543210", "919876543210", "9876543210", "+91 (98765) 43210"])("accepts %s", (phone) => {
    expect(createBookingSchema.parse({ ...valid, devotee: { ...valid.devotee, phone } }).devotee.phone).toBe("+919876543210");
  });

  it.each(["12345", "5876543210", "+1 415 555 0100"])("rejects phone %s", (phone) => {
    expect(createBookingSchema.safeParse({ ...valid, devotee: { ...valid.devotee, phone } }).success).toBe(false);
  });

  it("rejects impossible dates and unknown pujas", () => {
    expect(createBookingSchema.safeParse({ ...valid, pujaDate: "2026-02-30" }).success).toBe(false);
    expect(createBookingSchema.safeParse({ ...valid, pujaSlug: "made-up" }).success).toBe(false);
  });

  it("requires expectedStatus on status changes", () => {
    expect(statusChangeSchema.safeParse({ status: "Confirmed" }).success).toBe(false);
    expect(statusChangeSchema.parse({ status: "Confirmed", expectedStatus: "Pending", videoUrl: "" }).videoUrl).toBeUndefined();
  });

  it("parses list queries with defaults and rejects bad values", () => {
    const ok = parseListQuery(new URLSearchParams("status=In%20Progress&page=2&q="));
    expect(ok.success && ok.data).toMatchObject({ status: "In Progress", page: 2, pageSize: 10, sort: "createdAt", order: "desc" });
    expect(ok.success && ok.data.q).toBeUndefined();
    expect(parseListQuery(new URLSearchParams("sort=password")).success).toBe(false);
    expect(parseListQuery(new URLSearchParams("pageSize=5000")).success).toBe(false);
  });
});

describe("formatting", () => {
  it("formats rupees the Indian way", () => {
    expect(formatINR(150000)).toBe("₹1,50,000");
    expect(formatINRCompact(159920)).toBe("₹1.6L");
    expect(formatINRCompact(2_50_00_000)).toBe("₹2.5Cr");
  });

  it("treats puja dates as calendar dates and computes today in IST", () => {
    expect(formatPujaDate("2026-11-24")).toBe("Tue, 24 Nov 2026");
    expect(addDaysISO("2026-12-30", 3)).toBe("2027-01-02");
    // 20:00 UTC on 22 Nov is 01:30 IST on 23 Nov.
    expect(todayIST(new Date("2026-11-22T20:00:00Z"))).toBe("2026-11-23");
  });

  it("escapes CSV cells and blocks formula injection without mangling phone numbers", () => {
    const csv = toCsv(["a", "b", "c"], [['He said "hi", ok', "=SUM(A1)", "+919876543210"]]);
    expect(csv).toContain('"He said ""hi"", ok"');
    expect(csv).toContain("'=SUM(A1)");
    expect(csv).toContain(",+919876543210");
  });
});
