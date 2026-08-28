import { MONTH_NAMES } from './monthNames'

/** Renders a `MonthDay` (e.g. `{ month: 4, day: 15 }`) as `"April 15"` — shared by any UI showing a bloom window or date-range trigger. */
export function formatMonthDay(value: { month: number; day: number }): string {
  return `${MONTH_NAMES[value.month - 1]} ${value.day}`
}
