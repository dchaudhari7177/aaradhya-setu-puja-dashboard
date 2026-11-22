import { getAuth } from "firebase-admin/auth";
import { ApiError } from "./errors";
import { adminApp } from "./firebase-admin";

/**
 * Admin access control.
 *
 * When Firebase Auth is configured (NEXT_PUBLIC_FIREBASE_API_KEY is set), every
 * API request must carry `Authorization: Bearer <Firebase ID token>`. The token
 * is verified with the Admin SDK (signature, expiry, project), and the account
 * must be on the ADMIN_EMAILS allow-list or have the `admin` custom claim
 * (set with `npm run make-admin -- <email>`). Without Firebase
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

  // Outside the try: a misconfigured server (bad key file, wrong project) is a 500, not "please sign in".
  const auth = getAuth(adminApp());
  let decoded;
  try {
    decoded = await auth.verifyIdToken(token);
  } catch (err) {
    console.warn("[auth] rejected ID token:", (err as { code?: string }).code ?? (err as Error).message);
    throw new ApiError(401, "unauthenticated", "Your session has expired. Please sign in again.");
  }

  // Secure by default: the web API key is public, so anyone can create an
  // account in the project. Only accounts on ADMIN_EMAILS or carrying the
  // `admin` custom claim get through; with neither configured, nobody does.
  const email = decoded.email?.toLowerCase() ?? null;
  const onList = email !== null && allowList().includes(email);
  if (!onList && decoded.admin !== true) {
    throw new ApiError(403, "forbidden", "This account is not an Aaradhya Setu admin.");
  }

  const name = (decoded.name as string | undefined) || (email ? email.split("@")[0] : "Admin");
  return { uid: decoded.uid, email, name };
}
