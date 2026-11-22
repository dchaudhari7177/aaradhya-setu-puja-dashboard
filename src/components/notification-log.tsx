"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCheck, ChevronDown, CircleAlert, Inbox, RefreshCw } from "lucide-react";
import clsx from "clsx";
import { NOTIFICATION_TEMPLATES } from "@/lib/domain/templates";
import type { NotificationRecord, NotificationTemplateKey } from "@/lib/domain/types";
import { formatDateTime, formatPhone, timeAgo } from "@/lib/format";
import { useApi } from "@/lib/api-client";
import { Button } from "./ui/button";
import { WhatsAppText } from "./whatsapp-thread";

const TEMPLATE_TONE: Record<NotificationTemplateKey, string> = {
  booking_received: "bg-pending-bg text-pending",
  booking_confirmed: "bg-confirmed-bg text-confirmed",
  puja_started: "bg-progress-bg text-progress",
  puja_completed: "bg-completed-bg text-completed",
};

export function NotificationLog() {
  const [limit, setLimit] = useState(50);
  const { data, error, loading, reload } = useApi<{ items: NotificationRecord[] }>(`/api/notifications?limit=${limit}`);
  const [template, setTemplate] = useState<NotificationTemplateKey | "">("");
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const items = useMemo(
    () => (data?.items ?? []).filter((n) => (!template || n.template === template) && (!onlyFailed || n.status === "failed")),
    [data, template, onlyFailed],
  );

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line-soft p-3">
        <select
          aria-label="Filter by message type"
          className="field w-auto"
          value={template}
          onChange={(e) => setTemplate(e.target.value as NotificationTemplateKey | "")}
        >
          <option value="">All message types</option>
          {Object.entries(NOTIFICATION_TEMPLATES).map(([key, t]) => (
            <option key={key} value={key}>
              {t.title}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
          <input type="checkbox" className="accent-brand-600" checked={onlyFailed} onChange={(e) => setOnlyFailed(e.target.checked)} />
          Failed only
        </label>
        <Button variant="ghost" size="sm" className="ml-auto" icon={<RefreshCw className={clsx("size-3.5", loading && "animate-spin")} />} onClick={reload}>
          Refresh
        </Button>
      </div>

      {error && !data ? (
        <p className="p-6 text-center text-sm text-brand-800" role="alert">
          {error.message}
        </p>
      ) : !data ? (
        <div className="space-y-3 p-4" role="status" aria-label="Loading messages">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="skeleton block h-12" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-14 text-center">
          <Inbox className="size-8 text-muted" />
          <p className="mt-2 font-semibold">No messages match</p>
        </div>
      ) : (
        <ul className="divide-y divide-line-soft">
          {items.map((n) => {
            const expanded = open === n.id;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : n.id)}
                  aria-expanded={expanded}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-cream sm:px-4"
                >
                  <span className={clsx("grid size-8 shrink-0 place-items-center rounded-full", n.status === "sent" ? "bg-whatsapp/10 text-whatsapp" : "bg-brand-50 text-brand-700")}>
                    {n.status === "sent" ? <CheckCheck className="size-4" /> : <CircleAlert className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-semibold">{n.devoteeName}</span>
                      <span className={clsx("rounded-full px-2 py-px text-xs font-semibold", TEMPLATE_TONE[n.template])}>
                        {NOTIFICATION_TEMPLATES[n.template]?.title}
                      </span>
                      {n.status === "failed" && <span className="text-xs font-semibold text-brand-700">Failed</span>}
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-muted">{n.message.replace(/\*/g, "").split("\n")[0]}</span>
                  </span>
                  <span className="hidden shrink-0 text-right text-xs text-muted sm:block">
                    <span className="block font-mono font-semibold text-ink/80">{n.bookingId}</span>
                    <span title={formatDateTime(n.createdAt)}>{timeAgo(n.createdAt)}</span>
                  </span>
                  <ChevronDown className={clsx("size-4 shrink-0 text-muted transition-transform", expanded && "rotate-180")} />
                </button>
                {expanded && (
                  <div className="grid gap-4 bg-cream/60 px-3 pb-4 sm:grid-cols-[minmax(0,1fr)_14rem] sm:px-4">
                    <div className="wa-wall rounded-xl p-3">
                      <p className="max-w-[95%] rounded-xl rounded-tr-none bg-whatsapp-bubble px-3 py-2 text-[0.8125rem] leading-relaxed whitespace-pre-line shadow-sm">
                        <WhatsAppText text={n.message} />
                      </p>
                    </div>
                    <dl className="space-y-2 text-sm">
                      <Meta label="Booking">
                        <Link href={`/bookings/${n.bookingId}`} className="font-mono font-semibold text-brand-700 hover:underline">
                          {n.bookingId}
                        </Link>
                      </Meta>
                      <Meta label="To">{formatPhone(n.to)}</Meta>
                      <Meta label="Sent">{formatDateTime(n.createdAt)}</Meta>
                      <Meta label="Template">
                        <code className="text-xs">{n.template}</code>
                      </Meta>
                      {n.providerMessageId && (
                        <Meta label="Provider ID">
                          <code className="text-xs break-all">{n.providerMessageId}</code>
                        </Meta>
                      )}
                      {n.error && <Meta label="Error">{n.error}</Meta>}
                    </dl>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {data && data.items.length >= limit && (
        <div className="border-t border-line-soft p-3 text-center">
          <Button variant="secondary" size="sm" loading={loading} onClick={() => setLimit((l) => l + 50)}>
            Load older messages
          </Button>
        </div>
      )}
    </section>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
