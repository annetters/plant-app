/**
 * A Task completion: a log entry (done or missed) keyed by Care task
 * template, Planting, and calendar year (see `CONTEXT.md`). A Plant with N
 * Care task templates produces N Task completions per year for each of its
 * Plantings — this is what makes `buildPlantingTaskHistory` below always
 * return one entry per template, never a variable count.
 */

import type { CareTaskTemplate } from "./careTaskTemplate.js";

export type TaskCompletionStatus = "done" | "missed";

export interface TaskCompletionInput {
  careTaskTemplateId: string;
  plantingId: string;
  year: number;
  status: TaskCompletionStatus;
}

export interface TaskCompletion extends TaskCompletionInput {
  id: string;
  createdAt: string;
}

export type TaskCompletionValidationErrors = Partial<
  Record<"careTaskTemplateId" | "plantingId" | "year" | "status", string>
>;

export type TaskCompletionValidationResult =
  | { ok: true }
  | { ok: false; errors: TaskCompletionValidationErrors };

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

export function validateTaskCompletionInput(
  input: TaskCompletionInput,
): TaskCompletionValidationResult {
  const errors: TaskCompletionValidationErrors = {};

  if (!input.careTaskTemplateId.trim()) {
    errors.careTaskTemplateId = "A Care task template reference is required.";
  }
  if (!input.plantingId.trim()) {
    errors.plantingId = "A Planting reference is required.";
  }
  if (!(Number.isInteger(input.year) && input.year >= MIN_YEAR && input.year <= MAX_YEAR)) {
    errors.year = "Year must be a real year.";
  }
  if (input.status !== "done" && input.status !== "missed") {
    errors.status = "Status must be done or missed.";
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true };
}

/** The `task_completions` table's row shape — the seam between domain types and Postgres. */
export interface TaskCompletionRow {
  id: string;
  care_task_template_id: string;
  planting_id: string;
  year: number;
  status: TaskCompletionStatus;
  created_at: string;
}

export function taskCompletionInputToRow(
  input: TaskCompletionInput,
): Omit<TaskCompletionRow, "id" | "created_at"> {
  return {
    care_task_template_id: input.careTaskTemplateId,
    planting_id: input.plantingId,
    year: input.year,
    status: input.status,
  };
}

export function taskCompletionFromRow(row: TaskCompletionRow): TaskCompletion {
  return {
    id: row.id,
    createdAt: row.created_at,
    careTaskTemplateId: row.care_task_template_id,
    plantingId: row.planting_id,
    year: row.year,
    status: row.status,
  };
}

export interface PlantingTaskHistoryEntry {
  careTaskTemplateId: string;
  careTaskTemplateName: string;
  year: number;
  status: TaskCompletionStatus | "pending";
}

/**
 * A Planting's reviewable care history for one calendar year: exactly one
 * entry per Care task template on its Plant, `"pending"` when nothing has
 * been logged yet for that template/Planting/year combination. Matches
 * CONTEXT.md's Task completion entry — N templates always produce N
 * entries, never a variable count based on what's already been marked.
 */
export function buildPlantingTaskHistory(
  templates: readonly CareTaskTemplate[],
  completions: readonly TaskCompletion[],
  plantingId: string,
  year: number,
): PlantingTaskHistoryEntry[] {
  return templates.map((template) => {
    const completion = completions.find(
      (candidate) =>
        candidate.careTaskTemplateId === template.id &&
        candidate.plantingId === plantingId &&
        candidate.year === year,
    );
    return {
      careTaskTemplateId: template.id,
      careTaskTemplateName: template.name,
      year,
      status: completion?.status ?? "pending",
    };
  });
}
