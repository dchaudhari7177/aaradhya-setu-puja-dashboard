"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type ComponentType, type ReactNode } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Copy,
  Flame,
  Gem,
  IndianRupee,
  Landmark,
  Mail,
  MapPin,
  Phone,
  ScrollText,
  Undo2,
  UserRound,
  UsersRound,
  Video,
} from "lucide-react";
import clsx from "clsx";
import { nextAction, previousStatus, statusIndex } from "@/lib/domain/status";
import { BOOKING_STATUSES, type Booking, type BookingStatus, type NotificationRecord } from "@/lib/domain/types";
import { formatDateTime, formatINR, formatPhone, formatPujaDate, timeAgo, todayIST } from "@/lib/format";
import { notifyDataChanged, useApi } from "@/lib/api-client";
import { StatusBadge, STATUS_STYLE } from "./status-badge";
import { StatusChangeDialog, type StatusChangeResult } from "./status-change-dialog";
import { WhatsAppThread } from "./whatsapp-thread";
import { Button, ButtonLink } from "./ui/button";
import { useToast } from "./ui/toast";

interface DetailResponse {
  booking: Booking;
  notifications: NotificationRecord[];
}

export function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, error, reload } = useApi<DetailResponse>(`/api/bookings/${encodeURIComponent(id)}`);
  const toast = useToast();
  const [dialogTo, setDialogTo] = useState<BookingStatus | null>(null);

  if (error && !data) {
    return (
      <div className="card mx-auto mt-10 max-w-md p-8 text-center">
        <p className="font-display text-xl font-bold">{error.status === 404 ? "Booking not found" : "Couldn't load this booking"}</p>
        <p className="mt-2 text-sm text-muted">{error.status === 404 ? `There is no booking with ID ${id}.` : error.message}</p>
        <div className="mt-5 flex justify-center gap-2">
          {error.status !== 404 && (
            <Button variant="secondary" onClick={reload}>
              Try again
            </Button>
          )}
          <ButtonLink href="/" variant="primary">
            Back to bookings
          </ButtonLink>
        </div>
      </div>
    );
  }
  if (!data) return <BookingDetailSkeleton />;

  const { booking, notifications } = data;
  const today = todayIST();
  const action = nextAction(booking, today);
  const back = previousStatus(booking.status);

  function onDone(result: StatusChangeResult) {
    setDialogTo(null);
    const n = result.notification;
    toast(
      n
        ? n.status === "sent"
          ? { tone: "whatsapp", title: `Moved to ${result.booking.status}`, description: `WhatsApp sent to ${n.devoteeName}.` }
          : { tone: "error", title: `Moved to ${result.booking.status}`, description: `WhatsApp failed: ${n.error}` }
        : { tone: "success", title: `Moved back to ${result.booking.status}`, description: "Recorded in the history. No message sent." },
    );
    notifyDataChanged();
  }

  return (
    <div className="space-y-5">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> All bookings
      </Link>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CopyId id={booking.id} />
            <StatusBadge status={booking.status} />
            <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-semibold text-muted">{booking.puja.category}</span>
          </div>
          <h1 className="mt-2 text-2xl leading-tight font-bold sm:text-3xl">{booking.puja.name}</h1>
          <p className="mt-1 text-[0.9375rem] text-muted">
            for <span className="font-semibold text-ink">{booking.devotee.name}</span> · {formatPujaDate(booking.pujaDate)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {back && (
            <Button variant="secondary" icon={<Undo2 className="size-4" />} onClick={() => setDialogTo(back)}>
              Move back
            </Button>
          )}
          {action &&
            (action.enabled ? (
              <Button onClick={() => setDialogTo(action.to)}>{action.label}</Button>
            ) : (
              <span className="flex flex-col items-end">
                <Button disabled>{action.label}</Button>
                <span className="mt-1 text-xs text-muted">Available on the puja day ({action.reason?.replace("Starts ", "")})</span>
              </span>
            ))}
          {!action && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-completed-bg px-3 py-2 text-sm font-semibold text-completed">
              <Check className="size-4" /> Workflow complete
            </span>
          )}
        </div>
      </header>

      <Stepper booking={booking} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <Section title="Puja details" icon={Flame}>
              <Row icon={Landmark} label="Temple" value={`${booking.temple.name}, ${booking.temple.city}`} />
              <Row icon={CalendarDays} label="Puja date" value={formatPujaDate(booking.pujaDate)} />
              <Row icon={IndianRupee} label="Amount" value={<span className="font-semibold">{formatINR(booking.amount)}</span>} />
              <Row icon={Gem} label="Pandit" value={booking.pandit ?? <span className="text-muted">Assigned on confirmation</span>} />
              {booking.videoUrl && (
                <Row
                  icon={Video}
                  label="Puja video"
                  value={
                    <a href={booking.videoUrl} target="_blank" rel="noreferrer" className="break-all text-brand-700 hover:underline">
                      {booking.videoUrl.replace(/^https?:\/\//, "")}
                    </a>
                  }
                />
              )}
            </Section>
            <Section title="Devotee" icon={UserRound}>
              <Row icon={UserRound} label="Name" value={booking.devotee.name} />
              <Row
                icon={Phone}
                label="Phone"
                value={
                  <a href={`tel:${booking.devotee.phone}`} className="tabular-nums hover:underline">
                    {formatPhone(booking.devotee.phone)}
                  </a>
                }
              />
              {booking.devotee.email && (
                <Row
                  icon={Mail}
                  label="Email"
                  value={
                    <a href={`mailto:${booking.devotee.email}`} className="break-all hover:underline">
                      {booking.devotee.email}
                    </a>
                  }
                />
              )}
              <Row icon={MapPin} label="City" value={booking.devotee.city} />
              <Row icon={ScrollText} label="Gotra" value={booking.devotee.gotra ?? <span className="text-muted">Not provided</span>} />
            </Section>
          </div>

          <Section title="Sankalp" icon={UsersRound}>
            {booking.sankalpNames.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {booking.sankalpNames.map((n) => (
                  <li key={n} className="rounded-full border border-line bg-cream px-3 py-1 text-sm font-medium">
                    {n}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No family names added.</p>
            )}
            {booking.wish && (
              <blockquote className="mt-3 border-l-2 border-marigold-500 pl-3 text-[0.9375rem] text-ink/85 italic">
                “{booking.wish}”
              </blockquote>
            )}
          </Section>

          <Section title="Activity" icon={ScrollText}>
            <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[0.4375rem] before:w-px before:bg-line">
              {[...booking.history].reverse().map((h, i) => {
                const rollback = h.from && statusIndex(h.to) < statusIndex(h.from);
                return (
                  <li key={`${h.at}-${i}`} className="relative flex gap-3 pl-0">
                    <span
                      className={clsx(
                        "relative z-10 mt-1 size-[0.9375rem] shrink-0 rounded-full border-[3px] border-white ring-1",
                        STATUS_STYLE[h.to].dot,
                        STATUS_STYLE[h.to].ring,
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        {h.from === null ? (
                          <>
                            <span className="font-semibold">Booking created</span> as Pending
                          </>
                        ) : (
                          <>
                            <span className="font-semibold">{rollback ? "Moved back" : "Moved"}</span> from {h.from} to{" "}
                            <span className="font-semibold">{h.to}</span>
                          </>
                        )}
                        <span className="text-muted"> · by {h.by}</span>
                      </p>
                      {h.note && h.from !== null && <p className="mt-0.5 text-sm text-muted">“{h.note}”</p>}
                      <p className="mt-0.5 text-xs text-muted" title={formatDateTime(h.at)}>
                        {formatDateTime(h.at)} · {timeAgo(h.at)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Section>
        </div>

        <WhatsAppThread booking={booking} notifications={notifications} onResent={reload} />
      </div>

      {dialogTo && (
        <StatusChangeDialog booking={booking} to={dialogTo} onClose={() => setDialogTo(null)} onDone={onDone} />
      )}
    </div>
  );
}

function Stepper({ booking }: { booking: Booking }) {
  const current = statusIndex(booking.status);
  // Latest time each stage was reached (a rollback can revisit a stage).
  const reachedAt = new Map<BookingStatus, string>();
  for (const h of booking.history) reachedAt.set(h.to, h.at);

  return (
    <ol className="card grid grid-cols-4 gap-1 p-3 sm:p-4" aria-label="Booking workflow">
      {BOOKING_STATUSES.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="relative flex flex-col items-center text-center" aria-current={active ? "step" : undefined}>
            {i > 0 && (
              <span
                className={clsx("absolute top-4 right-1/2 h-0.5 w-full -translate-y-1/2", i <= current ? "bg-brand-600" : "bg-line")}
                aria-hidden
              />
            )}
            <span
              className={clsx(
                "relative z-10 grid size-8 place-items-center rounded-full text-sm font-bold transition-colors",
                done && "bg-brand-600 text-white",
                active && "bg-white text-brand-700 ring-[3px] ring-brand-600",
                !done && !active && "border border-line bg-white text-muted",
              )}
            >
              {done ? <Check className="size-4" /> : i + 1}
            </span>
            <span className={clsx("mt-2 text-xs font-semibold sm:text-sm", active ? "text-ink" : done ? "text-ink/80" : "text-muted")}>{s}</span>
            <span className="mt-0.5 hidden text-xs text-muted sm:block">
              {i <= current && reachedAt.get(s) ? formatDateTime(reachedAt.get(s)!) : "—"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: ComponentType<{ className?: string }>; children: ReactNode }) {
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
        <Icon className="size-4 text-brand-600" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-line-soft py-2 text-sm last:border-0">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted" />
      <span className="w-24 shrink-0 text-muted">{label}</span>
      <span className="min-w-0 flex-1">{value}</span>
    </div>
  );
}

function CopyId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(id).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2 py-0.5 font-mono text-sm font-semibold text-brand-700 hover:bg-brand-100"
      title="Copy booking ID"
    >
      {id}
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}

export function BookingDetailSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Loading booking">
      <span className="skeleton block h-4 w-28" />
      <div className="space-y-2">
        <span className="skeleton block h-5 w-48" />
        <span className="skeleton block h-8 w-80 max-w-full" />
      </div>
      <div className="card skeleton h-24" />
      <div className="grid gap-5 xl:grid-cols-[1fr_24rem]">
        <div className="card skeleton h-80" />
        <div className="card skeleton h-80" />
      </div>
    </div>
  );
}
