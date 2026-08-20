import { isValidMonthDay, type MonthDay } from "./plant.js";

export interface DateRangeTrigger {
  type: "date-range";
  start: MonthDay;
  end: MonthDay;
}

export interface SeasonalMarkerTrigger {
  type: "seasonal-marker";
  text: string;
}

export type TaskTrigger = DateRangeTrigger | SeasonalMarkerTrigger;

export interface CareTaskTemplateInput {
  plantId: string;
  name: string;
  trigger: TaskTrigger;
}

export interface CareTaskTemplate extends CareTaskTemplateInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export type CareTaskTemplateValidationErrors = Partial<
  Record<"name" | "trigger.start" | "trigger.end" | "trigger.text", string>
>;

export type CareTaskTemplateValidationResult =
  | { ok: true }
  | { ok: false; errors: CareTaskTemplateValidationErrors };

export function validateCareTaskTemplateInput(
  input: CareTaskTemplateInput,
): CareTaskTemplateValidationResult {
  const errors: CareTaskTemplateValidationErrors = {};

  if (!input.name.trim()) errors.name = "Name is required.";

  if (input.trigger.type === "date-range") {
    if (!isValidMonthDay(input.trigger.start)) {
      errors["trigger.start"] = "Start must be a valid month and day.";
    }
    if (!isValidMonthDay(input.trigger.end)) {
      errors["trigger.end"] = "End must be a valid month and day.";
    }
  } else {
    if (!input.trigger.text.trim()) {
      errors["trigger.text"] = "Seasonal marker text is required.";
    }
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true };
}

/**
 * True when a date-range trigger's start falls later in the calendar than
 * its end (e.g. Nov 15 -> Feb 15) — a deliberately supported window that
 * wraps into the following year, not a data-entry mistake. Exported so the
 * UI can flag this to the user rather than rendering it indistinguishably
 * from a plain within-year range.
 */
export function dateRangeWraps(trigger: DateRangeTrigger): boolean {
  return (
    trigger.start.month > trigger.end.month ||
    (trigger.start.month === trigger.end.month && trigger.start.day > trigger.end.day)
  );
}

/**
 * The computed date range a date-range trigger falls in for a given year, or
 * `null` for a seasonal-marker trigger — which has no computed date per
 * CONTEXT.md ("freeform reminder text, no computed date").
 */
export function computeTriggerDateRange(
  trigger: TaskTrigger,
  year: number,
): { start: Date; end: Date } | null {
  if (trigger.type === "seasonal-marker") return null;

  const start = new Date(Date.UTC(year, trigger.start.month - 1, trigger.start.day));
  const endYear = dateRangeWraps(trigger) ? year + 1 : year;
  const end = new Date(Date.UTC(endYear, trigger.end.month - 1, trigger.end.day));

  return { start, end };
}

/** The `care_task_templates` table's row shape — the seam between domain types and Postgres. */
export interface CareTaskTemplateRow {
  id: string;
  plant_id: string;
  name: string;
  trigger_type: "date-range" | "seasonal-marker";
  date_start_month: number | null;
  date_start_day: number | null;
  date_end_month: number | null;
  date_end_day: number | null;
  seasonal_marker_text: string | null;
  created_at: string;
  updated_at: string;
}

export function careTaskTemplateInputToRow(
  input: CareTaskTemplateInput,
): Omit<CareTaskTemplateRow, "id" | "created_at" | "updated_at"> {
  const { trigger } = input;
  return {
    plant_id: input.plantId,
    name: input.name,
    trigger_type: trigger.type,
    date_start_month: trigger.type === "date-range" ? trigger.start.month : null,
    date_start_day: trigger.type === "date-range" ? trigger.start.day : null,
    date_end_month: trigger.type === "date-range" ? trigger.end.month : null,
    date_end_day: trigger.type === "date-range" ? trigger.end.day : null,
    seasonal_marker_text: trigger.type === "seasonal-marker" ? trigger.text : null,
  };
}

export function careTaskTemplateFromRow(row: CareTaskTemplateRow): CareTaskTemplate {
  const trigger: TaskTrigger =
    row.trigger_type === "date-range"
      ? {
          type: "date-range",
          start: { month: row.date_start_month!, day: row.date_start_day! },
          end: { month: row.date_end_month!, day: row.date_end_day! },
        }
      : { type: "seasonal-marker", text: row.seasonal_marker_text! };

  return {
    id: row.id,
    plantId: row.plant_id,
    name: row.name,
    trigger,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
