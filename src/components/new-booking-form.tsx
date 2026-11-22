"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { Landmark, MessageCircle, Plus, X } from "lucide-react";
import clsx from "clsx";
import { PUJA_CATALOG, findPuja } from "@/lib/domain/catalog";
import { renderNotification } from "@/lib/domain/templates";
import type { Booking, NotificationRecord } from "@/lib/domain/types";
import { createBookingSchema, fieldErrors } from "@/lib/domain/validation";
import { addDaysISO, formatINR, todayIST } from "@/lib/format";
import { api, ApiClientError, notifyDataChanged } from "@/lib/api-client";
import { Button, ButtonLink } from "./ui/button";
import { useToast } from "./ui/toast";
import { WhatsAppText } from "./whatsapp-thread";

const initial = () => ({
  pujaSlug: PUJA_CATALOG[0].slug,
  pujaDate: addDaysISO(todayIST(), 3),
  amount: String(PUJA_CATALOG[0].price),
  name: "",
  phone: "",
  email: "",
  city: "",
  gotra: "",
  wish: "",
});

export function NewBookingForm() {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState(initial);
  const [names, setNames] = useState<string[]>([]);
  const [nameDraft, setNameDraft] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const puja = findPuja(form.pujaSlug)!;

  const payload = useMemo(
    () => ({
      devotee: { name: form.name, phone: form.phone, email: form.email, city: form.city, gotra: form.gotra },
      pujaSlug: form.pujaSlug,
      pujaDate: form.pujaDate,
      amount: form.amount,
      sankalpNames: names,
      wish: form.wish,
    }),
    [form, names],
  );

  // After the first submit attempt, re-validate on every change so errors clear as they are fixed.
  const liveErrors = useMemo(() => {
    if (!touched) return errors;
    const r = createBookingSchema.safeParse(payload);
    return r.success ? {} : fieldErrors(r.error);
  }, [touched, payload, errors]);

  function set<K extends keyof ReturnType<typeof initial>>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function choosePuja(slug: string) {
    const p = findPuja(slug);
    setForm((f) => ({ ...f, pujaSlug: slug, amount: p ? String(p.price) : f.amount }));
  }

  function addName() {
    const n = nameDraft.trim();
    if (n && !names.includes(n) && names.length < 8) setNames([...names, n]);
    setNameDraft("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    const parsed = createBookingSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }
    setSaving(true);
    try {
      const { booking, notification } = await api<{ booking: Booking; notification: NotificationRecord }>(
        "/api/bookings",
        {
          method: "POST",
          json: payload,
        },
      );
      toast(
        notification.status === "sent"
          ? {
              tone: "whatsapp",
              title: `Booking ${booking.id} created`,
              description: `Confirmation sent to ${booking.devotee.name} on WhatsApp.`,
            }
          : {
              tone: "error",
              title: `Booking ${booking.id} created`,
              description: `WhatsApp failed: ${notification.error}`,
            },
      );
      notifyDataChanged();
      router.push(`/bookings/${booking.id}`);
    } catch (err) {
      if (err instanceof ApiClientError && err.details && typeof err.details === "object") {
        setErrors(err.details as Record<string, string>);
      }
      toast({ tone: "error", title: "Couldn't create the booking", description: (err as Error).message });
      setSaving(false);
    }
  }

  const preview = renderNotification("booking_received", {
    id: "AS-1XXXXX",
    devotee: { name: form.name.trim() || "Devotee", phone: "", city: "" },
    puja: { slug: puja.slug, name: puja.name, category: puja.category },
    temple: puja.temple,
    pujaDate: /^\d{4}-\d{2}-\d{2}$/.test(form.pujaDate) ? form.pujaDate : todayIST(),
    amount: Number(form.amount) || 0,
    status: "Pending",
    sankalpNames: names,
    history: [],
    createdAt: "",
    updatedAt: "",
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <Card title="Puja" step={1}>
          <Field label="Puja or chadhava" error={liveErrors.pujaSlug}>
            {(id) => (
              <select id={id} className="field" value={form.pujaSlug} onChange={(e) => choosePuja(e.target.value)}>
                <optgroup label="Puja">
                  {PUJA_CATALOG.filter((p) => p.category === "Puja").map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.name} · {formatINR(p.price)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Chadhava">
                  {PUJA_CATALOG.filter((p) => p.category === "Chadhava").map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.name} · {formatINR(p.price)}
                    </option>
                  ))}
                </optgroup>
              </select>
            )}
          </Field>
          <p className="-mt-1 flex items-center gap-2 rounded-xl bg-sand/70 px-3 py-2 text-sm text-muted">
            <Landmark className="size-4 shrink-0 text-brand-600" />
            <span>
              Performed at{" "}
              <span className="font-semibold text-ink">
                {puja.temple.name}, {puja.temple.city}
              </span>{" "}
              · {puja.deity}
            </span>
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Puja date" error={liveErrors.pujaDate}>
              {(id) => (
                <input
                  id={id}
                  type="date"
                  className="field"
                  min={todayIST()}
                  value={form.pujaDate}
                  onChange={(e) => set("pujaDate", e.target.value)}
                  aria-invalid={Boolean(liveErrors.pujaDate)}
                />
              )}
            </Field>
            <Field label="Amount (₹)" error={liveErrors.amount} hint={`List price ${formatINR(puja.price)}`}>
              {(id) => (
                <input
                  id={id}
                  inputMode="numeric"
                  className="field tabular-nums"
                  value={form.amount}
                  onChange={(e) => set("amount", e.target.value.replace(/[^\d]/g, ""))}
                  aria-invalid={Boolean(liveErrors.amount)}
                />
              )}
            </Field>
          </div>
        </Card>

        <Card title="Devotee" step={2}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" error={liveErrors["devotee.name"]}>
              {(id) => (
                <input
                  id={id}
                  className="field"
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Meera Krishnan"
                  aria-invalid={Boolean(liveErrors["devotee.name"])}
                />
              )}
            </Field>
            <Field label="WhatsApp number" error={liveErrors["devotee.phone"]} hint="Indian mobile; updates go here">
              {(id) => (
                <div className="flex">
                  <span className="grid place-items-center rounded-l-[0.625rem] border border-r-0 border-line bg-sand px-3 text-sm text-muted">
                    +91
                  </span>
                  <input
                    id={id}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    className="field rounded-l-none"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="98765 43210"
                    aria-invalid={Boolean(liveErrors["devotee.phone"])}
                  />
                </div>
              )}
            </Field>
            <Field label="Email" optional error={liveErrors["devotee.email"]}>
              {(id) => (
                <input
                  id={id}
                  type="email"
                  autoComplete="email"
                  className="field"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  aria-invalid={Boolean(liveErrors["devotee.email"])}
                />
              )}
            </Field>
            <Field label="City" error={liveErrors["devotee.city"]}>
              {(id) => (
                <input
                  id={id}
                  className="field"
                  autoComplete="address-level2"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                  aria-invalid={Boolean(liveErrors["devotee.city"])}
                />
              )}
            </Field>
            <Field label="Gotra" optional error={liveErrors["devotee.gotra"]}>
              {(id) => (
                <input
                  id={id}
                  className="field"
                  value={form.gotra}
                  onChange={(e) => set("gotra", e.target.value)}
                  placeholder="e.g. Kashyap"
                />
              )}
            </Field>
          </div>
        </Card>

        <Card title="Sankalp" step={3}>
          <Field
            label="Family names for the sankalp"
            optional
            error={liveErrors.sankalpNames}
            hint="Press Enter to add each name (up to 8)"
          >
            {(id) => (
              <div className="flex flex-wrap gap-2 rounded-[0.625rem] border border-line bg-white p-1.5 focus-within:border-brand-600 focus-within:ring-3 focus-within:ring-brand-600/15">
                {names.map((n) => (
                  <span
                    key={n}
                    className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-0.5 pr-1 pl-2.5 text-sm font-medium text-brand-800"
                  >
                    {n}
                    <button
                      type="button"
                      className="rounded-full p-0.5 hover:bg-brand-100"
                      onClick={() => setNames(names.filter((x) => x !== n))}
                      aria-label={`Remove ${n}`}
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))}
                <input
                  id={id}
                  className="h-7 min-w-36 flex-1 bg-transparent px-1.5 text-[0.9375rem] outline-none"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addName();
                    } else if (e.key === "Backspace" && !nameDraft && names.length) {
                      setNames(names.slice(0, -1));
                    }
                  }}
                  onBlur={addName}
                  placeholder={names.length ? "Add another name" : "e.g. Meera Krishnan"}
                  disabled={names.length >= 8}
                />
                {form.name.trim() && !names.includes(form.name.trim()) && names.length < 8 && (
                  <button
                    type="button"
                    onClick={() => setNames([...names, form.name.trim()])}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2.5 py-0.5 text-sm text-muted hover:border-brand-600 hover:text-brand-700"
                  >
                    <Plus className="size-3.5" /> {form.name.trim()}
                  </button>
                )}
              </div>
            )}
          </Field>
          <Field label="Wish / intention" optional error={liveErrors.wish}>
            {(id) => (
              <textarea
                id={id}
                rows={2}
                maxLength={300}
                className="field resize-none"
                value={form.wish}
                onChange={(e) => set("wish", e.target.value)}
                placeholder="e.g. For good health of my parents"
              />
            )}
          </Field>
        </Card>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <ButtonLink href="/" variant="secondary">
            Cancel
          </ButtonLink>
          <Button type="submit" loading={saving}>
            Create booking & notify devotee
          </Button>
        </div>
      </div>

      <aside className="xl:sticky xl:top-6 xl:self-start">
        <div className="card overflow-hidden">
          <p className="flex items-center gap-2 border-b border-line-soft px-4 py-3 text-sm font-semibold">
            <MessageCircle className="size-4 text-whatsapp" /> WhatsApp the devotee will receive
          </p>
          <div className="wa-wall p-3">
            <p className="rounded-xl rounded-tr-none bg-whatsapp-bubble px-3 py-2 text-[0.8125rem] leading-relaxed whitespace-pre-line shadow-sm">
              <WhatsAppText text={preview} />
            </p>
          </div>
          <dl className="space-y-1.5 px-4 py-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Starts as</dt>
              <dd className="font-semibold text-pending">Pending</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Amount</dt>
              <dd className="font-semibold tabular-nums">{formatINR(Number(form.amount) || 0)}</dd>
            </div>
          </dl>
        </div>
      </aside>
    </form>
  );
}

function Card({ title, step, children }: { title: string; step: number; children: ReactNode }) {
  return (
    <fieldset className="card space-y-4 p-4 sm:p-5">
      <legend className="sr-only">{title}</legend>
      <h2 className="flex items-center gap-2.5 text-base font-bold" aria-hidden>
        <span className="grid size-6 place-items-center rounded-full bg-maroon-900 text-xs text-cream">{step}</span>
        {title}
      </h2>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  error,
  hint,
  optional,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      </label>
      {children(id)}
      <p
        className={clsx("mt-1 text-xs", error ? "font-medium text-brand-700" : "text-muted")}
        role={error ? "alert" : undefined}
      >
        {error ?? hint ?? " "}
      </p>
    </div>
  );
}
