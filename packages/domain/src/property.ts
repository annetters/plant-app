/**
 * Web Mercator tile math, ported from the validated prototype
 * (`prototype/satellite-base/index.html`'s `GeoBase` module — see ADR-0002).
 * Mirrored in `supabase/functions/create-property/index.ts` for the Deno
 * edge-function runtime, which can't import this npm workspace package —
 * keep the two in sync.
 */
const TILE_SIZE = 256;
const EARTH_CIRCUMFERENCE_METERS = 40075016.686;
const METERS_PER_FOOT = 0.3048;

/** Candidate zoom levels to probe for imagery availability, highest detail first. */
export const AERIAL_ZOOM_CANDIDATES: readonly number[] = [21, 20, 19, 18];

/**
 * Ground distance covered by one pixel at a given latitude and zoom. Mercator
 * stretches with latitude, so this is cos(latitude)-corrected — omitting that
 * correction makes every distance wrong by roughly 25% at New England
 * latitudes (see ADR-0002).
 */
export function metersPerPixel(latitude: number, zoom: number): number {
  return (
    (EARTH_CIRCUMFERENCE_METERS * Math.cos((latitude * Math.PI) / 180)) /
    (TILE_SIZE * 2 ** zoom)
  );
}

export function feetPerPixel(latitude: number, zoom: number): number {
  return metersPerPixel(latitude, zoom) / METERS_PER_FOOT;
}

export function pixelsPerFoot(latitude: number, zoom: number): number {
  return 1 / feetPerPixel(latitude, zoom);
}

/** lon/lat -> tile indices at zoom `z`, in the standard XYZ tile scheme. */
export function lonLatToTile(
  latitude: number,
  longitude: number,
  zoom: number,
): { x: number; y: number } {
  const n = TILE_SIZE * 2 ** zoom;
  const worldX = ((longitude + 180) / 360) * n;
  const latRad = (latitude * Math.PI) / 180;
  const worldY =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x: Math.floor(worldX / TILE_SIZE), y: Math.floor(worldY / TILE_SIZE) };
}

export interface ZoomProbeResult {
  zoom: number;
  available: boolean;
}

/** Highest zoom that actually has imagery, given probe results — null if none do. */
export function pickBestZoom(results: readonly ZoomProbeResult[]): number | null {
  const available = results.filter((r) => r.available).map((r) => r.zoom);
  return available.length > 0 ? Math.max(...available) : null;
}

/**
 * Esri World Imagery — public, no API key, sends
 * `Access-Control-Allow-Origin: *`. Note the path order: `{z}/{row}/{col}`,
 * i.e. y before x, the opposite of most tile URL conventions.
 */
export function aerialTileUrl(zoom: number, x: number, y: number): string {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`;
}

export interface PropertyInput {
  /** What the user typed in. Never re-derived — always shown alongside `resolvedAddress` so a bad geocoder match is visible, not silent. */
  address: string;
  /** What the geocoder actually matched `address` to (Nominatim's `display_name`), or `null` for a Property created before this field existed. */
  resolvedAddress: string | null;
  latitude: number;
  longitude: number;
  /** Highest zoom with confirmed imagery, or `null` if none was available anywhere probed. */
  imageryZoom: number | null;
  imageryAvailable: boolean;
}

export interface Property extends PropertyInput {
  id: string;
  createdAt: string;
}

export type PropertyValidationErrors = Partial<Record<keyof PropertyInput, string>>;

export type PropertyValidationResult =
  | { ok: true }
  | { ok: false; errors: PropertyValidationErrors };

export function validatePropertyInput(input: PropertyInput): PropertyValidationResult {
  const errors: PropertyValidationErrors = {};

  if (!input.address.trim()) {
    errors.address = "Address is required.";
  }
  if (!(input.latitude >= -90 && input.latitude <= 90)) {
    errors.latitude = "Latitude must be between -90 and 90.";
  }
  if (!(input.longitude >= -180 && input.longitude <= 180)) {
    errors.longitude = "Longitude must be between -180 and 180.";
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true };
}

/** The `properties` table's row shape — the seam between domain types and Postgres. */
export interface PropertyRow {
  id: string;
  address: string;
  resolved_address: string | null;
  latitude: number;
  longitude: number;
  imagery_zoom: number | null;
  imagery_available: boolean;
  created_at: string;
}

export function propertyInputToRow(
  input: PropertyInput,
): Omit<PropertyRow, "id" | "created_at"> {
  return {
    address: input.address,
    resolved_address: input.resolvedAddress,
    latitude: input.latitude,
    longitude: input.longitude,
    imagery_zoom: input.imageryZoom,
    imagery_available: input.imageryAvailable,
  };
}

export function propertyFromRow(row: PropertyRow): Property {
  return {
    id: row.id,
    createdAt: row.created_at,
    address: row.address,
    resolvedAddress: row.resolved_address,
    latitude: row.latitude,
    longitude: row.longitude,
    imageryZoom: row.imagery_zoom,
    imageryAvailable: row.imagery_available,
  };
}
