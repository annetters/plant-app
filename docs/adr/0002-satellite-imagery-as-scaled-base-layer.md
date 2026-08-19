# ADR-0002: Aerial imagery as an optional, self-scaling base layer

## Status

Accepted — 2026-08-13. **Narrows** the "no photo-based or GPS-based map
creation" line in `docs/plant-app-spec.md`; see "Relationship to the spec".

**Amended 2026-08-18**, in the same session that introduced Property and
Scale Reference (see `CONTEXT.md`): two corrections.

1. The aerial image was never a stencil Beds get traced from — it is a
   structural reference layer (property boundary, driveways/streets,
   hardscaping, house footprint) that Beds are hand-drawn against. Earlier
   wording below implied tracing; it didn't accurately describe the design
   even before this session, and is corrected in place.
2. Parcel-service boundary fetching is demoted from a committed feature to
   best-effort — see "Parcel boundaries: demoted to best-effort".

Validated by the throwaway prototype `prototype/satellite-base/index.html`.

## Context

The spec rejected photo- and GPS-based mapping for two specific, still-valid
reasons: consumer GPS is ~10–16 ft accurate against a ~1 ft target, and
ground-level photos carry perspective distortion that a two-point calibration
cannot correct across a whole bed.

That left Beds drawn onto a blank grid, with the user supplying the map scale
by measuring something real in the garden (user story 21).

The open question was whether a **top-down aerial tile** — which is neither
GPS positioning nor a user-taken ground photo — could serve as a tracing base,
and whether the property's real dimensions could be fetched from an address.

## Decision

**Use top-down orthorectified aerial tiles as an optional base layer** beneath
the drawing canvas, fetched by address.

**Derive the map scale from latitude and tile zoom rather than asking for it.**
Web Mercator ground resolution is `earth_circumference × cos(latitude) / (256 × 2^zoom)`.
The `cos(latitude)` correction is essential — omitting it makes every distance
wrong by roughly 25% at New England latitudes.

**Probe imagery availability before use.** Do not assume a zoom level exists.

**Source lot boundaries from the relevant jurisdiction's parcel service, best-effort only** — where one exists and is cheap to reach. Request geometry
and lot size only. See "Parcel boundaries: demoted to best-effort" — this is
no longer something the app depends on.

## Consequences

### Gains

- **The user never measures anything.** Scale is computed. User story 21 ("tie
  the map's grid scale to a real-world measurement") becomes largely redundant.
- Precision measured at **2.2–8.3 in/px** depending on location and available
  zoom — comfortably inside the ~1 ft target everywhere tested.
- Drawing Beds against a real, visible layout — house, driveway, hardscaping —
  is markedly easier than drawing from memory onto a blank grid. Beds are
  still always hand-drawn, never traced from the image (see "Amended" above)
  — this is the value of accurate context, not of a stencil.
- Independently-sourced building footprints landed correctly on the roofs in
  the imagery, confirming projection, scale and registration at once.
- Where a parcel service happens to be cheap to reach, the real lot line is
  available, and its recorded acreage cross-checks the computed polygon area
  to within ~0.1% — a nice-to-have confirmation, not something relied on.

### Costs and constraints

- **The base layer must stay optional.** Dense tree canopy hides the ground
  beneath it, which reduces how much visible structure is available to draw
  Beds against in that part of the yard — often exactly the shade beds most
  worth recording. It doesn't block drawing a Bed there (Beds are hand-drawn,
  never traced), only the visual reference for placing it precisely. A
  non-aerial fallback is required regardless: a photographed plan or a plan
  drawn directly in the app (see `CONTEXT.md`, Property) — not a literal blank
  canvas, which no longer exists as a mode now that Pins are placed by
  dragging onto a visible map.
