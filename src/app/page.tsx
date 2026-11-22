import { Suspense } from "react";
import { Plus } from "lucide-react";
import { BookingsTable } from "@/components/bookings-table";
import { KpiCards } from "@/components/kpi-cards";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/ui/button";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        eyebrow="Operations"
        title="Puja bookings"
        description="Search, review and move every booking through the puja workflow. Devotees get a WhatsApp update at each stage."
        actions={
          <ButtonLink href="/bookings/new" icon={<Plus className="size-4" />}>
            New booking
          </ButtonLink>
        }
      />
      <KpiCards />
      {/* The table reads the URL (filters live in the query string), so it renders below a Suspense boundary. */}
      <Suspense fallback={<div className="card skeleton h-96" />}>
        <BookingsTable />
      </Suspense>
    </div>
  );
}
