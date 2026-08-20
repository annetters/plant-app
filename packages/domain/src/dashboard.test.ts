import { describe, expect, it } from "vitest";
import { DASHBOARD_TILES } from "./dashboard.js";

describe("DASHBOARD_TILES", () => {
  it("has one placeholder tile each for Map, Registry, and Bloom Timeline, in that order", () => {
    expect(DASHBOARD_TILES.map((tile) => tile.label)).toEqual([
      "Map",
      "Registry",
      "Bloom Timeline",
    ]);
  });

  it("gives every tile a unique id and a route path", () => {
    const ids = DASHBOARD_TILES.map((tile) => tile.id);
    expect(new Set(ids).size).toBe(DASHBOARD_TILES.length);
    for (const tile of DASHBOARD_TILES) {
      expect(tile.path.startsWith("/")).toBe(true);
    }
  });
});
