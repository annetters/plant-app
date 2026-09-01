/**
 * A One-off todo: a manual, non-recurring reminder outside the Care task
 * template system (see `CONTEXT.md`). Unlike a Task completion, it isn't
 * keyed to a Planting or a calendar year — it's owned directly by the
 * account, the same ownership shape as Plant/Property.
 */

export interface OneOffTodoInput {
  text: string;
}

export interface OneOffTodo extends OneOffTodoInput {
  id: string;
  done: boolean;
  createdAt: string;
}

export type OneOffTodoValidationErrors = Partial<Record<"text", string>>;

export type OneOffTodoValidationResult =
  | { ok: true }
  | { ok: false; errors: OneOffTodoValidationErrors };

export function validateOneOffTodoInput(input: OneOffTodoInput): OneOffTodoValidationResult {
  const errors: OneOffTodoValidationErrors = {};

  if (!input.text.trim()) {
    errors.text = "Text is required.";
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true };
}

/** The `one_off_todos` table's row shape — the seam between domain types and Postgres. */
export interface OneOffTodoRow {
  id: string;
  text: string;
  done: boolean;
  created_at: string;
}

export function oneOffTodoInputToRow(
  input: OneOffTodoInput,
): Omit<OneOffTodoRow, "id" | "created_at" | "done"> {
  return {
    text: input.text,
  };
}

export function oneOffTodoFromRow(row: OneOffTodoRow): OneOffTodo {
  return {
    id: row.id,
    createdAt: row.created_at,
    text: row.text,
    done: row.done,
  };
}
