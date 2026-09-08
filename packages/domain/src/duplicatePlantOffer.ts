/**
 * The one wording every Plant creation path shows when the duplicate check
 * matches — Tag Scan review, the phone's Add Plant form, and web's
 * `/registry/new` (#37). It lives here, in the platform-agnostic package,
 * because the requirement is that the surfaces *agree*: three hand-written
 * copies of this offer is how web and mobile drift apart (see the
 * `plantLabel` divergence #18's QA found).
 *
 * The three decision points below are the offer, and every path presents all
 * three. Creating anyway is never removed: CONTEXT.md's model is
 * offer-an-alternative, not prohibit — a gardener may genuinely want a
 * second record. Only the *mechanics* differ by platform (web navigates by
 * route, native by navigation stack).
 */
export const DUPLICATE_PLANT_OFFER = {
  heading: "You already have this Plant",
  body:
    "One Plant record per plant type or cultivar is what keeps your Registry from fragmenting across repeat purchases from different nurseries. Did you mean to create a second record for it? Open the Plant below to check, add a Planting against the record you already have, or create a second Plant if this really is a different one.",
  /** Opens the matched Plant so the gardener can judge for themselves whether it's the same plant — the offer names it, but only the record itself settles it. */
  viewExistingAction: "Open the Plant you already have",
  addPlantingAction: "Add a Planting against this Plant",
  createAnywayAction: "This is a different Plant — create it anyway",
  keepEditingAction: "Go back and edit",
  /** Shown while the existing-Plant list is still loading, on every path — the check can't run until it arrives. */
  checkingMessage: "Checking your existing Plants for a match…",
} as const;
