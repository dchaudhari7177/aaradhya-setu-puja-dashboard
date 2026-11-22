"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  Inbox,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import clsx from "clsx";
import { PUJA_CATALOG } from "@/lib/domain/catalog";
import { nextAction, nextStatus } from "@/lib/domain/status";
import {
  BOOKING_STATUSES,
  type Booking,
  type BookingListResult,
  type BookingStatus,
  type SortField,
} from "@/lib/domain/types";
import { addDaysISO, formatINR, formatPhone, formatShortDate, todayIST } from "@/lib/format";
import { notifyDataChanged, useApi } from "@/lib/api-client";
import { StatusBadge, STATUS_STYLE } from "./status-badge";
import { StatusChangeDialog, type StatusChangeResult } from "./status-change-dialog";
import { Button, buttonClass } from "./ui/button";
import { useToast } from "./ui/toast";

const PAGE_SIZES = [10, 25, 50];
const FILTER_KEYS = ["q", "status", "puja", "from", "to"] as const;

export function BookingsTable() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [, startTransition] = useTransition();

  const state = {
    q: params.get("q") ?? "",
    status: (params.get("status") as BookingStatus | null) ?? "",
    puja: params.get("puja") ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    sort: (params.get("sort") as SortField | null) ?? "createdAt",
    order: (params.get("order") as "asc" | "desc" | null) ?? "desc",
    page: Number(params.get("page") ?? 1) || 1,
    pageSize: Number(params.get("pageSize") ?? 10) || 10,
  };

  /** Writes filters to the URL (shareable, survives refresh); any filter change returns to page 1. */
  function update(patch: Partial<Record<keyof typeof state, string | number>>, resetPage = true) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === "" || v === undefined) next.delete(k);
      else next.set(k, String(v));
    }
    if (resetPage) next.delete("page");
    if (next.get("sort") === "createdAt" && next.get("order") === "desc") {
      next.delete("sort");
      next.delete("order");
    }
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  const apiUrl = useMemo(() => {
    const p = new URLSearchParams(params.toString());
    return `/api/bookings?${p.toString()}`;
  }, [params]);
  const { data, error, loading, reload, setData } = useApi<BookingListResult>(apiUrl);

  // Debounced search box, kept local so typing never waits on the network.
  const [search, setSearch] = useState(state.q);
  const [lastQ, setLastQ] = useState(state.q);
  if (lastQ !== state.q) {
    setLastQ(state.q);
    setSearch(state.q);
  }
  useEffect(() => {
    if (search === state.q) return;
    const t = setTimeout(() => update({ q: search.trim() }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed text should restart the timer
  }, [search]);

  // "/" focuses search, like most admin tools.
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const [dialog, setDialog] = useState<{ booking: Booking; to: BookingStatus } | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  /** Optimistic advance from the table: the row moves immediately and rolls back if the API refuses. */
  async function quickAdvance(booking: Booking) {
    const to = nextStatus(booking.status);
    if (!to) return;
    if (to === "Completed") return setDialog({ booking, to }); // completing asks for the video link
    const previous = data;
    setPendingIds((s) => new Set(s).add(booking.id));
    setData((d) => (d ? { ...d, items: d.items.map((b) => (b.id === booking.id ? { ...b, status: to } : b)) } : d));
    try {
      const res = await fetch(`/api/bookings/${booking.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to, expectedStatus: booking.status }),
      });
      const body = await res.json();
      if (!res.ok) throw Object.assign(new Error(body?.error?.message ?? "Update failed"), { status: res.status });
      announce(body as StatusChangeResult);
    } catch (err) {
      setData(previous);
      toast({ tone: "error", title: `Couldn't update ${booking.id}`, description: (err as Error).message });
      if ((err as { status?: number }).status === 409) notifyDataChanged();
    } finally {
      setPendingIds((s) => {
        const n = new Set(s);
        n.delete(booking.id);
        return n;
      });
    }
  }

  function announce(result: StatusChangeResult) {
    const n = result.notification;
    toast(
      n
        ? n.status === "sent"
          ? {
              tone: "whatsapp",
              title: `${result.booking.id} → ${result.booking.status}`,
              description: `WhatsApp sent to ${n.devoteeName}.`,
            }
          : {
              tone: "error",
              title: `${result.booking.id} → ${result.booking.status}`,
              description: `WhatsApp failed: ${n.error}`,
            }
        : { tone: "success", title: `${result.booking.id} moved back to ${result.booking.status}` },
    );
    notifyDataChanged(); // refresh KPIs and counts
  }

  const hasFilters = FILTER_KEYS.some((k) => params.get(k));
  const counts = data?.counts;
  const today = todayIST();
  const exportUrl = `/api/bookings/export?${new URLSearchParams(
    Object.fromEntries([...params.entries()].filter(([k]) => k !== "page" && k !== "pageSize")),
  )}`;

  return (
    <section className="card overflow-hidden" aria-label="Bookings">
      {/* Status tabs */}
      <div
        className="flex [scrollbar-width:none] gap-1 overflow-x-auto border-b border-line-soft px-3 pt-3"
        role="tablist"
        aria-label="Filter by status"
      >
        {(["", ...BOOKING_STATUSES] as const).map((s) => {
          const active = state.status === s;
          return (
            <button
              key={s || "all"}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => update({ status: s })}
              className={clsx(
                "relative flex items-center gap-2 rounded-t-lg px-3 pt-1.5 pb-2.5 text-sm font-semibold whitespace-nowrap transition-colors",
                active ? "text-ink" : "text-muted hover:text-ink",
              )}
            >
              {s && <span className={clsx("size-2 rounded-full", STATUS_STYLE[s].dot)} aria-hidden />}
              {s || "All bookings"}
              <span
                className={clsx(
                  "rounded-full px-1.5 py-px text-xs tabular-nums",
                  active ? "bg-maroon-900 text-cream" : "bg-sand text-muted",
                )}
              >
                {counts ? counts[s || "All"] : "·"}
              </span>
              {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />}
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-line-soft p-3 xl:flex-row xl:items-center">
        <div className="relative min-w-0 flex-1 xl:min-w-72">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search booking ID, devotee, phone, puja or temple"
            aria-label="Search bookings"
            className="field pr-9 pl-9"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-line px-1.5 text-xs text-muted sm:block">
            /
          </kbd>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <select
            aria-label="Filter by puja"
            className="field col-span-2 sm:w-52"
            value={state.puja}
            onChange={(e) => update({ puja: e.target.value })}
          >
            <option value="">All pujas & chadhava</option>
            {PUJA_CATALOG.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-muted">
            <span className="shrink-0">From</span>
            <input
              type="date"
              className="field sm:w-38"
              value={state.from}
              max={state.to || undefined}
              onChange={(e) => update({ from: e.target.value })}
            />
          </label>
          <label className="flex items-center gap-1.5 text-sm text-muted">
            <span className="shrink-0">To</span>
            <input
              type="date"
              className="field sm:w-38"
              value={state.to}
              min={state.from || undefined}
              onChange={(e) => update({ to: e.target.value })}
            />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-3 py-2">
        <span className="text-xs font-semibold tracking-wide text-muted uppercase">Puja date</span>
        {[
          { label: "Today", from: today, to: today },
          { label: "Next 7 days", from: today, to: addDaysISO(today, 7) },
          { label: "Last 7 days", from: addDaysISO(today, -7), to: today },
        ].map((p) => {
          const active = state.from === p.from && state.to === p.to;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => update(active ? { from: "", to: "" } : { from: p.from, to: p.to })}
              aria-pressed={active}
              className={clsx(
                "rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
                active
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-line text-muted hover:border-muted/50 hover:text-ink",
              )}
            >
              {p.label}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-1">
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              icon={<X className="size-3.5" />}
              onClick={() => {
                setSearch("");
                update({ q: "", status: "", puja: "", from: "", to: "" });
              }}
            >
              Clear filters
            </Button>
          )}
          <a href={exportUrl} className={buttonClass("ghost", "sm")} download>
            <Download className="size-3.5" aria-hidden />
            Export CSV
          </a>
        </div>
      </div>

      {/* Results */}
      <div className="relative">
        {loading && data && (
          <div className="absolute inset-x-0 top-0 z-10 h-0.5 animate-pulse bg-brand-500" aria-hidden />
        )}

        {error && !data ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !data ? (
          <TableSkeleton />
        ) : data.items.length === 0 ? (
          <EmptyState
            filtered={hasFilters}
            onClear={() => {
              setSearch("");
              update({ q: "", status: "", puja: "", from: "", to: "" });
            }}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Puja bookings</caption>
                <thead className="bg-sand/50 text-xs tracking-wide text-muted uppercase">
                  <tr>
                    <SortHeader field="id" label="Booking ID" state={state} onSort={update} />
                    <SortHeader field="devotee" label="Devotee" state={state} onSort={update} />
                    <th scope="col" className="px-3 py-2.5 font-semibold">
                      Puja
                    </th>
                    <SortHeader field="pujaDate" label="Puja date" state={state} onSort={update} />
                    <SortHeader field="amount" label="Amount" state={state} onSort={update} align="right" />
                    <SortHeader field="status" label="Status" state={state} onSort={update} />
                    <th scope="col" className="px-3 py-2.5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className={clsx("divide-y divide-line-soft transition-opacity", loading && "opacity-60")}>
                  {data.items.map((b) => (
                    <tr key={b.id} className="group transition-colors hover:bg-cream">
                      <td className="px-3 py-3 font-mono text-[0.8125rem] font-semibold whitespace-nowrap">
                        <Link href={`/bookings/${b.id}`} className="text-brand-700 hover:underline">
                          {b.id}
                        </Link>
                      </td>
                      <td className="max-w-52 px-3 py-3">
                        <p className="truncate font-semibold">{b.devotee.name}</p>
                        <p className="truncate text-xs text-muted tabular-nums">{formatPhone(b.devotee.phone)}</p>
                      </td>
                      <td className="max-w-64 px-3 py-3">
                        <p className="truncate font-medium">{b.puja.name}</p>
                        <p className="truncate text-xs text-muted">
                          {b.temple.name}, {b.temple.city}
                        </p>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap tabular-nums">
                        {formatShortDate(b.pujaDate)}
                        {b.pujaDate === today && (
                          <span className="ml-1.5 rounded bg-marigold-100 px-1.5 py-px text-[0.6875rem] font-bold text-progress">
                            TODAY
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold whitespace-nowrap tabular-nums">
                        {formatINR(b.amount)}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={b.status} />
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <RowActions booking={b} today={today} busy={pendingIds.has(b.id)} onAdvance={quickAdvance} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className={clsx("divide-y divide-line-soft md:hidden", loading && "opacity-60")}>
              {data.items.map((b) => (
                <li key={b.id} className="p-3">
                  <Link href={`/bookings/${b.id}`} className="block rounded-xl">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-semibold text-brand-700">{b.id}</p>
                        <p className="truncate font-semibold">{b.devotee.name}</p>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>
                    <p className="mt-1 truncate text-sm">{b.puja.name}</p>
                    <div className="mt-1 flex items-center justify-between text-sm text-muted">
                      <span className="tabular-nums">
                        {formatShortDate(b.pujaDate)}
                        {b.pujaDate === today && <span className="ml-1 font-bold text-progress">· Today</span>}
                      </span>
                      <span className="font-semibold text-ink tabular-nums">{formatINR(b.amount)}</span>
                    </div>
                  </Link>
                  {nextAction(b, today)?.enabled && (
                    <div className="mt-2.5">
                      <RowActions
                        booking={b}
                        today={today}
                        busy={pendingIds.has(b.id)}
                        onAdvance={quickAdvance}
                        block
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <Pagination
              result={data}
              onPage={(page) => update({ page }, false)}
              onPageSize={(pageSize) => update({ pageSize: pageSize === 10 ? "" : pageSize })}
              sortSelect={
                <select
                  aria-label="Sort by"
                  className="field h-8 w-auto py-0 text-sm md:hidden"
                  value={`${state.sort}:${state.order}`}
                  onChange={(e) => {
                    const [sort, order] = e.target.value.split(":");
                    update({ sort, order });
                  }}
                >
                  <option value="createdAt:desc">Newest first</option>
                  <option value="pujaDate:asc">Puja date ↑</option>
                  <option value="pujaDate:desc">Puja date ↓</option>
                  <option value="amount:desc">Amount ↓</option>
                  <option value="devotee:asc">Devotee A–Z</option>
                </select>
              }
            />
          </>
        )}
      </div>

      {dialog && (
        <StatusChangeDialog
          booking={dialog.booking}
          to={dialog.to}
          onClose={() => setDialog(null)}
          onDone={(result) => {
            setDialog(null);
            announce(result);
          }}
        />
      )}
    </section>
  );
}

function RowActions({
  booking,
  today,
  busy,
  onAdvance,
  block,
}: {
  booking: Booking;
  today: string;
  busy: boolean;
  onAdvance: (b: Booking) => void;
  block?: boolean;
}) {
  const action = nextAction(booking, today);
  return (
    <div className={clsx("flex items-center justify-end gap-1", block && "justify-stretch")}>
      {action?.enabled && (
        <Button
          size="sm"
          variant="secondary"
          loading={busy}
          onClick={() => onAdvance(booking)}
          className={clsx(block && "flex-1")}
          title={`Move to ${action.to}`}
        >
          {action.label}
        </Button>
      )}
      {action && !action.enabled && (
        <span className="px-2 text-xs text-muted" title="A puja can be started on its scheduled day">
          {action.reason}
        </span>
      )}
      <Link
        href={`/bookings/${booking.id}`}
        className={clsx(buttonClass("ghost", "sm"), "px-1.5")}
        aria-label={`Open booking ${booking.id}`}
      >
        <ChevronRight className="size-4" />
      </Link>
    </div>
  );
}

function SortHeader({
  field,
  label,
  state,
  onSort,
  align,
}: {
  field: SortField;
  label: string;
  state: { sort: SortField; order: "asc" | "desc" };
  onSort: (p: { sort: string; order: string }) => void;
  align?: "right";
}) {
  const active = state.sort === field;
  const Icon = !active ? ArrowUpDown : state.order === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (state.order === "asc" ? "ascending" : "descending") : "none"}
      className={clsx("px-3 py-2.5 font-semibold", align === "right" && "text-right")}
    >
      <button
        type="button"
        onClick={() =>
          onSort({
            sort: field,
            order:
              active && state.order === "asc"
                ? "desc"
                : active
                  ? "asc"
                  : field === "amount" || field === "pujaDate"
                    ? "desc"
                    : "asc",
          })
        }
        className={clsx(
          "inline-flex items-center gap-1 whitespace-nowrap uppercase hover:text-ink",
          active && "text-ink",
        )}
      >
        {label}
        <Icon className={clsx("size-3.5", !active && "opacity-40")} aria-hidden />
      </button>
    </th>
  );
}

function Pagination({
  result,
  onPage,
  onPageSize,
  sortSelect,
}: {
  result: BookingListResult;
  onPage: (p: number) => void;
  onPageSize: (s: number) => void;
  sortSelect: React.ReactNode;
}) {
  const start = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const end = Math.min(result.page * result.pageSize, result.total);
  return (
    <div className="flex flex-col gap-2.5 border-t border-line-soft px-3 py-2.5 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
      <p className="tabular-nums">
        {result.page > result.totalPages ? (
          "No rows on this page"
        ) : (
          <>
            Showing{" "}
            <span className="font-semibold text-ink">
              {start}–{end}
            </span>{" "}
            of <span className="font-semibold text-ink">{result.total}</span>
          </>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {sortSelect}
        <select
          aria-label="Rows per page"
          className="field h-8 w-auto py-0 text-sm"
          value={result.pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s} / page
            </option>
          ))}
        </select>
        <Button
          variant="secondary"
          size="sm"
          className="px-1.5"
          disabled={result.page <= 1}
          onClick={() => onPage(Math.min(result.page - 1, result.totalPages))}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="whitespace-nowrap tabular-nums">
          {Math.min(result.page, result.totalPages)} / {result.totalPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          className="px-1.5"
          disabled={result.page >= result.totalPages}
          onClick={() => onPage(result.page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3 p-4" aria-label="Loading bookings" role="status">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <span className="skeleton h-4 w-20" />
          <span className="skeleton h-4 flex-1" />
          <span className="skeleton hidden h-4 w-40 md:block" />
          <span className="skeleton h-4 w-16" />
          <span className="skeleton h-5 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-sand text-muted">
        <Inbox className="size-6" />
      </span>
      <p className="mt-3 font-display text-lg font-bold">{filtered ? "No bookings match" : "No bookings yet"}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">
        {filtered ? "Try a different search or remove a filter." : "New bookings from the website will appear here."}
      </p>
      {filtered && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center" role="alert">
      <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
        <CircleAlert className="size-6" />
      </span>
      <p className="mt-3 font-display text-lg font-bold">Couldn&apos;t load bookings</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{message}</p>
      <Button
        variant="secondary"
        size="sm"
        className="mt-4"
        icon={<RefreshCw className="size-3.5" />}
        onClick={onRetry}
      >
        Try again
      </Button>
    </div>
  );
}
