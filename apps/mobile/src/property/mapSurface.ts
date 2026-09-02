import { STAGE_SIZE_PX, type BedPoint } from '@plant-app/domain'

/**
 * Fitting the base map onto a phone.
 *
 * The map itself is the same fixed `STAGE_SIZE_PX` square web draws on —
 * Beds, Pins and the Scale Reference are all defined against it, so its size
 * is never negotiable (see `@plant-app/domain`'s `baseMap`). A phone screen
 * is simply narrower than that square, so the *rendering* is scaled down to
 * fit and every screen-space measurement (a finger's drag) is converted back
 * through that scale before it touches map coordinates.
 */

/** How much of its true size the surface is drawn at, given the width the screen can spare. Never upscales — a wide screen shows the map 1:1 rather than a blurry enlargement. */
export function mapDisplayScale(availableWidthPx: number): number {
  // A layout pass can report zero width before it has measured; a scale of
  // zero would divide by zero in `draggedStagePoint` and blank the map.
  const usable = Math.max(availableWidthPx, 1)
  return Math.min(usable, STAGE_SIZE_PX) / STAGE_SIZE_PX
}

/**
 * Where a dragged Pin marker sits on the surface: where it was when the drag
 * began, plus how far the finger has travelled since — converted out of
 * screen pixels into surface pixels, so the marker tracks the fingertip
 * rather than lagging behind it by the display scale.
 *
 * `dx`/`dy` are cumulative from the start of the gesture (React Native's
 * `PanResponder` reports them that way), which is why `start` is the
 * position at the drag's *start*, not the marker's latest position.
 *
 * Clamped to the surface: a fling past the edge parks the Pin on the border
 * instead of somewhere off-map where it can't be seen or dragged back.
 */
export function draggedStagePoint(
  start: BedPoint,
  dx: number,
  dy: number,
  displayScale: number,
): BedPoint {
  return {
    x: clampToSurface(start.x + dx / displayScale),
    y: clampToSurface(start.y + dy / displayScale),
  }
}

function clampToSurface(value: number): number {
  return Math.min(Math.max(value, 0), STAGE_SIZE_PX)
}

/**
 * Which of `points` sit close enough to `target` that one fingertip can't
 * choose between them.
 *
 * Two markers of radius `tapRadiusPx` start overlapping once their centres are
 * within two radii of each other, so that's the threshold. It's measured in
 * *screen* pixels — a fingertip is a fixed physical size however far the map
 * has been shrunk to fit — while `points` and `target` are in the surface's
 * own coordinates, which is what `displayScale` reconciles.
 *
 * Returns indices rather than the points themselves, so the caller keeps
 * whatever it had attached to each one.
 */
export function indicesWithinTapRange(
  points: readonly BedPoint[],
  target: BedPoint,
  tapRadiusPx: number,
  displayScale: number,
): number[] {
  const maxSurfaceDistance = (tapRadiusPx * 2) / displayScale
  const found: number[] = []
  points.forEach((point, index) => {
    if (Math.hypot(point.x - target.x, point.y - target.y) <= maxSurfaceDistance) {
      found.push(index)
    }
  })
  return found
}
