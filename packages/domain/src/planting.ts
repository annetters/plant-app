/**
 * A Planting: one placement decision for a Plant within a Bed (see
 * `CONTEXT.md`). Quantity is a single field, never a per-specimen record —
 * a Planting of 24 is one row with `quantity: 24`. Pin coordinates live in
 * the same Property-relative real-world-feet space as their parent Bed's
 * own outline points (`BedPoint`, see `bed.ts`), never pixels and never a
 * Bed-local offset, so a Bed's outline and every Pin within it stay in one
 * consistent frame.
 */

import type { BedPoint } from "./bed.js";

export interface PlantingInput {
  plantId: string;
  bedId: string;
  quantity: number;
  yearAcquired?: number;
  sourceNursery?: string;
  /** Where the Pin was dropped, in Property-relative real-world feet — see `BedPoint`. */
  pin: BedPoint;
}

export interface Planting extends PlantingInput {
  id: string;
  createdAt: string;
}

export type PlantingValidationErrors = Partial<Record<keyof PlantingInput, string>>;

export type PlantingValidationResult =
  | { ok: true }
  | { ok: false; errors: PlantingValidationErrors };

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

export function validatePlantingInput(input: PlantingInput): PlantingValidationResult {
  const errors: PlantingValidationErrors = {};

  if (!input.plantId.trim()) {
    errors.plantId = "A Plant reference is required.";
  }
  if (!input.bedId.trim()) {
    errors.bedId = "A Bed reference is required.";
  }
  if (!(Number.isInteger(input.quantity) && input.quantity >= 1)) {
    errors.quantity = "Quantity must be a whole number of at least 1.";
  }
  if (
    input.yearAcquired !== undefined &&
    !(Number.isInteger(input.yearAcquired) && input.yearAcquired >= MIN_YEAR && input.yearAcquired <= MAX_YEAR)
  ) {
    errors.yearAcquired = "Year acquired must be a real year.";
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true };
}

/** The `plantings` table's row shape — the seam between domain types and Postgres. */
export interface PlantingRow {
  id: string;
  plant_id: string;
  bed_id: string;
  quantity: number;
  year_acquired: number | null;
  source_nursery: string | null;
  pin_x: number;
  pin_y: number;
  created_at: string;
}

export function plantingInputToRow(input: PlantingInput): Omit<PlantingRow, "id" | "created_at"> {
  return {
    plant_id: input.plantId,
    bed_id: input.bedId,
    quantity: input.quantity,
    year_acquired: input.yearAcquired ?? null,
    source_nursery: input.sourceNursery ?? null,
    pin_x: input.pin.x,
    pin_y: input.pin.y,
  };
}

export function plantingFromRow(row: PlantingRow): Planting {
  return {
    id: row.id,
    createdAt: row.created_at,
    plantId: row.plant_id,
    bedId: row.bed_id,
    quantity: row.quantity,
    ...(row.year_acquired !== null && { yearAcquired: row.year_acquired }),
    ...(row.source_nursery !== null && { sourceNursery: row.source_nursery }),
    pin: { x: row.pin_x, y: row.pin_y },
  };
}

/**
 * A Planting's dated photo log (see `CONTEXT.md`). Its own table, not an
 * array column like Plant's `referencePhotoPaths` — each photo carries its
 * own date, which a plain path list can't.
 */
export interface PlantingPhotoInput {
  plantingId: string;
  path: string;
  /** The date the photo depicts (`YYYY-MM-DD`), not necessarily the upload date. */
  takenOn: string;
}

export interface PlantingPhoto extends PlantingPhotoInput {
  id: string;
  createdAt: string;
}

export type PlantingPhotoValidationErrors = Partial<Record<keyof PlantingPhotoInput, string>>;

export type PlantingPhotoValidationResult =
  | { ok: true }
  | { ok: false; errors: PlantingPhotoValidationErrors };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function validatePlantingPhotoInput(
  input: PlantingPhotoInput,
): PlantingPhotoValidationResult {
  const errors: PlantingPhotoValidationErrors = {};

  if (!input.takenOn.trim()) {
    errors.takenOn = "A date is required.";
  } else if (!isValidCalendarDate(input.takenOn)) {
    errors.takenOn = "Enter a valid date.";
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true };
}

/** The `planting_photos` table's row shape — the seam between domain types and Postgres. */
export interface PlantingPhotoRow {
  id: string;
  planting_id: string;
  storage_path: string;
  taken_on: string;
  created_at: string;
}

export function plantingPhotoInputToRow(
  input: PlantingPhotoInput,
): Omit<PlantingPhotoRow, "id" | "created_at"> {
  return {
    planting_id: input.plantingId,
    storage_path: input.path,
    taken_on: input.takenOn,
  };
}

export function plantingPhotoFromRow(row: PlantingPhotoRow): PlantingPhoto {
  return {
    id: row.id,
    createdAt: row.created_at,
    plantingId: row.planting_id,
    path: row.storage_path,
    takenOn: row.taken_on,
  };
}

/**
 * Ray-casting point-in-polygon test, operating in the same real-world-feet
 * space as `BedPoint` — used to resolve which Bed a dragged Pin landed in
 * without the user ever picking a Bed manually (see CONTEXT.md's Pin entry).
 */
function isPointInPolygon(point: BedPoint, polygon: readonly BedPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const { x: xi, y: yi } = polygon[i];
    const { x: xj, y: yj } = polygon[j];
    const intersects = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * The first Bed (in list order) whose outline contains the given point, or
 * `null` if the point falls outside every Bed — e.g. a Pin dropped
 * somewhere on the map that isn't over any drawn Bed. Takes anything
 * outline-shaped (`points`), not the full `Bed` type, so callers can pass
 * either raw Beds or their render-time-smoothed outlines.
 */
export function findBedContainingPoint<T extends { points: readonly BedPoint[] }>(
  point: BedPoint,
  beds: readonly T[],
): T | null {
  for (const bed of beds) {
    if (isPointInPolygon(point, bed.points)) return bed;
  }
  return null;
}
