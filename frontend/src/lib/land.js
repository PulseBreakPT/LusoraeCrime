// Réplica exacta de backend/engine.py's is_on_land (_TEJO_SHORE, _LISBON_BOUNDS)
// — só para feedback visual instantâneo durante a colocação manual de
// propriedades no mapa. O servidor continua autoritativo em /properties/buy.

const TEJO_SHORE = [
  [-9.240, 38.690],
  [-9.200, 38.694],
  [-9.180, 38.700],
  [-9.150, 38.703],
  [-9.130, 38.706],
  [-9.110, 38.711],
  [-9.100, 38.720],
  [-9.093, 38.750],
  [-9.093, 38.780],
];

const BOUNDS = { latMin: 38.685, latMax: 38.800, lngMin: -9.240, lngMax: -9.085 };

export function isOnLand(lat, lng) {
  if (lat < BOUNDS.latMin || lat > BOUNDS.latMax || lng < BOUNDS.lngMin || lng > BOUNDS.lngMax) {
    return false;
  }
  const pts = TEJO_SHORE;
  let shore;
  if (lng <= pts[0][0]) {
    shore = pts[0][1];
  } else if (lng >= pts[pts.length - 1][0]) {
    shore = pts[pts.length - 1][1];
  } else {
    for (let i = 1; i < pts.length; i++) {
      if (lng <= pts[i][0]) {
        const [x0, y0] = pts[i - 1];
        const [x1, y1] = pts[i];
        const t = (lng - x0) / Math.max(1e-9, x1 - x0);
        shore = y0 + t * (y1 - y0);
        break;
      }
    }
  }
  return lat >= shore + 0.0010;
}
