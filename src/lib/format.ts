const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function formatINR(amount: number): string {
  return inr.format(amount);
}

/** Compact rupees for KPI cards: ₹1.2L, ₹3.4Cr. */
export function formatINRCompact(amount: number): string {
  if (amount >= 1_00_00_000) return `₹${trim(amount / 1_00_00_000)}Cr`;
  if (amount >= 1_00_000) return `₹${trim(amount / 1_00_000)}L`;
  if (amount >= 1_000) return `₹${trim(amount / 1_000)}K`;
  return formatINR(amount);
}

function trim(n: number): string {
  return n.toFixed(n >= 10 ? 1 : 2).replace(/\.?0+$/, "");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-11-24" -> "Tue, 24 Nov 2026". Parsed as a calendar date, so no timezone can shift the day. */
export function formatPujaDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[weekday]}, ${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatShortDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

const dateTime = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

export function timeAgo(iso: string, now: Date = new Date()): string {
  const s = Math.round((now.getTime() - new Date(iso).getTime()) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  return formatDateTime(iso);
}

/** Today's calendar date in IST, as YYYY-MM-DD. */
export function todayIST(now: Date = new Date()): string {
  return addDaysISO(new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10), 0);
}

export function addDaysISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function formatPhone(e164: string): string {
  const m = e164.match(/^\+91(\d{5})(\d{5})$/);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}
