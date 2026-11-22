/**
 * Invites an admin without anyone else ever knowing their password:
 *   npm run invite-admin -- someone@example.com "Their Name"
 *
 * 1. creates the Firebase Auth user if it doesn't exist (no password),
 * 2. grants the `admin` custom claim,
 * 3. asks Firebase to email a "set your password" link to that address.
 */
import { getAuth } from "firebase-admin/auth";
import { adminApp } from "../src/server/firebase-admin";

async function main() {
  const [email, displayName] = process.argv.slice(2);
  if (!email) throw new Error('Usage: npm run invite-admin -- <email> ["Display Name"]');
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY is required to send the password email.");

  const auth = getAuth(adminApp());
  let user = await auth.getUserByEmail(email).catch(() => null);
  if (!user) {
    user = await auth.createUser({ email, ...(displayName ? { displayName } : {}) });
    console.log(`Created ${email}.`);
  } else {
    console.log(`${email} already exists.`);
  }
  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), admin: true });
  console.log("Granted admin access.");

  // Firebase sends the email itself; the link never passes through this script.
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestType: "PASSWORD_RESET", email }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Could not send the password email: ${body?.error?.message ?? res.status}`);
  }
  console.log(`Sent a "set your password" email to ${email}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
