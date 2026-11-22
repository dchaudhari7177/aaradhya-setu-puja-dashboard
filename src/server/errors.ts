import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { fieldErrors } from "@/lib/domain/validation";
import { ConflictError } from "./repository";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new ApiError(404, "not_found", `${what} not found.`);
export const invalidTransition = (reason: string) => new ApiError(422, "invalid_transition", reason);

/** Every API error has the same shape: { error: { code, message, details? } }. */
export function errorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    return Response.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    return Response.json(
      { error: { code: "validation_failed", message: "Some fields need attention.", details: fieldErrors(err) } },
      { status: 400 },
    );
  }
  if (err instanceof ConflictError) {
    return Response.json(
      {
        error: {
          code: "conflict",
          message: `${err.message} Someone else updated this booking; refresh to see the latest.`,
          details: { current: err.current },
        },
      },
      { status: 409 },
    );
  }
  if (err instanceof SyntaxError) {
    return Response.json({ error: { code: "bad_json", message: "Request body must be valid JSON." } }, { status: 400 });
  }
  console.error("[api] unexpected error", err);
  return Response.json(
    { error: { code: "internal", message: "Something went wrong on our side. Please try again." } },
    { status: 500 },
  );
}

export function route<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      unstable_rethrow(err); // let Next.js control-flow signals (prerender bailout, redirects) through
      return errorResponse(err);
    }
  };
}
