import {
  MAP_TILE_ATTRIBUTION,
  MAP_TILE_CLASS,
  MAP_TILE_URL,
} from "./mapTiles";

describe("keyless map provider", () => {
  test("uses OpenStreetMap without an API token", () => {
    expect(MAP_TILE_URL).toContain("openstreetmap.org");
    expect(MAP_TILE_URL).not.toMatch(/api[_-]?key|access[_-]?token|carto/i);
    expect(MAP_TILE_ATTRIBUTION).toContain("OpenStreetMap");
    expect(MAP_TILE_CLASS).toBe("lus-osm-base-tile");
  });
});
