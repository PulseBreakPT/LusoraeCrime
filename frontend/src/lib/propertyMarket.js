// Índice imobiliário Portugal 2026 — espelho de backend/property_market.py.
// Usado no modo convidado e na pré-visualização do preço antes da compra.

export const REGIONAL_PROPERTY_MULTIPLIERS = Object.freeze({
  lisboa: 1.30,
  porto: 1.15,
  algarve: 1.10,
  madeira: 1.05,
  litoral: 1.00,
  acores: 0.90,
  interior: 0.85,
});

export function propertyMarketZone(lat, lng) {
  const y = Number(lat);
  const x = Number(lng);

  if (y >= 32.45 && y <= 33.35 && x >= -17.55 && x <= -15.75) {
    return { zone: "Madeira", multiplier: REGIONAL_PROPERTY_MULTIPLIERS.madeira };
  }
  if (y >= 36.5 && y <= 40.5 && x >= -31.8 && x <= -24.0) {
    return { zone: "Açores", multiplier: REGIONAL_PROPERTY_MULTIPLIERS.acores };
  }
  if (y >= 38.50 && y <= 39.05 && x >= -9.60 && x <= -8.75) {
    return { zone: "Lisboa", multiplier: REGIONAL_PROPERTY_MULTIPLIERS.lisboa };
  }
  if (y >= 40.95 && y <= 41.45 && x >= -8.95 && x <= -8.20) {
    return { zone: "Porto", multiplier: REGIONAL_PROPERTY_MULTIPLIERS.porto };
  }
  if (y >= 36.85 && y <= 37.45 && x >= -9.20 && x <= -7.10) {
    return { zone: "Algarve", multiplier: REGIONAL_PROPERTY_MULTIPLIERS.algarve };
  }
  if (x >= -7.65 || (y >= 39.2 && x >= -8.05) || (y <= 38.7 && x >= -8.15)) {
    return { zone: "Interior", multiplier: REGIONAL_PROPERTY_MULTIPLIERS.interior };
  }
  return { zone: "Litoral/Centro", multiplier: REGIONAL_PROPERTY_MULTIPLIERS.litoral };
}

export function propertyMarketPrice(basePrice, lat, lng) {
  const { zone, multiplier } = propertyMarketZone(lat, lng);
  const price = Math.max(500, Math.round((Number(basePrice || 0) * multiplier) / 500) * 500);
  return { zone, multiplier, basePrice: Number(basePrice || 0), price };
}
