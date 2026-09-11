// Ticket #47: deleting a Property or a Bed orphans its planting photo files.
//
// Runs server-side (Deno edge runtime) per ADR-0003 — object storage is an
// external adapter, so the code that empties the bucket runs here rather than
// in each client repository. Web and native both call this one function, so
// the two cannot drift, which is the failure mode duplicated repository code
// invites.
//
// Deliberately thin: auth, parsing and responses only. Everything worth
// testing is in `_shared/plantingPhotoCascade.ts`, which takes a client as an
// argument and has a vitest suite (`vitest.functions.config.ts`).
import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import {
  CascadeDeleteError,
  deleteBedWithPhotos,
  deletePropertyWithPhotos,
  type PlantingPhotoCascadeClient,
} from "../_shared/plantingPhotoCascade.ts";

interface DeleteMapObjectRequest {
  kind: "property" | "bed";
  id: string;
}

function parseRequestBody(body: unknown): DeleteMapObjectRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const { kind, id } = body as Record<string, unknown>;
  if (kind !== "property" && kind !== "bed") return null;
  if (typeof id !== "string" || !id.trim()) return null;
  return { kind, id };
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  let parsedBody: unknown;
  try {
    parsedBody = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }
  // A well-formed client can't reach this — a client-bug guard, not a
  // user-reachable validation message.
  const input = parseRequestBody(parsedBody);
  if (!input) return jsonResponse({ error: "A Property or Bed id is required." }, 400);

  const auth = await requireUser(req);
  if (!auth) return jsonResponse({ error: "Not authenticated." }, 401);

  // The client is authenticated *as the calling user*, so every read and
  // delete below runs under the same RLS policies the client would hit. This
  // function deliberately does not use the service role: it needs no more
  // reach than the owner already has, and the existing policies already let an
  // owner select and delete their own photo rows and files.
  const client = auth.supabase as unknown as PlantingPhotoCascadeClient;

  // Expected, user-reachable failures are returned as HTTP 200 with an
  // `{ error }` body — not a non-2xx status — because `supabase-js`'s
  // `functions.invoke` doesn't surface a non-2xx response's JSON body as a
  // usable client-side message, only a generic transport-level one.
  try {
    if (input.kind === "property") {
      await deletePropertyWithPhotos(client, input.id);
    } else {
      await deleteBedWithPhotos(client, input.id);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not complete this delete.";
    // The `code` is what lets the client throw a typed `NothingDeletedError`
    // rather than matching on this message across a deploy boundary.
    const code = error instanceof CascadeDeleteError ? error.code : undefined;
    return jsonResponse({ error: message, code });
  }

  return jsonResponse({ deleted: true });
});
