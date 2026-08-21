// Backs the address-picker on the Property page. A bare street with no
// locality ("1 main st") is otherwise a shot in the dark across the whole
// planet — Nominatim's free-text search still returns *something*, just not
// reliably the right something. Requiring the user to pick a specific
// candidate (rather than typing free text and submitting it directly) is
// what closes that gap; see create-property, which now takes an
// already-picked candidate instead of re-geocoding raw text itself.
import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { parseHitCoordinates, searchNominatim } from "../_shared/nominatim.ts";

const MAX_CANDIDATES = 5;
// Mirrors apps/web/src/property/AddressAutocomplete.tsx's own
// MIN_QUERY_LENGTH — keep the two in sync by hand.
const MIN_QUERY_LENGTH = 3;

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  let query = "";
  try {
    const body = await req.json();
    if (typeof body.query === "string") query = body.query.trim();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }
  // Authenticated (not left open to the whole internet) even though nothing
  // is persisted here — same guard as create-property, just without needing
  // the resulting user id for anything. Checked before the length
  // short-circuit below so *every* request is authenticated, not just the
  // ones that reach Nominatim.
  const auth = await requireUser(req);
  if (!auth) return jsonResponse({ error: "Not authenticated." }, 401);

  // Below the minimum length, return an empty list rather than an error —
  // this is a normal, expected state while the user is still typing, not a
  // failure.
  if (query.length < MIN_QUERY_LENGTH) return jsonResponse({ candidates: [] });

  let hits: Awaited<ReturnType<typeof searchNominatim>>;
  try {
    hits = await searchNominatim(query, MAX_CANDIDATES);
  } catch {
    return jsonResponse({ error: "Could not reach the geocoding service. Try again." });
  }

  const candidates = hits
    .map((hit) => {
      const coords = parseHitCoordinates(hit);
      // A malformed hit (missing/non-numeric lat-lon, or a non-string
      // display_name) is dropped rather than shown as a blank/"undefined"
      // option — never surfaced as something the user could pick.
      if (!coords || typeof hit.display_name !== "string" || !hit.display_name) return null;
      return { displayName: hit.display_name, ...coords };
    })
    .filter((candidate): candidate is { displayName: string; latitude: number; longitude: number } =>
      candidate !== null,
    );

  return jsonResponse({ candidates });
});
