"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCheck, CircleAlert, MessageCircle, RotateCcw } from "lucide-react";
import { NOTIFICATION_TEMPLATES } from "@/lib/domain/templates";
import type { Booking, NotificationRecord } from "@/lib/domain/types";
import { formatDateTime, formatPhone } from "@/lib/format";
import { api } from "@/lib/api-client";
import { Button } from "./ui/button";
import { useToast } from "./ui/toast";

const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

/** The booking's WhatsApp messages, rendered as the devotee would see them. */
export function WhatsAppThread({
  booking,
  notifications,
  onResent,
}: {
  booking: Booking;
  notifications: NotificationRecord[];
  onResent: () => void;
}) {
  const toast = useToast();
  const [resending, setResending] = useState(false);
  const ordered = [...notifications].reverse(); // oldest first, like a chat
  const latest = notifications[0];
  const wall = useRef<HTMLDivElement>(null);

  // Open on the newest message, like a chat app.
  useEffect(() => {
    if (wall.current) wall.current.scrollTop = wall.current.scrollHeight;
  }, [notifications.length]);

  async function resend() {
    setResending(true);
    try {
      const { notification } = await api<{ notification: NotificationRecord }>(`/api/bookings/${booking.id}/notifications`, {
        method: "POST",
        json: {},
      });
      toast(
        notification.status === "sent"
          ? { tone: "whatsapp", title: "Message re-sent", description: `Delivered to ${notification.devoteeName}.` }
          : { tone: "error", title: "Still failing", description: notification.error },
      );
      onResent();
    } catch (err) {
      toast({ tone: "error", title: "Couldn't resend", description: (err as Error).message });
    } finally {
      setResending(false);
    }
  }

  return (
    <section className="card flex max-h-[44rem] flex-col overflow-hidden xl:sticky xl:top-6" aria-label="WhatsApp notifications">
      <header className="flex items-center gap-3 bg-whatsapp px-4 py-3 text-white">
        <span className="grid size-9 place-items-center rounded-full bg-white/20 font-display font-bold">
          {booking.devotee.name.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{booking.devotee.name}</p>
          <p className="truncate text-xs text-white/80 tabular-nums">{formatPhone(booking.devotee.phone)} · WhatsApp (mock)</p>
        </div>
        <MessageCircle className="size-5 opacity-80" />
      </header>

      <div ref={wall} className="wa-wall flex-1 space-y-3 overflow-y-auto p-3">
        {ordered.length === 0 && (
          <p className="mx-auto mt-6 w-fit rounded-lg bg-white/80 px-3 py-1.5 text-xs text-muted">No messages yet</p>
        )}
        {ordered.map((n) => (
          <article key={n.id} className="flex flex-col items-end">
            <span className="mb-1 rounded-md bg-white/70 px-2 py-0.5 text-[0.6875rem] font-semibold text-muted">
              {NOTIFICATION_TEMPLATES[n.template]?.title ?? n.template}
            </span>
            <div
              className={
                n.status === "sent"
                  ? "max-w-[92%] rounded-xl rounded-tr-none bg-whatsapp-bubble px-3 py-2 shadow-sm"
                  : "max-w-[92%] rounded-xl rounded-tr-none border border-brand-200 bg-brand-50 px-3 py-2 shadow-sm"
              }
            >
              <p className="text-[0.8125rem] leading-relaxed break-words whitespace-pre-line">
                <WhatsAppText text={n.message} />
              </p>
              <p className="mt-1 flex items-center justify-end gap-1 text-[0.6875rem] text-muted" title={formatDateTime(n.createdAt)}>
                {timeFmt.format(new Date(n.createdAt))}
                {n.status === "sent" ? (
                  <CheckCheck className="size-3.5 text-sky-500" aria-label="Delivered" />
                ) : (
                  <CircleAlert className="size-3.5 text-brand-700" aria-label="Failed" />
                )}
              </p>
            </div>
            {n.status === "failed" && <p className="mt-1 text-xs font-medium text-brand-800">Not delivered: {n.error}</p>}
          </article>
        ))}
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-line-soft px-4 py-2.5 text-xs text-muted">
        <span>
          {notifications.length} message{notifications.length === 1 ? "" : "s"}
          {latest?.providerMessageId && <span className="hidden sm:inline"> · last id {latest.providerMessageId.slice(0, 14)}…</span>}
        </span>
        <Button
          size="sm"
          variant={latest?.status === "failed" ? "primary" : "ghost"}
          loading={resending}
          icon={<RotateCcw className="size-3.5" />}
          onClick={resend}
          title="Re-send the message for the current stage"
        >
          {latest?.status === "failed" ? "Retry" : "Resend"}
        </Button>
      </footer>
    </section>
  );
}

/** Renders WhatsApp's *bold* markup safely (no HTML injection). */
export function WhatsAppText({ text }: { text: string }) {
  const parts = text.split(/(\*[^*\n]+\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("*") && p.endsWith("*") && p.length > 2 ? <strong key={i}>{p.slice(1, -1)}</strong> : <span key={i}>{p}</span>,
      )}
    </>
  );
}
