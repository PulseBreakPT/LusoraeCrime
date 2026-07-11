"""Geografia real de Portugal — validação ponto-em-polígono.

Carrega o polígono oficial de Portugal (geoBoundaries ADM0 simplificado,
continente + Madeira + Açores, 31 parcelas) e valida se coordenadas estão
em terra firme portuguesa. O mar, rios largos (fora do polígono) e países
estrangeiros são rejeitados. Usado para:
  - colocação do Quartel-General no registo (regra estrita: nunca no mar)
  - geração de zonas de missão à volta do QG
  - amostragem de pontos de oportunidades
  - colocação de propriedades

Implementação pura em Python (ray casting com even-odd rule + bounding
boxes por parcela) — sem dependências pesadas.
"""
import json
import math
import os

_DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "portugal.geojson")
_WATER_PATH = os.path.join(os.path.dirname(__file__), "data", "water_pt.geojson")

# Cada entrada: (bbox=(min_lng, min_lat, max_lng, max_lat), rings=[outer, hole1, ...])
# rings em coordenadas (lng, lat) como no GeoJSON.
_POLYGONS = []
# Corpos de água interiores (geometria OSM real: estuários do Tejo/Sado/Douro,
# rias de Aveiro/Formosa, Alqueva, lagoas) — o polígono ADM0 trata-os como
# "dentro" do país, por isso precisam de exclusão explícita.
_WATER = []


def _ring_bbox(ring):
    lngs = [p[0] for p in ring]
    lats = [p[1] for p in ring]
    return (min(lngs), min(lats), max(lngs), max(lats))


def _load_multipolygons(path):
    with open(path, "r", encoding="utf-8") as f:
        gj = json.load(f)
    polys = []
    for feat in gj["features"]:
        geom = feat["geometry"]
        coords = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
        for poly in coords:
            outer = poly[0]
            polys.append((_ring_bbox(outer), [outer] + list(poly[1:])))
    return polys


def _load():
    global _POLYGONS, _WATER
    _POLYGONS = _load_multipolygons(_DATA_PATH)
    if os.path.exists(_WATER_PATH):
        _WATER = _load_multipolygons(_WATER_PATH)


_load()


def _point_in_ring(lng, lat, ring):
    """Ray casting clássico (even-odd)."""
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > lat) != (yj > lat):
            x_cross = (xj - xi) * (lat - yi) / (yj - yi) + xi
            if lng < x_cross:
                inside = not inside
        j = i
    return inside


def is_in_portugal(lat, lng):
    """True se o ponto estiver em terra firme portuguesa (continente ou ilhas)."""
    for (bx0, by0, bx1, by1), rings in _POLYGONS:
        if not (bx0 <= lng <= bx1 and by0 <= lat <= by1):
            continue
        if _point_in_ring(lng, lat, rings[0]):
            # Verificar buracos (lagoas interiores etc.)
            for hole in rings[1:]:
                if _point_in_ring(lng, lat, hole):
                    return False
            return True
    return False


def in_water_body(lat, lng):
    """True se o ponto cair num dos grandes corpos de água interiores
    (estuários, rias, albufeiras) — geometria real do OpenStreetMap."""
    for (bx0, by0, bx1, by1), rings in _WATER:
        if not (bx0 <= lng <= bx1 and by0 <= lat <= by1):
            continue
        if _point_in_ring(lng, lat, rings[0]):
            for hole in rings[1:]:
                if _point_in_ring(lng, lat, hole):
                    return False
            return True
    return False


def is_on_land_pt(lat, lng):
    """Regra do jogo: terra firme em Portugal — dentro do país E fora dos
    grandes corpos de água interiores."""
    return is_in_portugal(lat, lng) and not in_water_body(lat, lng)


def _seg_dist_m(lat, lng, ax, ay, bx, by):
    """Distância aproximada (m) do ponto ao segmento [a,b] em coords geográficas.
    Projeção equiretangular local — suficiente para buffers de centenas de metros."""
    kx = 111320.0 * math.cos(math.radians(lat))  # metros por grau de longitude
    ky = 110540.0                                 # metros por grau de latitude
    px, py = lng * kx, lat * ky
    x1, y1 = ax * kx, ay * ky
    x2, y2 = bx * kx, by * ky
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return math.hypot(px - x1, py - y1)
    t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))


def _distance_to_polyset_m(polyset, lat, lng, search_margin_deg=0.15):
    best = float("inf")
    for (bx0, by0, bx1, by1), rings in polyset:
        m = search_margin_deg
        if not (bx0 - m <= lng <= bx1 + m and by0 - m <= lat <= by1 + m):
            continue
        for ring in rings:
            j = len(ring) - 1
            for i in range(len(ring)):
                d = _seg_dist_m(lat, lng, ring[j][0], ring[j][1], ring[i][0], ring[i][1])
                if d < best:
                    best = d
                j = i
    return best


def distance_to_boundary_m(lat, lng, search_margin_deg=0.15):
    """Distância mínima (m) do ponto à fronteira/costa. Só considera parcelas
    cujo bbox expandido contém o ponto — chamado apenas na colocação do QG."""
    return _distance_to_polyset_m(_POLYGONS, lat, lng, search_margin_deg)


def distance_to_water_m(lat, lng, search_margin_deg=0.05):
    """Distância mínima (m) do ponto ao corpo de água interior mais próximo."""
    return _distance_to_polyset_m(_WATER, lat, lng, search_margin_deg)


def is_valid_hq_location(lat, lng, min_inland_m=120.0):
    """Regra estrita para o Quartel-General: em Portugal, fora de qualquer
    corpo de água E afastado da linha de costa/fronteira pelo menos
    `min_inland_m` (protege contra a margem de erro do polígono simplificado
    junto ao mar). O mar é estritamente proibido."""
    if not is_in_portugal(lat, lng):
        return False
    if in_water_body(lat, lng):
        return False
    if distance_to_boundary_m(lat, lng) < min_inland_m:
        return False
    return True
