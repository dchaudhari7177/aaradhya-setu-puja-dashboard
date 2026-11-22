import "server-only";
import type { BookingRepository } from "./repository";
import { buildRepository, selectedDriver } from "./drivers";
import { generateSeed } from "./seed-data";

type State = { repo?: BookingRepository; ready?: Promise<BookingRepository> };
const g = globalThis as typeof globalThis & { __repo?: State };
const state: State = (g.__repo ??= {});

/**
 * Returns the repository, seeding demo data the first time it finds an empty
 * database (disable with SEED_ON_EMPTY=false).
 */
export function getRepository(): Promise<BookingRepository> {
  state.ready ??= (async () => {
    const repo = (state.repo ??= buildRepository(selectedDriver()));
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
