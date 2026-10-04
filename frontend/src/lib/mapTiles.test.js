import {
  MAP_TILE_ATTRIBUTION,
  MAP_TILE_CLASS,
  MAP_TILE_URL,
  mapDetailForZoom,
} from "./mapTiles";

describe("keyless map provider", () => {
  test("uses OpenStreetMap without an API token", () => {
    expect(MAP_TILE_URL).toContain("openstreetmap.org");
    expect(MAP_TILE_URL).not.toMatch(/api[_-]?key|access[_-]?token|carto/i);
    expect(MAP_TILE_ATTRIBUTION).toContain("OpenStreetMap");
    expect(MAP_TILE_CLASS).toBe("sub-osm-base-tile");
  });

  test("changes cartographic detail as the player zooms in", () => {
    expect(mapDetailForZoom(7)).toBe("overview");
    expect(mapDetailForZoom(10)).toBe("operational");
    expect(mapDetailForZoom(13)).toBe("operational");
    expect(mapDetailForZoom(14)).toBe("street");
    expect(mapDetailForZoom(18)).toBe("street");
  });
});
