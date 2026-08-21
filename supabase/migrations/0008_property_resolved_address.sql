-- Follow-up to ticket #5, raised during manual QA: a vague address (e.g.
-- "1 main st", no city/state) still geocodes to *something* via Nominatim's
-- top-ranked match, silently, with no way to tell it's wrong. Storing what
-- the geocoder actually resolved to — distinct from what the user typed —
-- lets the app show both side by side so a mismatch is visible rather than
-- silent. Nullable: existing Property rows created before this column
-- existed have no resolved address on record and are not backfilled (same
-- no-backfill precedent as migration 0005 — this is a personal
-- single-user app).
alter table public.properties
  add column if not exists resolved_address text;
