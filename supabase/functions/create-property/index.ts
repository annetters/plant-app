// Ticket #5: Property + aerial base map.
//
// Runs server-side (Deno edge runtime) per ADR-0003 — anything calling an
// external adapter (here: a geocoder and a tile server) runs as a Supabase
// Edge Function, even though neither Nominatim nor Esri needs a credential.
// Geocodes the submitted address, probes which zoom levels actually have
// aerial imagery there (see ADR-0002 — missing tiles come back HTTP 200 as
// grey placeholders, so this can't be skipped), and inserts the resulting
// Property row as the calling user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

const geocodeUrl = (address: string) =>
  `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;

// tilemap, not tile — this is the availability probe (see ADR-0002), not
// image bytes. Path order is {z}/{row}/{col}, i.e. y before x.
const tilemapUrl = (z: number, x: number, y: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tilemap/${z}/${y}/${x}/2/2`;

// Nominatim's usage policy requires a descriptive User-Agent identifying the
// calling application; unidentified traffic gets rate-limited or blocked.
const USER_AGENT = "plant-app (personal garden registry; github.com/annetters/plant-app)";

async function geocode(
  address: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const res = await fetch(geocodeUrl(address), { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Geocoding service returned HTTP ${res.status}.`);
  const results = await res.json();
  if (!Array.isArray(results) || results.length === 0) return null;
  const [hit] = results;
  const latitude = parseFloat(hit.lat);
  const longitude = parseFloat(hit.lon);
  // A malformed hit (missing/non-numeric lat or lon) is treated the same as
  // no match — better than letting NaN reach the `properties` table's
  // latitude/longitude CHECK constraints as a raw, unfriendly Postgres error.
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

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

// Browser calls to an Edge Function are cross-origin, so a POST carrying a
// JSON body and an Authorization header triggers a CORS preflight (OPTIONS)
// first. Without these headers on every response — the preflight's included —
// the browser blocks the real request before this function's own logic ever
// gets a say.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  // x-client-info is sent by supabase-js on every request by default (see
  // its DEFAULT_HEADERS), not just when explicitly configured — omitting it
  // here makes the browser's real preflight fail even though a hand-crafted
  // curl OPTIONS request (which doesn't set that header) looks fine.
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  let address = "";
  try {
    const body = await req.json();
    if (typeof body.address === "string") address = body.address.trim();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }
  if (!address) return jsonResponse({ error: "Address is required." }, 400);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Not authenticated." }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  // Resolved explicitly (not left to a column default) because this insert
  // runs as this function's own client, authenticated only via the forwarded
  // header above — the row's `user_id` has to come from somewhere, and
  // `auth.getUser()` is also what proves the header is a real, live session
  // rather than just any non-empty string.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return jsonResponse({ error: "Not authenticated." }, 401);

  // Expected, user-reachable failures below are returned as HTTP 200 with an
  // `{ error }` body — not a non-2xx status — because `supabase-js`'s
  // `functions.invoke` doesn't surface a non-2xx response's JSON body as a
  // usable client-side message, only a generic transport-level one.
  let location: { latitude: number; longitude: number } | null;
  try {
    location = await geocode(address);
  } catch {
    return jsonResponse({ error: "Could not reach the geocoding service. Try again." });
  }
  if (!location) return jsonResponse({ error: "No match for that address." });

  const probeResults = await probeImagery(location.latitude, location.longitude);
  const bestZoom = pickBestZoom(probeResults);

  const { data, error } = await supabase
    .from("properties")
    .insert({
      user_id: user.id,
      address,
      latitude: location.latitude,
      longitude: location.longitude,
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
