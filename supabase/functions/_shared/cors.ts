// Shared across every Edge Function that's called from the browser
// (apps/web), not just create-property. Browser calls are cross-origin, so
// a POST carrying a JSON body and an Authorization header triggers a CORS
// preflight (OPTIONS) first — every response, including the preflight's,
// needs these headers or the browser blocks the request before the
// function's own logic ever gets a say.
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  // x-client-info is sent by supabase-js on every request by default (see
  // its DEFAULT_HEADERS), not just when explicitly configured — omitting it
  // makes the browser's real preflight fail even though a hand-crafted curl
  // OPTIONS request (which doesn't set that header) looks fine.
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

/** Call first in every handler; returns a response to return immediately if this was the preflight. */
export function handlePreflight(req: Request): Response | null {
  return req.method === "OPTIONS" ? new Response(null, { status: 204, headers: CORS_HEADERS }) : null;
}
