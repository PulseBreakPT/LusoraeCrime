import {
  buildCumulative,
  pointOnTimedRoute,
  sliceTimedRoute,
  timeAtDistanceFraction,
} from "./routing";

const route = {
  latlngs: [
    [41.1500, -8.6100],
    [41.1510, -8.6090],
    [41.1520, -8.6080],
  ],
  times: [0, 8, 20],
  duration: 20,
  distance: 220,
  unavailable: false,
};

describe("time-based road routing", () => {
  test("interpolates using cumulative segment times like 112i", () => {
    const at8 = pointOnTimedRoute(route, 8);
    expect(at8.lat).toBeCloseTo(41.1510, 6);
    expect(at8.lng).toBeCloseTo(-8.6090, 6);

    const at14 = pointOnTimedRoute(route, 14);
    expect(at14.lat).toBeCloseTo(41.1515, 6);
    expect(at14.lng).toBeCloseTo(-8.6085, 6);
    expect(Number.isFinite(at14.bearing)).toBe(true);
  });

  test("slices a route using exact timed endpoints", () => {
    const sliced = sliceTimedRoute(route, 4, 14);
    expect(sliced.length).toBeGreaterThanOrEqual(3);
    expect(sliced[0][0]).toBeCloseTo(41.1505, 6);
    expect(sliced[sliced.length - 1][0]).toBeCloseTo(41.1515, 6);
  });

  test("maps parking distance onto the provider timeline", () => {
    const distances = buildCumulative(route.latlngs);
    const halfway = timeAtDistanceFraction(route, distances, 0.5);
    expect(halfway).toBeGreaterThan(0);
    expect(halfway).toBeLessThan(20);
  });

  test("clamps before and after the route", () => {
    const before = pointOnTimedRoute(route, -50);
    const after = pointOnTimedRoute(route, 999);
    expect(before.lat).toBeCloseTo(route.latlngs[0][0], 6);
    expect(after.lat).toBeCloseTo(route.latlngs[2][0], 6);
  });
});
