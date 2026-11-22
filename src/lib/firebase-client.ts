"use client";

import { getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";

/**
 * Browser-side Firebase, used only for admin sign-in. The web config is public
 * by design (it identifies the project; security comes from Auth + the
 * server-side token check). Each NEXT_PUBLIC_ variable is referenced literally
 * so Next.js can inline it at build time.
 */
const config: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

export const authConfigured = Boolean(config.apiKey);
export const googleSignInEnabled = process.env.NEXT_PUBLIC_AUTH_GOOGLE === "true";
export const demoLogin =
  process.env.NEXT_PUBLIC_DEMO_EMAIL && process.env.NEXT_PUBLIC_DEMO_PASSWORD
    ? { email: process.env.NEXT_PUBLIC_DEMO_EMAIL, password: process.env.NEXT_PUBLIC_DEMO_PASSWORD }
    : null;

let auth: Auth | null = null;

export function clientAuth(): Auth | null {
  if (!authConfigured) return null;
  if (auth) return auth;
  auth = getAuth(getApps()[0] ?? initializeApp(config));
  const emulator = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
  if (emulator) connectAuthEmulator(auth, `http://${emulator}`, { disableWarnings: true });
  return auth;
}

/**
 * A fresh ID token for the signed-in admin (the SDK refreshes it before expiry).
 * Waits for Firebase to restore a saved session first, so requests made on the
 * first render never go out unauthenticated by accident.
 */
export async function currentIdToken(): Promise<string | null> {
  const auth = clientAuth();
  if (!auth) return null;
  await auth.authStateReady();
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}
