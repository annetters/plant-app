# CONTEXT.md — Personal Garden Plant Registry

> ## ⚠️ Five entries below are under review and describe unbuilt behaviour
>
> **Reopened 2026-09-11 (#54, ADR-0009).** The user is undecided about
> dropping `plantings.bed_id` and deriving a Planting's Bed from its Pin's
> position, and wants that stress-tested before it is built. These entries were
> rewritten for that decision and **do not describe how the app behaves today**:
> **Planting**, **Bed membership**, **Pin**, **Ownership and deletion**,
> **Bloom Timeline**.
>
> What is actually true right now: `plantings.bed_id` is `not null` and
> cascades on delete (`0013_plantings.sql`), a Pin must be dropped inside a
> Bed to save, and deleting a Bed destroys its Plantings and their photo logs.
>
> Remove this notice when the grilling settles the question, whichever way it
> goes.

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
(pin coordinates — a Planting stores no Bed of its own; which Beds it is
associated with is derived from where its Pin sits, see Bed membership),
year acquired, source/nursery, dated photo log.
A Planting with quantity 24 = one record for 24 specimens, not 24 records.

### Property
The whole real-world garden or yard the app manages, and the single
top-level container a user's Beds sit within. Owns the one grid scale
(pixels-per-real-world-unit) shared by every Bed drawn within it — a Bed
never carries its own independent scale, so a foot means the same distance
everywhere on the map, not just within one Bed.

Carries one or more **Maps** (see Map), each from one of three sources: an
aerial image, with scale auto-derived from latitude and tile zoom (ADR-0002);
a photograph or scan of an existing
plan — a professional plot plan or survey if the user has one (often already
printed to a stated scale with dimension callouts), otherwise a hand-drawn
sketch; or a plan drawn directly in the app. In every case, the base map is a
**structural reference layer** — property boundary, driveways/streets,
hardscaping, house footprint and dimensions — not a stencil Beds are traced
from. Beds are always hand-drawn (freehand or shape-based, ADR-0001) on top
of it, positioned by eye against the real features it shows. The latter two
Map sources carry no inherent scale and require a Scale Reference to
establish one.

Which source to use is a **free choice offered up front** when the Property
is first created, not a fallback only reachable once an address turns out to
have no aerial coverage — a gardener may prefer their own photographed/drawn
plan simply because the imagery available isn't usable (outdated, obscured
by tree cover, too low-res), or for privacy: choosing photo/drawn skips
geocoding entirely, so no address is ever sent to Nominatim or Esri for that
Property. A photo/drawn Property therefore has no address at all — it's
identified by a user-chosen name instead.

