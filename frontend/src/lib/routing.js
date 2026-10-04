import { api } from "./api";
import { isLocalGuestMode } from "../game/localGuestEngine";

// OSRM road routing used by the live map.
//
// The movement model mirrors the proven 112i approach:
// - full road geometry;
// - cumulative per-segment travel times;
// - interpolation by travel TIME (not by a global distance fraction);
// - no invented straight-line route when routing fails.
//
// Response geometry is [lng, lat]; Leaflet receives [lat, lng].

const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";
const ROUTE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const STORAGE_KEY = "submundo_road_route_cache_v3";
const MAX_PERSISTED_ROUTES = 40;

const routeCache = new Map();
const inflight = new Map();

const finite = (value) => Number.isFinite(Number(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

const roundCoord = (value) => Number(value).toFixed(5);
const roundKey = (lat, lng) => roundCoord(lat) + "," + roundCoord(lng);

export function routeKey(origin, target) {
  return roundKey(origin.lat, origin.lng) + "->" + roundKey(target.lat, target.lng);
}

function haversine(a, b) {
  const R = 6371000;
  const p1 = (a[0] * Math.PI) / 180;
  const p2 = (b[0] * Math.PI) / 180;
  const dp = ((b[0] - a[0]) * Math.PI) / 180;
  const dl = ((b[1] - a[1]) * Math.PI) / 180;
  const s = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function bearingDeg(a, b) {
  if (!a || !b) return null;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2)
    - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  if (!Number.isFinite(x) || !Number.isFinite(y) || (Math.abs(x) < 1e-12 && Math.abs(y) < 1e-12)) {
    return null;
  }
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function buildCumulative(latlngs) {
  const cum = [0];
  for (let i = 1; i < (latlngs || []).length; i += 1) {
    cum.push(cum[i - 1] + haversine(latlngs[i - 1], latlngs[i]));
  }
  return cum;
}

function cumulativeTimes(latlngs, annotationDurations, routeDuration) {
  const segmentCount = Math.max(0, latlngs.length - 1);
  const duration = Math.max(0, Number(routeDuration) || 0);
  let segments = [];

  if (
    Array.isArray(annotationDurations)
    && annotationDurations.length === segmentCount
    && annotationDurations.every((value) => finite(value) && Number(value) >= 0)
  ) {
    segments = annotationDurations.map(Number);
  } else {
    const distances = [];
    let totalDistance = 0;
    for (let i = 0; i < segmentCount; i += 1) {
      const d = Math.max(0, haversine(latlngs[i], latlngs[i + 1]));
      distances.push(d);
      totalDistance += d;
    }
    if (totalDistance > 0 && duration > 0) {
      segments = distances.map((d) => (d / totalDistance) * duration);
    } else {
      segments = new Array(segmentCount).fill(segmentCount ? duration / segmentCount : 0);
    }
  }

  const rawTotal = segments.reduce((sum, value) => sum + value, 0);
  if (duration > 0 && rawTotal > 0) {
    const scale = duration / rawTotal;
    segments = segments.map((value) => value * scale);
  }

  const times = [0];
  for (const seconds of segments) times.push(times[times.length - 1] + seconds);

  // Preserve the provider total exactly, avoiding accumulated floating-point drift.
  if (times.length > 1 && duration > 0) times[times.length - 1] = duration;
  return times;
}

function normalizeRoute(data) {
  const raw = data?.routes?.[0];
  const coords = raw?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) throw new Error("Percurso rodoviário incompleto");

  const latlngs = coords
    .map((point) => [Number(point?.[1]), Number(point?.[0])])
    .filter((point) => finite(point[0]) && finite(point[1]));

  if (latlngs.length < 2) throw new Error("Percurso rodoviário sem geometria válida");

  const duration = Math.max(0, Number(raw.duration) || 0);
  const distance = Math.max(0, Number(raw.distance) || 0);
  const annotations = raw?.legs?.flatMap((leg) => leg?.annotation?.duration || []) || [];
  const times = cumulativeTimes(latlngs, annotations, duration);

  if (times.length !== latlngs.length || times.some((value) => !finite(value) || Number(value) < 0)) {
    throw new Error("Tempos do percurso rodoviário inválidos");
  }

  return {
    latlngs,
    times,
    distance,
    duration: times[times.length - 1] || duration,
    source: "OSRM / OpenStreetMap",
    estimated: true,
    liveTraffic: false,
    unavailable: false,
  };
}

function normalizePreparedRoute(data) {
  if (!data) throw new Error("Percurso rodoviário vazio");

  // O backend SUBMUNDO já devolve o formato final consumido pelo mapa.
  if (Array.isArray(data.latlngs)) {
    const latlngs = data.latlngs
      .map((point) => [Number(point?.[0]), Number(point?.[1])])
      .filter((point) => finite(point[0]) && finite(point[1]));
    const times = Array.isArray(data.times) ? data.times.map(Number) : [];
    if (
      latlngs.length < 2
      || times.length !== latlngs.length
      || times.some((value) => !finite(value) || value < 0)
    ) {
      throw new Error("Percurso rodoviário devolvido pelo servidor é inválido");
    }
    return {
      ...data,
      latlngs,
      times,
      distance: Math.max(0, Number(data.distance) || 0),
      duration: Math.max(0, Number(data.duration) || times[times.length - 1] || 0),
      unavailable: false,
    };
  }

  // Compatibilidade com uma resposta OSRM crua (modo convidado/local).
  return normalizeRoute(data);
}

function routeErrorMessage(error) {
  return String(
    error?.response?.data?.detail
    || error?.message
    || error
    || "Rota indisponível"
  );
}

function unavailableRoute(origin, target, reason) {
  return {
    latlngs: [],
    times: [],
    distance: 0,
    duration: 0,
    source: "OSRM / OpenStreetMap",
    estimated: true,
    liveTraffic: false,
    unavailable: true,
    origin: { lat: Number(origin.lat), lng: Number(origin.lng) },
    target: { lat: Number(target.lat), lng: Number(target.lng) },
    reason: String(reason?.message || reason || "Rota indisponível"),
  };
}

function readPersisted(key) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const item = data?.[key];
    if (!item || Number(item.expiresAt || 0) <= Date.now()) return null;
    return item.route || null;
  } catch (_error) {
    return null;
  }
}

