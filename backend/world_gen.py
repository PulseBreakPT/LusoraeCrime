"""Geração inteligente do mundo à volta do Quartel-General escolhido.

Quando o jogador coloca o QG (em qualquer ponto de Portugal), este módulo:
  1. gera ~16 zonas de operação em 3 anéis de distância (perto = risco baixo,
     longe = risco/recompensa maiores — a fórmula de equilíbrio do motor já
     escala com a distância ao QG)
  2. valida TODAS as zonas em terra firme portuguesa (polígono real + água OSM)
  3. batiza cada zona com o nome REAL (rua + localidade, via Nominatim) em
     background — o motor só gera missões em zonas já batizadas, para nunca
     mostrar nomes inventados
"""
import asyncio
import logging
import math
import random

from geo import is_on_land_pt
from geocode import reverse_geocode, street_label

logger = logging.getLogger(__name__)

# (min_km, max_km, nº de zonas) — total 16, como as 16 zonas clássicas de Lisboa
DISTRICT_RINGS = [
    (0.5, 2.2, 5),   # anel interior: operações rápidas, risco base
    (2.2, 4.5, 6),   # anel médio: +1 risco a partir dos 3 km
    (4.5, 8.0, 5),   # anel exterior: +2 risco aos 6 km, recompensas maiores
]
MIN_SEPARATION_M = 450.0

# jogadores com batismo de zonas em curso (evita tarefas duplicadas)
_naming_in_flight = set()


def _hav_m(lat1, lng1, lat2, lng2):
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def generate_district_points(hq_lat, hq_lng):
    """Gera os centros das zonas de operação em anéis à volta do QG.
    Ângulos estratificados (cobertura em leque) com jitter; se um setor cair
    no mar/água (QG costeiro ou insular), tenta ângulos livres e por fim
    encolhe o raio — uma ilha pequena concentra as zonas no interior."""
    pts = []
    for ring_idx, (r_min, r_max, count) in enumerate(DISTRICT_RINGS):
        base = random.uniform(0, 2 * math.pi)
        for i in range(count):
            for attempt in range(60):
                if attempt < 24:
                    ang = base + (2 * math.pi * i / count) + random.uniform(-0.5, 0.5) * (2 * math.pi / count)
                else:
                    ang = random.uniform(0, 2 * math.pi)
                shrink = 1.0 if attempt < 40 else 0.5
                d_km = random.uniform(r_min, r_max) * shrink
                dlat = (d_km / 111.0) * math.cos(ang)
                dlng = (d_km / (111.0 * math.cos(math.radians(hq_lat)))) * math.sin(ang)
                lat2, lng2 = hq_lat + dlat, hq_lng + dlng
                if not is_on_land_pt(lat2, lng2):
                    continue
                if any(_hav_m(lat2, lng2, p["lat"], p["lng"]) < MIN_SEPARATION_M for p in pts):
                    continue
                pts.append({
                    "key": f"d{len(pts) + 1}",
                    "name": "", "named": False,
                    "lat": round(lat2, 6), "lng": round(lng2, 6),
                    "ring": ring_idx,
                })
                break
    return pts


async def name_districts_task(db, player_oid):
    """Batiza (em background) as zonas ainda sem nome com moradas reais.
    Atualiza o documento do jogador zona a zona — o spawn de missões começa
    assim que a primeira zona tem nome. Faz 2 passagens para tolerar falhas
    pontuais do Nominatim."""
    pid = str(player_oid)
    if pid in _naming_in_flight:
        return
    _naming_in_flight.add(pid)
    try:
        for _pass in range(2):
            player = await db.players.find_one({"_id": player_oid})
            if not player:
                return
            districts = player.get("districts") or []
            if not districts or all(d.get("named") for d in districts):
                return
            used = {d["name"] for d in districts if d.get("named")}
            for idx, d in enumerate(districts):
                if d.get("named"):
                    continue
                g = await reverse_geocode(db, d["lat"], d["lng"])
                label = street_label(g)
                if not label:
                    continue
                final, n = label, 2
                while final in used:
                    final = f"{label} · {n}"
                    n += 1
                used.add(final)
                d["name"] = final
                d["named"] = True
                await db.players.update_one(
                    {"_id": player_oid, f"districts.{idx}.key": d["key"]},
                    {"$set": {f"districts.{idx}.name": final,
                              f"districts.{idx}.named": True}},
                )
            if all(x.get("named") for x in districts):
                break
    except Exception:
        logger.exception("Falha ao batizar zonas do jogador %s", pid)
    finally:
        _naming_in_flight.discard(pid)


def ensure_naming_scheduled(db, player):
    """Retoma o batismo de zonas se alguma ficou sem nome (ex.: Nominatim em
    baixo na altura da colocação). Chamado de forma barata no GET /state."""
    districts = player.get("districts") or []
    if districts and any(not d.get("named") for d in districts):
        if str(player["_id"]) not in _naming_in_flight:
            asyncio.create_task(name_districts_task(db, player["_id"]))
