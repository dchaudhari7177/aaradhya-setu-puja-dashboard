"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Database, LayoutDashboard, LogOut, Menu, MessageCircle, Plus, RotateCcw, X } from "lucide-react";
import clsx from "clsx";
import { Logo } from "./logo";
import { useAuth } from "./auth-provider";
import { SignInScreen } from "./sign-in-screen";
import { useToast } from "./ui/toast";
import { api, notifyDataChanged, useApi } from "@/lib/api-client";

const NAV = [
  {
    href: "/",
    label: "Bookings",
    icon: LayoutDashboard,
    match: (p: string) => p === "/" || /^\/bookings\/(?!new)/.test(p),
  },
  { href: "/bookings/new", label: "New booking", icon: Plus, match: (p: string) => p === "/bookings/new" },
  {
    href: "/notifications",
    label: "WhatsApp log",
    icon: MessageCircle,
    match: (p: string) => p.startsWith("/notifications"),
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  // While Firebase restores a saved session ("loading") the dashboard frame and
  // its skeletons render as usual (and are prerendered); data requests wait for
  // the session inside api(). Only a confirmed signed-out visitor sees sign-in.
  if (status === "signed-out") return <SignInScreen />;
  return <Shell>{children}</Shell>;
}

function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[16.5rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col bg-maroon-900 text-cream lg:flex">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-maroon-800 bg-maroon-900 px-4 text-cream lg:hidden">
        <Link href="/" aria-label="Aaradhya Setu admin home">
          <Logo />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 hover:bg-white/10"
          aria-label="Open menu"
          aria-expanded={open}
        >
          <Menu className="size-5" />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            className="absolute inset-0 animate-fade-in bg-maroon-950/50"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-slide-up flex-col bg-maroon-900 text-cream shadow-pop">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-4 right-3 rounded-lg p-2 hover:bg-white/10"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <main className="min-w-0">{children}</main>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="px-5 pt-5 pb-6">
        <Link href="/" className="hidden lg:block" aria-label="Aaradhya Setu admin home">
          <Logo />
        </Link>
        <div className="lg:hidden">
          <Logo />
        </div>
      </div>
      {/* The active highlight depends on the URL, so it streams in behind Suspense; the links render immediately. */}
      <Suspense fallback={<NavLinks pathname={null} onNavigate={onNavigate} />}>
        <ActiveNavLinks onNavigate={onNavigate} />
      </Suspense>
      <div className="mt-auto space-y-3 p-4">
        <UserCard />
        <SystemCard />
        <p className="px-1 text-xs text-cream/45">Prototype for the Aaradhya Setu SDE intern assignment.</p>
      </div>
    </>
  );
}

function ActiveNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return <NavLinks pathname={usePathname()} onNavigate={onNavigate} />;
}

function NavLinks({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 px-3" aria-label="Main">
      {NAV.map(({ href, label, icon: Icon, match }) => {
        const active = pathname !== null && match(pathname);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.9375rem] font-medium transition-colors",
              active ? "bg-cream text-maroon-900 shadow-sm" : "text-cream/75 hover:bg-white/8 hover:text-cream",
            )}
          >
            <Icon className={clsx("size-[1.125rem]", active ? "text-brand-600" : "")} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserCard() {
  const { status, user, signOut } = useAuth();
  if (status !== "signed-in" || !user) return null;
  const label = user.displayName || user.email || "Admin";
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-white/5 p-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white uppercase">
        {label.charAt(0)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{label}</span>
        {user.displayName && user.email && <span className="block truncate text-xs text-cream/55">{user.email}</span>}
      </span>
      <button
        type="button"
        onClick={() => void signOut()}
        className="rounded-lg p-1.5 text-cream/70 hover:bg-white/10 hover:text-cream"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}

function SystemCard() {
  const toast = useToast();
  const router = useRouter();
  const { data: health } = useApi<{ driver: string; bookings: number }>("/api/health");
  const [resetting, setResetting] = useState(false);

  async function reset() {
    if (!confirm("Restore the 72 demo bookings? Changes you made will be replaced.")) return;
    setResetting(true);
    try {
      const res = await api<{ bookings: number }>("/api/demo/reset", { method: "POST" });
      toast({ tone: "success", title: "Demo data restored", description: `${res.bookings} bookings reloaded.` });
      notifyDataChanged();
      router.push("/");
    } catch (err) {
      toast({ tone: "error", title: "Could not reset", description: (err as Error).message });
    } finally {
      setResetting(false);
    }
  }

  const label =
    health?.driver === "firestore" ? "Firestore" : health?.driver === "mongodb" ? "MongoDB" : health?.driver;
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
      <div className="flex items-center gap-2 text-cream/80">
        <Database className="size-4" aria-hidden />
        <span>
          {health ? (
            <>
              {label} · <span className="tabular-nums">{health.bookings}</span> bookings
            </>
          ) : (
            "Connecting…"
          )}
        </span>
        <span className={clsx("ml-auto size-2 rounded-full", health ? "bg-emerald-400" : "bg-cream/30")} aria-hidden />
      </div>
      <button
        type="button"
        onClick={reset}
        disabled={resetting}
        className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 py-1.5 text-xs font-semibold text-cream/80 hover:bg-white/10 disabled:opacity-60"
      >
        <RotateCcw className={clsx("size-3.5", resetting && "animate-spin")} aria-hidden />
        Reset demo data
      </button>
    </div>
  );
}
