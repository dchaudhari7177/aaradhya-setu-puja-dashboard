import { z } from "zod";
import { findPuja } from "./catalog";
import { BOOKING_STATUSES, SORT_FIELDS, type BookingListQuery } from "./types";

/**
 * Validation schemas shared by the API (authoritative) and the booking form
 * (instant feedback). One source of truth means the UI can never accept
 * something the server will reject.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const isoDate = z
  .string()
  .regex(ISO_DATE, "Use the format YYYY-MM-DD")
  .refine((v) => {
    const [y, m, d] = v.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }, "Not a real calendar date");

/** Accepts "98765 43210", "+91-98765-43210", "09876543210"; stores E.164 (+919876543210). */
export const indianMobile = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s\-()]/g, ""))
  .transform((v) => v.replace(/^(\+91|0091|91(?=\d{10}$)|0(?=\d{10}$))/, ""))
  .refine((v) => /^[6-9]\d{9}$/.test(v), "Enter a valid 10-digit Indian mobile number")
  .transform((v) => `+91${v}`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters`)
    .optional()
    .transform((v) => (v ? v : undefined));

export const createBookingSchema = z.object({
  devotee: z.object({
    name: z.string().trim().min(2, "Enter the devotee's full name").max(80),
    phone: indianMobile,
    email: z
      .union([z.literal(""), z.email("Enter a valid email address")])
      .optional()
      .transform((v) => (v ? v.toLowerCase() : undefined)),
    city: z.string().trim().min(2, "Enter a city").max(60),
    gotra: optionalText(40),
  }),
  pujaSlug: z.string().refine((s) => !!findPuja(s), "Choose a puja from the list"),
  pujaDate: isoDate,
  amount: z.coerce
    .number({ error: "Enter an amount" })
    .int("Amount must be in whole rupees")
    .min(1, "Amount must be at least ₹1")
    .max(10_00_000, "Amount looks too large"),
  sankalpNames: z.array(z.string().trim().min(1).max(60)).max(8, "A sankalp can include up to 8 names").default([]),
  wish: optionalText(300),
});

export type CreateBookingInput = z.input<typeof createBookingSchema>;
export type CreateBookingData = z.output<typeof createBookingSchema>;

export const statusChangeSchema = z.object({
  status: z.enum(BOOKING_STATUSES, { error: `Status must be one of: ${BOOKING_STATUSES.join(", ")}` }),
  /** The status the admin saw when they clicked. Guards against two admins changing the same booking at once. */
  expectedStatus: z.enum(BOOKING_STATUSES, { error: "expectedStatus is required (the status you last saw)" }),
  note: optionalText(280),
  pandit: optionalText(80),
  videoUrl: z
    .union([z.literal(""), z.url("Enter a valid video link (https://...)")])
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type StatusChangeInput = z.input<typeof statusChangeSchema>;
export type StatusChangeData = z.output<typeof statusChangeSchema>;

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const listQuerySchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  status: z.preprocess(emptyToUndefined, z.enum(BOOKING_STATUSES).optional()),
  puja: z.preprocess(emptyToUndefined, z.string().max(80).optional()),
  from: z.preprocess(emptyToUndefined, isoDate.optional()),
  to: z.preprocess(emptyToUndefined, isoDate.optional()),
  sort: z.preprocess(emptyToUndefined, z.enum(SORT_FIELDS).default("createdAt")),
  order: z.preprocess(emptyToUndefined, z.enum(["asc", "desc"]).default("desc")),
  page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).default(1)),
  pageSize: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(100).default(10)),
});

export function parseListQuery(params: URLSearchParams): z.ZodSafeParseResult<BookingListQuery> {
  return listQuerySchema.safeParse(Object.fromEntries(params.entries())) as z.ZodSafeParseResult<BookingListQuery>;
}

/** Flattens zod issues into { "devotee.phone": "message" } for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    out[key] ??= issue.message;
  }
  return out;
}
