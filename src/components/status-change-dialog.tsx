"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, MessageCircle, Undo2, X } from "lucide-react";
import { findPuja } from "@/lib/domain/catalog";
import { isRollback } from "@/lib/domain/status";
import { NOTIFICATION_TEMPLATES, renderNotification, templateForStatus } from "@/lib/domain/templates";
import type { Booking, BookingStatus, NotificationRecord } from "@/lib/domain/types";
import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "./ui/button";
import { StatusBadge } from "./status-badge";
import { WhatsAppText } from "./whatsapp-thread";

export interface StatusChangeResult {
  booking: Booking;
  notification: NotificationRecord | null;
}

/**
 * Confirms a status move. Collects what the next stage needs (a pandit when
 * confirming, a video link when completing, a reason when rolling back) and
 * previews the exact WhatsApp message the devotee will receive.
 */
export function StatusChangeDialog({
  booking,
  to,
  onClose,
  onDone,
}: {
  booking: Booking;
  to: BookingStatus;
  onClose: () => void;
  onDone: (result: StatusChangeResult) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const rollback = isRollback(booking.status, to);
  const pandits = findPuja(booking.puja.slug)?.pandits ?? [];
  const [pandit, setPandit] = useState(booking.pandit ?? pandits[0] ?? "");
  const [videoUrl, setVideoUrl] = useState(booking.videoUrl ?? "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<Record<string, string>>({});

  useEffect(() => {
    // No close() in a cleanup: StrictMode re-runs effects, and closing fires onClose, which would unmount the dialog.
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const preview = rollback
    ? null
    : renderNotification(templateForStatus(to), {
        ...booking,
        status: to,
        pandit: to === "Confirmed" ? pandit || undefined : booking.pandit,
        videoUrl: videoUrl || undefined,
      });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rollback && !note.trim()) {
      setFieldError({ note: "Add a short reason for moving this booking back." });
      return;
    }
    setSaving(true);
    setError(null);
    setFieldError({});
    try {
      const result = await api<StatusChangeResult>(`/api/bookings/${booking.id}/status`, {
        method: "PATCH",
        json: {
          status: to,
          expectedStatus: booking.status,
          note: note || undefined,
          pandit: to === "Confirmed" ? pandit : undefined,
          videoUrl: to === "Completed" ? videoUrl : undefined,
        },
      });
      onDone(result);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "validation_failed" && err.details) {
        setFieldError(err.details as Record<string, string>);
      } else {
        setError((err as Error).message);
      }
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(34rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] rounded-2xl bg-white p-0 text-ink shadow-pop backdrop:bg-maroon-950/45 backdrop:backdrop-blur-[2px] open:animate-slide-up"
      aria-labelledby="status-dialog-title"
    >
      <form onSubmit={submit} className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-line-soft px-5 py-4">
          <div>
            <h2 id="status-dialog-title" className="text-lg font-bold">
              {rollback ? "Move booking back" : `Move to ${to}`}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted">
              {booking.id} · {booking.devotee.name}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-sand" aria-label="Close">
            <X className="size-5" />
          </button>
        </header>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="flex items-center gap-2">
            <StatusBadge status={booking.status} />
            {rollback ? <Undo2 className="size-4 text-muted" /> : <ArrowRight className="size-4 text-muted" />}
            <StatusBadge status={to} />
          </div>

          {to === "Confirmed" && !rollback && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Assign pandit</span>
              <select className="field" value={pandit} onChange={(e) => setPandit(e.target.value)}>
                {pandits.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-muted">Verified pandits at {booking.temple.name}.</span>
            </label>
          )}

          {to === "Completed" && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">
                Puja video link <span className="font-normal text-muted">(optional)</span>
              </span>
              <input
                className="field"
                type="url"
                inputMode="url"
                placeholder="https://youtu.be/…"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                aria-invalid={Boolean(fieldError.videoUrl)}
              />
              {fieldError.videoUrl && <span className="mt-1 block text-sm text-brand-700">{fieldError.videoUrl}</span>}
            </label>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">
              {rollback ? "Reason" : "Internal note"}{" "}
              {!rollback && <span className="font-normal text-muted">(optional)</span>}
            </span>
            <textarea
              className="field resize-none"
              rows={2}
              maxLength={280}
              placeholder={rollback ? "e.g. Devotee asked to reschedule" : "Visible in the booking history only"}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-invalid={Boolean(fieldError.note)}
              autoFocus={rollback}
            />
            {fieldError.note && <span className="mt-1 block text-sm text-brand-700">{fieldError.note}</span>}
          </label>

          {preview ? (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
                <MessageCircle className="size-4 text-whatsapp" />
                WhatsApp to {booking.devotee.name.split(" ")[0]}: {NOTIFICATION_TEMPLATES[templateForStatus(to)].title}
              </p>
              <div className="wa-wall rounded-xl p-3">
                <p className="max-w-[92%] rounded-lg rounded-tl-none bg-whatsapp-bubble px-3 py-2 text-[0.8125rem] leading-relaxed whitespace-pre-line shadow-sm">
                  <WhatsAppText text={preview} />
                </p>
              </div>
            </div>
          ) : (
            <p className="rounded-xl bg-sand px-3 py-2.5 text-sm text-muted">
              Rollbacks are internal corrections. The devotee is not messaged.
            </p>
          )}

          {error && (
            <p role="alert" className="rounded-xl bg-brand-50 px-3 py-2.5 text-sm text-brand-800">
              {error}
            </p>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-line-soft px-5 py-3.5">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant={rollback ? "danger" : "primary"} loading={saving}>
            {rollback ? `Move back to ${to}` : preview ? "Update & send WhatsApp" : `Move to ${to}`}
          </Button>
        </footer>
      </form>
    </dialog>
  );
}
