# ADR-0002: Aerial imagery as an optional, self-scaling base layer

## Status

Accepted — 2026-08-13. **Narrows** the "no photo-based or GPS-based map
creation" line in `docs/plant-app-spec.md`; see "Relationship to the spec".

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

**Source lot boundaries from the relevant jurisdiction's parcel service**, where
one exists. Request geometry and lot size only.

## Consequences

### Gains

- **The user never measures anything.** Scale is computed. User story 21 ("tie
  the map's grid scale to a real-world measurement") becomes largely redundant.
- Precision measured at **2.2–8.3 in/px** depending on location and available
  zoom — comfortably inside the ~1 ft target everywhere tested.
- Tracing a visible outline is markedly easier than drawing from memory onto a
  blank grid.
- Independently-sourced building footprints landed correctly on the roofs in
  the imagery, confirming projection, scale and registration at once.
- Where a parcel service exists, the real lot line is available, and its
  recorded acreage cross-checks the computed polygon area to within ~0.1%.

### Costs and constraints

- **The base layer must stay optional.** Dense tree canopy makes beds
  untraceable from above — exactly the shade beds most worth recording. A
  blank-canvas fallback is required, not a nice-to-have.
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

## Deferred, not rejected

**GPS-assisted pin placement is out of scope for the MVP but explicitly left
open for a later phase.** It is not ruled out permanently.

For whoever revisits this: the blocker was accuracy, ~10–16 ft against a ~1 ft
target. Reopen it if that gap closes — for example via a phone's dual-frequency
GNSS, RTK correction services, or by using GPS only as a coarse hint that a
landmark-distance measurement then refines. The base layer decided here is
compatible with that: a correctly-scaled map is a prerequisite for placing any
GPS-derived pin onto it.
