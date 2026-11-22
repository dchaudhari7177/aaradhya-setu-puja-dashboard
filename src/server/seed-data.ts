import { PUJA_CATALOG } from "@/lib/domain/catalog";
import { renderNotification, templateForStatus } from "@/lib/domain/templates";
import { BOOKING_STATUSES, type Booking, type BookingStatus, type NotificationRecord, type StatusEvent } from "@/lib/domain/types";
import { addDaysISO, todayIST } from "@/lib/format";
import { BOOKING_ID_START, formatBookingId } from "./repository";

/**
 * Deterministic demo data, generated relative to "now" so the dashboard always
 * has pujas today, this week, and in the recent past. A seeded PRNG makes every
 * reset produce the same devotees and amounts.
 */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = [
  "Aarav", "Priya", "Rohan", "Ananya", "Vikram", "Meera", "Arjun", "Kavya", "Siddharth", "Ishita",
  "Rahul", "Neha", "Aditya", "Pooja", "Karthik", "Lakshmi", "Harsh", "Divya", "Manish", "Sneha",
  "Venkatesh", "Shalini", "Gaurav", "Anjali", "Suresh", "Ritu", "Pranav", "Deepa", "Nikhil", "Bhavna",
];
const LAST = [
  "Sharma", "Iyer", "Patel", "Reddy", "Mehta", "Nair", "Kulkarni", "Gupta", "Joshi", "Rao",
  "Chatterjee", "Desai", "Verma", "Pillai", "Agarwal", "Mishra", "Banerjee", "Shetty", "Chauhan", "Menon",
];
const CITIES = [
  "Mumbai", "Pune", "Bengaluru", "Delhi", "Hyderabad", "Chennai", "Kolkata", "Ahmedabad", "Jaipur", "Lucknow",
  "Indore", "Nagpur", "Dubai", "Singapore", "London",
];
const GOTRAS = ["Kashyap", "Bharadwaj", "Vashishtha", "Gautam", "Atri", "Vishwamitra", "Jamadagni", "Shandilya", "Kaushik", "Agastya"];
const WISHES = [
  "For good health of my parents",
  "Success in my daughter's board exams",
  "Peace and harmony in the family",
  "Blessings for our new home",
  "Recovery from illness for my father",
  "Growth in the new business",
  "Smooth job transition",
  "Blessings on our wedding anniversary",
];

const HOUR = 3_600_000;

export interface SeedResult {
  bookings: Booking[];
  notifications: Omit<NotificationRecord, "id">[];
}

