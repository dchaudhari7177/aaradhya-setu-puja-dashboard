import clsx from "clsx";
import type { BookingStatus } from "@/lib/domain/types";

export const STATUS_STYLE: Record<BookingStatus, { badge: string; dot: string; ring: string }> = {
  Pending: { badge: "bg-pending-bg text-pending", dot: "bg-pending", ring: "ring-pending/25" },
  Confirmed: { badge: "bg-confirmed-bg text-confirmed", dot: "bg-confirmed", ring: "ring-confirmed/25" },
  "In Progress": { badge: "bg-progress-bg text-progress", dot: "bg-progress", ring: "ring-progress/25" },
  Completed: { badge: "bg-completed-bg text-completed", dot: "bg-completed", ring: "ring-completed/25" },
};

export function StatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.8125rem] font-semibold whitespace-nowrap",
        s.badge,
        className,
      )}
    >
      <span className={clsx("size-1.5 rounded-full", s.dot, status === "In Progress" && "animate-pulse")} aria-hidden />
      {status}
    </span>
  );
}
