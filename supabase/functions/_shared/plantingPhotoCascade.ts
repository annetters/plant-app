// Ticket #47: deleting a Property or a Bed leaves its planting photo *files*
// behind.
//
// A planting photo exists in two places: a `planting_photos` row and a file in
// the `planting-photos` bucket. The database cascade
// (`0015_planting_photos.sql`) removes the row; nothing removes the file. The
// only code that empties the bucket runs when a *single* Planting is removed
// (`PlantingsRepository.remove`), so a Property or Bed delete cascades straight
// past it and every file underneath becomes unreferenced and unreachable.
//
// This runs server-side rather than in the client repositories (ADR-0003:
// anything talking to an external adapter runs server-side, and object storage
// is one). Both surfaces call the same function, so they cannot drift — which
// is the failure mode the duplicated repository code invites today.
//
// A pure Postgres trigger cannot do this job: deleting rows from
// `storage.objects` removes only the metadata and leaves the file in the
// bucket, which is strictly *worse* than the bug, because the rows that
// currently make the orphans enumerable would be gone too.
//
// Written against a narrow client interface with no Deno-specific imports, so
// it can be tested under vitest (`vitest.functions.config.ts`) — the handler
// in `delete-map-object/index.ts` is what knows about Deno.

/** The bucket a Planting's dated photo log writes into — see `0015_planting_photos.sql`. */
export const PLANTING_PHOTOS_BUCKET = "planting-photos";

/**
 * Set on the response when the delete matched no row, so the client can throw
 * a typed error instead of matching on message text across a deploy boundary.
 * Mirrors `NOTHING_DELETED_CODE` in `packages/domain/src/deleteMapObject.ts` —
 * keep the two in sync; the edge runtime can't import that package.
 */
export const NOTHING_DELETED_CODE = "nothing_deleted";

/** An expected, user-reachable failure, carrying a code the handler puts on the response. */
export class CascadeDeleteError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "CascadeDeleteError";
    this.code = code;
  }
}

const nothingDeleted = (entity: string) =>
  new CascadeDeleteError(
    `This ${entity} could not be deleted — it may already be gone.`,
    NOTHING_DELETED_CODE,
  );

type Row = Record<string, unknown>;
type DbResult = { data: unknown; error: { message: string } | null };

/** The slice of a PostgREST filter builder the cascade actually calls. */
interface CascadeQuery extends PromiseLike<DbResult> {
  select(columns?: string): CascadeQuery;
  eq(column: string, value: string): CascadeQuery;
  in(column: string, values: string[]): CascadeQuery;
}

/** The narrow shape of a Supabase client this module needs — mirrors the repositories' `*DbClient` pattern. */
export interface PlantingPhotoCascadeClient {
  from(table: string): {
    select(columns?: string): CascadeQuery;
    delete(): CascadeQuery;
  };
  storage: {
    from(bucket: string): {
      remove(paths: string[]): Promise<{ error: { message: string } | null }>;
    };
  };
}

function unwrap(result: DbResult): Row[] {
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as Row[];
}

const idsOf = (rows: Row[]): string[] => rows.map((row) => row.id as string);

/** Every Planting sitting in any of the given Beds. Empty in, empty out — PostgREST's `in.()` with no values is a syntax error, not an empty match. */
async function plantingIdsInBeds(
  client: PlantingPhotoCascadeClient,
  bedIds: string[],
): Promise<string[]> {
  if (bedIds.length === 0) return [];
  return idsOf(unwrap(await client.from("plantings").select("id").in("bed_id", bedIds)));
}

async function photoPathsForPlantings(
  client: PlantingPhotoCascadeClient,
  plantingIds: string[],
): Promise<string[]> {
  if (plantingIds.length === 0) return [];
  const rows = unwrap(
    await client.from("planting_photos").select("storage_path").in("planting_id", plantingIds),
  );
  return rows.map((row) => row.storage_path as string);
}

/**
 * Removes the files, then the row — never the other way round.
 *
 * Storage removal and a row delete cannot be made atomic, so the order decides
 * which way a partial failure falls. Files first means a storage failure
 * leaves the Property or Bed **entirely intact** and the gardener can simply
 * try again. Row first would mean a storage failure had already destroyed the
 * map and orphaned the files anyway — the exact bug this fixes. Same ordering,
 * and the same reasoning, as `PlantingsRepository.remove`.
 */
async function removePhotosThenRow(
  client: PlantingPhotoCascadeClient,
  { table, id, entity, photoPaths }: {
    table: string;
    id: string;
    entity: string;
    photoPaths: string[];
  },
): Promise<void> {
  // Check the row is there *before* touching storage. Storage removal and a
  // row delete can't be made atomic, so the cheapest way to shrink the window
  // is to not start when the delete was never going to succeed: without this,
  // deleting something RLS hides (or that is already gone) would remove every
  // photo file first and only then discover there was no row — files
  // destroyed, map still standing, which is worse than the bug being fixed.
  const existing = unwrap(await client.from(table).select("id").eq("id", id));
  if (existing.length === 0) throw nothingDeleted(entity);

  if (photoPaths.length > 0) {
    const { error } = await client.storage.from(PLANTING_PHOTOS_BUCKET).remove(photoPaths);
    if (error) throw new Error(error.message);
  }

  // `.select()` is what tells a real delete from a no-op: PostgREST answers
  // with `error: null` when RLS filters out every candidate row, so without
  // this a delete that removed nothing reports success and the record
  // reappears on the next load. Still needed despite the check above — the row
  // can go between the two — but it is now the backstop rather than the only
  // guard. Mirrors `requireRowsDeleted` in
  // `packages/domain/src/deleteOutcome.ts`, kept as its own copy for the same
  // reason `_shared/usdaChecklist.ts` mirrors the domain parser: the Deno edge
  // runtime can't import that npm workspace package.
  const deleted = unwrap(await client.from(table).delete().eq("id", id).select());
  if (deleted.length === 0) throw nothingDeleted(entity);
}

/** Deletes a Property, and every planting photo file beneath it, all or nothing. */
export async function deletePropertyWithPhotos(
  client: PlantingPhotoCascadeClient,
  propertyId: string,
): Promise<void> {
  const bedIds = idsOf(
    unwrap(await client.from("beds").select("id").eq("property_id", propertyId)),
  );
  const plantingIds = await plantingIdsInBeds(client, bedIds);
  const photoPaths = await photoPathsForPlantings(client, plantingIds);

  await removePhotosThenRow(client, {
    table: "properties",
    id: propertyId,
    entity: "Property",
    photoPaths,
  });
}

/**
 * Deletes a Bed, and every planting photo file beneath it, all or nothing.
 *
 * **This reaches Plantings only because `plantings.bed_id` still cascades**
 * (`0013_plantings.sql`). ADR-0009 reverses that: a Bed stops being on the path
 * to a Planting, and deleting one will unassign its Plantings rather than
 * destroy them. When #54 lands there are no photos beneath a Bed to clean up
 * and this function goes with the cascade it exists to compensate for.
 */
export async function deleteBedWithPhotos(
  client: PlantingPhotoCascadeClient,
  bedId: string,
): Promise<void> {
  const plantingIds = await plantingIdsInBeds(client, [bedId]);
  const photoPaths = await photoPathsForPlantings(client, plantingIds);

  await removePhotosThenRow(client, { table: "beds", id: bedId, entity: "Bed", photoPaths });
}
