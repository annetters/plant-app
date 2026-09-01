import { describe, expect, it } from "vitest";
import type { CareTaskTemplate } from "./careTaskTemplate.js";
import {
  buildPlantingTaskHistory,
  taskCompletionFromRow,
  taskCompletionInputToRow,
  validateTaskCompletionInput,
  type TaskCompletion,
  type TaskCompletionInput,
  type TaskCompletionRow,
} from "./taskCompletion.js";

const VALID_INPUT: TaskCompletionInput = {
  careTaskTemplateId: "template-1",
  plantingId: "planting-1",
  year: 2026,
  status: "done",
};

describe("validateTaskCompletionInput", () => {
  it("accepts a valid Task completion", () => {
    expect(validateTaskCompletionInput(VALID_INPUT)).toEqual({ ok: true });
  });

  it("requires a Care task template reference", () => {
    const result = validateTaskCompletionInput({ ...VALID_INPUT, careTaskTemplateId: "" });
    expect(result).toEqual({
      ok: false,
      errors: { careTaskTemplateId: "A Care task template reference is required." },
    });
  });

  it("requires a Planting reference", () => {
    const result = validateTaskCompletionInput({ ...VALID_INPUT, plantingId: "" });
    expect(result).toEqual({
      ok: false,
      errors: { plantingId: "A Planting reference is required." },
    });
  });

  it("rejects an out-of-range year", () => {
    const result = validateTaskCompletionInput({ ...VALID_INPUT, year: 1899 });
    expect(result).toEqual({ ok: false, errors: { year: "Year must be a real year." } });
  });

  it("rejects a non-integer year", () => {
    const result = validateTaskCompletionInput({ ...VALID_INPUT, year: 2026.5 });
    expect(result).toEqual({ ok: false, errors: { year: "Year must be a real year." } });
  });

  it("rejects an invalid status", () => {
    const result = validateTaskCompletionInput({
      ...VALID_INPUT,
      status: "done-ish" as never,
    });
    expect(result).toEqual({ ok: false, errors: { status: "Status must be done or missed." } });
  });
});

describe("taskCompletionInputToRow / taskCompletionFromRow", () => {
  it("round-trips through the row shape", () => {
    const row: TaskCompletionRow = {
      id: "completion-1",
      ...taskCompletionInputToRow(VALID_INPUT),
      created_at: "2026-04-01T00:00:00.000Z",
    };
    expect(taskCompletionFromRow(row)).toEqual<TaskCompletion>({
      id: "completion-1",
      createdAt: "2026-04-01T00:00:00.000Z",
      careTaskTemplateId: "template-1",
      plantingId: "planting-1",
      year: 2026,
      status: "done",
    });
  });
});

function template(overrides: Partial<CareTaskTemplate> = {}): CareTaskTemplate {
  return {
    id: "template-1",
    plantId: "plant-1",
    name: "Prune",
    trigger: { type: "seasonal-marker", text: "Early spring" },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function completion(overrides: Partial<TaskCompletion> = {}): TaskCompletion {
  return {
    id: "completion-1",
    careTaskTemplateId: "template-1",
    plantingId: "planting-1",
    year: 2026,
    status: "done",
    createdAt: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildPlantingTaskHistory", () => {
  it("produces exactly one entry per Care task template", () => {
    const templates = [template({ id: "t1" }), template({ id: "t2" }), template({ id: "t3" })];
    const history = buildPlantingTaskHistory(templates, [], "planting-1", 2026);
    expect(history).toHaveLength(3);
  });

  it("marks an entry pending when no completion exists yet", () => {
    const history = buildPlantingTaskHistory([template()], [], "planting-1", 2026);
    expect(history).toEqual([
      { careTaskTemplateId: "template-1", careTaskTemplateName: "Prune", year: 2026, status: "pending" },
    ]);
  });

  it("reflects a task marked done in that Planting's history for the correct year", () => {
    const templates = [template({ id: "t1" })];
    const completions = [completion({ careTaskTemplateId: "t1", plantingId: "planting-1", year: 2026 })];

    const history2026 = buildPlantingTaskHistory(templates, completions, "planting-1", 2026);
    expect(history2026).toEqual([
      { careTaskTemplateId: "t1", careTaskTemplateName: "Prune", year: 2026, status: "done" },
    ]);

    // A different year for the same Planting/template stays pending — the
    // completion is scoped to the calendar year it was recorded for.
    const history2027 = buildPlantingTaskHistory(templates, completions, "planting-1", 2027);
    expect(history2027).toEqual([
      { careTaskTemplateId: "t1", careTaskTemplateName: "Prune", year: 2027, status: "pending" },
    ]);
  });

  it("does not leak a completion recorded for a different Planting", () => {
    const templates = [template({ id: "t1" })];
    const completions = [completion({ careTaskTemplateId: "t1", plantingId: "other-planting", year: 2026 })];

    const history = buildPlantingTaskHistory(templates, completions, "planting-1", 2026);
    expect(history).toEqual([
      { careTaskTemplateId: "t1", careTaskTemplateName: "Prune", year: 2026, status: "pending" },
    ]);
  });

  it("reflects a missed status the same way as done", () => {
    const templates = [template({ id: "t1" })];
    const completions = [
      completion({ careTaskTemplateId: "t1", plantingId: "planting-1", year: 2026, status: "missed" }),
    ];

    const history = buildPlantingTaskHistory(templates, completions, "planting-1", 2026);
    expect(history).toEqual([
      { careTaskTemplateId: "t1", careTaskTemplateName: "Prune", year: 2026, status: "missed" },
    ]);
  });
});
