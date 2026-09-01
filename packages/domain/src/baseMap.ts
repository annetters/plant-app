/**
 * The shared geometry of the base-map drawing surface — the fixed pixel
 * space Beds, Pins and a Scale Reference are all captured and rendered
 * against (see `CONTEXT.md`'s Property entry for the three base-map
 * sources).
 *
 * Lives in the domain package rather than in either app because both
 * surfaces now render the same map: web's Konva stage (`BedEditor`,
 * `PlantingMap`) and the phone's read-only Map screen (ticket #14). Two
 * copies of these constants would be a silent correctness bug, not just
 * duplication — a Scale Reference calibrated against one stage size but
 * rendered against another is off by exactly the ratio between them.
 */

import type { BedPoint } from "./bed.js";
import { aerialTileUrl, lonLatToTile, type Property } from "./property.js";

/** A fixed grid around the property's center tile — panning/zooming is out of scope, on both surfaces. */
export const GRID_RADIUS = 1;
export const TILE_SIZE_PX = 256;
/**
 * The one drawing-surface size every base-map source shares — aerial tiles,
 * an uploaded photo, and a drawn plan, plus the Scale Reference calibration
 * step that captures points against whichever one is showing. All of them
 * must agree exactly: a Scale Reference calibrated against a different pixel
 * size than Beds/Pins are later drawn against would derive a scale that's
 * off by the ratio between the two.
 *
 * A phone screen is narrower than this, so the native Map screen renders the
 * same surface scaled down to fit — it scales the *rendering*, never these
 * numbers.
 */
export const STAGE_SIZE_PX = TILE_SIZE_PX * (GRID_RADIUS * 2 + 1);

export interface BaseMapTile {
  key: string;
  url: string;
}

/** The aerial tiles covering the surface, in row-major order — a caller can lay them straight into a `GRID_RADIUS * 2 + 1` wide grid. Empty unless the Property actually has aerial coordinates. */
export function baseMapTiles(property: Property): BaseMapTile[] {
  if (
    property.imageryZoom === null ||
    property.latitude === null ||
    property.longitude === null
  ) {
    return [];
  }
  const center = lonLatToTile(
    property.latitude,
    property.longitude,
    property.imageryZoom,
  );
  const tiles: BaseMapTile[] = [];
  for (let dy = -GRID_RADIUS; dy <= GRID_RADIUS; dy++) {
    for (let dx = -GRID_RADIUS; dx <= GRID_RADIUS; dx++) {
      const x = center.x + dx;
      const y = center.y + dy;
      tiles.push({ key: `${x}-${y}`, url: aerialTileUrl(property.imageryZoom, x, y) });
    }
  }
  return tiles;
}

/**
 * A point list as an SVG `points="..."` attribute value — used for a drawn
 * base plan's strokes (`<polyline>`) on both surfaces, and for a Bed's
 * outline (`<polygon>`) on the phone, which has no Konva.
 */
export function svgPointsAttribute(points: readonly BedPoint[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}
