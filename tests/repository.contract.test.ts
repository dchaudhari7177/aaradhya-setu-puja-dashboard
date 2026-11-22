import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MemoryRepository } from "@/server/adapters/memory";
import { MongoRepository } from "@/server/adapters/mongo";
import { FirestoreRepository } from "@/server/adapters/firestore";
import { ConflictError, type BookingRepository } from "@/server/repository";
import { generateSeed } from "@/server/seed-data";
import { applyListQuery, computeStats } from "@/lib/domain/query";
import type { BookingListQuery } from "@/lib/domain/types";

/**
 * Every adapter must behave exactly like the reference implementation in
 * lib/domain/query.ts. The same suite runs against the in-memory store and a
 * real mongod, which is what lets the UI trust any backend.
 */

const NOW = new Date("2026-11-22T06:30:00Z");
const seed = generateSeed(NOW);

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGODB_DB = "contract_test";
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
});

const base: BookingListQuery = { sort: "createdAt", order: "desc", page: 1, pageSize: 10 };
const QUERIES: [string, BookingListQuery][] = [
  ["default", base],
  ["status tab", { ...base, status: "Confirmed" }],
  ["search by name, case-insensitive", { ...base, q: "SHARMA" }],
  ["search by booking ID", { ...base, q: "as-10001" }],
  [
    "search by spaced phone digits",
    { ...base, q: seed.bookings[5].devotee.phone.slice(3, 8) + " " + seed.bookings[5].devotee.phone.slice(8) },
  ],
  ["search by temple city", { ...base, q: "varanasi", status: "Completed" }],
  ["puja filter", { ...base, puja: "rudrabhishek" }],
  ["date range", { ...base, from: "2026-11-20", to: "2026-11-30", sort: "pujaDate", order: "asc" }],
  ["sort by amount, page 3", { ...base, sort: "amount", order: "desc", page: 3 }],
  ["sort by devotee asc", { ...base, sort: "devotee", order: "asc", pageSize: 25 }],
  ["sort by status", { ...base, sort: "status", order: "asc", page: 2 }],
  ["page past the end", { ...base, page: 99 }],
  ["no matches", { ...base, q: "zzzz-no-such-devotee" }],
];

const adapters: [string, () => BookingRepository][] = [
  ["memory", () => new MemoryRepository()],
  ["mongodb", () => new MongoRepository()],
];
// Firestore joins the suite when the emulator is running: `npm run test:emulators`.
if (process.env.FIRESTORE_EMULATOR_HOST) adapters.push(["firestore", () => new FirestoreRepository()]);

describe.each(adapters)("%s adapter", (_name, make) => {
  let repo: BookingRepository;

  beforeEach(async () => {
    repo = make();
    await repo.reset(seed.bookings, seed.notifications);
  });

  it.each(QUERIES)("list matches the reference: %s", async (_label, query) => {
    const expected = applyListQuery(seed.bookings, query);
    const actual = await repo.list(query);
    expect(actual.items.map((b) => b.id)).toEqual(expected.items.map((b) => b.id));
    expect(actual.total).toBe(expected.total);
    expect(actual.totalPages).toBe(expected.totalPages);
    expect(actual.counts).toEqual(expected.counts);
  });

  it("round-trips a booking without losing fields", async () => {
    const original = seed.bookings.find((b) => b.status === "Completed" && b.devotee.gotra && b.wish)!;
    expect(await repo.get(original.id.toLowerCase())).toEqual(original);
    expect(await repo.get("AS-000000")).toBeNull();
  });

  it("computes the same KPIs as the reference", async () => {
    const sent = seed.notifications.filter((n) => n.status === "sent").length;
    expect(await repo.stats(NOW)).toEqual(computeStats(seed.bookings, sent, NOW));
  });

  it("exports every filtered row in order", async () => {
    const q = { q: "puja", sort: "pujaDate" as const, order: "asc" as const };
    const expected = applyListQuery(seed.bookings, { ...q, page: 1, pageSize: 1000 }).items.map((b) => b.id);
    expect((await repo.exportAll(q)).map((b) => b.id)).toEqual(expected);
  });

  it("hands out unique sequential IDs under concurrent creates", async () => {
    const template = { ...seed.bookings[0] } as Partial<(typeof seed.bookings)[0]>;
    delete template.id;
    const created = await Promise.all(
      Array.from({ length: 12 }, () => repo.create(template as Omit<(typeof seed.bookings)[0], "id">)),
    );
    const ids = created.map((b) => b.id).sort();
    expect(new Set(ids).size).toBe(12);
    expect(ids[0]).toBe(`AS-${100001 + seed.bookings.length}`);
    expect(await repo.count()).toBe(seed.bookings.length + 12);
  });

  it("lets exactly one of two racing status changes win", async () => {
    const pending = seed.bookings.find((b) => b.status === "Pending")!;
    const change = (by: string) =>
      repo.updateStatus(pending.id, {
        expected: "Pending",
        event: { from: "Pending", to: "Confirmed", at: NOW.toISOString(), by },
        set: { pandit: by, updatedAt: NOW.toISOString() },
      });
    const results = await Promise.allSettled([change("Admin A"), change("Admin B")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ConflictError);

    const after = (await repo.get(pending.id))!;
    expect(after.status).toBe("Confirmed");
    expect(after.history).toHaveLength(pending.history.length + 1);
    expect(
      await repo.updateStatus("AS-000000", {
        expected: "Pending",
        event: { from: "Pending", to: "Confirmed", at: NOW.toISOString(), by: "x" },
        set: { updatedAt: NOW.toISOString() },
      }),
    ).toBeNull();
  });

  it("lists notifications newest first, optionally per booking", async () => {
    const all = await repo.listNotifications({ limit: 5 });
    expect(all).toHaveLength(5);
    expect([...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt))).toEqual(all);

    const target = seed.bookings.find((b) => b.status === "Completed")!;
    const mine = await repo.listNotifications({ bookingId: target.id, limit: 50 });
    expect(mine.map((n) => n.template)).toEqual([
      "puja_completed",
      "puja_started",
      "booking_confirmed",
      "booking_received",
    ]);

    const added = await repo.addNotification({
      ...mine[0],
      status: "failed",
      error: "x",
      createdAt: "2030-01-01T00:00:00.000Z",
    });
    expect(added.id).toBeTruthy();
    expect((await repo.listNotifications({ limit: 1 }))[0]).toEqual(added);
  });
});
