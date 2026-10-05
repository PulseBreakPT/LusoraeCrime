import {
  ECONOMY_DIRECTOR_VERSION,
  careerEconomyBand,
  rewardCeiling,
  guardReward,
  cityBusinessCap,
  passivePortfolioScale,
} from "./economyDirector";

describe("economy director parity", () => {
  test("uses the versioned shared career envelope", () => {
    expect(ECONOMY_DIRECTOR_VERSION).toBe(1);
    expect(careerEconomyBand(1).ceiling_per_hour).toBe(18000);
    expect(careerEconomyBand(100).ceiling_per_hour).toBe(80000);
  });

  test("caps burst rewards without flattening career growth", () => {
    expect(rewardCeiling(100, "mastermind")).toBe(1600000);
    expect(rewardCeiling(100, "operation")).toBe(400000);
    expect(guardReward(9999999, 100, "mastermind")).toBe(1600000);
    expect(rewardCeiling(100, "operation")).toBeGreaterThan(rewardCeiling(1, "operation"));
  });

  test("scales aggregate passive income to the career ceiling", () => {
    expect(passivePortfolioScale(1, 1, 18000, 18000)).toBe(0.5);
    expect(passivePortfolioScale(100, 2, 80000, 80000)).toBe(1);
  });

  test("bounds city business portfolio growth", () => {
    expect(cityBusinessCap(1)).toBe(2);
    expect(cityBusinessCap(10)).toBe(3);
    expect(cityBusinessCap(50)).toBe(7);
    expect(cityBusinessCap(100)).toBe(12);
  });
});