- **Imagery is stale**, typically 1–4 years. Low impact for property extent
  (buildings and lot lines don't move), high impact for seeing current beds.
- **Maximum zoom varies by location.** Observed: zoom 21 in one US suburb,
  20 in another, 19 in central London and in rural areas.
- **Missing tiles are served as grey placeholders with HTTP 200.** A gap cannot
  be detected from the status code. Availability must be probed explicitly.
- **Canvas tainting will silently break export.** Drawing cross-origin imagery
  onto a canvas taints it, and every later `toDataURL()` throws. It works only
  with both a permissive CORS header from the tile server and `crossOrigin`
  set on the image. Any imagery source adopted later must be re-checked.
- **Registration offset** of a few feet persists across providers. Fine for
  tracing shapes; not sufficient for absolute coordinates.
- **Lot boundaries do not generalise.** There is no free national parcel
  source. Coverage is per-jurisdiction and some jurisdictions publish nothing.
  The feature must degrade gracefully, and must distinguish "outside our
  coverage" from "no parcel at this point" — they are different problems.
- **Recorded boundaries and physical reality differ.** A parcel polygon is a
  strong starting guess, not ground truth; what is actually fenced routinely
  differs by a few feet.

### Privacy

Parcel services typically carry owner names, owner mailing addresses, sale
history and valuations alongside the geometry. **Request only the fields
needed** — geometry and lot size — so personal data is never fetched, rather
than fetched and filtered later. This is a hard constraint.

### Licensing

The prototype's free stack is not licensed for production volume — the
geocoder used explicitly forbids heavy use, and public data mirrors are
volunteer infrastructure. OpenStreetMap data is ODbL (share-alike), which
raises derivative-database questions if bed geometry is derived from it.
Revisit before shipping anything beyond personal use.

## Relationship to the spec

This does **not** reopen what the spec actually rejected. No GPS is read and no
user photo is taken. The user still draws every outline by hand — they trace
something real instead of drawing from memory.

The spec's "Out of Scope" wording was too broad and has been narrowed to name
GPS positioning and user-taken ground-level photos specifically.

## Parcel boundaries: demoted to best-effort

**Amended 2026-08-18.** Parcel-service boundary fetching was written above as
a committed decision. It no longer is — it's opportunistic only: fetch it
where a jurisdiction's service is easy and cheap to reach, silently skip it
everywhere else, and never block anything on it.

Nothing new was discovered to cause this — both reasons were already sitting
in this ADR. Coverage has no free national source and is per-jurisdiction
(Costs and constraints), and OpenStreetMap-derived data carries an unresolved
ODbL share-alike question already flagged above for revisit (Licensing). Read
together, they made this path more fragile than it's worth depending on.

What changed is that it's no longer the only way to get an accurate boundary.
A photographed plot plan or survey — see `CONTEXT.md`, Scale Reference — gives
most homeowners a reliable property boundary without touching a parcel
service, its coverage gaps, or its licensing question at all.

## Deferred, not rejected

**GPS-assisted pin placement is out of scope for the MVP but explicitly left
open for a later phase.** It is not ruled out permanently.

For whoever revisits this: the blocker was accuracy, ~10–16 ft against a ~1 ft
target. Reopen it if that gap closes — for example via a phone's dual-frequency
GNSS, RTK correction services, or by using GPS only as a coarse hint that a
landmark-distance measurement then refines. The base layer decided here is
compatible with that: a correctly-scaled map is a prerequisite for placing any
GPS-derived pin onto it.

## Considered and set aside: LiDAR/AR scanning

**Added 2026-08-18.** Ground-level LiDAR/AR scanning (Apple's ARKit, on
LiDAR-equipped Pro-model iPhones/iPads) was discussed as a possible fourth
base-map source — capturing structural geometry (property line, driveway,
house footprint) by walking the property instead of using an aerial image or
a photographed plan. Set aside, not as technically impossible, but because it
doesn't fill a real gap: the photographed plot-plan/survey path (see
`CONTEXT.md`, Property and Scale Reference) already serves the same case — no
usable aerial imagery — more reliably, with no per-device hardware gate and
far less engineering effort.

Outdoor use also faces real limits: short sensor range (~5 m) requiring
extensive walking and stitching to cover a whole property, and accuracy
degradation in direct sunlight — exactly the conditions gardening happens in.
Unlike GPS's accuracy gap, these aren't closing on a predictable trajectory,
so there's no clean "reopen if X happens" condition to record here. Revisit
only if a concrete case emerges where none of the three existing base-map
sources serve.
