# CONTEXT.md — Personal Garden Plant Registry

## Surfaces

There are **two** surfaces, and only two (ADR-0003): the **web app**, which is
the desktop surface, and the **iPhone app**, which is the phone surface.

**A mobile browser is not a third surface.** The web app is not expected to
work as a phone experience, is not designed against one, and is not QA'd on
one. On a phone-sized browser it says so and points at the iPhone app. It
stays readable rather than refusing outright — a link opened on a phone
shouldn't be a dead end — but that is a courtesy, not a supported way to use
the app, and no feature is held to working there.

So when a term below says something works "on phone", it means the iPhone
app. It is never a claim about a phone browser.

**Drawing is the exception that belongs to neither phone surface.** Freehand
Bed outlines and the in-app drawn base plan are **desktop-browser-only**:
ADR-0001 evaluated touchscreen tracing and rejected it as impractical, and
ADR-0003 kept that as the single gap in otherwise-full native parity. The
iPhone app deliberately doesn't offer drawing either. So a phone browser
that can't draw must point the gardener at a *desktop browser* — pointing at
the iPhone app would send them somewhere the feature doesn't exist.

## Glossary

### Plant
A species- or variety-level record. Fields: common name, scientific name,
cultivar, flower color, bloom window, sun/shade requirement, mature height
and spread, USDA hardiness zone, deciduous/evergreen, native/non-native,
reference photos (visual identification only — see Tag Scan for a separate,
non-mixed category of photo). One Plant record may underlie many
Plantings. Never use "plant" to mean both Plant and Planting.

Before creating a new Plant record, the app checks whether the user already
has a matching Plant (same genus/species/cultivar) and offers to add a new
Planting against the existing record instead — one source of truth per plant
type/cultivar, not a registry that fragments across repeat purchases from
different nurseries. This holds however the record is being created: a Tag
Scan, the phone's Add Plant form, or the web Registry's, all check the same
way and present the same offer. It offers an alternative, it never
prohibits — a gardener who means to keep a second record can always create
one anyway.

### Tag Scan
Creating or enriching a Plant record from a photographed nursery tag. OCR
extracts candidate text (common name, scientific name, cultivar); the user
always confirms before anything is applied — OCR proposes, a human decides,
nothing auto-applies. Same rule as Scale Reference's photographed-dimension
entry.

Matching resolves to genus, species, **and** cultivar — never just a common
name or genus. A common name can span multiple species (e.g. "Liatris"
covers both *spicata* and *aspera*), and a species can span both a straight
form and named cultivars (e.g. Joe Pye Weed as the species, or as 'Gateway').
When a scan doesn't resolve unambiguously, the app shows the candidates and
asks the user to check the physical tag rather than guessing.

A proposed scientific name is checked against a **genus vocabulary** — a
bundled list of real plant genera, compiled from GBIF's taxonomic backbone
and consulted locally, never over the network (ADR-0006). Typography alone
cannot tell a binomial from marketing copy: "Follow us" has the same shape as
"Monarda didyma", and both used to be proposed as species. A name is offered
only if its genus is a real one. Unknown genus means no proposal at all — a
blank field the gardener fills in beats a confident wrong guess. This is a
different job from trait suggestion, and deliberately a different source:
GBIF validates a genus offline, from a vocabulary bundled into the app, with
no network call and no account of what a plant is like.

No single taxonomic-status filter gets the vocabulary right, so it carries a
small hand-edited **override layer** beside it — additions for real genera the
filter drops, exclusions for entries that collide with ordinary tag text, each
with its reason recorded. It is data the gardener's agent edits deliberately,
never something the app learns on its own: a filter that quietly changed its
own behaviour would be exactly the auto-decision Tag Scan's rule forbids.

**Species names** come from USDA PLANTS, held as our own copy of its full
checklist — 48,994 accepted names plus 44,163 synonyms, refreshed from USDA's
bulk file by a job that is run deliberately, never on a schedule USDA hasn't
published (ADR-0007). Names local, traits live. Because the synonyms are
there, a tag printing an outdated name resolves to the one USDA accepts today.

