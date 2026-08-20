import { describe, expect, it } from "vitest";
import {
  careTaskTemplateFromRow,
  careTaskTemplateInputToRow,
  computeTriggerDateRange,
  validateCareTaskTemplateInput,
  type CareTaskTemplateInput,
  type CareTaskTemplateRow,
  type TaskTrigger,
} from "./careTaskTemplate.js";

function validInput(overrides: Partial<CareTaskTemplateInput> = {}): CareTaskTemplateInput {
  return {
    plantId: "plant-1",
    name: "Prune",
    trigger: { type: "date-range", start: { month: 4, day: 1 }, end: { month: 4, day: 15 } },
    ...overrides,
  };
}

describe("validateCareTaskTemplateInput", () => {
  it("accepts a valid date-range trigger", () => {
    expect(validateCareTaskTemplateInput(validInput())).toEqual({ ok: true });
  });

  it("accepts a valid seasonal-marker trigger", () => {
    const result = validateCareTaskTemplateInput(
      validInput({ trigger: { type: "seasonal-marker", text: "After first hard frost" } }),
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects a blank name", () => {
    const result = validateCareTaskTemplateInput(validInput({ name: "  " }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.name).toBeDefined();
  });

  it("rejects a date-range trigger with an out-of-range start month", () => {
    const result = validateCareTaskTemplateInput(
      validInput({
        trigger: { type: "date-range", start: { month: 13, day: 1 }, end: { month: 4, day: 15 } },
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors["trigger.start"]).toBeDefined();
  });

  it("rejects a date-range trigger with an invalid end day", () => {
    const result = validateCareTaskTemplateInput(
      validInput({
        trigger: { type: "date-range", start: { month: 4, day: 1 }, end: { month: 2, day: 30 } },
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors["trigger.end"]).toBeDefined();
  });

  it("rejects a seasonal-marker trigger with blank text", () => {
    const result = validateCareTaskTemplateInput(
      validInput({ trigger: { type: "seasonal-marker", text: "   " } }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors["trigger.text"]).toBeDefined();
  });
});

describe("computeTriggerDateRange", () => {
  it("evaluates a date-range trigger within a single year", () => {
    const trigger: TaskTrigger = {
      type: "date-range",
      start: { month: 4, day: 1 },
      end: { month: 4, day: 15 },
    };
    expect(computeTriggerDateRange(trigger, 2026)).toEqual({
      start: new Date(Date.UTC(2026, 3, 1)),
      end: new Date(Date.UTC(2026, 3, 15)),
    });
  });

  it("evaluates a date-range trigger that wraps into the following year", () => {
    const trigger: TaskTrigger = {
      type: "date-range",
      start: { month: 11, day: 15 },
      end: { month: 2, day: 15 },
    };
    expect(computeTriggerDateRange(trigger, 2026)).toEqual({
      start: new Date(Date.UTC(2026, 10, 15)),
      end: new Date(Date.UTC(2027, 1, 15)),
    });
  });

  it("returns no computed date for a seasonal-marker trigger", () => {
    const trigger: TaskTrigger = { type: "seasonal-marker", text: "After first hard frost" };
    expect(computeTriggerDateRange(trigger, 2026)).toBeNull();
  });
});

describe("careTaskTemplateInputToRow / careTaskTemplateFromRow", () => {
  it("round-trips a date-range trigger through row form", () => {
    const input = validInput();
    const row: CareTaskTemplateRow = {
      id: "template-1",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      ...careTaskTemplateInputToRow(input),
    };
    expect(careTaskTemplateFromRow(row)).toEqual({
      id: "template-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      ...input,
    });
  });

  it("round-trips a seasonal-marker trigger through row form, with date fields null", () => {
    const input = validInput({ trigger: { type: "seasonal-marker", text: "After first frost" } });
    const row: CareTaskTemplateRow = {
      id: "template-2",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      ...careTaskTemplateInputToRow(input),
    };
    expect(row.date_start_month).toBeNull();
    expect(row.date_end_day).toBeNull();
    expect(careTaskTemplateFromRow(row)).toEqual({
      id: "template-2",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      ...input,
    });
  });
});
