import mongoose from "mongoose";
import path from "node:path";

/**
 * One shared Mongoose connection per server process. Next.js dev mode reloads
 * modules on every edit, so the connection promise lives on globalThis or each
 * reload would open a new pool.
 *
 * With no MONGODB_URI in development, a real `mongod` is started locally via
 * mongodb-memory-server with an on-disk data directory (.data/mongo), so the
 * project runs with `npm install && npm run dev` and data survives restarts.
 */

type Cache = { promise?: Promise<typeof mongoose>; embeddedUri?: string };
const g = globalThis as typeof globalThis & { __mongo?: Cache };
const cache: Cache = (g.__mongo ??= {});

const EMBEDDED_PORT = Number(process.env.EMBEDDED_MONGO_PORT ?? 27031);

export function connectMongo(): Promise<typeof mongoose> {
  cache.promise ??= open().catch((err) => {
    cache.promise = undefined; // allow a retry on the next request
    throw err;
  });
  return cache.promise;
}

async function open(): Promise<typeof mongoose> {
  mongoose.set("strictQuery", true);
  const uri = process.env.MONGODB_URI || (await embeddedUri());
  return mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB || "aaradhya_setu",
    serverSelectionTimeoutMS: 8000,
    maxPoolSize: 10,
  });
}

export function usingEmbeddedMongo(): boolean {
  return !process.env.MONGODB_URI;
}

async function embeddedUri(): Promise<string> {
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_EMBEDDED_MONGO) {
    throw new Error(
      "MONGODB_URI is not set. Set it to a MongoDB / Atlas connection string, or set DB_DRIVER=firestore with Firebase credentials.",
    );
  }
  if (cache.embeddedUri) return cache.embeddedUri;

  const uri = `mongodb://127.0.0.1:${EMBEDDED_PORT}/`;
  // Another dev process (or a previous hot reload) may already own the local mongod.
  if (await reachable(uri)) return (cache.embeddedUri = uri);

  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const dbPath = path.join(process.cwd(), ".data", "mongo");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(dbPath, { recursive: true });
  const server = await MongoMemoryServer.create({
    instance: { port: EMBEDDED_PORT, dbPath, storageEngine: "wiredTiger" },
  });
  console.log(`[db] started local MongoDB at ${server.getUri()} (data in .data/mongo)`);
  return (cache.embeddedUri = uri);
}

async function reachable(uri: string): Promise<boolean> {
  const probe = mongoose.createConnection(uri, { serverSelectionTimeoutMS: 700 });
  try {
    await probe.asPromise();
    return true;
  } catch {
    return false;
  } finally {
    await probe.close().catch(() => {});
  }
}
