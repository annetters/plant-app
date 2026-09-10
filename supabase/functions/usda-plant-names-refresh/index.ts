// Ticket #36: pulls USDA PLANTS' bulk checklist into `public.usda_plant_names`.
//
// Ingest, don't proxy (the user's call, 2026-09-08). The name index is 93,157
// rows that USDA regenerates on no published schedule; fetching it per lookup
// would put 6.7 MB and an undocumented endpoint in the path of every
// keystroke. Ingesting touches that fragility once per refresh, in a run
// somebody is watching, and leaves name resolution as a local index scan.
//
// Licensing is explicit: USDA's Help Document states the plant data "is not
// copyrighted and is free for any use", citation requested. Images are a
// separate, stricter regime and are deliberately untouched.
//
//   USDA, NRCS. The PLANTS Database (http://plants.usda.gov, 9 September 2026).
//   National Plant Data Team, Greensboro, NC USA.
//
// Invoked by hand, not on a schedule — USDA publishes no update cadence, so
// there is no frequency worth guessing at. See
// docs/research/usda-plants-name-resolution.md.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { parseUsdaChecklist, type UsdaChecklistRow } from "../_shared/usdaChecklist.ts";

// A plain static file, not an API call. The same filename at the same path
// appears in Internet Archive snapshots from 2010 and 2019 and is a named
// constant in USDA's own app bundle — the most stable thing USDA offers here.
const CHECKLIST_URL = "https://plants.sc.egov.usda.gov/DocumentLibrary/Txt/plantlst.txt";
const USER_AGENT =
  "plant-app/0.0 (USDA PLANTS checklist ingest, github.com/annetters/plant-app issue #36)";

/** Big enough that 93k rows don't need 90 round trips, small enough to stay well inside PostgREST's request limits. */
const UPSERT_BATCH_SIZE = 2_000;
/** Batches in flight at once. Sequential inserts alone put the run uncomfortably close to the wall-clock limit. */
const UPSERT_CONCURRENCY = 4;

interface ChecklistDownload {
  status: "unchanged" | "downloaded";
  text?: string;
  lastModified: string | null;
}

/**
 * USDA serves a real `Last-Modified` on this file, so a refresh that finds
 * nothing new costs one conditional request instead of 6.7 MB.
 */
async function downloadChecklist(knownLastModified: string | null): Promise<ChecklistDownload> {
  const headers: Record<string, string> = { "User-Agent": USER_AGENT };
  if (knownLastModified) headers["If-Modified-Since"] = knownLastModified;

  const response = await fetch(CHECKLIST_URL, { headers });
  if (response.status === 304) {
    // Read nothing, but the body still has to be released.
    await response.body?.cancel();
    return { status: "unchanged", lastModified: knownLastModified };
  }
  if (!response.ok) throw new Error(`GET plantlst.txt -> HTTP ${response.status}`);
  return {
    status: "downloaded",
    text: await response.text(),
    lastModified: response.headers.get("Last-Modified"),
  };
}

function toInsertRows(rows: UsdaChecklistRow[], refreshedAt: string) {
  return rows.map((row) => ({
    symbol: row.symbol,
    // The table's key half, never null — see the migration on why.
    synonym_symbol: row.synonymSymbol ?? "",
    scientific_name: row.scientificName,
    scientific_name_with_author: row.scientificNameWithAuthor,
    common_name: row.commonName,
    family: row.family,
    refreshed_at: refreshedAt,
  }));
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  // Any signed-in user, which during MVP means the one person who owns every
  // account on this project. Worth revisiting before there are third-party
  // users: this is an expensive call for anyone to be able to trigger.
  const auth = await requireUser(req);
  if (!auth) return jsonResponse({ error: "Not authenticated." }, 401);

  let force = false;
  try {
    const body = await req.json();
    force = typeof body === "object" && body !== null && (body as { force?: unknown }).force === true;
  } catch {
    // An empty body is the ordinary way to call this.
  }

  // Writes bypass RLS: the table has read policies only, deliberately, so the
  // checklist can't be edited from a client session.
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: previous } = await admin
    .from("usda_plant_names_refresh")
    .select("source_last_modified")
    .maybeSingle();

  let download: ChecklistDownload;
  try {
    download = await downloadChecklist(force ? null : (previous?.source_last_modified ?? null));
  } catch (cause) {
    // Same body-visibility reason as the other functions: an expected failure
    // returns HTTP 200 carrying `{ error }`, so `functions.invoke` shows it.
    return jsonResponse({ error: `Could not download USDA's checklist. ${cause}` });
  }

  if (download.status === "unchanged") {
    return jsonResponse({
      status: "unchanged",
      sourceLastModified: download.lastModified,
    });
  }

  const parsed = parseUsdaChecklist(download.text!);
  if (parsed.length === 0) {
    // USDA served *something* but it held no usable rows. Refusing to write is
    // the point: a truncated or re-shaped file must not be allowed to empty
    // the index that every species lookup depends on.
    return jsonResponse({ error: "USDA's checklist parsed to zero rows; leaving the index alone." });
  }

  const refreshedAt = new Date().toISOString();
  const rows = toInsertRows(parsed, refreshedAt);

  for (let start = 0; start < rows.length; start += UPSERT_BATCH_SIZE * UPSERT_CONCURRENCY) {
    const batches = [];
    for (let n = 0; n < UPSERT_CONCURRENCY; n += 1) {
      const from = start + n * UPSERT_BATCH_SIZE;
      if (from >= rows.length) break;
      batches.push(
        admin
          .from("usda_plant_names")
          .upsert(rows.slice(from, from + UPSERT_BATCH_SIZE), {
            onConflict: "symbol,synonym_symbol",
          }),
      );
    }
    const results = await Promise.all(batches);
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      // Partial writes are survivable by design — every row written is a real
      // name, and the stale sweep below hasn't run, so nothing was removed.
      return jsonResponse({ error: `Writing the checklist failed: ${failed.error.message}` });
    }
  }

  // Taxa USDA has dropped since the last pull: present in the table, untouched
  // by this run. Only reached once every batch above succeeded.
  const { error: sweepError } = await admin
    .from("usda_plant_names")
    .delete()
    .lt("refreshed_at", refreshedAt);
  if (sweepError) {
    return jsonResponse({ error: `Removing withdrawn taxa failed: ${sweepError.message}` });
  }

  const { error: stateError } = await admin.from("usda_plant_names_refresh").upsert({
    id: true,
    source_last_modified: download.lastModified,
    source_row_count: rows.length,
    refreshed_at: refreshedAt,
  });
  if (stateError) {
    return jsonResponse({ error: `Recording the refresh failed: ${stateError.message}` });
  }

  return jsonResponse({
    status: "refreshed",
    rowCount: rows.length,
    sourceLastModified: download.lastModified,
  });
});
