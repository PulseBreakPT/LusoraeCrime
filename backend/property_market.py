"""Índice imobiliário simplificado para a economia Portugal 2026.

Não pretende ser um avaliador imobiliário. Os multiplicadores transformam o
preço-base de gameplay num preço regional coerente com as diferenças observadas
entre Lisboa, Porto, Algarve, ilhas, litoral e interior.
"""

REGIONAL_PROPERTY_MULTIPLIERS = {
    "lisboa": 1.30,
    "porto": 1.15,
    "algarve": 1.10,
    "madeira": 1.05,
    "litoral": 1.00,
    "acores": 0.90,
    "interior": 0.85,
}


def property_market_zone(lat: float, lng: float) -> tuple[str, float]:
    lat = float(lat)
    lng = float(lng)

    # Regiões autónomas.
    if 32.45 <= lat <= 33.35 and -17.55 <= lng <= -15.75:
        return "Madeira", REGIONAL_PROPERTY_MULTIPLIERS["madeira"]
    if 36.5 <= lat <= 40.5 and -31.8 <= lng <= -24.0:
        return "Açores", REGIONAL_PROPERTY_MULTIPLIERS["acores"]

    # Áreas metropolitanas aproximadas.
    if 38.50 <= lat <= 39.05 and -9.60 <= lng <= -8.75:
        return "Lisboa", REGIONAL_PROPERTY_MULTIPLIERS["lisboa"]
    if 40.95 <= lat <= 41.45 and -8.95 <= lng <= -8.20:
        return "Porto", REGIONAL_PROPERTY_MULTIPLIERS["porto"]

    # Algarve.
    if 36.85 <= lat <= 37.45 and -9.20 <= lng <= -7.10:
        return "Algarve", REGIONAL_PROPERTY_MULTIPLIERS["algarve"]

    # Interior: aproximação deliberadamente simples, usada só para balanceamento.
    # Inclui grande parte de Trás-os-Montes, Beira Interior e Alentejo interior.
    if lng >= -7.65 or (lat >= 39.2 and lng >= -8.05) or (lat <= 38.7 and lng >= -8.15):
        return "Interior", REGIONAL_PROPERTY_MULTIPLIERS["interior"]

    return "Litoral/Centro", REGIONAL_PROPERTY_MULTIPLIERS["litoral"]


def property_market_price(base_price: int, lat: float, lng: float) -> dict:
    zone, multiplier = property_market_zone(lat, lng)
    # Arredondamento a 500 € mantém a leitura limpa no jogo.
    price = int(round((float(base_price) * multiplier) / 500.0) * 500)
    return {
        "zone": zone,
        "multiplier": multiplier,
        "base_price": int(base_price),
        "price": max(500, price),
    }
