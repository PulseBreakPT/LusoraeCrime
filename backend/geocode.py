"""Geocodificação inversa com cadeia de fornecedores — nomes REAIS.

O utilizador exige nomes exatos (rua + localidade) para o QG, zonas de missão
e propriedades — nada de nomes inventados. Este módulo:
  - tenta os fornecedores por ordem: Nominatim (OSM oficial) → Photon
    (komoot, dados OSM com rua/cidade) → BigDataCloud (freguesia/cidade,
    sem chave) — o primeiro que responder ganha
  - respeita a política de cada serviço (throttle por fornecedor, User-Agent)
    e aplica um cooldown de 10 min ao Nominatim quando este devolve 429/403
    (IPs de datacenter são frequentemente bloqueados)
  - guarda cache em Mongo (coleção `geocache`) para nunca repetir pedidos
  - devolve um dicionário normalizado com rua/lugar/localidade/concelho/cc
"""
import asyncio
import time

import httpx

USER_AGENT = "Lusorae/1.0 (jogo de estrategia; suporte@lusorae.pt)"

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
PHOTON_URL = "https://photon.komoot.io/reverse"
BDC_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client"

# Throttle por fornecedor (política de uso dos serviços públicos)
_MIN_INTERVAL = {"nominatim": 1.1, "photon": 0.6, "bdc": 0.25}
_last_call = {"nominatim": 0.0, "photon": 0.0, "bdc": 0.0}
# Nominatim bloqueado (429/403) → não insistir durante 10 minutos
_NOMINATIM_COOLDOWN_S = 600.0
_nominatim_blocked_until = 0.0

_lock = asyncio.Lock()


def _cache_key(lat, lng):
    # ~11 m de granularidade — pontos praticamente iguais partilham cache
    return f"{round(float(lat), 4)},{round(float(lng), 4)}"


async def _throttle(provider):
    wait = _MIN_INTERVAL[provider] - (time.monotonic() - _last_call[provider])
    if wait > 0:
        await asyncio.sleep(wait)
    _last_call[provider] = time.monotonic()


def _parse_nominatim(raw):
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


def _parse_photon(raw):
    feats = (raw or {}).get("features") or []
    if not feats:
        return None
    pr = feats[0].get("properties", {})
    name = pr.get("name")
    road = pr.get("street")
    # Quando o resultado É uma via (osm_key=highway), o nome do objeto é a rua
    if not road and pr.get("osm_key") == "highway":
        road = name
    local = pr.get("district") or (name if name and name != road else None)
    locality = pr.get("city") or pr.get("town") or pr.get("village")
    return {
        "road": road,
        "local": local,
        "locality": locality or pr.get("county"),
        "county": pr.get("county") or pr.get("state"),
        "cc": (pr.get("countrycode") or "").lower() or None,
        "display_name": None,
    }


def _parse_bdc(raw):
    if not raw or not raw.get("countryCode"):
        return None
    local = raw.get("locality") or None
    if local and "," in local:
        # Freguesias agregadas ("Cedofeita, Santo Ildefonso, …") → a primeira
        local = local.split(",")[0].strip()
    locality = raw.get("city") or None
    if local and locality and local == locality:
        local = None
    return {
        "road": None,
        "local": local,
        "locality": locality or local,
        "county": raw.get("principalSubdivision"),
        "cc": (raw.get("countryCode") or "").lower(),
        "display_name": None,
    }


async def _fetch_nominatim(client, lat, lng, zoom):
    global _nominatim_blocked_until
    if time.monotonic() < _nominatim_blocked_until:
        return None
    await _throttle("nominatim")
    r = await client.get(NOMINATIM_URL, params={
        "format": "jsonv2", "lat": f"{lat:.6f}", "lon": f"{lng:.6f}",
        "zoom": zoom, "addressdetails": 1,
    }, headers={"User-Agent": USER_AGENT, "Accept-Language": "pt"})
    if r.status_code in (403, 429):
        # IP bloqueado/limitado — deixar de insistir por uns minutos
        _nominatim_blocked_until = time.monotonic() + _NOMINATIM_COOLDOWN_S
        return None
    if r.status_code != 200:
        return None
    return _parse_nominatim(r.json())


async def _fetch_photon(client, lat, lng, zoom):
    await _throttle("photon")
    r = await client.get(PHOTON_URL, params={
        "lat": f"{lat:.6f}", "lon": f"{lng:.6f}",
    }, headers={"User-Agent": USER_AGENT})
    if r.status_code != 200:
        return None
    return _parse_photon(r.json())


async def _fetch_bdc(client, lat, lng, zoom):
    await _throttle("bdc")
    r = await client.get(BDC_URL, params={
        "latitude": f"{lat:.6f}", "longitude": f"{lng:.6f}",
        "localityLanguage": "pt",
    }, headers={"User-Agent": USER_AGENT})
    if r.status_code != 200:
        return None
    return _parse_bdc(r.json())


_PROVIDERS = (_fetch_nominatim, _fetch_photon, _fetch_bdc)


async def reverse_geocode(db, lat, lng, zoom=17):
    """Devolve dados de morada reais para (lat,lng) ou None se indisponível.
    Usa cache Mongo; caso contrário percorre a cadeia de fornecedores com
    throttle por serviço — o primeiro resultado válido é guardado em cache."""
    key = _cache_key(lat, lng)
    cached = await db.geocache.find_one({"_id": key})
    # Entradas com data=None são tratadas como MISS: podem ser restos de
    # falhas antigas (ex.: 429 do Nominatim guardado como vazio) — com a
    # cadeia de fornecedores, um ponto em terra devolve quase sempre morada.
    if cached is not None and cached.get("data"):
        return cached.get("data")

    data = None
    got_any_response = False
    async with _lock:
        async with httpx.AsyncClient(timeout=9.0) as client:
            for fetch in _PROVIDERS:
                try:
                    data = await fetch(client, lat, lng, zoom)
                except Exception:
                    continue  # falha de rede neste fornecedor → tentar o próximo
                if data:
                    got_any_response = True
                    break

    if not got_any_response:
        # Nenhum fornecedor respondeu (rede em baixo / todos bloqueados):
        # NÃO guardar em cache, para poder repetir mais tarde.
        return None

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
