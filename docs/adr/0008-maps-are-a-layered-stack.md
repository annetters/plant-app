# ADR-0008: Maps are a layered stack on a Property, not one exclusive source

## Status

Accepted — 2026-09-10. **Reverses the one-source-per-Property rule** set by
#6 on 2026-08-18 and recorded in three places: `CONTEXT.md`'s Property entry
("The choice is made once, at creation; it isn't revisited afterward"),
`packages/domain/src/property.ts`, and the
`properties_base_map_source_consistent` check constraint in migration
`0017_property_base_map.sql`.

Prompted by a V1 product specification received from the developer team on
2026-09-10. Only the parts of that document judged better than the existing
implementation were adopted; see "Relationship to the specification".

## Context

#6 established three base-map sources — aerial imagery, a photographed
plan, an in-app drawing — as a **free choice made once, up front, never
mixed**. The exclusivity was enforced at every level: a `text` column with a
`check` constraint, a second constraint forbidding the other two sources'
columns from being populated, and a domain rule stating a Property is
recreated rather than re-sourced.

That rule was correct for what #6 shipped. It has since been pushed on from
both sides by tickets filed against real use:

- **#41** wants a Property re-mapped in place — aligning and re-framing the
  base map after Beds exist — which the "recreated, not re-sourced" half of
  the rule forbids.
- **#52** wants a landscaper's plan traced *over* the aligned aerial map, and
  states the problem exactly: it needs "an underlay plus an overlay, not one
  of three exclusive sources", adding that "#41 relaxes the same rule from
  the other side. Worth doing them consistently."

So the rule was already scheduled for demolition by two independent tickets
before the specification arrived. What the specification contributed was a
better shape for what replaces it, and one distinction the codebase did not
have.

## Decision

**A Property has zero or more Maps.** Each is a row of its own, carrying its
own source asset, opacity, visibility and stacking order. The three sources
stop being mutually exclusive kinds of Property and become kinds of Map.

**Calibration and display transform are separate concerns.**

- **Calibration** answers *how big is this picture in the real world* — the
  relationship between a Map's own image coordinates and the Property's
  real-world feet. It is the thing #28 made visible and redoable because a
  wrong one is otherwise undetectable.
- **Display transform** answers *how is this picture positioned on the
  canvas* — rotation, pan, zoom, crop, opacity.

Today these are fused into one scalar, `pixelsPerFootForProperty`. That
fusion is invisible while no display transform exists; #41 is the ticket that
introduces one, which is what makes separating them urgent rather than
theoretical.

**Garden objects never use Map-local coordinates.** Beds and Pins stay in
Property-relative real-world feet, exactly as `bed.ts` already stores them.
Adding, hiding, reordering, re-transforming or deleting a Map must not move
a Bed or a Pin. This is already true by construction and must stay true.

### The aerial-flatten carve-out

The specification requires that Map transformations be non-destructive with
no exceptions. **We deviate for aerial maps, deliberately.**

#41 flattens the aligned aerial map to a single stored image and discards the
tiles. That is safe for aerial specifically, because #41 also persists the
centre lat/lon, `canvasNorthBearingDegrees` and derived px-per-ft — which
makes the flatten *reconstructible*: the tiles can be re-fetched from Esri
and the transform re-applied. #41 already relies on this to re-project Beds
exactly through a re-align. A flatten you can rebuild from stored parameters
is a cache, not a destroyed original.

A **photographed or drawn** Map has no such source to go back to. Flattening
one and re-aligning it later means resampling an already-resampled image,
compounding loss every time — and #41 acknowledges this from the other
direction by locking the re-align affordance entirely once a Bed exists on a
photo/drawn Property. So for those, the original upload is kept and the
transform stored beside it.

The practical consequence: **#41 ships as designed, for aerial.** It is not
redesigned against this ADR and is not blocked by it. Its flattened image
becomes one row in the Maps table when the layered model lands.

## Consequences

### Gains

- **#52 becomes buildable** without working around the source model, which
  is what it currently says it must do.
- **#41's photo/drawn lock becomes removable** later. Today its own
  acceptance criteria hide re-alignment once a Bed exists, because Beds
  cannot be re-projected without georeferencing. Keeping the original plus a
  transform means the picture moves under the Beds without the Beds moving —
  no re-projection needed, so nothing has to be locked.
- **Calibration stays redoable independently of framing.** #28 exists because
  a calibration set once and never shown is how #6 shipped a map ~1.5× off.
  Fusing calibration into a display transform would make every re-frame
  silently re-derive scale.
- An aerial underlay plus a traced plan on top is the "paper plan" outcome
  #52 is after, with the underlay hideable rather than replaced.

### Costs and constraints

- **A migration that moves live columns.** `base_map_source`,
  `base_map_photo_path`, `base_map_drawing` and `scale_reference` leave
  `properties` for rows of their own, and both check constraints are dropped.
  Every existing Property becomes a Property with exactly one Map.
- **Four render surfaces gain a stack.** `BedEditor`, `PlantingMap`,
  `PropertyPage`'s preview and the native `MapScreen` currently render one
  base map via `BaseMapBackground`. They must render an ordered list with
  per-Map opacity — and the phone surface gets this whether or not it gains
  any way to edit it.
- **The one-Map case must not get worse.** Most Properties will have exactly
  one Map forever. Layer ordering, opacity and visibility controls must stay
  out of the way until there is a second Map to order.
- **`STAGE_SIZE_PX` remains load-bearing** and is not addressed here. Every
  Map in the stack calibrates against the same 768px render space, and #41's
  trap — never letting a raster's own resolution leak into the stored
  px-per-ft — applies per Map rather than once per Property.

## Relationship to the specification

The specification's §7–9 proposed this model, including the
calibration/display-transform split, which is the genuinely new idea and the
reason this ADR exists rather than a plain #52 implementation.

Its blanket non-destructive rule (§7.3, invariant 6) is **not** adopted in
full; the aerial carve-out above is a documented deviation, taken under the
specification's own "Existing Implementation Superior" category.

Its `property_maps` table and column names are treated as conceptual. The
existing vocabulary — Property, base map, Scale Reference — is what
`CONTEXT.md` and the codebase already speak, and naming differences are not
architectural conflicts.
