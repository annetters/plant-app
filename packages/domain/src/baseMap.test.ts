import { describe, expect, it } from "vitest";
import {
  GRID_RADIUS,
  STAGE_SIZE_PX,
  TILE_SIZE_PX,
  baseMapTiles,
  svgPointsAttribute,
} from "./baseMap.js";
import { lonLatToTile, type Property } from "./property.js";

function aerialProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: "property-1",
    address: "1 Main St",
    resolvedAddress: "1 Main St, Anytown",
    latitude: 40,
    longitude: -70,
    imageryZoom: 20,
    imageryAvailable: true,
    baseMapSource: "aerial",
    baseMapPhotoPath: null,
    baseMapDrawing: null,
    scaleReference: null,
    name: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("STAGE_SIZE_PX", () => {
  it("covers the whole tile grid, so every base-map source shares one surface size", () => {
    expect(STAGE_SIZE_PX).toBe(TILE_SIZE_PX * (GRID_RADIUS * 2 + 1));
  });
});

describe("baseMapTiles", () => {
  it("returns the full grid around the Property's center tile", () => {
    const tiles = baseMapTiles(aerialProperty());

    expect(tiles).toHaveLength((GRID_RADIUS * 2 + 1) ** 2);
    expect(new Set(tiles.map((tile) => tile.key)).size).toBe(tiles.length);
  });

  it("orders tiles row by row, so a caller can lay them out in a plain grid", () => {
    const property = aerialProperty();
    const center = lonLatToTile(property.latitude!, property.longitude!, property.imageryZoom!);

    const keys = baseMapTiles(property).map((tile) => tile.key);

    // Row-major from the top-left corner of the grid to its bottom-right.
    expect(keys[0]).toBe(`${center.x - GRID_RADIUS}-${center.y - GRID_RADIUS}`);
    expect(keys[1]).toBe(`${center.x}-${center.y - GRID_RADIUS}`);
    expect(keys[keys.length - 1]).toBe(`${center.x + GRID_RADIUS}-${center.y + GRID_RADIUS}`);
  });

  it("centers the grid on the Property's own coordinates", () => {
    const property = aerialProperty();
    const center = lonLatToTile(property.latitude!, property.longitude!, property.imageryZoom!);

    const keys = baseMapTiles(property).map((tile) => tile.key);

    expect(keys).toContain(`${center.x}-${center.y}`);
  });

  it("builds each tile's URL from the Property's own zoom", () => {
    const [first] = baseMapTiles(aerialProperty());

    expect(first.url).toContain("/MapServer/tile/20/");
  });

  it("returns nothing when the Property has no aerial coordinates to center on", () => {
    expect(baseMapTiles(aerialProperty({ imageryZoom: null }))).toEqual([]);
    expect(baseMapTiles(aerialProperty({ latitude: null }))).toEqual([]);
    expect(baseMapTiles(aerialProperty({ longitude: null }))).toEqual([]);
  });
});

describe("svgPointsAttribute", () => {
  it("formats a point list as an SVG points attribute", () => {
    expect(
      svgPointsAttribute([
        { x: 0, y: 0 },
        { x: 100, y: 50 },
      ]),
    ).toBe("0,0 100,50");
  });

  it("is empty for an empty point list", () => {
    expect(svgPointsAttribute([])).toBe("");
  });
});
