import type { Metadata } from "next";
import { Suspense } from "react";
import { NewBookingForm } from "@/components/new-booking-form";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "New booking" };

export default function NewBookingPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        eyebrow="Bookings"
        title="New booking"
        description="Record a phone or walk-in booking. It starts as Pending and the devotee gets a WhatsApp confirmation straight away."
      />
      {/* The form defaults the puja date from "today" (IST), so it renders per request rather than at build time. */}
      <Suspense fallback={<div className="card skeleton h-[36rem]" />}>
        <NewBookingForm />
      </Suspense>
    </div>
  );
}
