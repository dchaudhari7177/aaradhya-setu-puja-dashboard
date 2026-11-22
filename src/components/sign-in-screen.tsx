"use client";

import { useState } from "react";
import {
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { KeyRound, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { clientAuth, demoLogin, googleSignInEnabled } from "@/lib/firebase-client";
import { api, ApiClientError } from "@/lib/api-client";
import { Logo } from "./logo";
import { Button } from "./ui/button";

const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "That email and password don't match an admin account.",
  "auth/wrong-password": "That email and password don't match an admin account.",
  "auth/user-not-found": "That email and password don't match an admin account.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/too-many-requests": "Too many attempts. Wait a minute and try again.",
  "auth/network-request-failed": "Can't reach Firebase. Check your connection.",
  "auth/popup-closed-by-user": "The Google window was closed before signing in.",
  "auth/operation-not-allowed": "This sign-in method isn't enabled for the project.",
  "auth/unauthorized-domain": "This domain isn't authorised for sign-in in Firebase.",
};

function message(err: unknown): string {
  const code = (err as { code?: string })?.code;
  return (code && MESSAGES[code]) || (err as Error)?.message || "Sign-in failed. Please try again.";
}

export function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"password" | "google" | "reset" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  /** After Firebase accepts the login, confirm the API accepts this account as an admin. */
  async function confirmAdmin() {
    try {
      await api("/api/health");
    } catch (err) {
      const auth = clientAuth();
      if (auth) await signOut(auth);
      throw err instanceof ApiClientError && err.status === 403
        ? new Error("This account is signed in but isn't on the admin list. Ask an owner for access.")
        : err;
    }
  }

  async function withPassword(e: React.FormEvent) {
    e.preventDefault();
    const auth = clientAuth();
    if (!auth) return;
    setBusy("password");
    setError(null);
    setInfo(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      await confirmAdmin();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(null);
    }
  }

  async function withGoogle() {
    const auth = clientAuth();
    if (!auth) return;
    setBusy("google");
    setError(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      await confirmAdmin();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(null);
    }
  }

  async function resetPassword() {
    const auth = clientAuth();
    if (!auth) return;
    if (!email.trim()) return setError("Enter your email above first, then choose “Forgot password”.");
    setBusy("reset");
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo(`If ${email.trim()} is an admin account, a reset link is on its way.`);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-maroon-900 p-10 text-cream lg:flex lg:flex-col">
        <Logo />
        <div className="my-auto max-w-md">
          <p className="text-xs font-bold tracking-[0.14em] text-marigold-500 uppercase">Operations console</p>
          <h1 className="mt-3 text-4xl leading-tight font-bold">Every puja, from booking to blessing.</h1>
          <p className="mt-4 text-cream/70">
            Confirm bookings, assign pandits, start and complete pujas, and keep every devotee informed on WhatsApp at
            each step.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-cream/80">
            {[
              "Search any booking in seconds",
              "One-step workflow with automatic updates",
              "Full history of who changed what",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <ShieldCheck className="size-4 text-marigold-500" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <svg
          aria-hidden
          viewBox="0 0 200 200"
          className="pointer-events-none absolute -right-24 -bottom-24 size-[28rem] opacity-[0.16]"
        >
          {Array.from({ length: 12 }, (_, i) => (
            <ellipse
              key={i}
              cx="100"
              cy="100"
              rx="28"
              ry="90"
              fill="none"
              stroke="#fdebd4"
              strokeWidth="0.6"
              transform={`rotate(${i * 15} 100 100)`}
            />
          ))}
        </svg>
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 rounded-2xl bg-maroon-900 p-4 text-cream lg:hidden">
            <Logo />
          </div>
          <h2 className="text-2xl font-bold">Admin sign in</h2>
          <p className="mt-1 text-sm text-muted">Use the account your team lead created for you.</p>

          <form onSubmit={withPassword} className="mt-6 space-y-4" noValidate>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Email</span>
              <span className="relative block">
                <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
                <input
                  type="email"
                  autoComplete="username"
                  required
                  className="field pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@aaradhyasetu.com"
                />
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 flex items-center justify-between text-sm font-semibold">
                Password
                <button
                  type="button"
                  onClick={resetPassword}
                  disabled={busy !== null}
                  className="text-xs font-semibold text-brand-700 hover:underline"
                >
                  Forgot password?
                </button>
              </span>
              <span className="relative block">
                <LockKeyhole className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  className="field pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </span>
            </label>

            {error && (
              <p role="alert" className="rounded-xl bg-brand-50 px-3 py-2.5 text-sm text-brand-800">
                {error}
              </p>
            )}
            {info && (
              <p role="status" className="rounded-xl bg-confirmed-bg px-3 py-2.5 text-sm text-confirmed">
                {info}
              </p>
            )}

            <Button type="submit" className="w-full" loading={busy === "password"} disabled={!email || !password}>
              Sign in
            </Button>
          </form>

          {googleSignInEnabled && (
            <>
              <div className="my-5 flex items-center gap-3 text-xs text-muted">
                <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
              </div>
              <Button variant="secondary" className="w-full" loading={busy === "google"} onClick={withGoogle}>
                <GoogleMark /> Continue with Google
              </Button>
            </>
          )}

          {demoLogin && (
            <div className="mt-6 rounded-xl border border-dashed border-line bg-sand/50 p-3.5 text-sm">
              <p className="flex items-center gap-2 font-semibold">
                <KeyRound className="size-4 text-brand-600" /> Reviewer access
              </p>
              <p className="mt-1 text-muted">
                A demo admin account is set up for the assignment review. Data can be reset from the sidebar.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-2.5"
                onClick={() => {
                  setEmail(demoLogin?.email ?? "");
                  setPassword(demoLogin?.password ?? "");
                }}
              >
                Fill in demo login
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