export function peekRoute(origin, target) {
  if (!origin || !target || !finite(origin.lat) || !finite(origin.lng) || !finite(target.lat) || !finite(target.lng)) {
    return null;
  }
  const key = routeKey(origin, target);
  const memory = routeCache.get(key);
  if (memory?.latlngs?.length > 1 && memory?.times?.length === memory.latlngs.length) return memory;
  const persisted = readPersisted(key);
  if (persisted?.latlngs?.length > 1 && persisted?.times?.length === persisted.latlngs.length) {
    routeCache.set(key, persisted);
    return persisted;
  }
  return null;
}

function persistRoute(key, route) {
  if (!route || route.unavailable) return;
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    let data = {};
    try {
      data = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}") || {};
    } catch (_error) {
      data = {};
    }

    const now = Date.now();
    for (const [cacheKey, item] of Object.entries(data)) {
      if (!item || Number(item.expiresAt || 0) <= now) delete data[cacheKey];
    }

    data[key] = { route, expiresAt: now + ROUTE_TTL_MS, touchedAt: now };
    const entries = Object.entries(data).sort(
      (a, b) => Number(b[1]?.touchedAt || 0) - Number(a[1]?.touchedAt || 0)
    );
    const trimmed = Object.fromEntries(entries.slice(0, MAX_PERSISTED_ROUTES));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (_error) {
    // Cache persistence is an optimisation only.
  }
}

async function fetchDirectOsrm(cleanOrigin, cleanTarget) {
  const coordinates =
    Number(cleanOrigin.lng).toFixed(6) + "," + Number(cleanOrigin.lat).toFixed(6)
    + ";" + Number(cleanTarget.lng).toFixed(6) + "," + Number(cleanTarget.lat).toFixed(6);
  const query =
    "steps=false&annotations=duration,distance&geometries=geojson"
    + "&overview=full&alternatives=false&radiuses=1000;1000";
  const response = await fetch(OSRM_BASE + "/" + coordinates + "?" + query);
  if (!response.ok) throw new Error("OSRM HTTP " + response.status);
  const data = await response.json();
  if (data?.code !== "Ok" || !data?.routes?.length) {
    throw new Error("Sem percurso rodoviário disponível");
  }
  return normalizeRoute(data);
}

