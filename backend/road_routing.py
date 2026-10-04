"""Road routing for SUBMUNDO.

The browser must not depend directly on the public OSRM instance during a
dispatch. Routes are resolved server-side, throttled, cached in MongoDB and
returned in the exact shape the live map consumes.
"""
import asyncio
import hashlib
import math
import os
import time
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import HTTPException

from db import db


OSRM_BASE = os.environ.get("OSRM_URL", "https://router.project-osrm.org").rstrip("/")
ROUTE_TTL = timedelta(days=7)
SNAP_RADII_M = (250, 1000, 2500)


def _finite(value):
    try:
        return math.isfinite(float(value))
    except (TypeError, ValueError):
        return False


def _haversine(a, b):
    radius = 6371000.0
    lat1 = math.radians(a[0])
    lat2 = math.radians(b[0])
    dlat = math.radians(b[0] - a[0])
    dlng = math.radians(b[1] - a[1])
    q = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(q))


def _cumulative_times(latlngs, annotation_durations, route_duration):
    segment_count = max(0, len(latlngs) - 1)
    duration = max(0.0, float(route_duration or 0))
    segments = []

    if (
        isinstance(annotation_durations, list)
        and len(annotation_durations) == segment_count
        and all(_finite(v) and float(v) >= 0 for v in annotation_durations)
    ):
        segments = [float(v) for v in annotation_durations]
    else:
        distances = [
            max(0.0, _haversine(latlngs[i], latlngs[i + 1]))
            for i in range(segment_count)
        ]
        total_distance = sum(distances)
        if total_distance > 0 and duration > 0:
            segments = [(distance / total_distance) * duration for distance in distances]
        else:
            each = duration / segment_count if segment_count else 0.0
            segments = [each for _ in range(segment_count)]

    raw_total = sum(segments)
    if duration > 0 and raw_total > 0:
        scale = duration / raw_total
        segments = [value * scale for value in segments]

    times = [0.0]
    for seconds in segments:
        times.append(times[-1] + seconds)
    if len(times) > 1 and duration > 0:
        times[-1] = duration
    return times


def _normalize(raw):
    coords = ((raw or {}).get("geometry") or {}).get("coordinates") or []
    if len(coords) < 2:
        raise ValueError("Percurso rodoviário sem geometria suficiente")

    latlngs = []
    for point in coords:
        if not isinstance(point, (list, tuple)) or len(point) < 2:
            continue
        lat, lng = point[1], point[0]
        if _finite(lat) and _finite(lng):
            latlngs.append([float(lat), float(lng)])
    if len(latlngs) < 2:
        raise ValueError("Percurso rodoviário sem coordenadas válidas")

    annotations = []
    for leg in (raw.get("legs") or []):
        annotation = (leg or {}).get("annotation") or {}
        annotations.extend(annotation.get("duration") or [])

    duration = max(0.0, float(raw.get("duration") or 0))
    distance = max(0.0, float(raw.get("distance") or 0))
    times = _cumulative_times(latlngs, annotations, duration)
    if len(times) != len(latlngs):
        raise ValueError("Tempos do percurso rodoviário inválidos")

    return {
        "latlngs": latlngs,
        "times": times,
        "distance": distance,
        "duration": times[-1] if times else duration,
        "source": "OSRM / OpenStreetMap",
        "estimated": True,
        "liveTraffic": False,
        "unavailable": False,
    }


class RoadRouter:
    def __init__(self):
        self.lock = asyncio.Lock()
        self.last_request = 0.0
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(10.0, connect=4.0),
            headers={
                "User-Agent": "SUBMUNDO-RoadRouting/1.0",
                "Accept": "application/json",
            },
        )

    async def close(self):
        await self.client.aclose()

    @staticmethod
    def _key(origin, target):
        coords = (
            f"{float(origin['lng']):.5f},{float(origin['lat']):.5f};"
            f"{float(target['lng']):.5f},{float(target['lat']):.5f}"
        )
        return hashlib.sha256(f"osrm-driving-v3:{coords}".encode()).hexdigest(), coords

    async def _cached(self, key):
        now = datetime.now(timezone.utc)
        cached = await db.road_routes.find_one(
            {"key": key, "expires_at": {"$gt": now}},
            {"_id": 0, "route": 1},
        )
        return cached.get("route") if cached else None

    async def get(self, origin, target):
        values = (
            origin.get("lat"), origin.get("lng"),
            target.get("lat"), target.get("lng"),
        )
        if not all(_finite(v) for v in values):
            raise HTTPException(status_code=422, detail="Coordenadas inválidas para calcular o percurso.")

        key, coordinates = self._key(origin, target)
        cached = await self._cached(key)
        if cached:
            return cached

        async with self.lock:
            # Outra coroutine pode ter preenchido a cache enquanto esperávamos.
            cached = await self._cached(key)
            if cached:
                return cached

            last_error = None
            transient_error = False
            for radius in SNAP_RADII_M:
                # Respeita o servidor público: no máximo ~1 pedido/s.
                await asyncio.sleep(max(0.0, 1.05 - (time.monotonic() - self.last_request)))
                self.last_request = time.monotonic()
                try:
                    response = await self.client.get(
                        f"{OSRM_BASE}/route/v1/driving/{coordinates}",
                        params={
                            "steps": "false",
                            "annotations": "duration,distance",
                            "geometries": "geojson",
                            "overview": "full",
                            "alternatives": "false",
                            "radiuses": f"{radius};{radius}",
                        },
                    )
                    if response.status_code in (400, 404):
                        last_error = "Não foi encontrada uma estrada acessível junto ao ponto escolhido."
                        continue
                    response.raise_for_status()
                    data = response.json()
                    if data.get("code") != "Ok" or not data.get("routes"):
                        last_error = "Sem percurso rodoviário entre estes locais."
                        continue
                    route = _normalize(data["routes"][0])
                except httpx.HTTPError as exc:
                    transient_error = True
                    last_error = str(exc) or "Serviço rodoviário temporariamente indisponível."
                    continue
                except (ValueError, KeyError) as exc:
                    transient_error = True
                    last_error = str(exc) or "O serviço rodoviário devolveu uma resposta inválida."
                    continue

                now = datetime.now(timezone.utc)
                await db.road_routes.update_one(
                    {"key": key},
                    {"$set": {
                        "key": key,
                        "route": route,
                        "expires_at": now + ROUTE_TTL,
                        "updated_at": now,
                    }},
                    upsert=True,
                )
                return route

        raise HTTPException(
            status_code=503 if transient_error else 422,
            detail=last_error or "Não foi possível calcular um percurso rodoviário válido.",
        )


road_router = RoadRouter()
