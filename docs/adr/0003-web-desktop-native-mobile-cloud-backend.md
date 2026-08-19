# ADR-0003: Web desktop + native mobile, cloud-hosted BaaS backend, full feature parity except drawing

## Status

Accepted — 2026-08-18. Resolves the tech-stack and persistence decision
`plant-app-handoff.md` flagged as the one thing blocking ticket-writing.

**Amended the same day**: adds where the shared domain logic executes — see
"Domain logic execution", flagged there as **held with lower confidence**
than the rest of this ADR.

## Context

The spec is deliberately stack-agnostic. ADR-0001's prototype used vanilla
JS and Konva for the bed editor, but was explicit that this was not a
commitment — the stack decision was left open. Three questions had to be
settled before `/to-tickets` could produce meaningful work: what runs where
(platform), how data persists and moves between devices, and — once native
mobile entered the picture — how much of the app that native build actually
needs to contain.

## Decision

### Platform

- **Desktop: a browser-based web app.** Reuses ADR-0001's Konva validation
  directly — no reason to rebuild the bed editor in a different stack.
- **Phone: a native app, built with React Native** — not Flutter, not
  true-native Swift/Kotlin per platform. iPhone first; Android added later
  at low incremental cost, not a second full build.
- **Why React Native over Flutter**: it shares TypeScript/JavaScript with
  the web app — one language across the whole stack, which matters more for
  a solo build than any native-API access this app doesn't need (nothing in
  the spec — camera, notifications, maps — is behind an API cross-platform
  can't reach).
- **Why cross-platform over true-native**: "iPhone primary, Android
  nice-to-have, not committed" is exactly the situation where Android
  should be cheap to add later, not a decision to make twice.

### Persistence

- **Cloud-hosted backend, with user accounts.** A user logs in from any
  browser or device and sees the same data — this is load-bearing, not a
  preference: bed creation happens on desktop, pin placement happens on
  phone, and both need to see the same Property.
- **Backend-as-a-service, Postgres-based** (e.g. Supabase) — not a
  hand-rolled Node backend, not a NoSQL BaaS like Firebase.
- **Why relational, specifically**: the domain is clearly relational —
  Plant, Planting, Property, Bed, Scale Reference, Landmark, Pin, Tag Scan
  all reference each other in structured ways. A BaaS also gets auth and
  file storage largely for free, which matters more for a solo build than
  the control a custom backend would offer.
- **Local-only persistence was ruled out**, not merely deprioritized: it
  would silently break the desktop-draws / phone-places workflow, since two
  separate physical devices wouldn't see the same data without some kind of
  sync — at which point it isn't "local-only" in any meaningful sense.
- **Offline-first with background sync** was considered and set aside for
  MVP as more complexity than a single-user app needs up front. Revisit if
  spotty signal while gardening turns out to be a real, observed problem,
  not a hypothetical one.

### Native app feature scope: full parity, except drawing

- **Every view ships natively** — Map, Registry, Bloom Timeline, Dashboard,
  task/todo management — not a map-only companion app.
- **Exception: freehand/shape drawing stays desktop-only.** This covers Bed
  outlines and a Property's drawn-in-app base map (the fallback path when
  neither an aerial image nor a photographed plan is available) — both use
  the same precision-tracing tool, and ADR-0001's original finding
  (touchscreen freehand tracing was tried and rejected as impractical)
  didn't change just because the rest of the app went to full parity.
- **Scale Reference calibration is *not* bundled with "drawing."** It's
  tapping two points and entering a number, not freehand tracing — a much
  coarser gesture that doesn't need the fine motor precision that ruled out
  touchscreen bed-drawing in the first place. It ships at full parity: a
  plot plan or survey can be photographed and calibrated entirely from a
  phone.
- **Bloom Timeline ships as two presentations on every platform, including
  phone** — the horizontal year-view chart and the month-filtered list —
  neither is a phone-only fallback for the other. The horizontal-scroll
  experience must be fluid and pleasant to use, not merely technically
  functional.

### Domain logic execution

Split by whether the logic touches an external adapter credential.

