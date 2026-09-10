import { describe, expect, it } from "vitest";
import {
  GRID_SPACING_CHOICES_FEET,
  defaultGridSpacingFeet,
  measurementGrid,
} from "./measurementGrid.js";
import { STAGE_SIZE_PX } from "./baseMap.js";

describe("measurementGrid", () => {
  it("places a line every `spacingFeet`, starting at the stage origin", () => {
    const grid = measurementGrid(12, 5, 100);
    expect(grid.lines).toEqual([
      { offsetFeet: 0, offsetPx: 0 },
      { offsetFeet: 5, offsetPx: 60 },
    ]);
  });

  it("stops at the stage edge rather than drawing a line onto nothing", () => {
    const grid = measurementGrid(1, 10, 25);
    expect(grid.lines.map((line) => line.offsetFeet)).toEqual([0, 10, 20]);
  });

  it("includes the far edge when it lands exactly on a line", () => {
    const grid = measurementGrid(1, 10, 20);
    expect(grid.lines.map((line) => line.offsetFeet)).toEqual([0, 10, 20]);
  });

  it("carries the spacing back out, so a caller can label the grid without recomputing it", () => {
    expect(measurementGrid(12, 5, 100).spacingFeet).toBe(5);
  });

  it("refuses a nonsensical spacing rather than looping forever", () => {
    expect(measurementGrid(12, 0, 100).lines).toEqual([]);
    expect(measurementGrid(12, -5, 100).lines).toEqual([]);
  });

  it("draws nothing when a whole square would be under a pixel wide", () => {
    expect(measurementGrid(0.001, 1, 768).lines).toEqual([]);
  });
});

describe("defaultGridSpacingFeet", () => {
  /**
   * The squares have to be big enough to count and small enough to be worth
   * counting. Below roughly 40px they read as texture over the imagery
   * rather than as a measure.
   */
  it("picks squares a gardener can actually see, at an aerial scale", () => {
    // ~2.75 px per ft is a zoom-20 aerial map at New England latitudes.
    expect(defaultGridSpacingFeet(2.75)).toBe(25);
  });

  it("picks a finer spacing on a close-in photo scale", () => {
    expect(defaultGridSpacingFeet(12)).toBe(5);
  });

  it("falls back to the coarsest choice when even that is tiny", () => {
    expect(defaultGridSpacingFeet(0.05)).toBe(
      GRID_SPACING_CHOICES_FEET[GRID_SPACING_CHOICES_FEET.length - 1],
    );
  });

  it("falls back to the finest choice when everything is comfortably large", () => {
    expect(defaultGridSpacingFeet(500)).toBe(GRID_SPACING_CHOICES_FEET[0]);
  });

  it("always returns one of the offered choices, so the picker can show it as selected", () => {
    for (const pixelsPerFoot of [0.2, 0.7, 1.4, 2.75, 6, 12, 40, 200]) {
      expect(GRID_SPACING_CHOICES_FEET).toContain(defaultGridSpacingFeet(pixelsPerFoot));
    }
  });
});

describe("the grid as a calibration check", () => {
  /**
   * #28's real job. A 1.5x-off Scale Reference (the #6 bug) draws its grid
   * 1.5x too small on the same imagery, so a gardener who knows one real
   * distance on their own map sees it immediately.
   */
  it("puts visibly different numbers of squares across the map when the scale is wrong", () => {
    const correct = measurementGrid(12, 10, STAGE_SIZE_PX);
    const miscalibrated = measurementGrid(12 * 1.5, 10, STAGE_SIZE_PX);
    expect(correct.lines).toHaveLength(7);
    expect(miscalibrated.lines).toHaveLength(5);
  });
});
