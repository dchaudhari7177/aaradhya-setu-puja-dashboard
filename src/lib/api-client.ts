"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Error carrying the API's { error: { code, message, details } } payload. */
export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...rest.headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiClientError(0, "network", "Can't reach the server. Check your connection and try again.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const e = body?.error;
    throw new ApiClientError(
      res.status,
      e?.code ?? "http_error",
      e?.message ?? `Request failed (${res.status})`,
      e?.details,
    );
  }
  return body as T;
}

/**
 * Tiny data hook: fetches `url`, keeps the previous data while a new URL loads
 * (no flashing tables), cancels stale requests, and refetches when any part of
 * the app signals a change via notifyDataChanged().
 */
export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiClientError | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [version, setVersion] = useState(0);
  const controller = useRef<AbortController | null>(null);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    window.addEventListener(CHANGED, reload);
    return () => window.removeEventListener(CHANGED, reload);
  }, [reload]);

  useEffect(() => {
    if (!url) return;
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- marking a request as in flight is the point of this effect
    setLoading(true);
    api<T>(url, { signal: c.signal })
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((err) => {
        if (err.name !== "AbortError")
          setError(err instanceof ApiClientError ? err : new ApiClientError(0, "unknown", String(err)));
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [url, version]);

  return { data, error, loading, reload, setData };
}

const CHANGED = "aaradhya:data-changed";
export function notifyDataChanged() {
  window.dispatchEvent(new Event(CHANGED));
}