export async function fetchRoute(origin, target) {
  if (!origin || !target || !finite(origin.lat) || !finite(origin.lng) || !finite(target.lat) || !finite(target.lng)) {
    return unavailableRoute(origin || {}, target || {}, "Coordenadas inválidas");
  }

  const cleanOrigin = { lat: Number(origin.lat), lng: Number(origin.lng) };
  const cleanTarget = { lat: Number(target.lat), lng: Number(target.lng) };
  const key = routeKey(cleanOrigin, cleanTarget);
  if (routeCache.has(key)) return routeCache.get(key);

  const persisted = readPersisted(key);
  if (persisted?.latlngs?.length > 1 && persisted?.times?.length === persisted.latlngs.length) {
    routeCache.set(key, persisted);
    return persisted;
  }

  if (inflight.has(key)) return inflight.get(key);

  const promise = (async () => {
    try {
      let route;

      if (!isLocalGuestMode()) {
        // Produção: prefere o backend autoritativo. Enquanto um deployment
        // antigo ainda não tiver /road-route, cai para OSRM direto sem quebrar
        // o jogo. Erros 422 são definitivos e não inventam linha reta.
        try {
          const { data } = await api.post(
            "/game/road-route",
            { origin: cleanOrigin, target: cleanTarget },
            { timeout: 25000 }
          );
          route = normalizePreparedRoute(data);
        } catch (backendError) {
          if (backendError?.response?.status === 422) throw backendError;
          route = await fetchDirectOsrm(cleanOrigin, cleanTarget);
        }
      } else {
        route = await fetchDirectOsrm(cleanOrigin, cleanTarget);
      }

      routeCache.set(key, route);
      persistRoute(key, route);
      return route;
    } catch (error) {
      // Falhas nunca entram na cache: um retry seguinte pode funcionar.
      return unavailableRoute(cleanOrigin, cleanTarget, routeErrorMessage(error));
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

// Distance-based helpers are kept for local choreography/parking calculations.
// Actual vehicle travel uses the time-based helpers below.
export function pointOnRoute(latlngs, cum, t) {
  if (!latlngs || latlngs.length === 0) return null;
  if (latlngs.length === 1) return { lat: latlngs[0][0], lng: latlngs[0][1] };
  const total = cum?.[cum.length - 1] || 0;
  if (total <= 0) return { lat: latlngs[0][0], lng: latlngs[0][1] };
  const dist = clamp(t, 0, 1) * total;

  let lo = 0;
  let hi = cum.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= dist) lo = mid;
    else hi = mid;
  }

  const span = cum[hi] - cum[lo];
  const fraction = span > 0 ? (dist - cum[lo]) / span : 0;
  const a = latlngs[lo];
  const b = latlngs[hi];
  return {
    lat: a[0] + (b[0] - a[0]) * fraction,
    lng: a[1] + (b[1] - a[1]) * fraction,
  };
}

export function sliceRoute(latlngs, cum, fromT, toT) {
  if (!latlngs || latlngs.length < 2) return latlngs || [];
  const total = cum?.[cum.length - 1] || 0;
  if (total <= 0) return [];

  const reverse = fromT > toT;
  const a = clamp(reverse ? toT : fromT, 0, 1);
  const b = clamp(reverse ? fromT : toT, 0, 1);
  const dA = a * total;
  const dB = b * total;
  const out = [];

  const start = pointOnRoute(latlngs, cum, a);
  if (start) out.push([start.lat, start.lng]);
  for (let i = 0; i < cum.length; i += 1) {
    if (cum[i] > dA && cum[i] < dB) out.push(latlngs[i]);
  }
  const end = pointOnRoute(latlngs, cum, b);
  if (end) out.push([end.lat, end.lng]);
  return reverse ? out.reverse() : out;
}

export function pointOnTimedRoute(route, travelSeconds) {
  const points = route?.latlngs;
  const times = route?.times;
  if (!points?.length || !times?.length || points.length !== times.length) return null;
  if (points.length === 1) return { lat: points[0][0], lng: points[0][1], bearing: null, segment: 0 };

  const travel = clamp(travelSeconds, 0, times[times.length - 1] || route.duration || 0);
  let low = 0;
  let high = times.length - 1;

  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (times[middle] <= travel) low = middle;
    else high = middle - 1;
  }

  const index = Math.min(low, points.length - 2);
  const a = points[index];
  const b = points[index + 1];
  const span = times[index + 1] - times[index];
  const fraction = span > 0 ? clamp((travel - times[index]) / span, 0, 1) : 1;

  return {
    lat: a[0] + (b[0] - a[0]) * fraction,
    lng: a[1] + (b[1] - a[1]) * fraction,
    bearing: bearingDeg(a, b),
    segment: index,
    fraction,
  };
}

export function sliceTimedRoute(route, fromSeconds, toSeconds) {
  const points = route?.latlngs;
  const times = route?.times;
  if (!points?.length || points.length < 2 || !times?.length || times.length !== points.length) return [];

  const endTime = times[times.length - 1] || route.duration || 0;
  const reverse = Number(fromSeconds) > Number(toSeconds);
  const a = clamp(reverse ? toSeconds : fromSeconds, 0, endTime);
  const b = clamp(reverse ? fromSeconds : toSeconds, 0, endTime);
  const out = [];

  const start = pointOnTimedRoute(route, a);
  if (start) out.push([start.lat, start.lng]);

  for (let i = 0; i < times.length; i += 1) {
    if (times[i] > a && times[i] < b) out.push(points[i]);
  }

  const end = pointOnTimedRoute(route, b);
  if (end) out.push([end.lat, end.lng]);
  return reverse ? out.reverse() : out;
}

export function timeAtDistanceFraction(route, cumulativeDistance, fraction) {
  const times = route?.times;
  if (!times?.length || times.length !== cumulativeDistance?.length) {
    return clamp(fraction, 0, 1) * Math.max(0, Number(route?.duration) || 0);
  }

  const totalDistance = cumulativeDistance[cumulativeDistance.length - 1] || 0;
  if (totalDistance <= 0) return 0;
  const targetDistance = clamp(fraction, 0, 1) * totalDistance;

  let low = 0;
  let high = cumulativeDistance.length - 1;
  while (low + 1 < high) {
    const middle = (low + high) >> 1;
    if (cumulativeDistance[middle] <= targetDistance) low = middle;
    else high = middle;
  }

  const distanceSpan = cumulativeDistance[high] - cumulativeDistance[low];
  const local = distanceSpan > 0
    ? (targetDistance - cumulativeDistance[low]) / distanceSpan
    : 0;
  return times[low] + (times[high] - times[low]) * clamp(local, 0, 1);
}
