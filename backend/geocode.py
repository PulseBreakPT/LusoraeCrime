"""Geocodificação inversa via Nominatim (OpenStreetMap) — nomes REAIS.

O utilizador exige nomes exatos (rua + localidade) para o QG, zonas de missão
e propriedades — nada de nomes inventados. Este módulo:
  - respeita a política do Nominatim público (1 pedido/s, User-Agent)
  - guarda cache em Mongo (coleção `geocache`) para nunca repetir pedidos
  - devolve um dicionário normalizado com rua/lugar/localidade/concelho/cc
"""
import asyncio
import time

import httpx

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
USER_AGENT = "Lusorae/1.0 (jogo de estrategia; suporte@lusorae.pt)"
_MIN_INTERVAL_S = 1.1  # política de uso do Nominatim público: máx 1 req/s

_lock = asyncio.Lock()
_last_call = 0.0


def _cache_key(lat, lng):
    # ~11 m de granularidade — pontos praticamente iguais partilham cache
    return f"{round(float(lat), 4)},{round(float(lng), 4)}"


def _parse(raw):
    if not raw or "error" in raw:
        return None
    addr = raw.get("address", {})
    return {
        "road": addr.get("road") or addr.get("pedestrian") or addr.get("footway")
                or addr.get("cycleway") or addr.get("path") or addr.get("square"),
        "local": addr.get("neighbourhood") or addr.get("suburb") or addr.get("quarter")
                 or addr.get("hamlet") or addr.get("isolated_dwelling") or addr.get("farm"),
        "locality": addr.get("city") or addr.get("town") or addr.get("village")
                    or addr.get("municipality"),
        "county": addr.get("county") or addr.get("state_district"),
        "cc": addr.get("country_code"),
        "display_name": raw.get("display_name"),
    }


async def reverse_geocode(db, lat, lng, zoom=17):
    """Devolve dados de morada reais para (lat,lng) ou None se indisponível.
    Usa cache Mongo; caso contrário chama o Nominatim com throttle global."""
    key = _cache_key(lat, lng)
    cached = await db.geocache.find_one({"_id": key})
    if cached is not None:
        return cached.get("data")

    global _last_call
    raw = None
    async with _lock:
        wait = _MIN_INTERVAL_S - (time.monotonic() - _last_call)
        if wait > 0:
            await asyncio.sleep(wait)
        try:
            async with httpx.AsyncClient(timeout=9.0) as client:
                r = await client.get(NOMINATIM_URL, params={
                    "format": "jsonv2", "lat": f"{lat:.6f}", "lon": f"{lng:.6f}",
                    "zoom": zoom, "addressdetails": 1,
                }, headers={"User-Agent": USER_AGENT, "Accept-Language": "pt"})
            _last_call = time.monotonic()
            if r.status_code == 200:
                raw = r.json()
        except Exception:
            _last_call = time.monotonic()
            return None  # falha de rede: NÃO guardar em cache, para poder repetir

    data = _parse(raw)
    # cache também de respostas vazias (ponto sem morada) para não repetir pedidos
    await db.geocache.update_one(
        {"_id": key}, {"$set": {"data": data, "ts": time.time()}}, upsert=True
    )
    return data


def street_label(g):
    """Nome exato do local: 'Rua X, Localidade'. Se não houver rua mapeada
    (campo aberto), usa o lugar mais específico devolvido pelo OSM — nunca
    inventa nomes."""
    if not g:
        return None
    locality = g.get("locality") or g.get("county")
    main = g.get("road") or g.get("local")
    if main and locality and main != locality:
        return f"{main}, {locality}"
    return main or locality


def locality_label(g):
    """Rótulo curto da região (para o relógio da rede, eventos, etc.)."""
    if not g:
        return None
    return g.get("locality") or g.get("county")
