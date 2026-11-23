"use client";

import { useEffect } from "react";
import { CircleAlert, RefreshCw } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";

/** Catches unexpected rendering errors in any page and offers a retry instead of a blank screen. */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center" role="alert">
      <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
        <CircleAlert className="size-7" />
      </span>
      <h1 className="mt-5 text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-muted">
        This page hit an unexpected error. Try again; if it keeps happening, the details are in the browser console.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted">Reference: {error.digest}</p>}
      <div className="mt-6 flex gap-2">
        <Button icon={<RefreshCw className="size-4" />} onClick={() => retry()}>
          Try again
        </Button>
        <ButtonLink href="/" variant="secondary">
          Back to bookings
        </ButtonLink>
      </div>
    </div>
  );
}
