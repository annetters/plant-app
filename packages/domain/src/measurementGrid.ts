/**
 * An optional grid drawn over a Property's base map, one square per known
 * real-world distance.
 *
 * Ticket #28 asked for the derived scale to be shown as something a
 * gardener can sanity-check against reality. A number ("2.75 px per ft")
 * isn't that — it can't be compared to anything without doing arithmetic on
 * a screenshot. A grid is: a gardener who knows one real distance on their
 * own property (a driveway, a fence run, the house frontage) can count
 * squares across it and see straight away whether the app agrees with them.
 * That is the check that would have caught #6's 1.5x-off calibration.
 *
 * Pure geometry in the stage's own pixel space, shared by both surfaces —
 * the web overlay draws these as SVG, the phone draws them as
 * `react-native-svg`, and neither gets to disagree about where a line goes.
 */

/**
 * The spacings offered in the picker. Round, mentally divisible numbers a
 * gardener already thinks in — not whatever would make the squares exactly
 * some pixel size. Kept ascending: `defaultGridSpacingFeet` relies on it.
 */
export const GRID_SPACING_CHOICES_FEET: readonly number[] = [1, 2, 5, 10, 25, 50, 100];

/**
 * Below roughly this, squares stop reading as a measure and start reading as
 * texture over the imagery — you can't count what you can't separate.
 */
const MIN_COMFORTABLE_SQUARE_PX = 40;

/** A square narrower than one pixel can't be drawn at all, let alone counted. */
const MIN_RENDERABLE_SQUARE_PX = 1;

export interface GridLine {
  /** Distance from the stage origin in real-world feet — what the line is labelled with. */
  offsetFeet: number;
  /** The same distance in the stage's pixel space — where the line is drawn. */
  offsetPx: number;
}

export interface MeasurementGrid {
  /** Carried back out so a caller can label the grid without recomputing the choice. */
  spacingFeet: number;
  /**
   * Offsets from the origin outward, inclusive of both edges when the far
   * one lands exactly on a line. The stage is square and the scale is
   * uniform, so one set of offsets serves both axes.
   */
  lines: GridLine[];
}

export function measurementGrid(
  pixelsPerFoot: number,
  spacingFeet: number,
  stageSizePx: number,
): MeasurementGrid {
  const spacingPx = spacingFeet * pixelsPerFoot;
  // Inverted deliberately, so `NaN` and every non-positive spacing fail it
  // too — a zero or negative step would make the loop below run forever
  // rather than merely draw something ugly.
  if (!(spacingPx >= MIN_RENDERABLE_SQUARE_PX)) {
    return { spacingFeet, lines: [] };
  }
  const lines: GridLine[] = [];
  // Multiplied out from the index rather than accumulated, so the last line
  // on a long run doesn't drift off the edge it's supposed to sit on.
  for (let i = 0; i * spacingPx <= stageSizePx; i++) {
    lines.push({ offsetFeet: i * spacingFeet, offsetPx: i * spacingPx });
  }
  return { spacingFeet, lines };
}

/**
 * The spacing to start on for a given scale: the finest one whose squares
 * are still comfortably countable, so the grid is as informative as it can
 * be without turning into hatching. The gardener can override it — this is
 * only where the picker opens.
 */
export function defaultGridSpacingFeet(pixelsPerFoot: number): number {
  const comfortable = GRID_SPACING_CHOICES_FEET.find(
    (spacing) => spacing * pixelsPerFoot >= MIN_COMFORTABLE_SQUARE_PX,
  );
  // Nothing on offer is big enough (an extremely zoomed-out scale): the
  // coarsest choice is still the best of them.
  return comfortable ?? GRID_SPACING_CHOICES_FEET[GRID_SPACING_CHOICES_FEET.length - 1];
}
