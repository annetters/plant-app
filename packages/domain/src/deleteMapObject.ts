import { NothingDeletedError, type DeleteTarget } from "./deleteOutcome.js";

/**
 * Calling the `delete-map-object` Edge Function, which deletes a Property or a
 * Bed *and* the planting photo files underneath it (#47).
 *
 * Lives here, in the platform-agnostic package, for the reason the whole
 * ticket exists: the cleanup must not drift between surfaces. Web and native
 * hold byte-identical copies of anything they both do, and two copies of a
 * delete path is exactly how the repositories ended up unable to agree on what
 * a successful delete means. There is no Deno boundary here to force a
 * hand-mirrored copy (unlike `usdaChecklist.ts`) — both apps already import
 * this package.
 *
 * It takes the client as a narrow interface rather than importing
 * supabase-js, which keeps this module as dependency-free as the rest of the
 * domain package.
 */

/** What a Property or Bed delete is aimed at. */
export type MapObjectKind = "property" | "bed";

/**
 * The `code` the function sets when its delete matched no row. A code rather
 * than the message text, so the client can rethrow a typed error without
 * string-matching wording that lives on the other side of a deploy boundary.
 */
export const NOTHING_DELETED_CODE = "nothing_deleted";

const TARGET_BY_KIND: Record<MapObjectKind, DeleteTarget> = {
  property: "Property",
  bed: "Bed",
};

/** The slice of a Supabase client this needs — just the function invoker. */
export interface MapObjectDeleteClient {
  functions: {
    invoke(
      name: string,
      options: { body: unknown },
    ): Promise<{ data: unknown; error: { message: string } | null }>;
  };
}

const DELETE_FUNCTION = "delete-map-object";

export async function deleteMapObject(
  client: MapObjectDeleteClient,
  kind: MapObjectKind,
  id: string,
): Promise<void> {
  const { data, error } = await client.functions.invoke(DELETE_FUNCTION, { body: { kind, id } });
  // `error` is transport-level. Expected, user-reachable failures — a delete
  // that matched no row, a photo file that wouldn't go — come back as HTTP 200
  // with an `{ error }` body, because `functions.invoke` doesn't surface a
  // non-2xx response's JSON body as a usable message. Same arrangement as
  // `create-property`.
  if (error) throw new Error(error.message);
  const result = data as { error?: string; code?: string } | null;
  if (result?.error) {
    // A delete that matched nothing throws the same type here as it does for
    // Plant and Planting, whose repositories call `requireRowsDeleted`
    // directly — so a caller sees one kind of "nothing was deleted" whichever
    // record it asked about.
    if (result.code === NOTHING_DELETED_CODE) throw new NothingDeletedError(TARGET_BY_KIND[kind]);
    throw new Error(result.error);
  }
}
