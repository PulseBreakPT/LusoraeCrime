// OSRM (public routing service) — fetches real driving route between two points.
// Response geometry is [lng, lat] pairs; we return [lat, lng] pairs to match Leaflet.

const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";
// OSRM defaults return the fastest route for the driving profile. We add explicit params
// (overview=full, no alternatives, no annotations, no steps) for concise, deterministic output.
const OSRM_QS = "overview=full&geometries=geojson&alternatives=false&steps=false&annotations=false";

const routeCache = new Map();
const inflight = new Map();

const roundKey = (lat, lng) => `${lat.toFixed(4)},${lng.toFixed(4)}`;

export function routeKey(origin, target) {
  return `${roundKey(origin.lat, origin.lng)}->${roundKey(target.lat, target.lng)}`;
}

export async function fetchRoute(origin, target) {
  const key = routeKey(origin, target);
  if (routeCache.has(key)) return routeCache.get(key);
  if (inflight.has(key)) return inflight.get(key);

  const url = `${OSRM_BASE}/${origin.lng},${origin.lat};${target.lng},${target.lat}?${OSRM_QS}`;
  const promise = fetch(url)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((data) => {
      const coords = data?.routes?.[0]?.geometry?.coordinates;
      if (!coords || !coords.length) throw new Error("no route");
      const latlngs = coords.map(([lng, lat]) => [lat, lng]);
      const distance = data.routes[0].distance || 0;
      const duration = data.routes[0].duration || 0;
      const info = { latlngs, distance, duration };
      routeCache.set(key, info);
      inflight.delete(key);
      return info;
    })
    .catch((err) => {
      inflight.delete(key);
      // Fallback: straight line
      const fallback = { latlngs: [[origin.lat, origin.lng], [target.lat, target.lng]], distance: 0, duration: 0, fallback: true };
      routeCache.set(key, fallback);
      return fallback;
    });
  inflight.set(key, promise);
  return promise;
}

// Great-circle distance in meters
function haversine(a, b) {
  const R = 6371000;
  const p1 = (a[0] * Math.PI) / 180;
  const p2 = (b[0] * Math.PI) / 180;
  const dp = ((b[0] - a[0]) * Math.PI) / 180;
  const dl = ((b[1] - a[1]) * Math.PI) / 180;
  const s = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Build cumulative distances for a polyline so we can interpolate by fraction of total length.
export function buildCumulative(latlngs) {
  const cum = [0];
  for (let i = 1; i < latlngs.length; i++) {
    cum.push(cum[i - 1] + haversine(latlngs[i - 1], latlngs[i]));
  }
  return cum;
}

// Given a route (with cumulative distances) and t in [0,1], return {lat, lng}.
export function pointOnRoute(latlngs, cum, t) {
  if (!latlngs || latlngs.length === 0) return null;
  if (latlngs.length === 1) return { lat: latlngs[0][0], lng: latlngs[0][1] };
  const total = cum[cum.length - 1];
  if (total <= 0) return { lat: latlngs[0][0], lng: latlngs[0][1] };
  const dist = Math.max(0, Math.min(1, t)) * total;
  // binary search
  let lo = 0;
  let hi = cum.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= dist) lo = mid;
    else hi = mid;
  }
  const seg = cum[hi] - cum[lo];
  const frac = seg > 0 ? (dist - cum[lo]) / seg : 0;
  const a = latlngs[lo];
  const b = latlngs[hi];
  return { lat: a[0] + (b[0] - a[0]) * frac, lng: a[1] + (b[1] - a[1]) * frac };
}

// Return the sub-polyline of route between fractions fromT and toT (0..1) as [lat,lng] pairs.
// Handles fromT > toT by reversing the returned slice, so callers can render "remaining path"
// from the current vehicle position toward its next waypoint on the same coord array.
export function sliceRoute(latlngs, cum, fromT, toT) {
  if (!latlngs || latlngs.length < 2) return latlngs || [];
  const total = cum[cum.length - 1];
  if (total <= 0) return [];
  const reverse = fromT > toT;
  const a = Math.max(0, Math.min(1, reverse ? toT : fromT));
  const b = Math.max(0, Math.min(1, reverse ? fromT : toT));
  const dA = a * total;
  const dB = b * total;
  const out = [];
  // Starting point (exact)
  const start = pointOnRoute(latlngs, cum, a);
  out.push([start.lat, start.lng]);
  for (let i = 0; i < cum.length; i++) {
    if (cum[i] > dA && cum[i] < dB) out.push(latlngs[i]);
  }
  const end = pointOnRoute(latlngs, cum, b);
  out.push([end.lat, end.lng]);
  return reverse ? out.reverse() : out;
}