**Species-level trait suggestions** (hardiness, mature size — never bloom
window, which is climate-dependent, not a species/cultivar fact, and stays
user-observed only regardless of source; and no longer sun/shade, whose
USDA reading proved close to inverted and is dropped as of #44) come from
USDA too, but from a different, much smaller table fetched live — an NRCS
conservation-plant set of ~2,186 species. Most garden plants are named in the
checklist and absent from it, so **having no traits is ordinary and does not
mean the plant is unknown**. Duration, growth habit and family are shown
alongside, attributed to USDA and never saved: they exist for plants that
have no traits at all, and USDA's families are Cronquist-era, so they read as
USDA's claim rather than the app's.

Native status is deliberately **not** taken from USDA. It answers per coarse
region ("native in the lower 48"), and native is only meaningful against the
gardener's own area — see #50 for the state-level version of the question.

Sources are a pluggable layer, not a single permanent choice: USDA has no
cultivar-level data, so for now cultivar identification relies on OCR, the
saved tag photo, and user confirmation only, with no automated lookup
claiming a precision no current free source provides. Named candidates for
closing that gap later: Proven Winners and similar commercial
breeder/marketing programs (USDA structurally can't cover patented,
trademarked cultivars), Missouri Botanical Garden's Plant Finder, and NC
State's plant database. **The species-level revisit already happened** (#36,
ADR-0007) and it was answered inside USDA; what remains parked is the
*cultivar*-level question, and that is what those candidates are for. A
nice-to-have once richer taxonomic data exists: browsing a registry Plant's
taxonomic relatives (e.g. every other Plant in the same genus already in the
user's registry).

The tag photo itself is kept, tagged as its own category distinct from
Plant's reference photos and never mixed with them — it's evidence of where
the data came from, not a picture of the living plant. Kept by default (a
system-wide setting, not a per-scan prompt); deletable afterward like any
other photo.

### Planting
A specific placement decision: one cluster of a given Plant at a given
location in the garden. Fields: reference to Plant, quantity, map location
(bed + pin coordinates), year acquired, source/nursery, dated photo log.
A Planting with quantity 24 = one record for 24 specimens, not 24 records.

### Property
The whole real-world garden or yard the app manages, and the single
top-level container a user's Beds sit within. Owns the one grid scale
(pixels-per-real-world-unit) shared by every Bed drawn within it — a Bed
never carries its own independent scale, so a foot means the same distance
everywhere on the map, not just within one Bed.

Gets a base map one of three ways: an aerial image, with scale auto-derived
from latitude and tile zoom (ADR-0002); a photograph or scan of an existing
plan — a professional plot plan or survey if the user has one (often already
printed to a stated scale with dimension callouts), otherwise a hand-drawn
sketch; or a plan drawn directly in the app. In every case, the base map is a
**structural reference layer** — property boundary, driveways/streets,
hardscaping, house footprint and dimensions — not a stencil Beds are traced
from. Beds are always hand-drawn (freehand or shape-based, ADR-0001) on top
of it, positioned by eye against the real features it shows. The latter two
base-map sources carry no inherent scale and require a Scale Reference to
establish one.

Which source to use is a **free choice offered up front** when the Property
is first created, not a fallback only reachable once an address turns out to
have no aerial coverage — a gardener may prefer their own photographed/drawn
plan simply because the imagery available isn't usable (outdated, obscured
by tree cover, too low-res), or for privacy: choosing photo/drawn skips
geocoding entirely, so no address is ever sent to Nominatim or Esri for that
Property. A photo/drawn Property therefore has no address at all — it's
identified by a user-chosen name instead. The choice is made once, at
creation; it isn't revisited afterward (a Property is recreated, not
re-sourced, to change it) — with one exception: an aerial Property whose
address turns out to have no imagery coverage can still fall back to
photo/drawn afterward, since that's completing the original setup, not
switching a settled choice.

### Scale Reference
Establishes a Property's scale when it has none of its own (i.e. no aerial
image — see Property). Two entry modes, producing the same underlying data —
two points plus a real-world distance:
- **Known measurement**: the user already knows an overall dimension (a
  property width, or a plan already drawn to a stated scale) and enters it
  directly, calibrated against the base image's own edges. On a photographed
  plot plan or survey, OCR may extract candidate numbers from the image to
  save typing — but only as candidates: the user always picks which one is
  correct and confirms it. No number is ever applied automatically.
- **Measured object**: the user marks two points against a fixed, permanent,
  precisely-measurable real-world reference (a wall or fence run — not
  furniture or vegetation) and enters the tape-measured distance.

Prefer as long a reference as practical: a longer baseline makes the derived
scale far less sensitive to small tap or measurement error.

A Property has at most one Scale Reference at a time, but it can be **redone**.
A gardener who can't see the scale can't tell a good calibration from a bad
one, and a calibration set once and never shown is exactly how #6 shipped a
map that was ~1.5x off. So the derived scale is always stated on the Property,
and a Scale Reference can be replaced without touching the base map it was
measured against. Redoing it is safe precisely because Beds and Plantings are
stored in real-world units (see Bed): they keep their positions and simply
redraw against the new scale.

An aerial Property has no Scale Reference to redo — its scale comes from
latitude and imagery zoom, with no gardener-supplied input in it.

### Measurement grid
An optional overlay of squares of a known real-world size, drawn over a
Property's base map on either surface. It exists to make a Property's scale
**checkable**: a number ("2.75 px per ft") can't be compared against anything
without arithmetic, where a gardener who knows one real distance on their own
land — a driveway, a fence run, the house frontage — can count squares along
it and see at a glance whether the app agrees with them.

It is a reference, never a drawing surface: nothing is snapped to it, no Bed
or Pin is constrained by it, and turning it on or off changes nothing that is
stored — it is a way of looking, not a thing the Property has.

