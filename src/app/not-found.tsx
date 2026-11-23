import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
        <Compass className="size-7" />
      </span>
      <p className="mt-5 text-xs font-bold tracking-[0.14em] text-brand-600 uppercase">404</p>
      <h1 className="mt-1 text-2xl font-bold">This page isn&apos;t here</h1>
      <p className="mt-2 text-muted">The link may be old, or the page may have moved. Your bookings are safe.</p>
      <Link href="/" className={buttonClass("primary", "md", "mt-6")}>
        Back to bookings
      </Link>
    </div>
  );
}
