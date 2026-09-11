import { describe, expect, it, vi } from "vitest";
import {
  NOTHING_DELETED_CODE,
  PLANTING_PHOTOS_BUCKET,
  deleteBedWithPhotos,
  deletePropertyWithPhotos,
} from "./plantingPhotoCascade.ts";

/**
 * An in-memory stand-in for the slice of PostgREST the cascade uses:
 * `select` with `eq`/`in`, and `delete().eq().select()`. Mirrors the shape of
 * the web app's own fake db clients (`apps/web/src/test/fakeBedsDbClient.ts`)
 * so the two read the same way.
 */
function createFakeClient({
  beds = [] as { id: string; property_id: string }[],
  plantings = [] as { id: string; bed_id: string }[],
  photos = [] as { id: string; planting_id: string; storage_path: string }[],
  properties = [] as { id: string }[],
  storageError = null as { message: string } | null,
} = {}) {
  const tables: Record<string, Record<string, unknown>[]> = {
    beds,
    plantings,
    planting_photos: photos,
    properties,
  };

  const remove = vi.fn(async (_paths: string[]) => ({ error: storageError }));
  const bucketsTouched: string[] = [];
  /** Every table a `delete()` was issued against — what proves the cascade stays out of the Registry. */
  const tablesDeletedFrom: string[] = [];

  function builder(table: string, op: "select" | "delete") {
    let rows = [...(tables[table] ?? [])];
    const chain = {
      select() {
        return chain;
      },
      eq(column: string, value: string) {
        rows = rows.filter((row) => row[column] === value);
        return chain;
      },
      in(column: string, values: string[]) {
        rows = rows.filter((row) => values.includes(row[column] as string));
        return chain;
      },
      then<T1 = unknown, T2 = never>(
        onfulfilled?: ((value: { data: unknown; error: null }) => T1 | PromiseLike<T1>) | null,
        onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
      ) {
        if (op === "delete") {
          tablesDeletedFrom.push(table);
          const ids = new Set(rows.map((row) => row.id));
          tables[table] = (tables[table] ?? []).filter((row) => !ids.has(row.id));
        }
        return Promise.resolve({ data: rows, error: null }).then(onfulfilled, onrejected);
      },
    };
    return chain;
  }

  return {
    client: {
      from: (table: string) => ({
        select: () => builder(table, "select"),
        delete: () => builder(table, "delete"),
      }),
      storage: {
        from: (bucket: string) => {
          bucketsTouched.push(bucket);
          return { remove };
        },
      },
    },
    remove,
    bucketsTouched,
    tablesDeletedFrom,
    tables,
  };
}

const PROPERTY = [{ id: "prop-1" }];
const BEDS = [
  { id: "bed-1", property_id: "prop-1" },
  { id: "bed-2", property_id: "prop-1" },
  { id: "bed-other", property_id: "prop-2" },
];
const PLANTINGS = [
  { id: "planting-1", bed_id: "bed-1" },
  { id: "planting-2", bed_id: "bed-2" },
  { id: "planting-other", bed_id: "bed-other" },
];
const PHOTOS = [
  { id: "photo-1", planting_id: "planting-1", storage_path: "user-1/planting-1/a.jpg" },
  { id: "photo-2", planting_id: "planting-1", storage_path: "user-1/planting-1/b.jpg" },
  { id: "photo-3", planting_id: "planting-2", storage_path: "user-1/planting-2/c.jpg" },
  { id: "photo-other", planting_id: "planting-other", storage_path: "user-2/planting-other/d.jpg" },
];

describe("deletePropertyWithPhotos", () => {
  it("removes every planting photo file beneath the Property from the bucket", async () => {
    const fake = createFakeClient({
      properties: PROPERTY,
      beds: BEDS,
      plantings: PLANTINGS,
      photos: PHOTOS,
    });

    await deletePropertyWithPhotos(fake.client, "prop-1");

    expect(fake.remove).toHaveBeenCalledTimes(1);
    expect(fake.remove.mock.calls[0][0].sort()).toEqual([
      "user-1/planting-1/a.jpg",
      "user-1/planting-1/b.jpg",
      "user-1/planting-2/c.jpg",
    ]);
    expect(fake.bucketsTouched).toContain(PLANTING_PHOTOS_BUCKET);
  });

  it("leaves photo files belonging to another Property alone", async () => {
    const fake = createFakeClient({
      properties: PROPERTY,
      beds: BEDS,
      plantings: PLANTINGS,
      photos: PHOTOS,
    });

    await deletePropertyWithPhotos(fake.client, "prop-1");

    expect(fake.remove.mock.calls[0][0]).not.toContain("user-2/planting-other/d.jpg");
  });

  it("deletes the Property row once the files are gone", async () => {
    const fake = createFakeClient({
      properties: PROPERTY,
      beds: BEDS,
      plantings: PLANTINGS,
      photos: PHOTOS,
    });

    await deletePropertyWithPhotos(fake.client, "prop-1");

    expect(fake.tables.properties).toEqual([]);
  });

  it("deletes nothing at all when a photo file cannot be removed", async () => {
    const fake = createFakeClient({
      properties: PROPERTY,
      beds: BEDS,
      plantings: PLANTINGS,
      photos: PHOTOS,
      storageError: { message: "Storage is unavailable." },
    });

    await expect(deletePropertyWithPhotos(fake.client, "prop-1")).rejects.toThrow(
      "Storage is unavailable.",
    );
    // All-or-nothing: the Property is still standing, so the gardener can retry.
    expect(fake.tables.properties).toEqual(PROPERTY);
  });

  it("skips the bucket call entirely when there are no photos", async () => {
    const fake = createFakeClient({ properties: PROPERTY, beds: BEDS, plantings: PLANTINGS });

    await deletePropertyWithPhotos(fake.client, "prop-1");

    expect(fake.remove).not.toHaveBeenCalled();
    expect(fake.tables.properties).toEqual([]);
  });

  it("throws when the Property delete matches no row, rather than reporting success", async () => {
    const fake = createFakeClient({ properties: [], beds: [], plantings: [] });

    await expect(deletePropertyWithPhotos(fake.client, "prop-1")).rejects.toThrow(/Property/);
  });
});