The square size opens at whatever suits the Property's scale, and is then the
gardener's to set. On the desktop surface that means any distance they can
type, because the check the grid exists for is "count squares along something
you already know the length of" and a known run is a 37 ft driveway as often
as a round 25. The phone offers the round values only: it can't set a Scale
Reference at all yet (#15), so there it is for reading a map rather than
checking one against a tape measure.

### Bed
A drawn map area representing a physical garden section, belonging to
exactly one Property. Desktop-only creation. Has a name, a drawn outline
stored as the raw traced point list **in real-world units, not pixels of
whatever base image was showing when drawn**, a smoothing flag, and zero or
more Landmarks. Grid scale belongs to the Property, not the Bed — see
Property.

The outline is stored raw and smoothed on render, never the other way round —
see ADR-0001. Storing points in real-world units, converted to pixels only at
render time, keeps a Bed's shape correct even if its Property's base image is
later replaced or its scale is re-derived. Landmarks are optional: a Pin
placed by rough tap needs none.

### Landmark
**Deferred — not a required feature for MVP.** Originally spec'd as a named
reference point tagged during Bed creation, used to refine a Pin's position
by entering a distance from it. Superseded for MVP by dragging a Pin
directly to position on an accurately scaled map (see Pin) — landmark-distance
math was a workaround for imprecise base maps, which Scale Reference and
real-world-unit Bed storage now make unnecessary as a hard requirement. May
return later as an optional precision-assist suggestion, not a manual
numeric input.

### Pin
A map marker for a Planting's location within a Bed, placed by dragging
directly to position on the map. No manual distance or number entry is
required. Works identically on the **desktop web app and the iPhone app** —
the two supported surfaces (see Surfaces). This is not a claim about a phone
browser; the iPhone app is what makes Pin placement work on a phone.
Optional precision-assist suggestions (e.g. referencing a Landmark) may be
added later — not required for MVP.

### Bloom window
A Plant's typical flowering period, stored as start and end month/day
(year-independent). Displayed as bars on the Bloom Timeline.

### Task system — removed
**Removed from the app entirely on 2026-09-08 (ADR-0005): application code
and database tables.** Not deferred like Landmark and not merely out of
scope — gone. Four terms lived here, and the language is recorded once so a
later attempt doesn't re-invent it with different boundaries:

- **Care task template** — a recurring care instruction defined on a Plant
  and inherited by all its Plantings, never overridable per Planting.
- **Task trigger** — its schedule, of exactly two kinds: a fixed calendar
  **date-range**, or a freeform **seasonal-marker** reminder with no computed
  date.
- **Task completion** — a done/missed log entry keyed by all three of Care
  task template, Planting and calendar year.
- **One-off todo** — a manual, non-recurring reminder that sat *outside* the
  care task template system entirely: owned directly by the account, attached
  to no Plant and no Planting. This is the distinction most easily lost, and
  the one to preserve if any of this ever returns.

Built by #4, #12 and #18, which stay closed as accurate history. #21 was the
only piece never built and is closed as `wontfix`.

### Registry
The searchable, filterable Plant list. Filter axes: name, flower color,
bloom month, sun/shade, and other Plant fields. Each entry links to its
Planting location(s) on the Property's map.

### Ownership and deletion
The gardener's own model, and the one the app follows:

> The Registry is a collection of items. A Bed is a shelf where the items go.
> The Map holds the shelves.

Deleting a Map or a Bed **never** removes items from the Registry. Plants are
owned by the account, not by the map, and the delete cascade only ever runs
downward: Property -> Bed -> Planting -> planting photos.

What a shelf note records goes with the shelf, and this is expected rather
than a surprise to be softened: a Planting's quantity, year acquired,
source/nursery and dated photo log are all properties of the placement, not
of the Plant. The Plant record itself — name, color, bloom window, reference
photos — always survives. In the other direction, deleting a Plant removes it
from the collection *and* from every shelf it sits on, since its Plantings
go with it.

**Every destructive action confirms first**, on every surface, and states
which of the two is being lost in those terms. A destructive action is one
that removes a record or an uploaded file that cannot be recovered from
within the app — deleting a Property, a Bed, a Plant, a Planting, or any
photo. It is not enough to say "this cannot be undone": that undersells a
cascade and says nothing about what is kept. Web confirms with an in-page
modal, never `window.confirm` — a browser can suppress that and answer it
"no" on the gardener's behalf without showing anything. Native confirms with
`Alert`. The two carry the same words. See #47.

A delete also removes the files it makes unreachable, not just the rows:
a photo lives both as a record and as a file in a storage bucket, and the
database cascade only ever reaches the first.

### Bloom Timeline
Year-view bar chart of Plant bloom windows, filterable by Bed. A
month-filtered list view is a secondary presentation of the same data —
no separate data model. Unfiltered (no Bed selected), both views show
every Plant with a bloom window, planted or not — the Bed filter narrows
to only Plants actually planted in that Bed. It is not a "planted
somewhere" toggle: there is no filter state that means "every Planting
across every Bed" as distinct from "every Plant in the Registry."

### Dashboard
The home screen. Quick access to Map, Registry, and Bloom Timeline.
