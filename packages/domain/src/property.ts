/**
 * Web Mercator tile math, ported from the validated prototype
 * (`prototype/satellite-base/index.html`'s `GeoBase` module — see ADR-0002).
 * Mirrored in `supabase/functions/create-property/index.ts` for the Deno
 * edge-function runtime, which can't import this npm workspace package —
 * keep the two in sync.
 */
import type { BedPoint } from "./bed.js";
import {
  derivePixelsPerFootFromScaleReference,
  type ScaleReferenceInput,
} from "./scaleReference.js";

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

/**
 * One geocoder search result, offered as a pick — never applied
 * automatically. A bare street with no locality ("1 main st") is
 * otherwise a shot in the dark across the whole planet; requiring a
 * specific candidate to be chosen is what narrows it, not stricter input
 * validation (real addresses vary too much to validate by shape).
 */
export interface AddressCandidate {
  displayName: string;
  latitude: number;
  longitude: number;
}

/**
 * Which of the three sources (CONTEXT.md's Property entry) a Property's base
 * map comes from — one per Property, never mixed (ticket #6's own
 * acceptance criterion), chosen once up front when the Property is created
 * and not changed afterward (a Property is recreated, not re-sourced, if the
 * gardener wants a different kind of base map). The one exception: an
 * `'aerial'` Property whose address turns out to have no imagery coverage
 * can still fall back to `'photo'`/`'drawn'` afterward — that's completing
 * the original setup, not switching a settled choice.
 */
export type BaseMapSource = "aerial" | "photo" | "drawn";

export interface PropertyInput {
  /**
   * What the user typed in. Required (and geocoded) only for
   * `baseMapSource === 'aerial'` — `'photo'`/`'drawn'` Properties skip
   * geocoding entirely (no address is ever sent to Nominatim/Esri for them,
   * by design: some gardeners choose those sources specifically to avoid
   * that) and are identified by `name` instead. Always shown alongside
   * `resolvedAddress` when present, so a bad geocoder match is visible, not
   * silent.
   */
  address: string | null;
  /** What the geocoder actually matched `address` to (Nominatim's `display_name`), or `null` for a Property created before this field existed, or one with no address at all. */
  resolvedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Highest zoom with confirmed imagery, or `null` if none was available anywhere probed, or never probed at all (`baseMapSource !== 'aerial'`). */
  imageryZoom: number | null;
  imageryAvailable: boolean;
  baseMapSource: BaseMapSource;
  /** Storage path of an uploaded plot plan/survey photo — set only when `baseMapSource === 'photo'`. */
  baseMapPhotoPath: string | null;
  /** Hand-drawn structural plan (ticket #6), one polyline per stroke, in the drawing canvas's own pixel space — set only when `baseMapSource === 'drawn'`. */
  baseMapDrawing: BedPoint[][] | null;
  /** Calibrates `baseMapPhotoPath`/`baseMapDrawing` to real-world feet (see `scaleReference.ts`) — always `null` for `baseMapSource === 'aerial'`, which derives its scale from latitude/zoom instead (see `pixelsPerFoot` below). */
  scaleReference: ScaleReferenceInput | null;
  /** User-chosen label for a `'photo'`/`'drawn'` Property, which has no address to identify it by. Always `null` for `'aerial'`, which is identified by `address` instead. */
  name: string | null;
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

  if (input.baseMapSource === "aerial") {
    if (!input.address?.trim()) {
      errors.address = "Address is required.";
    }
    if (input.latitude === null) {
      errors.latitude = "Latitude is required.";
    }
    if (input.longitude === null) {
      errors.longitude = "Longitude is required.";
    }
  } else if (!input.name?.trim()) {
    errors.name = "Name is required.";
  }

  if (input.latitude !== null && !(input.latitude >= -90 && input.latitude <= 90)) {
    errors.latitude = "Latitude must be between -90 and 90.";
  }
  if (input.longitude !== null && !(input.longitude >= -180 && input.longitude <= 180)) {
    errors.longitude = "Longitude must be between -180 and 180.";
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true };
}

/** The `properties` table's row shape — the seam between domain types and Postgres. */
export interface PropertyRow {
  id: string;
  address: string | null;
  resolved_address: string | null;
  latitude: number | null;
  longitude: number | null;
  imagery_zoom: number | null;
  imagery_available: boolean;
  base_map_source: BaseMapSource;
  base_map_photo_path: string | null;
  base_map_drawing: BedPoint[][] | null;
  scale_reference: ScaleReferenceInput | null;
  name: string | null;
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
    base_map_source: input.baseMapSource,
    base_map_photo_path: input.baseMapPhotoPath,
    base_map_drawing: input.baseMapDrawing,
    scale_reference: input.scaleReference,
    name: input.name,
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
    baseMapSource: row.base_map_source,
    baseMapPhotoPath: row.base_map_photo_path,
    baseMapDrawing: row.base_map_drawing,
    scaleReference: row.scale_reference,
    name: row.name,
  };
}

/**
 * The scale (pixels-per-foot) to render this Property's Beds/Pins against,
 * regardless of which of the three base-map sources it uses — `null` when
 * there's no scale to draw against yet (no aerial imagery and no Scale
 * Reference calibrated). This is the one seam `BedEditor`/`PlantingMap`
 * should call instead of reaching for `pixelsPerFoot`/`imageryZoom` directly,
 * so a photo/drawn Property draws Beds and Pins exactly like an aerial one.
 */
export function pixelsPerFootForProperty(property: Property): number | null {
  if (property.baseMapSource === "aerial") {
    return property.imageryZoom !== null && property.latitude !== null
      ? pixelsPerFoot(property.latitude, property.imageryZoom)
      : null;
  }
  return property.scaleReference
    ? derivePixelsPerFootFromScaleReference(property.scaleReference)
    : null;
}
