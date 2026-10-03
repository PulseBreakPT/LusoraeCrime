// Keyless OpenStreetMap base layer shared by the onboarding and live game map.
//
// Distrito 112 uses OpenStreetMap cartography through MapLibre. Lusorae keeps
// Leaflet because all of its markers/routes are already implemented on Leaflet,
// but uses the same open cartography family and does not require a CARTO token.
export const MAP_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export const MAP_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const MAP_TILE_MAX_ZOOM = 19;
export const MAP_TILE_CLASS = "lus-osm-base-tile";


export const MAP_DETAIL_BREAKPOINTS = Object.freeze({
  overviewMax: 8,
  operationalMax: 13,
});

export function mapDetailForZoom(zoom) {
  const z = Number(zoom) || 0;
  if (z <= MAP_DETAIL_BREAKPOINTS.overviewMax) return "overview";
  if (z <= MAP_DETAIL_BREAKPOINTS.operationalMax) return "operational";
  return "street";
}
