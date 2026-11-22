/**
 * Resets the configured database to the demo dataset.
 *   npm run seed                 # uses .env.local / environment, like the app
 *   DB_DRIVER=firestore npm run seed
 */
import mongoose from "mongoose";
import { buildRepository, selectedDriver } from "../src/server/drivers";
import { generateSeed } from "../src/server/seed-data";

async function main() {
  const repo = buildRepository(selectedDriver());
  const { bookings, notifications } = generateSeed();
  await repo.reset(bookings, notifications);
  console.log(`Seeded ${bookings.length} bookings and ${notifications.length} WhatsApp messages into ${repo.driver}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
    process.exit();
  });
