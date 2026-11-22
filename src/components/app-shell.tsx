"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Database, LayoutDashboard, Menu, MessageCircle, Plus, RotateCcw, X } from "lucide-react";
import clsx from "clsx";
import { Logo } from "./logo";
import { useToast } from "./ui/toast";
import { api, notifyDataChanged } from "@/lib/api-client";

const NAV = [
  { href: "/", label: "Bookings", icon: LayoutDashboard, match: (p: string) => p === "/" || /^\/bookings\/(?!new)/.test(p) },
  { href: "/bookings/new", label: "New booking", icon: Plus, match: (p: string) => p === "/bookings/new" },
  { href: "/notifications", label: "WhatsApp log", icon: MessageCircle, match: (p: string) => p.startsWith("/notifications") },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

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
        <SidebarContent pathname={pathname} />
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
          <button className="absolute inset-0 animate-fade-in bg-maroon-950/50" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-slide-up flex-col bg-maroon-900 text-cream shadow-pop">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-4 right-3 rounded-lg p-2 hover:bg-white/10"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
            <SidebarContent pathname={pathname} />
          </aside>
        </div>
      )}

      <main className="min-w-0">{children}</main>
    </div>
  );
}

function SidebarContent({ pathname }: { pathname: string }) {
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
      <nav className="flex flex-col gap-1 px-3" aria-label="Main">
        {NAV.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
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
      <div className="mt-auto space-y-3 p-4">
        <SystemCard />
        <p className="px-1 text-xs text-cream/45">Prototype for the Aaradhya Setu SDE intern assignment.</p>
      </div>
    </>
  );
}

function SystemCard() {
  const toast = useToast();
  const router = useRouter();
  const [health, setHealth] = useState<{ driver: string; bookings: number } | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    api<{ driver: string; bookings: number }>("/api/health").then(setHealth).catch(() => setHealth(null));
  }, []);

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

  const label = health?.driver === "firestore" ? "Firestore" : health?.driver === "mongodb" ? "MongoDB" : health?.driver;
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
