/**
 * Grants (or revokes) dashboard access by setting the `admin` custom claim.
 *   npm run make-admin -- someone@example.com
 *   npm run make-admin -- someone@example.com --revoke
 * The user must already exist in Firebase Auth. They get access on their next
 * sign-in (or within the hour, when their ID token refreshes).
 */
import { getAuth } from "firebase-admin/auth";
import { adminApp } from "../src/server/firebase-admin";

async function main() {
  const email = process.argv[2];
  const revoke = process.argv.includes("--revoke");
  if (!email) throw new Error("Usage: npm run make-admin -- <email> [--revoke]");
  const auth = getAuth(adminApp());
  const user = await auth.getUserByEmail(email);
  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), admin: !revoke });
  console.log(`${revoke ? "Revoked" : "Granted"} admin access for ${email}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
