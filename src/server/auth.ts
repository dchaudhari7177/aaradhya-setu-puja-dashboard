import { getAuth } from "firebase-admin/auth";
import { ApiError } from "./errors";
import { adminApp } from "./firebase-admin";

/**
 * Admin access control.
 *
 * When Firebase Auth is configured (NEXT_PUBLIC_FIREBASE_API_KEY is set), every
 * API request must carry `Authorization: Bearer <Firebase ID token>`. The token
 * is verified with the Admin SDK (signature, expiry, project), and, when
 * ADMIN_EMAILS is set, the email must be on that allow-list. Without Firebase
 * config (local development, tests) the API is open and changes are recorded
 * as "Admin".
 */

export interface Actor {
  uid: string | null;
  email: string | null;
  name: string;
}

export function authEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) && process.env.AUTH_DISABLED !== "true";
}

function allowList(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireAdmin(request: Request): Promise<Actor> {
  if (!authEnabled()) return { uid: null, email: null, name: "Admin" };

  const header = request.headers.get("authorization") ?? "";
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new ApiError(401, "unauthenticated", "Please sign in to continue.");

  let decoded;
  try {
    decoded = await getAuth(adminApp()).verifyIdToken(token);
  } catch {
    throw new ApiError(401, "unauthenticated", "Your session has expired. Please sign in again.");
  }

  const email = decoded.email?.toLowerCase() ?? null;
  const allowed = allowList();
  if (allowed.length > 0 && (!email || !allowed.includes(email))) {
    throw new ApiError(403, "forbidden", "This account is not an Aaradhya Setu admin.");
  }

  const name = (decoded.name as string | undefined) || (email ? email.split("@")[0] : "Admin");
  return { uid: decoded.uid, email, name };
}
