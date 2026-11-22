import { cert, getApps, initializeApp, type App, type ServiceAccount } from "firebase-admin/app";

/**
 * One Firebase Admin app per process, shared by the Firestore adapter and the
 * auth guard. Credentials come from a service-account key (raw JSON, base64,
 * or a path) or from the three split variables. Without a key the app is
 * created with just a project ID, which is enough to verify ID tokens and to
 * talk to the local emulators.
 */

export function serviceAccount(): ServiceAccount | undefined {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (raw) {
    const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(json) as { project_id: string; client_email: string; private_key: string };
    return { projectId: parsed.project_id, clientEmail: parsed.client_email, privateKey: parsed.private_key };
  }
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
  }
  return undefined;
}

export function firebaseProjectId(): string | undefined {
  return (
    serviceAccount()?.projectId ??
    process.env.FIREBASE_PROJECT_ID ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
    (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST ? "demo-aaradhya-setu" : undefined)
  );
}

export function adminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const sa = serviceAccount();
  return initializeApp(sa ? { credential: cert(sa), projectId: sa.projectId } : { projectId: firebaseProjectId() });
}
