# ADR-0010: Storing derived Esri imagery is acceptable at one user, and must be revisited before there are more

## Status

Accepted — 2026-09-11. Resolves #51, which asked the question and did not
answer it. Unblocks #41's flatten-at-setup design, which ADR-0008 had already
carved out as a deliberate deviation from its own non-destructive rule.

## Context

Today the app only **displays** Esri World Imagery. `aerialTileUrl`
(`packages/domain/src/property.ts:73`) builds a tile URL against
`server.arcgisonline.com` and the tiles are fetched fresh from the endpoint
on every render. Nothing is kept.

#41 changes that. It flattens the aligned aerial map into a single raster at
the end of Property setup and stores it in Supabase storage, indefinitely,
discarding the tiles. ADR-0008 accepted that deviation on the grounds that a
flatten which can be rebuilt from stored parameters — centre lat/lon,
`canvasNorthBearingDegrees`, derived px-per-ft — is a cache rather than a
destroyed original.

That reasoning is about *our* data model. It says nothing about whether
Esri's terms permit the storing, which is a different question and the one
#51 raised: displaying and storing are different acts, and the terms may
treat them differently.

## Decision

**Store it.** #41 ships its flatten as designed.

The rationale is not that the terms permit it — that research was never
done, and this ADR does not claim an answer to it. The rationale is that the
question does not currently have stakes:

- There is exactly one user, who is the developer.
- The stored raster is private to that user's own Supabase storage.
- Nothing is redistributed, published, or served to a third party.

A private cache held by a single user, of imagery that user is entitled to
view, is the case least likely to trouble anyone. #51 itself said as much —
"Not a blocker on #41 being *specified* — only on it shipping as a product
anyone else uses."

## The revisit trigger

**This decision expires the moment the app has a user who is not the
developer.** Sharing it with anyone — a second account, a beta group, a
public launch — makes the unanswered question live again, and it must be
answered before that happens, not after.

What a revisit has to settle, which this ADR explicitly does not:

- Whether Esri's World Imagery terms permit storing or caching derived
  images at all.
- Whether they distinguish a private single-user cache from redistribution.
  This ADR leans entirely on that distinction existing; if it doesn't, the
  decision was wrong even at one user.
- **Attribution.** The app currently displays none — there is no Esri
  credit anywhere in `apps/web` or `apps/mobile`. That is a gap under the
  display-only model too, and a stored derived raster does not make it
  smaller.

If the answer comes back unfavourable, #51 already listed the fallbacks:
re-fetch and re-composite on demand, keep the transform live instead of
flattening (#41's rejected option (b)), or move to a different imagery
source.

## Consequences

- **#41 is unblocked** and needs no redesign.
- **The debt is real and deferred, not retired.** A stored raster per
  Property accumulates from the first Property onward, so a later adverse
  answer means deleting stored images and changing how the aerial map
  renders — not just changing a decision on paper.
- **Reconstructibility is now load-bearing for a second reason.** ADR-0008
  wanted it so a re-align could re-project Beds exactly. It also happens to
  be the escape hatch here: because the flatten can be rebuilt from stored
  parameters, dropping to on-demand compositing later is a change of
  strategy rather than a loss of data.
