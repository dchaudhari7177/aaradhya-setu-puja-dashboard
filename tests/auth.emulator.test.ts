import { beforeAll, describe, expect, it } from "vitest";
import { getAuth } from "firebase-admin/auth";

/**
 * End-to-end check of the API's Firebase Auth guard against the Auth emulator:
 *   npm run test:emulators
 * Skipped unless FIREBASE_AUTH_EMULATOR_HOST is set.
 */
const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const PROJECT = "demo-aaradhya-setu";

async function signUp(email: string): Promise<string> {
  const res = await fetch(`http://${host}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "test-password-123", returnSecureToken: true }),
  });
  const body = await res.json();
  if (!body.idToken) {
    // Already exists from a previous run: sign in instead.
    const again = await fetch(
      `http://${host}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "test-password-123", returnSecureToken: true }),
      },
    );
    return (await again.json()).idToken;
  }
  return body.idToken;
}

describe.skipIf(!host)("API auth guard (Firebase Auth emulator)", () => {
  let list: typeof import("@/app/api/bookings/route");
  let status: typeof import("@/app/api/bookings/[id]/status/route");
  let adminToken: string;
  let outsiderToken: string;

  beforeAll(async () => {
    process.env.DB_DRIVER = "memory";
    process.env.FIREBASE_PROJECT_ID = PROJECT;
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "demo-key";
    process.env.ADMIN_EMAILS = "ops.lead@aaradhyasetu.test, second.admin@aaradhyasetu.test";
    list = await import("@/app/api/bookings/route");
    status = await import("@/app/api/bookings/[id]/status/route");
    adminToken = await signUp("ops.lead@aaradhyasetu.test");
    outsiderToken = await signUp("someone@example.test");
  });

  const get = (headers: Record<string, string> = {}) =>
    list.GET(new Request("http://test.local/api/bookings?pageSize=1", { headers }));

  it("rejects requests without a token (401)", async () => {
    const res = await get();
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("unauthenticated");
  });

  it("rejects a forged token (401)", async () => {
    expect((await get({ Authorization: "Bearer not-a-real-token" })).status).toBe(401);
  });

  it("rejects a valid Firebase user who is not on the admin list (403)", async () => {
    const res = await get({ Authorization: `Bearer ${outsiderToken}` });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("forbidden");
  });

  it("is closed by default: with no ADMIN_EMAILS only the admin claim gets in", async () => {
    const saved = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = "";
    try {
      expect((await get({ Authorization: `Bearer ${adminToken}` })).status).toBe(403);

      const { adminApp } = await import("@/server/firebase-admin");
      const auth = getAuth(adminApp());
      const user = await auth.getUserByEmail("claims.admin@aaradhyasetu.test").catch(() => null);
      if (!user) await signUp("claims.admin@aaradhyasetu.test");
      const uid = (await auth.getUserByEmail("claims.admin@aaradhyasetu.test")).uid;
      await auth.setCustomUserClaims(uid, { admin: true });
      const claimToken = await signUp("claims.admin@aaradhyasetu.test"); // fresh token carries the claim
      expect((await get({ Authorization: `Bearer ${claimToken}` })).status).toBe(200);
    } finally {
      process.env.ADMIN_EMAILS = saved;
    }
  });

  it("lets an admin in and records them in the booking history", async () => {
    const ok = await get({ Authorization: `Bearer ${adminToken}` });
    expect(ok.status).toBe(200);

    const pending = await (
      await list.GET(
        new Request("http://test.local/api/bookings?status=Pending&pageSize=1", {
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
      )
    ).json();
    const id = pending.items[0].id;
    const res = await status.PATCH(
      new Request(`http://test.local/api/bookings/${id}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Confirmed", expectedStatus: "Pending" }),
      }),
      { params: Promise.resolve({ id }) } as never,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).booking.history.at(-1).by).toBe("ops.lead");
  });
});