export function generateSeed(now: Date = new Date(), count = 72, seed = 2026): SeedResult {
  const rand = mulberry32(seed);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
  const today = todayIST(now);
  const bookings: Booking[] = [];
  const notifications: Omit<NotificationRecord, "id">[] = [];

  for (let i = 0; i < count; i++) {
    const puja = pick(PUJA_CATALOG);
    const first = pick(FIRST);
    const last = pick(LAST);
    const name = `${first} ${last}`;
    const phone = `+91${pick(["9", "8", "7", "6"])}${String(Math.floor(rand() * 1e9)).padStart(9, "0")}`;

    // Puja dates from 21 days ago to 24 days ahead; bookings are made 2 to 12 days before the puja.
    const offset = Math.floor(rand() * 46) - 21;
    const pujaDate = addDaysISO(today, offset);
    const leadDays = 2 + Math.floor(rand() * 11);
    let createdMs = Date.parse(`${addDaysISO(pujaDate, -leadDays)}T04:30:00Z`) + Math.floor(rand() * 12 * HOUR);
    if (createdMs > now.getTime() - HOUR) createdMs = now.getTime() - (2 + Math.floor(rand() * 40)) * HOUR;

    const status = statusFor(offset, rand);
    const amount = Math.round(puja.price * (rand() < 0.25 ? 1 + Math.floor(rand() * 3) * 0.5 : 1));
    const pandit = BOOKING_STATUSES.indexOf(status) >= 1 ? pick(puja.pandits) : undefined;
    const familySize = Math.floor(rand() * 4);
    const sankalpNames = [name, ...Array.from({ length: familySize }, () => `${pick(FIRST)} ${last}`)].filter(
      (n, idx, arr) => arr.indexOf(n) === idx,
    );

    const history = buildHistory(status, createdMs, pujaDate, now, rand);
    bookings.push({
      id: "", // assigned below, once bookings are in creation order
      devotee: {
        name,
        phone,
        ...(rand() < 0.7 ? { email: `${first}.${last}${Math.floor(rand() * 90 + 10)}@example.com`.toLowerCase() } : {}),
        city: pick(CITIES),
        ...(rand() < 0.8 ? { gotra: pick(GOTRAS) } : {}),
      },
      puja: { slug: puja.slug, name: puja.name, category: puja.category },
      temple: puja.temple,
      pujaDate,
      amount,
      status,
      ...(pandit ? { pandit } : {}),
      sankalpNames,
      ...(rand() < 0.6 ? { wish: pick(WISHES) } : {}),
      history,
      createdAt: history[0].at,
      updatedAt: history[history.length - 1].at,
    });
  }

  // Newest bookings get the highest IDs, like a real sequence would.
  bookings.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  bookings.forEach((b, idx) => {
    b.id = formatBookingId(BOOKING_ID_START + idx);
    if (b.status === "Completed") b.videoUrl = `https://www.youtube.com/watch?v=demo-${b.id.toLowerCase()}`;
    for (const event of b.history) {
      const template = templateForStatus(event.to);
      notifications.push({
        bookingId: b.id,
        channel: "whatsapp",
        to: b.devotee.phone,
        devoteeName: b.devotee.name,
        template,
        message: renderNotification(template, b),
        status: "sent",
        providerMessageId: `wamid.SEED${b.id.replace(/\D/g, "")}${event.to.replace(/\s/g, "").toUpperCase()}`,
        createdAt: new Date(Date.parse(event.at) + 20_000).toISOString(),
      });
    }
  });

  return { bookings, notifications };
}

function statusFor(offset: number, rand: () => number): BookingStatus {
  const r = rand();
  if (offset < -3) return "Completed";
  if (offset < -1) return r < 0.85 ? "Completed" : "In Progress";
  if (offset <= 0) return r < 0.45 ? "Completed" : r < 0.8 ? "In Progress" : "Confirmed";
  if (offset <= 3) return r < 0.65 ? "Confirmed" : "Pending";
  return r < 0.45 ? "Confirmed" : "Pending";
}

function buildHistory(
  status: BookingStatus,
  createdMs: number,
  pujaDate: string,
  now: Date,
  rand: () => number,
): StatusEvent[] {
  const events: StatusEvent[] = [{ from: null, to: "Pending", at: new Date(createdMs).toISOString(), by: "Website", note: "Booking created" }];
  const target = BOOKING_STATUSES.indexOf(status);
  const pujaStart = Date.parse(`${pujaDate}T01:30:00Z`) + Math.floor(rand() * 5) * HOUR; // 7:00 IST onwards
  const cap = now.getTime() - 5 * 60_000;
  const times = [
    createdMs,
    createdMs + (1 + rand() * 20) * HOUR, // confirmed within a day
    pujaStart, // started on the puja day
    pujaStart + (1.5 + rand() * 2) * HOUR, // completed a couple of hours later
  ];
  for (let i = 1; i <= target; i++) {
    const at = Math.min(Math.max(times[i], Date.parse(events[i - 1].at) + 10 * 60_000), cap);
    events.push({ from: BOOKING_STATUSES[i - 1], to: BOOKING_STATUSES[i], at: new Date(at).toISOString(), by: rand() < 0.5 ? "Ops Team" : "Admin" });
  }
  return events;
}
