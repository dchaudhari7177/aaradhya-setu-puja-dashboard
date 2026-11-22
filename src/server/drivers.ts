import type { BookingRepository } from "./repository";
import { MemoryRepository } from "./adapters/memory";
import { MongoRepository } from "./adapters/mongo";
import { FirestoreRepository, firestoreConfigured } from "./adapters/firestore";

export type Driver = BookingRepository["driver"];

/**
 * Picks the storage adapter:
 *   DB_DRIVER=mongodb | firestore | memory   (explicit), otherwise
 *   Firestore when Firebase credentials are present, otherwise MongoDB
 *   (MONGODB_URI, or a local embedded mongod in development).
 */
export function selectedDriver(): Driver {
  const explicit = process.env.DB_DRIVER?.toLowerCase();
  if (explicit === "mongodb" || explicit === "mongo") return "mongodb";
  if (explicit === "firestore" || explicit === "firebase") return "firestore";
  if (explicit === "memory") return "memory";
  return firestoreConfigured() ? "firestore" : "mongodb";
}

export function buildRepository(driver: Driver): BookingRepository {
  switch (driver) {
    case "firestore":
      return new FirestoreRepository();
    case "memory":
      return new MemoryRepository();
    default:
      return new MongoRepository();
  }
}