**A Property is not limited to one Map, and the choice is not made once**
(ADR-0008, reversing the rule #6 set). Maps stack: an aerial image with a
traced plan over it (#52), or a survey beside the imagery it was checked
against. A Map can be added, hidden, reordered or replaced at any time, and
none of that moves a Bed or a Pin — those are stored in real-world feet
against the Property, never against a picture.

### Map
A reference picture of the Property — aerial imagery, a photographed plot
plan or survey, or a plan drawn in the app. A Property carries zero or more,
stacked in an order the gardener sets, each with its own opacity and its own
show/hide. **A Map is not the garden**: it is what Beds and Pins are
positioned *against*, never what they are stored in.

Two different things can be done to a Map, and running them together is how
a map goes quietly wrong:

- **Calibration** — how big the picture is in the real world. This is what
  Scale Reference establishes and what the stated scale makes checkable. It
  is the one that can be wrong without looking wrong.
- **Display transform** — where the picture sits on the canvas: rotation,
  pan, zoom, framing, opacity.

Changing how a Map is displayed never changes what anything measures, and
never moves a Bed or a Pin.

Map transforms are non-destructive — the uploaded original is kept — with
one deliberate exception: an **aerial** Map is flattened to a stored image
once aligned (#41). That is safe only because its centre lat/lon, bearing and
px-per-ft are stored alongside it, so the tiles can be re-fetched and the
result rebuilt. A photographed or drawn Map has no source to go back to, so
its original is always kept. See ADR-0008.

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

### Bed membership
> **Under review (#54, ADR-0009) — reopened 2026-09-11.** The rules in this
> entry describe a decision the user has not settled, and none of it is
> implemented: a Planting still stores `bed_id`, and deleting a Bed still
> destroys its Plantings. Read it as a proposal, not as how the app behaves.

A Bed is a region drawn on the map. A Planting is **associated** with a Bed
when its Pin falls inside that Bed's outline. **Association is not ownership
and not containment** (ADR-0009) — nothing is held, and nothing is stored: a
Planting records a position, and its Beds are worked out from it wherever
they are needed.

**Position is the only truth.** Dropping a Pin inside a Bed associates the
Planting with it; dropping it on bare ground associates it with none. There
is no Bed picker and no override, so a Planting cannot be associated with a
Bed its Pin does not sit inside — that state is not warned about, it is
unrepresentable.

**A Planting may have no Bed at all.** That is an ordinary state, not
missing data: a tree standing in the lawn has a real position on the map and
belongs to no Bed. The distinction that matters is *on the map versus not on
the map*, never *in a bed versus in a container* — a plant the gardener has
not placed anywhere is a Plant with no Planting, which is a different thing
and already works.

**A Pin marks the plant's centre, not its extent.** A plant whose foliage
has spread past its bed's edge has not moved, so it has not changed Beds.

**Beds are independent geometric objects and may overlap.** Drawing,
redrawing or deleting one never modifies, trims, merges or moves another.
Overlap is legal rather than an error, and a Pin inside two overlapping
outlines is associated with **both** — every surface that names a Planting's
Bed names all of them.

Redrawing a Bed therefore changes what is inside it, silently and with no
notification, because nothing was ever assigned to lose.

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
A map marker for a Planting's location on the Property, placed by dragging
directly to position on the map. No manual distance or number entry is
required. A Pin may land inside a Bed, inside two overlapping Beds, or
nowhere near one — see Bed membership. Its position is what determines the
Planting's Bed association, so it is never adjusted on the gardener's
behalf. Works identically on the **desktop web app and the iPhone app** —
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
The Registry is a collection of items, owned by the account.

**A Bed is not a shelf those items sit on.** That half of the older metaphor
is retired (ADR-0009): a shelf holds what is put on it, and a Bed holds
nothing. It is an outline drawn on the map, and a Planting is associated
with it only because the Planting's Pin happens to fall inside — see Bed
membership. Association is not ownership and not containment, so a Bed going
away takes nothing with it.

Deleting a Map or a Bed **never** removes items from the Registry. Plants are
owned by the account, not by the map. The cascade runs downward from the
Property, and **a Bed is not on the path to a Planting** (ADR-0009):

```
Property -> Map
Property -> Bed            (no Plantings beneath it)
Property -> Planting -> planting photos
```

Deleting a Bed removes its outline and nothing else; the Plantings inside it
stay where they are. This is not a cascade that was corrected but one that no
longer exists, because a Planting never references a Bed to begin with. A Bed
delete is still destructive — the outline is gone and cannot be recovered —
and its confirmation says exactly that and no more (#48).

What a Planting records is still the placement's own: quantity, year
acquired, source/nursery and dated photo log belong to the Planting, not to
the Plant, and deleting the *Planting* loses them. The Plant record
itself — name, color, bloom window, reference
photos — always survives. In the other direction, deleting a Plant removes it
from the collection *and* from the map, since its Plantings go with it.

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
Year-view bar chart of Plant bloom windows. A month-filtered list view is a
secondary presentation of the same data — no separate data model.
Unfiltered, both views show every Plant with a bloom window, planted or not.

Two independent filters narrow it:

- **By Bed** — only Plants with a Planting associated with that Bed. A Plant
  whose Pin falls inside two overlapping Beds appears under both.
- **On the map / not on the map** — whether a Plant has any Planting at all.
  This is the "planted somewhere" distinction that an earlier version of this
  entry explicitly ruled out; it is now wanted, on the Timeline and in the
  Registry alike, and being in a Bed has nothing to do with it.

### Dashboard
The home screen. Quick access to Map, Registry, and Bloom Timeline.
