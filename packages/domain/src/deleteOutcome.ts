/**
 * Telling a delete that worked from one that silently did nothing (#47).
 *
 * PostgREST answers a `delete()` with `error: null` when RLS filtered out
 * every candidate row — a delete that removed **nothing** is indistinguishable
 * from one that worked. Callers then clear the record from local state and it
 * reappears on the next load. Asking for the deleted rows back (`.select()`)
 * and treating an empty result as a failure is what closes that gap.
 *
 * This is currently unreachable — every delete policy is correct — so it is a
 * guard against a future policy or filter mistake becoming a silent
 * wrong answer, which is the class of bug #28 and #47 were both filed about.
 */

/** The records a delete can fail to match. A closed set, not a free string — there are exactly four things in this app that can be deleted by id. */
export type DeleteTarget = "Property" | "Bed" | "Plant" | "Planting";

/**
 * A delete that affected no rows. Its own type rather than a bare `Error` so a
 * caller can tell "the delete didn't match anything" from "the request failed",
 * which want different messages even though both are failures today.
 */
export class NothingDeletedError extends Error {
  /** The record that wasn't deleted. */
  readonly entity: DeleteTarget;

  constructor(entity: DeleteTarget) {
    super(`This ${entity} could not be deleted — it may already be gone.`);
    this.name = "NothingDeletedError";
    this.entity = entity;
  }
}

/**
 * Throws unless the delete came back with at least one row. `rows` is what
 * `.delete().select()` returned; PostgREST can hand back `null` as well as an
 * empty array, and both mean the same thing here.
 */
export function requireRowsDeleted(rows: unknown[] | null, entity: DeleteTarget): void {
  if (!rows || rows.length === 0) throw new NothingDeletedError(entity);
}
