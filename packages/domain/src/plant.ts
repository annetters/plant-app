export type SunRequirement = "full-sun" | "part-sun" | "part-shade" | "full-shade";
export type FoliageType = "deciduous" | "evergreen";
export type NativeStatus = "native" | "non-native";

export const SUN_REQUIREMENTS: readonly SunRequirement[] = [
  "full-sun",
  "part-sun",
  "part-shade",
  "full-shade",
];
export const FOLIAGE_TYPES: readonly FoliageType[] = ["deciduous", "evergreen"];
export const NATIVE_STATUSES: readonly NativeStatus[] = ["native", "non-native"];

/**
 * The USDA's 13 whole hardiness zone numbers. A Plant's own hardiness
 * rating is always a *range* of whole zones (a nursery tag reads "Zones
 * 5-7", never "Zones 5a-7b") — the a/b half-zone precision only applies to
 * a single real-world location's zone, not a plant's tolerance range, so
 * it has no place here. See `HardinessZoneRange`.
 */
export const HARDINESS_ZONE_NUMBERS: readonly number[] = Array.from(
  { length: 13 },
  (_, i) => i + 1,
);

/** Month/day only — a bloom window is year-independent, per CONTEXT.md. */
export interface MonthDay {
  month: number;
  day: number;
}

export interface BloomWindow {
  start: MonthDay;
  end: MonthDay;
}

/** The whole-zone range a Plant is rated hardy across, e.g. `{ min: 5, max: 7 }` for a tag reading "Zones 5-7". A single-zone rating is `min === max`. */
export interface HardinessZoneRange {
  min: number;
  max: number;
}

export interface PlantInput {
  commonName: string;
  scientificName: string;
  cultivar?: string;
  flowerColor?: string;
  bloomWindow?: BloomWindow;
  sunRequirement?: SunRequirement;
  matureHeightInches?: number;
  matureSpreadInches?: number;
  hardinessZoneRange?: HardinessZoneRange;
  foliageType?: FoliageType;
  nativeStatus?: NativeStatus;
  referencePhotoPaths?: string[];
}

export interface Plant extends Omit<PlantInput, "referencePhotoPaths"> {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** Always present (defaults to `[]`) once mapped from a row — unlike PlantInput, where it's optional on the way in. */
  referencePhotoPaths: string[];
}

export type PlantValidationErrors = Partial<
  Record<
    | keyof PlantInput
    | "bloomWindow.start"
    | "bloomWindow.end"
    | "hardinessZoneRange.min"
    | "hardinessZoneRange.max",
    string
  >
>;

export type PlantValidationResult =
  | { ok: true }
  | { ok: false; errors: PlantValidationErrors };

// Index 1 (February) allows day 29 — a bloom window has no year, so a
// recurring Feb 29 bloom day is valid rather than tied to leap years.
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// A free-text identity/descriptive field (name, cultivar, color) is
// meaningless as digits/punctuation alone — "000" isn't a common name.
// Unicode-aware (\p{L}) so a name written entirely in a non-Latin script
// (e.g. Cyrillic, Japanese) isn't wrongly rejected as letterless.
const LETTER_PATTERN = /\p{L}/u;

export function isValidMonthDay(value: MonthDay): boolean {
  if (!Number.isInteger(value.month) || value.month < 1 || value.month > 12) return false;
  if (!Number.isInteger(value.day) || value.day < 1) return false;
  return value.day <= DAYS_IN_MONTH[value.month - 1];
}

/** A required free-text field: blank first, then must contain a letter. */
function requiredTextError(value: string, fieldName: string): string | undefined {
  if (!value.trim()) return `${fieldName} is required.`;
  if (!LETTER_PATTERN.test(value)) return `${fieldName} must include a letter.`;
  return undefined;
}

/** An optional free-text field: blank is fine (omitted), but if present must contain a letter. */
function optionalTextError(value: string, fieldName: string): string | undefined {
  if (!value.trim()) return undefined;
  if (!LETTER_PATTERN.test(value)) return `${fieldName} must include a letter.`;
  return undefined;
}

