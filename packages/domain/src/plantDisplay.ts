import type { MonthDay } from "./plant.js";
import type { Plant } from "./plant.js";

/** Full calendar month names, January-first — shared by any UI needing a month picker or axis label (Bloom Timeline's year-view axis and month filter, the Registry's bloom-month filter, on both web and native). */
export const MONTH_NAMES: readonly string[] = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Renders a `MonthDay` (e.g. `{ month: 4, day: 15 }`) as `"April 15"` — shared by any UI showing a bloom window or date-range trigger. */
export function formatMonthDay(value: MonthDay): string {
  return `${MONTH_NAMES[value.month - 1]} ${value.day}`;
}

/** Renders a hyphenated domain enum value (e.g. `"full-sun"`) as space-separated display text (`"full sun"`) — shared by any UI listing a Plant enum's raw values (sun requirement, foliage type, native status). */
export function formatOption(value: string): string {
  return value.replace(/-/g, " ");
}

/** A Plant's display label — its common name, with the cultivar appended in parentheses when set. Shared by any UI listing Plants (the map's Pin list and details panel, the Registry, on both web and native). */
export function plantLabel(plant: Plant | undefined): string {
  if (!plant) return "Unknown plant";
  return plant.cultivar ? `${plant.commonName} (${plant.cultivar})` : plant.commonName;
}
