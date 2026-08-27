import type { BedPoint } from '@plant-app/domain'

/** A stroke's points as an SVG `<polyline points="...">` attribute value. */
export function strokePoints(stroke: readonly BedPoint[]): string {
  return stroke.map((point) => `${point.x},${point.y}`).join(' ')
}
