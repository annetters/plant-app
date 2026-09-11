/**
 * The wording every destructive-delete confirmation shows, on both surfaces
 * (#47). It lives here, in the platform-agnostic package, for the same reason
 * `DUPLICATE_PLANT_OFFER` does: the requirement is that web and native *agree*,
 * and two hand-written copies is how they drift (see the `plantLabel`
 * divergence #18's QA found).
 *
 * Only the *mechanism* differs by platform. Web renders these as an in-page
 * modal — never `window.confirm`, which a browser can suppress and answer
 * "no" on the gardener's behalf without showing anything, which is the bug
 * #47 was filed for. Native renders them through `Alert`, which the OS draws
 * and offers no suppression control for.
 *
 * Per CONTEXT.md's "Ownership and deletion": it is not enough to say "this
 * cannot be undone". That undersells the cascade and says nothing about what
 * is *kept*, which for a gardener is the more urgent half of the question.
 */

/** One confirmation's words. `reassurance` is the "and here is what survives" half — not every delete has one. */
export interface DeleteConfirmationCopy {
  heading: string;
  body: string;
  /** What the gardener keeps. Rendered with emphasis, and the reason this dialog is more than a warning. */
  reassurance?: string;
  confirmAction: string;
  cancelAction: string;
}

/**
 * Deleting a Property takes the whole map with it. The Registry is what
 * survives, and saying so is the point: a gardener's fear here is losing
 * their plant collection, and they don't.
 */
export const DELETE_PROPERTY_CONFIRMATION: DeleteConfirmationCopy = {
  heading: "Delete this Property?",
  body:
    "This deletes your map: the Beds you've drawn, and everything recorded about what's planted where — photos, quantities, where you bought each plant.",
  reassurance: "Your Registry is untouched. Every plant stays in your collection.",
  confirmAction: "Delete Property",
  cancelAction: "Cancel",
};

/**
 * The mirror image of the Property case, and the reason it gets its own
 * wording rather than a generic one: deleting a Plant *does* reach the map,
 * because its Plantings go with it (CONTEXT.md, "Ownership and deletion").
 * There is nothing reassuring to add, so nothing is added.
 */
export const DELETE_PLANT_CONFIRMATION: DeleteConfirmationCopy = {
  heading: "Delete this Plant?",
  body: "This removes it from your Registry, and from anywhere it's planted on your map.",
  confirmAction: "Delete Plant",
  cancelAction: "Cancel",
};
