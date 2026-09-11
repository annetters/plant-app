# ADR-0009: A Planting's Bed is derived from its Pin, not stored on it

## Status

**Proposed — reopened 2026-09-11, pending a grilling session. Do not build
against this.** The user is undecided about dropping `plantings.bed_id`, which
is what everything below turns on, and asked for the decision to be stress-
tested before #54 is started. Nothing here is implemented: `bed_id` is still
`not null` and still cascades (`0013_plantings.sql`). See #54's 2026-09-11
comment.

Originally accepted 2026-09-10, and **substantially revised the same day**
after a grilling session reversed the central decision of the first draft. See
"What the grilling changed" at the bottom: the original version made Bed
membership an explicit assignment the gardener sets and the app never
overrides. It is the opposite — position is the only truth — and the
reasoning is kept so a later attempt does not re-propose assignment.

**Reverses the Pin-within-a-Bed containment rule** established by #8 and
recorded in `CONTEXT.md`'s Pin and Planting entries, and **amends the delete
cascade** recorded under "Ownership and deletion".

Enforced today in three places, all of which change:
`plantings.bed_id not null references beds (id) on delete cascade`
(`0013_plantings.sql`), the save-time gate in `PlantingMap.tsx` ("Drop the
pin inside a Bed before saving."), and `resolvePinDrop`'s single-Bed
resolution in `packages/domain/src/planting.ts`.

Also **supersedes** the Planting-fields line in `docs/plant-app-spec.md`
("map location (bed + pin coordinates...)"), which assumed a Bed was part of
a Planting's address. The spec is left unedited, as ADR-0002 and ADR-0005
left it — an ADR is how that document gets narrowed in this repo.

Prompted by the V1 product specification received 2026-09-10 — see ADR-0008
for how that document is being used.

## Context

A Planting currently *cannot exist* outside a Bed. `bed_id` is `not null`,
the UI refuses to save a Pin dropped anywhere else, and deleting a Bed
deletes every Planting in it along with their photo logs.

Two problems follow, and they are different in kind.

**The first is a gap in what can be recorded.** Not every plant in a garden
is in a bed. A tree standing in the lawn has a real, specific position on
the map — it is simply not inside any drawn Bed. Today it cannot be
recorded at all: the map refuses to save a Pin that lands on bare ground.

The distinction that matters here is **on the map versus not on the map**,
not *in a bed versus in a container*:

- A plant the gardener has not placed anywhere is a **Plant with no
  Planting**. That already works — `plants` hangs off the account directly
  (`0001_plants.sql`), and the Registry lists it whether or not it is
  planted.
- A tree in the lawn is a **Planting with a position and no Bed**. That is
  what this ADR makes possible.

An earlier draft motivated this with "a pot on the patio" and "nursery stock
not yet in the ground". Both are wrong, and wrong in a way that muddied the
decision: they are things that are *not on the map*, which is the first case
and needs nothing built. Container-versus-ground is not a distinction this
app makes.

**The second is that the only way to fix a Bed is to lose its Plantings.**
Beds cannot be reshaped — there is no update path for a Bed's geometry, and
editability was considered and **deferred** on 2026-09-10. So correcting a
mis-drawn outline means deleting and redrawing, which today cascades through
every Planting inside it and every photo attached to those Plantings.

This is the argument for making the change now rather than alongside some
later editing feature: delete-and-redraw is not a temporary state of affairs,
it is the only way to fix a Bed for the foreseeable future. #48 records this
as the sharpest destructive-action gap in the app: a larger loss than the
Property delete that *does* ask for confirmation, on a single unconfirmed
click.

### What `CONTEXT.md` already decided, and why it is being reopened

This ADR reverses a considered position, not an oversight. "Ownership and
deletion" argues the current behaviour explicitly:

> What a shelf note records goes with the shelf, and this is expected rather
> than a surprise to be softened: a Planting's quantity, year acquired,
> source/nursery and dated photo log are all properties of the placement, not
> of the Plant.

That reasoning answers "does deleting a Bed damage the Registry?", and the
answer stays **no**. The Plant record and everything on it survives.

What the shelf metaphor cannot describe is the relationship this ADR
establishes. A shelf physically holds its items: put something on it and it
is there until moved, and the shelf going away means the items have nowhere
to be. A Bed does none of that. It is an outline drawn on a map, and a
Planting is associated with it when the Planting's Pin happens to fall
inside that outline. Nothing is held. **Association is not ownership and not
containment** — see the Decision below, and `CONTEXT.md`'s Bed membership
entry.

## Decision

**Bed association is derived from the Pin's position, and is not stored.**
`plantings.bed_id` is dropped rather than made nullable. Which Beds a
Planting is associated with is computed, wherever it is needed, from the Pin
and the Bed outlines already loaded. A stored link would be a second copy of
something the geometry already answers, with nothing to keep the two honest.

**Position is the only truth.** Dropping a Pin inside a Bed associates the
Planting with that Bed. Dropping it on bare ground associates it with none.
There is no Bed picker, no override, and no way to set membership by hand —
so a Planting cannot be associated with a Bed its Pin does not sit inside.
That state is not warned about; it is unrepresentable.

**A Pin marks the plant's centre**, not its extent. A plant whose foliage
has spread past its bed's edge has not moved, so it does not change Beds.
The first draft treated "a plant that has spread past the edge of its bed"
as a case to preserve; it cannot arise.

**Beds are independent geometric objects and may overlap.** Drawing,
redrawing or deleting one never modifies, trims, merges or moves another.
Overlap is legal, not a validation error. The app *may* warn about it; that
warning is not being built now.

**A Planting may be associated with several Beds.** If its Pin falls inside
two overlapping outlines, both are true, and every surface that names a
Planting's Bed names all of them.

**Deleting a Bed removes its outline and nothing else.** The cascade
recorded in `CONTEXT.md` changes from

```
Property -> Bed -> Planting -> planting photos
```

to

```
Property -> Map
Property -> Bed                      (no Plantings beneath it)
Property -> Planting -> planting photos
```

Because a Planting never references a Bed, this is not a cascade that had to
be corrected — there is no longer a path for it to run down. The data loss
#54 exists to fix becomes structurally impossible rather than fixed.

**A Planting records its Property directly.** With no `bed_id`, a Planting
can no longer reach a Property through its Bed, and `plantings`' row-level
security currently does exactly that — all three of its policies, and all
three on `planting_photos`, resolve the owner via
`plantings -> beds -> properties`. Those policies re-root on
`plantings.property_id`. This is a security boundary, not bookkeeping: a
Planting with the wrong Property is invisible to its own owner.

**Deleting a Property still cascades to everything.** That is the one delete
the gardener is unambiguously asking for, and it already confirms.

## Consequences

### Gains

- A tree in the lawn — any plant with a position and no Bed — becomes
  recordable. It has no representation today.
- **#48's sharpest case stops existing.** Confirmation is still required
  (#48 stands), but a mis-clicked Bed delete now costs an outline. Its
  approved wording is superseded: it warns about losing photos and
  quantities that are no longer at risk.
- Fixing a mis-drawn Bed stops costing a season of records.
- **Nothing can drift.** A derived association cannot disagree with the
  geometry, so the "assignment and position disagree" state — which the
  first draft had to design a warning for — does not exist.
- Redrawing a Bed re-associates the Plantings inside it automatically, with
  no recomputation step to forget.
- Removes the "Drop the pin inside a Bed before saving." dead end, which is
  currently reachable with no Beds drawn at all.

### Costs and constraints

- **A migration that is a security step.** Each Planting's `property_id` is
  backfilled from the Bed it currently points at, then `bed_id` is dropped.
  No production data is at risk — every account is a throwaway — but a wrong
  `property_id` hides a Planting rather than merely looking odd, so it needs
  a test that every Pin comes out associated with the same Beds it went in.
- **Every surface that names a Bed computes it.** The Registry, the phone
  Registry, `PlantingDetailScreen` and `MapScreen` all read a stored
  `bedId` today. At 50-100 Plantings the point-in-polygon pass is
  negligible, and the Registry already loads every Bed.
- **Fetching by Bed stops working.** `MapScreen` lists Plantings with
  `listByBeds(bedIds)`; with no Bed column there is nothing to query on, and
  it becomes a list-by-Property call. Same on web.
- **Redrawing a Bed silently changes what is inside it.** Delete a Bed,
  redraw it tighter, and a Pin near the old edge is now in no Bed, with no
  notification — because nothing was ever assigned to lose. This is accepted
  as the price of the simpler rule.
- **Overlapping Beds produce multiple associations**, which every display
  site must handle rather than picking one. `findBedContainingPoint` returns
  the first match in list order today; that arbitrary choice becomes visible
  once membership is computed, which is why the plural form replaces it.

## What is not adopted

The specification splits plants three ways — catalog, individually-owned
specimen, placement — so that "Cafe au Lait #1" and "#2" are separate
records. **That split is rejected.** `CONTEXT.md`'s rule stands: a Planting
with quantity 24 is one record for 24 specimens, not 24 records. A gardener
plants a drift as one decision, and per-specimen records would be worse to
enter, read and edit for no gain this app has a use for.

An **overlap warning** is permitted by this ADR but deliberately not built.
Overlap is legal, so a warning would be advisory only, and designing where
it appears and when it clears is work for a situation that has not yet been
observed to confuse anyone.

## What the grilling changed

The first draft of this ADR, and #54 as originally filed, made Bed
membership an **explicit assignment**: `bed_id` nullable, a Pin drop
*proposing* a Bed that the gardener could override, and a warning whenever
the stored assignment and the Pin's position disagreed. Three things came
out of the grilling session that reversed it:

1. **The motivating examples were wrong.** "A pot on the patio" and
   "nursery stock not yet in the ground" are plants that are not on the map,
   which the Plant/Planting split already handles. The real case is a plant
   *with* a map position and no Bed — a tree in the lawn.
2. **Manual assignment was not wanted.** Stated directly: a Planting should
   not be assignable by hand, and it should be impossible for a Planting to
   sit outside a Bed while being associated with it. That deletes the
   override, the Bed picker, the disagreement state and the warning in one
   move — and, once nothing can disagree, deletes the stored column too.
3. **Beds may overlap**, so association is plural. An earlier round had
   settled on forbidding overlap to keep a single answer; that was reversed
   on the grounds that Beds are independent geometric objects and one must
   never constrain another.

The net effect is a smaller change with less UI, and one the schema enforces
rather than the application maintaining it.