- **Anything calling an external adapter with a secret — USDA lookup,
  geocoder, tile server, parcel service — runs server-side**, as Supabase
  Edge Functions. This is not a judgment call: an API key cannot ship inside
  a client bundle or mobile binary, full stop, independent of anything else
  in this section.
- **OCR is not settled onto either side yet, and doesn't automatically
  belong in the list above.** The "must run server-side" reasoning only
  applies if OCR turns out to be a cloud API with a credential to protect.
  If it's on-device instead (e.g. Apple's Vision framework — plausible
  given iPhone-first is already decided: free, works offline, no credential
  at all), there's nothing to protect and no reason it couldn't run in the
  shared client package below instead. **Which one it is has never been
  decided.** Resolve this as part of the recommended Tag Scan prototype
  pass (see the spec's Further Notes) — testing on-device OCR against real
  nursery tags is exactly how you'd find out whether it's even accurate
  enough to skip the cloud option. Until resolved, don't build OCR
  integration assuming either side of this split.
- **Everything else — task-template cascading, Bloom Timeline bar math,
  Scale Reference's two-point-plus-distance calculation, real-world-unit Bed
  geometry, Tag Scan's matching/de-dup logic once an OCR or USDA result is
  already in hand — runs in a shared TypeScript package**, imported directly
  by both the web app and the React Native app. Neither client re-implements
  its own copy. This is the concrete payoff of choosing React Native over
  Flutter above specifically for sharing a language with the web app — a
  shared package is what actually cashes that reasoning in, rather than the
  two codebases merely happening to use the same language. This package is
  also the domain-logic seam the spec's testing plan targets directly.
- **Baseline, regardless of the above**: ordinary Postgres schema
  constraints — foreign keys, `NOT NULL`, cheap `CHECK`s like quantity > 0 —
  stay in place no matter what. This isn't the richer enforcement layer
  discussed below; it's standard relational hygiene that costs nothing extra
  in a BaaS and catches gross corruption even if the shared package has a
  bug.

**Held with lower confidence than the rest of this ADR.** The alternative —
enforcing the non-adapter logic server-side too, so a buggy or compromised
client can never write data that violates a business rule — is the more
defensible choice for a multi-tenant product with an adversarial threat
model. This is a single-user personal app without that threat model, which
is why the lighter approach was chosen here — but that argument rests on a
risk-profile judgment, not on security expertise this ADR doesn't have.
**Reconsider server-side enforcement of the full rule set if**: the app ever
gains multi-user or shared-access features, or enough data accumulates
(years of task history, 50-100+ plantings) that a corruption caused by a
client-side bug becomes expensive to unwind by hand.

## Consequences

### Gains

- The web app remains reachable from any browser, phone included, for
  anything a user prefers to do there — though with full native parity,
  this matters less than it would have under a narrower native scope.
- Property base-map photo upload (a plot plan or survey) already works from
  any device via an ordinary browser file picker — this was settled before
  the native app scope was decided, and holds regardless: native app or
  phone browser both work.
- One relational schema serves both frontends without translation.

### Costs and risks

- **Full parity is a substantially bigger native build** than a map-only
  companion app would have been. This was a deliberate, explicit scope
  choice — nothing in this session's original reason for going native
  (pin placement while walking the garden) demanded it — not a default
  that crept in unexamined.
- **BaaS lock-in.** If the chosen provider's pricing, features, or terms
  ever force a switch, the relational schema should port reasonably
  cleanly to another Postgres-based BaaS. A switch to a NoSQL BaaS would
  require real data modeling changes, not just a config change.
- Two frontends (web, React Native) still means two UI codebases to build
  and maintain, even sharing one language and one backend — full parity
  makes this cost real, not just theoretical.

## Relationship to prior ADRs

Builds on, does not reopen, ADR-0001 (Konva bed editor, still desktop-only)
and ADR-0002 (aerial/photographed base layer, Property, Scale Reference).
The "desktop-only" line those ADRs draw around drawing is preserved here
exactly — this ADR's contribution is drawing that line correctly around
*only* drawing, not around everything base-map-related, now that Scale
Reference and photo upload are known to work fine on phone.
