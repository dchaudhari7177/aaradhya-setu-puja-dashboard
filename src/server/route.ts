import { unstable_rethrow } from "next/navigation";
import { requireAdmin, type Actor } from "./auth";
import { errorResponse } from "./errors";

/**
 * Wraps an API route handler: authenticates the caller (see auth.ts), passes
 * the verified admin to the handler for the audit trail, and turns any thrown
 * error into the shared JSON error shape.
 */
export function route<C = unknown>(handler: (request: Request, ctx: C & { actor: Actor }) => Promise<Response>) {
  return async (request: Request, ctx: C = {} as C): Promise<Response> => {
    try {
      const actor = await requireAdmin(request);
      return await handler(request, { ...ctx, actor });
    } catch (err) {
      unstable_rethrow(err); // let Next.js control-flow signals (prerender bailout, redirects) through
      return errorResponse(err);
    }
  };
}
