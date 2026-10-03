// Lightweight client-side land validator used only in local guest mode.
// Normal authenticated play validates against backend/data/portugal.geojson
// (plus water_pt.geojson), which remains the authoritative geography.

const MAINLAND = [
  [-9.52, 41.96], [-8.90, 42.14], [-8.20, 42.15], [-7.15, 41.93],
  [-6.20, 41.58], [-6.18, 41.02], [-6.70, 40.35], [-6.86, 39.75],
  [-7.05, 39.03], [-7.45, 38.45], [-7.38, 37.12], [-7.70, 37.00],
  [-8.20, 36.95], [-8.95, 37.02], [-9.12, 37.38], [-9.52, 38.70],
  [-9.43, 39.35], [-9.16, 40.15], [-8.95, 40.85], [-8.78, 41.45],
];

const ISLAND_BOXES = [
  // Madeira + Porto Santo
  [-17.30, 32.55, -16.65, 32.90],
  [-16.45, 32.98, -16.25, 33.16],
  // Açores
  [-31.35, 39.34, -31.00, 39.60], // Flores
  [-31.18, 39.62, -31.02, 39.77], // Corvo
  [-28.90, 38.45, -28.50, 38.72], // Faial
  [-28.62, 38.32, -27.95, 38.62], // Pico
  [-28.38, 38.48, -27.68, 38.82], // São Jorge
  [-28.18, 38.95, -27.82, 39.18], // Graciosa
  [-27.45, 38.58, -26.98, 38.87], // Terceira
  [-25.95, 37.62, -25.00, 38.02], // São Miguel
  [-25.22, 36.88, -24.86, 37.10], // Santa Maria
];

function pointInPolygon(lng, lat, polygon) {
  let inside = false;
  let j = polygon.length - 1;
  for (let i = 0; i < polygon.length; i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > lat) !== (yj > lat)) {
      const cross = ((xj - xi) * (lat - yi)) / Math.max(1e-12, yj - yi) + xi;
      if (lng < cross) inside = !inside;
    }
    j = i;
  }
  return inside;
}

export function isOnLand(lat, lng) {
  const y = Number(lat);
  const x = Number(lng);
  if (!Number.isFinite(y) || !Number.isFinite(x)) return false;
  if (pointInPolygon(x, y, MAINLAND)) return true;
  return ISLAND_BOXES.some(([minLng, minLat, maxLng, maxLat]) =>
    x >= minLng && x <= maxLng && y >= minLat && y <= maxLat
  );
}
