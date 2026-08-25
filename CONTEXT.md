# CONTEXT.md — Personal Garden Plant Registry

## Glossary

### Plant
A species- or variety-level record. Fields: common name, scientific name,
cultivar, flower color, bloom window, sun/shade requirement, mature height
and spread, USDA hardiness zone, deciduous/evergreen, native/non-native,
reference photos (visual identification only — see Tag Scan for a separate,
non-mixed category of photo), and care task templates. One Plant record may
underlie many Plantings. Never use "plant" to mean both Plant and Planting.

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

Before creating a new Plant record, a Tag Scan checks whether the user
already has a matching Plant (same genus/species/cultivar) and offers to add
a new Planting against the existing record instead — one source of truth per
plant type/cultivar, not a registry that fragments across repeat purchases
from different nurseries.

Species-level trait suggestions (hardiness, mature size, sun/shade — never
bloom window, which is climate-dependent, not a species/cultivar fact, and
stays user-observed only regardless of source) come from USDA PLANTS, the
starting data source — see
`docs/research/plant-data-source-cultivar-level-evaluation.md`. Sources are
a pluggable layer, not a single permanent choice: USDA has no cultivar-level
data, so for now cultivar identification relies on OCR, the saved tag photo,
and user confirmation only, with no automated lookup claiming a precision no
current free source provides. Named candidates for closing that gap later:
Proven Winners and similar commercial breeder/marketing programs (USDA
structurally can't cover patented, trademarked cultivars), Missouri
Botanical Garden's Plant Finder, and NC State's plant database. Revisit when
cultivar-level coverage is a real gap in practice, not speculatively. A
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
scale far less sensitive to small tap or measurement error. Used once per
Property.

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
required. Works identically on desktop and phone. Optional precision-assist
suggestions (e.g. referencing a Landmark) may be added later — not required
for MVP.

### Bloom window
A Plant's typical flowering period, stored as start and end month/day
(year-independent). Displayed as bars on the Bloom Timeline.

### Care task template
A recurring care instruction defined on a Plant, inherited by all its
Plantings. Has a name and a trigger. Not overridable per Planting.

### Task trigger
The scheduling mechanism for a care task template. Two types only:
- **Date-range**: fixed calendar window (e.g. "April 1–15"), auto-computed.
- **Seasonal-marker**: freeform reminder text, no computed date.

### Task completion
A log entry (done or missed) keyed by Care task template, Planting, and
calendar year. All three are needed: a Plant with three Care task templates
produces three Task completions per year for each of its Plantings. Forms a
reviewable care history per Planting.

### One-off todo
A manual, non-recurring reminder outside the care task template system.

### Registry
The searchable, filterable Plant list. Filter axes: name, flower color,
bloom month, sun/shade, and other Plant fields. Each entry links to its
Planting location(s) on the Property's map.

### Bloom Timeline
Year-view bar chart of Plant bloom windows, filterable by Bed. A
month-filtered list view is a secondary presentation of the same data —
no separate data model. Unfiltered (no Bed selected), both views show
every Plant with a bloom window, planted or not — the Bed filter narrows
to only Plants actually planted in that Bed. It is not a "planted
somewhere" toggle: there is no filter state that means "every Planting
across every Bed" as distinct from "every Plant in the Registry."

### Dashboard
The home screen. Quick access to Map, Registry, and Bloom Timeline. Task
lists not surfaced immediately — reachable within 2–3 taps.
