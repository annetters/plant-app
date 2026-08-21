// Ticket #5: Property + aerial base map.
//
// Runs server-side (Deno edge runtime) per ADR-0003 — anything calling an
// external adapter (here: a tile server) runs as a Supabase Edge Function,
// even though it doesn't need a credential. Takes a location the user has
// already picked from search-addresses's candidates (never raw address
// text — see that function for why: a bare street with no locality is a
// geocoding shot in the dark, closed by requiring a specific pick, not by
// re-resolving text here), probes which zoom levels actually have aerial
// imagery there (see ADR-0002 — missing tiles come back HTTP 200 as grey
// placeholders, so this can't be skipped), and inserts the resulting
// Property row as the calling user.
import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";

// Mirrors packages/domain/src/property.ts's Web Mercator math. Deno edge
// functions can't import this npm workspace package directly — keep the
// two in sync by hand.
const TILE_SIZE = 256;
const AERIAL_ZOOM_CANDIDATES = [21, 20, 19, 18];

function lonLatToTile(latitude: number, longitude: number, zoom: number) {
  const n = TILE_SIZE * 2 ** zoom;
  const worldX = ((longitude + 180) / 360) * n;
  const latRad = (latitude * Math.PI) / 180;
  const worldY =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x: Math.floor(worldX / TILE_SIZE), y: Math.floor(worldY / TILE_SIZE) };
}

function pickBestZoom(results: { zoom: number; available: boolean }[]): number | null {
  const available = results.filter((r) => r.available).map((r) => r.zoom);
  return available.length > 0 ? Math.max(...available) : null;
}

// tilemap, not tile — this is the availability probe (see ADR-0002), not
// image bytes. Path order is {z}/{row}/{col}, i.e. y before x.
const tilemapUrl = (z: number, x: number, y: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tilemap/${z}/${y}/${x}/2/2`;

async function probeImagery(
  latitude: number,
  longitude: number,
): Promise<{ zoom: number; available: boolean }[]> {
  return Promise.all(
    AERIAL_ZOOM_CANDIDATES.map(async (zoom) => {
      const { x, y } = lonLatToTile(latitude, longitude, zoom);
      try {
        const res = await fetch(tilemapUrl(zoom, x, y));
        if (!res.ok) return { zoom, available: false };
        const body = await res.json();
        const available = Array.isArray(body.data) && body.data.some((v: number) => v === 1);
        return { zoom, available };
      } catch {
        return { zoom, available: false };
      }
    }),
  );
}

interface CreatePropertyRequest {
  address: string;
  resolvedAddress: string;
  latitude: number;
  longitude: number;
}

/**
 * Range/shape-checked, but not re-verified against Nominatim — this trusts
 * that latitude/longitude/resolvedAddress actually came from a real
 * search-addresses pick rather than re-geocoding to confirm it. Consistent
 * with ADR-0003's "Domain logic execution" section, held there at lower
 * confidence for the same reason: acceptable for a single-user personal app
 * with no adversarial threat model, not for a multi-tenant one. Reconsider
 * (e.g. re-run the geocode server-side and compare) if this app ever gains
 * multi-user or shared-access features.
 */
function parseRequestBody(body: unknown): CreatePropertyRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const { address, resolvedAddress, latitude, longitude } = body as Record<string, unknown>;
  if (typeof address !== "string" || !address.trim()) return null;
  if (typeof resolvedAddress !== "string" || !resolvedAddress.trim()) return null;
  if (typeof latitude !== "number" || !(latitude >= -90 && latitude <= 90)) return null;
  if (typeof longitude !== "number" || !(longitude >= -180 && longitude <= 180)) return null;
  return { address: address.trim(), resolvedAddress, latitude, longitude };
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  let parsedBody: unknown;
  try {
    parsedBody = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }
  const input = parseRequestBody(parsedBody);
  // A well-formed client can't reach this — the address-picker only ever
  // sends a candidate it just received from search-addresses — so this is a
  // client-bug guard, not a user-reachable validation message.
  if (!input) return jsonResponse({ error: "A picked address location is required." }, 400);

  const auth = await requireUser(req);
  if (!auth) return jsonResponse({ error: "Not authenticated." }, 401);
  const { supabase, user } = auth;

  // Expected, user-reachable failures below are returned as HTTP 200 with an
  // `{ error }` body — not a non-2xx status — because `supabase-js`'s
  // `functions.invoke` doesn't surface a non-2xx response's JSON body as a
  // usable client-side message, only a generic transport-level one.
  const probeResults = await probeImagery(input.latitude, input.longitude);
  const bestZoom = pickBestZoom(probeResults);

  const { data, error } = await supabase
    .from("properties")
    .insert({
      user_id: user.id,
      address: input.address,
      resolved_address: input.resolvedAddress,
      latitude: input.latitude,
      longitude: input.longitude,
      imagery_zoom: bestZoom,
      imagery_available: bestZoom !== null,
    })
    .select()
    .single();

  if (error) {
    const message = error.code === "23505" ? "You already have a Property." : error.message;
    return jsonResponse({ error: message });
  }

  return jsonResponse(data, 201);
});
