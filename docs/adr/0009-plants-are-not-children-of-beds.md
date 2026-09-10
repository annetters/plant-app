# ADR-0009: A Planting is assigned to a Bed, not owned by one

## Status

Accepted — 2026-09-10. **Reverses the Pin-within-a-Bed containment rule**
established by #8 and recorded in `CONTEXT.md`'s Pin and Planting entries,
and **amends the delete cascade** recorded under "Ownership and deletion".

Enforced today in three places, all of which change:
`plantings.bed_id not null references beds (id) on delete cascade`
(`0013_plantings.sql`), the save-time gate in `PlantingMap.tsx` ("Drop the
pin inside a Bed before saving."), and `resolvePinDrop`'s containment
resolution in `packages/domain/src/planting.ts`.

Also **supersedes** the Planting-fields line in `docs/plant-app-spec.md`
("map location (bed + pin coordinates...)"), which assumed a Bed was part of
a Planting's address rather than an assignment on it. The spec is left
unedited, as ADR-0002 and ADR-0005 left it — an ADR is how that document gets
narrowed in this repo.

Prompted by the V1 product specification received 2026-09-10 — see ADR-0008
for how that document is being used.

## Context

A Planting currently *cannot exist* outside a Bed. `bed_id` is `not null`,
the UI refuses to save a Pin dropped anywhere else, and deleting a Bed
deletes every Planting in it along with their photo logs.

Two problems follow, and they are different in kind.

**The first is a gap in what can be recorded.** A gardener's plants are not
all in beds. A pot on the patio, a specimen in the lawn, something tucked
between two beds, a nursery pot waiting to go in the ground — none of these
can be entered at all today. The app silently insists every plant is in a
bed, which is not true of any real garden.

**The second is that the only way to fix a Bed is to lose its Plantings.**
Beds cannot be reshaped at all — there is no update path for a Bed's
geometry, and editability was considered and **deferred** on 2026-09-10. So
correcting a mis-drawn outline means deleting and redrawing, which today
cascades through every Planting inside it and every photo attached to those
Plantings.

This is the argument for making the change now rather than alongside some
later editing feature: delete-and-redraw is not a temporary state of affairs,
it is the only way to fix a Bed for the foreseeable future. #48
records this as the sharpest destructive-action gap in the app: a larger loss
than the Property delete that *does* ask for confirmation, on a single
unconfirmed click.

### What `CONTEXT.md` already decided, and why it is being reopened

This ADR reverses a considered position, not an oversight. "Ownership and
deletion" argues the current behaviour explicitly:

> What a shelf note records goes with the shelf, and this is expected rather
> than a surprise to be softened: a Planting's quantity, year acquired,
> source/nursery and dated photo log are all properties of the placement, not
> of the Plant.

That reasoning is sound for what it was about — it answers "does deleting a
Bed damage the Registry?", and the answer stays **no**. The Plant record and
everything on it survives, then and now.

What the metaphor does not cover is a plant with **no shelf**. The Registry
is a collection, a Bed is a shelf, the Map holds the shelves — and a pot on
the patio is an item in the collection sitting on no shelf at all. There was
no such thing when the model was written, because the schema made it
impossible.

Once "no shelf" is representable, deleting a shelf has an obvious answer that
did not previously exist: the items on it stop being on a shelf. Destroying
them stops being the only available reading.

## Decision

**`bed_id` becomes nullable, and means explicit assignment.** A value says
"the gardener put this Planting in that Bed". Null says "not assigned to a
Bed" — a pot, the lawn, the gap between two beds, or simply not decided yet.
Null is an ordinary state, not a missing value to be repaired.

**Containment becomes a warning, never a gate.** Dropping a Pin outside every
Bed saves fine. Geometry that disagrees with the assignment — a Pin outside
the Bed it is assigned to, after either one moves — surfaces as a warning on
the Planting, and never rewrites `bed_id` on the gardener's behalf.

**Geometric containment stops being a source of truth.** `resolvePinDrop`
keeps proposing a Bed when a Pin lands inside one, because that is a good
default and saves a step. It proposes; it no longer decides, and it can be
overridden.

**Deleting a Bed clears the assignment; it does not delete Plantings.** The
cascade recorded in `CONTEXT.md` changes from

```
Property -> Bed -> Planting -> planting photos
```

to

```
Property -> Bed                      (Plantings are unassigned, not deleted)
Property -> Planting -> planting photos
```

A Planting therefore needs a direct `property_id`, since it can no longer
reach a Property through its Bed.

**Deleting a Property still cascades to everything.** That is the one delete
the gardener is unambiguously asking for, and it already confirms.

## Consequences

### Gains

- Potted plants, lawn specimens and unplanted nursery stock become
  recordable — none of which have any representation today.
- **#48's sharpest case stops being a data-loss risk.** Confirmation is still
  required (#48 stands, and its approved wording needs revising to match the
  new behaviour), but a mis-click now costs a Bed outline rather than a
  season of photo logs.
- Fixing a mis-drawn Bed stops costing a season of records. Delete-and-redraw
  remains the only correction available, and this is what makes it survivable.
- Should Bed reshaping ever be built, it is safe by construction rather than
  needing this worked out first.
- Removes the "Drop the pin inside a Bed before saving." dead end, which is
  currently reachable with no Beds drawn at all.

### Costs and constraints

- **A migration with a real data question.** Dropping `not null` is trivial;
  changing the cascade is not. Existing Plantings need `property_id`
  backfilled from their Bed. There is no production data to protect — every
  account is a throwaway — but the migration still has to be right.
- **Unassigned Plantings need somewhere to be listed.** The Registry links to
  a Planting's location as "View in Front Border on the map". A Planting with
  no Bed needs different wording and a still-meaningful map link. This is a
  UI question this ADR does not settle.
- **The Bloom Timeline's Bed filter gains a third state.** Today it is
  "unfiltered" or "this Bed". Plantings with no Bed belong to neither and
  must not silently vanish from the unfiltered view.
- **The phone surface renders Pins by Bed.** `MapScreen` and
  `PlantingDetailScreen` both assume a Planting has one. Neither is
  desktop-gated, so both need handling.
- **A warning that is always on screen is noise.** "This plant is outside its
  assigned bed" must be dismissible or scoped to selection, or gardeners will
  learn to ignore it — and it is the one signal that catches a genuinely
  misplaced Pin.

## What is not adopted

The specification splits plants three ways — catalog, individually-owned
specimen, placement — so that "Cafe au Lait #1" and "#2" are separate
records. **That split is rejected.** `CONTEXT.md`'s rule stands: a Planting
with quantity 24 is one record for 24 specimens, not 24 records. A gardener
plants a drift as one decision, and per-specimen records would be worse to
enter, read and edit for no gain this app has a use for.

`bed_id` therefore hangs off a Planting — a cluster — exactly as it does
today. Only its nullability and its cascade change.
