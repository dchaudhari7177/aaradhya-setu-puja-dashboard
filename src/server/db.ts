import "server-only";
import type { BookingRepository } from "./repository";
import { MemoryRepository } from "./adapters/memory";
import { MongoRepository } from "./adapters/mongo";
import { FirestoreRepository, firestoreConfigured } from "./adapters/firestore";
import { generateSeed } from "./seed-data";

/**
 * Picks the storage adapter once per process:
 *   DB_DRIVER=mongodb | firestore | memory   (explicit), otherwise
 *   Firestore when Firebase credentials are present, otherwise MongoDB
 *   (MONGODB_URI, or a local embedded mongod in development).
 */
export type Driver = BookingRepository["driver"];

export function selectedDriver(): Driver {
  const explicit = process.env.DB_DRIVER?.toLowerCase();
  if (explicit === "mongodb" || explicit === "mongo") return "mongodb";
  if (explicit === "firestore" || explicit === "firebase") return "firestore";
  if (explicit === "memory") return "memory";
  return firestoreConfigured() ? "firestore" : "mongodb";
}

type State = { repo?: BookingRepository; ready?: Promise<BookingRepository> };
const g = globalThis as typeof globalThis & { __repo?: State };
const state: State = (g.__repo ??= {});

function build(driver: Driver): BookingRepository {
  switch (driver) {
    case "firestore":
      return new FirestoreRepository();
    case "memory":
      return new MemoryRepository();
    default:
      return new MongoRepository();
  }
}

/**
 * Returns the repository, seeding demo data the first time it finds an empty
 * database (disable with SEED_ON_EMPTY=false).
 */
export function getRepository(): Promise<BookingRepository> {
  state.ready ??= (async () => {
    const repo = (state.repo ??= build(selectedDriver()));
    if (process.env.SEED_ON_EMPTY !== "false" && (await repo.count()) === 0) {
      const { bookings, notifications } = generateSeed();
      await repo.reset(bookings, notifications);
      console.log(`[db] seeded ${bookings.length} demo bookings into ${repo.driver}`);
    }
    return repo;
  })().catch((err) => {
    state.ready = undefined;
    throw err;
  });
  return state.ready;
}
