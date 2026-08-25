/**
 * Bloom Timeline (#9, see CONTEXT.md): a year-view bar chart of Plant bloom
 * windows, plus a month-filtered list view of the same underlying data — no
 * separate data model, just two presentations of the same `BloomTimelineBar`
 * list this module builds from Plants and Plantings.
 */

import { monthDayRangeWraps, type BloomWindow, type MonthDay, type Plant } from "./plant.js";
import type { Planting } from "./planting.js";

// Leap-safe (Feb counted as 29 days), matching plant.ts's isValidMonthDay —
// a bloom window is year-independent, so Feb 29 is always a valid day here,
// not just on real leap years. Used only for chart positioning, never for
// real calendar-date arithmetic.
const DAYS_BEFORE_MONTH = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];

/** A MonthDay's 1-indexed position in a (leap-safe, 366-day) year — for positioning a bar on the year-view chart. */
export function dayOfYear(value: MonthDay): number {
  return DAYS_BEFORE_MONTH[value.month - 1] + value.day;
}

/** True when a bloom window's start falls later in the calendar than its end (e.g. Nov 15 -> Feb 15) — a window that wraps into the following year. Same rule as `dateRangeWraps` for care task triggers, via the shared `monthDayRangeWraps`. */
export function bloomWindowWraps(window: BloomWindow): boolean {
  return monthDayRangeWraps(window.start, window.end);
}

/** True when the given calendar month (1-12) falls within a bloom window, wrap-aware. */
export function bloomWindowIncludesMonth(window: BloomWindow, month: number): boolean {
  const { start, end } = window;
  if (!bloomWindowWraps(window)) return month >= start.month && month <= end.month;
  return month >= start.month || month <= end.month;
}

/** One horizontal bar on the year-view chart, or one row in the month-filtered list — the same object drives both. */
export interface BloomTimelineBar {
  plantId: string;
  commonName: string;
  cultivar?: string;
  bloomWindow: BloomWindow;
}

/**
 * Every Plant with a bloom window, as a chart bar — optionally narrowed to
 * only Plants with a Planting in the given Bed (CONTEXT.md's "filterable by
 * Bed"). With no `bedId`, every blooming Plant in the Registry appears,
 * whether or not it's actually planted yet.
 */
export function buildBloomTimelineBars(
  plants: readonly Plant[],
  plantings: readonly Planting[],
  bedId?: string,
): BloomTimelineBar[] {
  const plantIdsInBed = bedId
    ? new Set(plantings.filter((planting) => planting.bedId === bedId).map((planting) => planting.plantId))
    : null;

  return plants
    .filter((plant) => plant.bloomWindow !== undefined)
    .filter((plant) => plantIdsInBed === null || plantIdsInBed.has(plant.id))
    .map((plant) => ({
      plantId: plant.id,
      commonName: plant.commonName,
      ...(plant.cultivar !== undefined && { cultivar: plant.cultivar }),
      bloomWindow: plant.bloomWindow as BloomWindow,
    }))
    .sort((a, b) => dayOfYear(a.bloomWindow.start) - dayOfYear(b.bloomWindow.start));
}

/** The month-filtered list view: the same bars, narrowed to those blooming in a given calendar month. */
export function filterBloomTimelineBarsByMonth(
  bars: readonly BloomTimelineBar[],
  month: number,
): BloomTimelineBar[] {
  return bars.filter((bar) => bloomWindowIncludesMonth(bar.bloomWindow, month));
}