describe("deleteBedWithPhotos", () => {
  it("removes the photo files for the Plantings in that Bed only", async () => {
    const fake = createFakeClient({
      beds: BEDS,
      plantings: PLANTINGS,
      photos: PHOTOS,
    });

    await deleteBedWithPhotos(fake.client, "bed-1");

    expect(fake.remove.mock.calls[0][0].sort()).toEqual([
      "user-1/planting-1/a.jpg",
      "user-1/planting-1/b.jpg",
    ]);
  });

  it("deletes the Bed row once the files are gone", async () => {
    const fake = createFakeClient({ beds: BEDS, plantings: PLANTINGS, photos: PHOTOS });

    await deleteBedWithPhotos(fake.client, "bed-1");

    expect(fake.tables.beds.map((bed) => bed.id)).toEqual(["bed-2", "bed-other"]);
  });

  it("deletes nothing at all when a photo file cannot be removed", async () => {
    const fake = createFakeClient({
      beds: BEDS,
      plantings: PLANTINGS,
      photos: PHOTOS,
      storageError: { message: "Storage is unavailable." },
    });

    await expect(deleteBedWithPhotos(fake.client, "bed-1")).rejects.toThrow(
      "Storage is unavailable.",
    );
    expect(fake.tables.beds.map((bed) => bed.id)).toEqual(["bed-1", "bed-2", "bed-other"]);
  });

  it("throws when the Bed delete matches no row", async () => {
    const fake = createFakeClient({ beds: [], plantings: [] });

    await expect(deleteBedWithPhotos(fake.client, "bed-1")).rejects.toThrow(/Bed/);
  });
});

/**
 * CONTEXT.md's "Ownership and deletion": the Registry is a collection of
 * items, a Bed is a shelf, the Map holds the shelves — and deleting a Map or a
 * Bed *never* removes items from the collection. Plants are owned by the
 * account (`plants.user_id`), so the FK cascade cannot reach them; these pin
 * that this code doesn't reach them either, by any other route.
 */
describe("the Registry survives", () => {
  it("issues no delete against plants when a Property goes", async () => {
    const fake = createFakeClient({
      properties: PROPERTY,
      beds: BEDS,
      plantings: PLANTINGS,
      photos: PHOTOS,
    });

    await deletePropertyWithPhotos(fake.client, "prop-1");

    expect(fake.tablesDeletedFrom).toEqual(["properties"]);
  });

  it("issues no delete against plants when a Bed goes", async () => {
    const fake = createFakeClient({ beds: BEDS, plantings: PLANTINGS, photos: PHOTOS });

    await deleteBedWithPhotos(fake.client, "bed-1");

    expect(fake.tablesDeletedFrom).toEqual(["beds"]);
  });

  it("touches only the planting-photos bucket, never a Plant's reference photos", async () => {
    const fake = createFakeClient({
      properties: PROPERTY,
      beds: BEDS,
      plantings: PLANTINGS,
      photos: PHOTOS,
    });

    await deletePropertyWithPhotos(fake.client, "prop-1");

    // Base-map and Plant reference photo cleanup is #49's, deliberately not
    // this ticket's — so reaching either bucket here would be out of scope,
    // not a bonus.
    expect(new Set(fake.bucketsTouched)).toEqual(new Set([PLANTING_PHOTOS_BUCKET]));
  });
});

/**
 * Storage removal and a row delete can't be made atomic, so ordering decides
 * which way a partial failure falls. The ticket settles the storage-failure
 * direction ("on any failure removing files, the function aborts and deletes
 * nothing"); these cover the *inverse*, which it doesn't mention — a delete
 * that was never going to match a row must not destroy the files first.
 */
describe("a delete that matches no row", () => {
  it("removes no photo files when the Property isn't there", async () => {
    const fake = createFakeClient({
      properties: [],
      beds: BEDS,
      plantings: PLANTINGS,
      photos: PHOTOS,
    });

    await expect(deletePropertyWithPhotos(fake.client, "prop-1")).rejects.toThrow(/Property/);

    expect(fake.remove).not.toHaveBeenCalled();
  });

  it("removes no photo files when the Bed isn't there", async () => {
    const fake = createFakeClient({ beds: [], plantings: PLANTINGS, photos: PHOTOS });

    await expect(deleteBedWithPhotos(fake.client, "bed-1")).rejects.toThrow(/Bed/);

    expect(fake.remove).not.toHaveBeenCalled();
  });

  it("carries a code, so the client throws a typed error rather than matching the message", async () => {
    const fake = createFakeClient({ properties: [] });

    await expect(deletePropertyWithPhotos(fake.client, "prop-1")).rejects.toMatchObject({
      code: NOTHING_DELETED_CODE,
    });
  });

  it("issues no delete at all, leaving the rest of the map standing", async () => {
    const fake = createFakeClient({
      properties: [],
      beds: BEDS,
      plantings: PLANTINGS,
      photos: PHOTOS,
    });

    await expect(deletePropertyWithPhotos(fake.client, "prop-1")).rejects.toThrow();

    expect(fake.tablesDeletedFrom).toEqual([]);
    expect(fake.tables.beds).toHaveLength(BEDS.length);
  });
});
