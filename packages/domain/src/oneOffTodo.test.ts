import { describe, expect, it } from "vitest";
import {
  oneOffTodoFromRow,
  oneOffTodoInputToRow,
  validateOneOffTodoInput,
  type OneOffTodo,
  type OneOffTodoRow,
} from "./oneOffTodo.js";

describe("validateOneOffTodoInput", () => {
  it("accepts a non-empty todo", () => {
    expect(validateOneOffTodoInput({ text: "Order mulch" })).toEqual({ ok: true });
  });

  it("rejects empty text", () => {
    expect(validateOneOffTodoInput({ text: "" })).toEqual({
      ok: false,
      errors: { text: "Text is required." },
    });
  });

  it("rejects whitespace-only text", () => {
    expect(validateOneOffTodoInput({ text: "   " })).toEqual({
      ok: false,
      errors: { text: "Text is required." },
    });
  });
});

describe("oneOffTodoInputToRow / oneOffTodoFromRow", () => {
  it("round-trips through the row shape", () => {
    const row: OneOffTodoRow = {
      id: "todo-1",
      ...oneOffTodoInputToRow({ text: "Order mulch" }),
      done: false,
      created_at: "2026-04-01T00:00:00.000Z",
    };
    expect(oneOffTodoFromRow(row)).toEqual<OneOffTodo>({
      id: "todo-1",
      createdAt: "2026-04-01T00:00:00.000Z",
      text: "Order mulch",
      done: false,
    });
  });
});
