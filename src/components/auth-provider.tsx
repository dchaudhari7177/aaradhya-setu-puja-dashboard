"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, type User } from "firebase/auth";
import { authConfigured, clientAuth } from "@/lib/firebase-client";
import { UNAUTHENTICATED } from "@/lib/api-client";

type Status = "loading" | "signed-in" | "signed-out" | "disabled";

interface AuthState {
  status: Status;
  user: User | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({ status: "disabled", user: null, signOut: async () => {} });

export const useAuth = () => useContext(AuthContext);

/**
 * Tracks the Firebase session. With no Firebase config the dashboard runs
 * open ("disabled"), which keeps local development and tests zero-setup.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(authConfigured ? "loading" : "disabled");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const auth = clientAuth();
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setStatus(u ? "signed-in" : "signed-out");
    });
    // The API rejected our token (revoked, expired beyond refresh, or account removed): sign out cleanly.
    const onUnauthenticated = () => void firebaseSignOut(auth);
    window.addEventListener(UNAUTHENTICATED, onUnauthenticated);
    return () => {
      unsubscribe();
      window.removeEventListener(UNAUTHENTICATED, onUnauthenticated);
    };
  }, []);

  const signOut = async () => {
    const auth = clientAuth();
    if (auth) await firebaseSignOut(auth);
  };

  return <AuthContext.Provider value={{ status, user, signOut }}>{children}</AuthContext.Provider>;
}
