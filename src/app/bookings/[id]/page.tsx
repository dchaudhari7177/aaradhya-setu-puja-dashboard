import { Suspense } from "react";
import { BookingDetail, BookingDetailSkeleton } from "@/components/booking-detail";

export default function BookingPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <Suspense fallback={<BookingDetailSkeleton />}>
        <BookingDetail />
      </Suspense>
    </div>
  );
}
