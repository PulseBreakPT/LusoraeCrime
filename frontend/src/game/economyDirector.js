// Shared guest/offline economy guardrails.
// Keep values mirrored with backend/economy_director.py; launch-contract tests
// protect the version and critical caps from drifting unnoticed.

export const ECONOMY_DIRECTOR_VERSION = 1;

export const CAREER_ECONOMY_BANDS = [
  [1, 1200, 4500, 18000],
  [10, 2500, 9000, 22500],
  [25, 5000, 18000, 30000],
  [50, 9000, 32000, 45000],
  [75, 15000, 50000, 60000],
  [100, 22000, 70000, 80000],
];

export const SOURCE_BURST_HOURS = {
  operation: 5,
  quest: 3,
  mastermind: 20,
  city_cache: 2,
  season: 3,
};

const levelOf = (value) => Math.max(1, Math.min(100, Math.trunc(Number(value) || 1)));

const interpolate = (level, index) => {
  const lvl = levelOf(level);
  let previous = CAREER_ECONOMY_BANDS[0];
  if (lvl <= previous[0]) return Number(previous[index]);
  for (const current of CAREER_ECONOMY_BANDS.slice(1)) {
    if (lvl <= current[0]) {
      const span = current[0] - previous[0];
      const t = (lvl - previous[0]) / Math.max(1, span);
      return Number(previous[index]) + (Number(current[index]) - Number(previous[index])) * t;
    }
    previous = current;
  }
  return Number(CAREER_ECONOMY_BANDS.at(-1)[index]);
};

export const careerEconomyBand = (level) => ({
  level: levelOf(level),
  floor_per_hour: Math.round(interpolate(level, 1)),
  target_per_hour: Math.round(interpolate(level, 2)),
  ceiling_per_hour: Math.round(interpolate(level, 3)),
});

export const rewardCeiling = (level, source) => {
  const band = careerEconomyBand(level);
  const hours = Number(SOURCE_BURST_HOURS[source] ?? 5);
  return Math.max(1, Math.round(band.ceiling_per_hour * hours));
};

export const guardReward = (amount, level, source) =>
  Math.min(Math.max(0, Math.round(Number(amount) || 0)), rewardCeiling(level, source));

export const passiveHourlyCeiling = (level) => careerEconomyBand(level).ceiling_per_hour;

export const cityBusinessCap = (level) => Math.min(12, 2 + Math.floor(levelOf(level) / 10));
