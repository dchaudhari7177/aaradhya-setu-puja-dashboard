"use client";

import { CalendarDays, Hourglass, IndianRupee, MessageCircle, ScrollText } from "lucide-react";
import type { ComponentType } from "react";
import clsx from "clsx";
import { useApi } from "@/lib/api-client";
import { formatINR, formatINRCompact } from "@/lib/format";
import { BOOKING_STATUSES, type DashboardStats } from "@/lib/domain/types";
import { STATUS_STYLE } from "./status-badge";

export function KpiCards() {
  const { data, error } = useApi<DashboardStats>("/api/stats");

  if (error) return null; // the table shows the connection error; KPIs are secondary

  return (
    <section aria-label="Key numbers" className="space-y-3">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi
          icon={ScrollText}
          label="Total bookings"
          value={data?.totalBookings.toLocaleString("en-IN")}
          hint={data ? `${data.todayCount} puja${data.todayCount === 1 ? "" : "s"} scheduled today` : undefined}
          accent="text-brand-600 bg-brand-50"
        />
        <Kpi
          icon={IndianRupee}
          label="Booking value"
          value={data ? formatINRCompact(data.totalRevenue) : undefined}
          title={data ? formatINR(data.totalRevenue) : undefined}
          hint={data ? `${formatINRCompact(data.completedRevenue)} from completed pujas` : undefined}
          accent="text-completed bg-completed-bg"
        />
        <Kpi
          icon={Hourglass}
          label="Awaiting confirmation"
          value={data?.byStatus.Pending.toString()}
          hint="Pending bookings need a pandit"
          accent="text-pending bg-pending-bg"
        />
        <Kpi
          icon={CalendarDays}
          label="Pujas in the next 7 days"
          value={data?.upcomingWeekCount.toString()}
          hint={data ? `${data.notificationsSent} WhatsApp updates sent` : undefined}
          hintIcon={MessageCircle}
          accent="text-confirmed bg-confirmed-bg"
        />
      </div>
      <PipelineBar stats={data} />
    </section>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  hintIcon: HintIcon,
  title,
  accent,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value?: string;
  hint?: string;
  hintIcon?: ComponentType<{ className?: string }>;
  title?: string;
  accent: string;
}) {
  return (
    <div className="card flex min-w-0 flex-col gap-3 p-4">
      <div className="flex items-center gap-2.5">
        <span className={clsx("grid size-8 shrink-0 place-items-center rounded-lg", accent)}>
          <Icon className="size-4" />
        </span>
        <span className="text-sm leading-tight font-medium text-muted">{label}</span>
      </div>
      {value !== undefined ? (
        <p className="font-display text-[1.75rem] leading-none font-bold tabular-nums" title={title}>
          {value}
        </p>
      ) : (
        <span className="skeleton h-7 w-20" />
      )}
      {hint ? (
        <p className="flex items-start gap-1 text-xs leading-snug text-muted">
          {HintIcon && <HintIcon className="mt-px size-3.5 shrink-0 text-whatsapp" />}
          {hint}
        </p>
      ) : (
        <span className="skeleton h-3 w-32" />
      )}
    </div>
  );
}

/** Where every booking sits in the workflow, as one stacked bar. */
function PipelineBar({ stats }: { stats: DashboardStats | null }) {
  const total = stats?.totalBookings ?? 0;
  return (
    <div className="card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-semibold">Workflow pipeline</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {BOOKING_STATUSES.map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className={clsx("size-2 rounded-full", STATUS_STYLE[s].dot)} aria-hidden />
              {s} <span className="font-semibold text-ink tabular-nums">{stats ? stats.byStatus[s] : "–"}</span>
            </li>
          ))}
        </ul>
      </div>
      <div
        className="mt-2.5 flex h-2.5 overflow-hidden rounded-full bg-sand"
        role="img"
        aria-label={
          stats ? BOOKING_STATUSES.map((s) => `${s}: ${stats.byStatus[s]}`).join(", ") : "Loading pipeline"
        }
      >
        {stats &&
          total > 0 &&
          BOOKING_STATUSES.map((s) => (
            <span
              key={s}
              className={clsx("h-full transition-[width] duration-500 first:rounded-l-full last:rounded-r-full", STATUS_STYLE[s].dot)}
              style={{ width: `${(stats.byStatus[s] / total) * 100}%` }}
            />
          ))}
      </div>
    </div>
  );
}
