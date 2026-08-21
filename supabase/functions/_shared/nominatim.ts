// Used by search-addresses (multiple candidates, for the address-picker
// UI). create-property no longer geocodes — it takes a candidate the user
// already picked from search-addresses's results, so it doesn't call this
// module. Lives in `_shared/` on the expectation that a future function
// (e.g. Tag Scan's own geocoding/lookup needs) may end up needing it too.

export interface NominatimHit {
  display_name: string;
  lat: string;
  lon: string;
}

// Nominatim's usage policy requires a descriptive User-Agent identifying the
// calling application; unidentified traffic gets rate-limited or blocked.
// This can only be set server-side — browsers refuse to let JS set
// `User-Agent` on a fetch/XHR request at all (it's a forbidden header name
// per the Fetch spec), so geocoding from the client isn't just a policy
// violation, it's not technically possible to identify the app if it did.
const USER_AGENT = "plant-app (personal garden registry; github.com/annetters/plant-app)";

const searchUrl = (query: string, limit: number) =>
  `https://nominatim.openstreetmap.org/search?format=json&limit=${limit}&q=${encodeURIComponent(query)}`;

export async function searchNominatim(query: string, limit: number): Promise<NominatimHit[]> {
  const res = await fetch(searchUrl(query, limit), { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Geocoding service returned HTTP ${res.status}.`);
  const results = await res.json();
  return Array.isArray(results) ? results : [];
}

/** A malformed hit (missing/non-numeric lat or lon) — treated as not a real match by callers. */
export function parseHitCoordinates(hit: NominatimHit): { latitude: number; longitude: number } | null {
  const latitude = parseFloat(hit.lat);
  const longitude = parseFloat(hit.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}
