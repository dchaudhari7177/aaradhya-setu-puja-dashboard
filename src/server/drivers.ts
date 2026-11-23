import type { BookingRepository } from "./repository";
import { MemoryRepository } from "./adapters/memory";
import { MongoRepository } from "./adapters/mongo";
import { FirestoreRepository, firestoreConfigured } from "./adapters/firestore";

export type Driver = BookingRepository["driver"];

/**
 * Picks the storage adapter for the environment:
 *   - DB_DRIVER=mongodb | firestore | memory always wins;
 *   - on the hosted deployment (Vercel) the app runs on Firestore;
 *   - everywhere else (local development, CI) it runs on MongoDB:
 *     MONGODB_URI if set, otherwise a local embedded mongod.
 */
export function selectedDriver(): Driver {
  const explicit = process.env.DB_DRIVER?.toLowerCase();
  if (explicit === "mongodb" || explicit === "mongo") return "mongodb";
  if (explicit === "firestore" || explicit === "firebase") return "firestore";
  if (explicit === "memory") return "memory";
  return isHosted() ? "firestore" : "mongodb";
}

/** True on Vercel (it sets VERCEL=1 for builds and functions). */
export function isHosted(): boolean {
  return Boolean(process.env.VERCEL);
}

export function buildRepository(driver: Driver): BookingRepository {
  switch (driver) {
    case "firestore":
      if (!firestoreConfigured()) {
        throw new Error(
          "Firestore is selected but no Firebase service account is configured. Set FIREBASE_SERVICE_ACCOUNT (JSON or base64) or FIREBASE_SERVICE_ACCOUNT_FILE.",
        );
      }
      return new FirestoreRepository();
    case "memory":
      return new MemoryRepository();
    default:
      return new MongoRepository();
  }
}