export function validatePlantInput(input: PlantInput): PlantValidationResult {
  const errors: PlantValidationErrors = {};

  const commonNameError = requiredTextError(input.commonName, "Common name");
  if (commonNameError) errors.commonName = commonNameError;

  const scientificNameError = requiredTextError(input.scientificName, "Scientific name");
  if (scientificNameError) errors.scientificName = scientificNameError;

  if (input.cultivar !== undefined) {
    const cultivarError = optionalTextError(input.cultivar, "Cultivar");
    if (cultivarError) errors.cultivar = cultivarError;
  }

  if (input.flowerColor !== undefined) {
    const flowerColorError = optionalTextError(input.flowerColor, "Flower color");
    if (flowerColorError) errors.flowerColor = flowerColorError;
  }

  if (input.bloomWindow) {
    if (!isValidMonthDay(input.bloomWindow.start)) {
      errors["bloomWindow.start"] = "Bloom start must be a valid month and day.";
    }
    if (!isValidMonthDay(input.bloomWindow.end)) {
      errors["bloomWindow.end"] = "Bloom end must be a valid month and day.";
    }
  }

  if (input.matureHeightInches !== undefined && !(input.matureHeightInches > 0)) {
    errors.matureHeightInches = "Mature height must be greater than zero.";
  }
  if (input.matureSpreadInches !== undefined && !(input.matureSpreadInches > 0)) {
    errors.matureSpreadInches = "Mature spread must be greater than zero.";
  }

  if (input.hardinessZoneRange) {
    const { min, max } = input.hardinessZoneRange;
    const minValid = HARDINESS_ZONE_NUMBERS.includes(min);
    const maxValid = HARDINESS_ZONE_NUMBERS.includes(max);
    if (!minValid) errors["hardinessZoneRange.min"] = "Min zone must be a standard USDA zone (1-13).";
    if (!maxValid) errors["hardinessZoneRange.max"] = "Max zone must be a standard USDA zone (1-13).";
    if (minValid && maxValid && max < min) {
      errors["hardinessZoneRange.max"] = "Max zone must be at least the min zone.";
    }
  }

  if (input.sunRequirement !== undefined && !SUN_REQUIREMENTS.includes(input.sunRequirement)) {
    errors.sunRequirement = "Unrecognized sun requirement.";
  }
  if (input.foliageType !== undefined && !FOLIAGE_TYPES.includes(input.foliageType)) {
    errors.foliageType = "Unrecognized foliage type.";
  }
  if (input.nativeStatus !== undefined && !NATIVE_STATUSES.includes(input.nativeStatus)) {
    errors.nativeStatus = "Unrecognized native status.";
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true };
}

/** The `plants` table's row shape — the seam between domain types and Postgres. */
export interface PlantRow {
  id: string;
  common_name: string;
  scientific_name: string;
  cultivar: string | null;
  flower_color: string | null;
  bloom_start_month: number | null;
  bloom_start_day: number | null;
  bloom_end_month: number | null;
  bloom_end_day: number | null;
  sun_requirement: string | null;
  mature_height_inches: number | null;
  mature_spread_inches: number | null;
  hardiness_zone_min: number | null;
  hardiness_zone_max: number | null;
  foliage_type: string | null;
  native_status: string | null;
  reference_photo_paths: string[];
  created_at: string;
  updated_at: string;
}

export function plantInputToRow(
  input: PlantInput,
): Omit<PlantRow, "id" | "created_at" | "updated_at"> {
  return {
    common_name: input.commonName,
    scientific_name: input.scientificName,
    cultivar: input.cultivar ?? null,
    flower_color: input.flowerColor ?? null,
    bloom_start_month: input.bloomWindow?.start.month ?? null,
    bloom_start_day: input.bloomWindow?.start.day ?? null,
    bloom_end_month: input.bloomWindow?.end.month ?? null,
    bloom_end_day: input.bloomWindow?.end.day ?? null,
    sun_requirement: input.sunRequirement ?? null,
    mature_height_inches: input.matureHeightInches ?? null,
    mature_spread_inches: input.matureSpreadInches ?? null,
    hardiness_zone_min: input.hardinessZoneRange?.min ?? null,
    hardiness_zone_max: input.hardinessZoneRange?.max ?? null,
    foliage_type: input.foliageType ?? null,
    native_status: input.nativeStatus ?? null,
    reference_photo_paths: input.referencePhotoPaths ?? [],
  };
}

export function plantFromRow(row: PlantRow): Plant {
  const bloomWindow: BloomWindow | undefined =
    row.bloom_start_month !== null &&
    row.bloom_start_day !== null &&
    row.bloom_end_month !== null &&
    row.bloom_end_day !== null
      ? {
          start: { month: row.bloom_start_month, day: row.bloom_start_day },
          end: { month: row.bloom_end_month, day: row.bloom_end_day },
        }
      : undefined;

  const hardinessZoneRange: HardinessZoneRange | undefined =
    row.hardiness_zone_min !== null && row.hardiness_zone_max !== null
      ? { min: row.hardiness_zone_min, max: row.hardiness_zone_max }
      : undefined;

  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    commonName: row.common_name,
    scientificName: row.scientific_name,
    ...(row.cultivar !== null && { cultivar: row.cultivar }),
    ...(row.flower_color !== null && { flowerColor: row.flower_color }),
    ...(bloomWindow && { bloomWindow }),
    ...(row.sun_requirement !== null && {
      sunRequirement: row.sun_requirement as SunRequirement,
    }),
    ...(row.mature_height_inches !== null && {
      matureHeightInches: row.mature_height_inches,
    }),
    ...(row.mature_spread_inches !== null && {
      matureSpreadInches: row.mature_spread_inches,
    }),
    ...(hardinessZoneRange && { hardinessZoneRange }),
    ...(row.foliage_type !== null && { foliageType: row.foliage_type as FoliageType }),
    ...(row.native_status !== null && { nativeStatus: row.native_status as NativeStatus }),
    referencePhotoPaths: row.reference_photo_paths,
  };
}
