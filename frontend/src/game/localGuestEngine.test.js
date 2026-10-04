import {
  disableLocalGuestMode,
  enableLocalGuestMode,
  isLocalGuestMode,
  localGuestRequest,
  resetLocalGuestGame,
} from "./localGuestEngine";

describe("offline guest engine", () => {
  beforeEach(() => {
    localStorage.clear();
    resetLocalGuestGame();
  });

  afterEach(() => {
    resetLocalGuestGame();
    localStorage.clear();
  });

  test("starts locally without any backend and exposes a guest user", async () => {
    enableLocalGuestMode();
    expect(isLocalGuestMode()).toBe(true);

    const me = await localGuestRequest("get", "/auth/me");
    expect(me.status).toBe(200);
    expect(me.data.is_guest).toBe(true);
    expect(me.data.providers).toContain("guest");

    const initial = await localGuestRequest("get", "/game/state");
    expect(initial.data.hq_pending).toBe(true);
    expect(initial.data.player.clean_money).toBe(100000);
  });

  test("places an HQ and creates a playable organization", async () => {
    enableLocalGuestMode();

    const validation = await localGuestRequest("post", "/game/hq/validate", {
      lat: 38.7223,
      lng: -9.1393,
    });
    expect(validation.data.valid).toBe(true);

    const placed = await localGuestRequest("post", "/game/hq/place", {
      lat: 38.7223,
      lng: -9.1393,
    });
    expect(placed.data.hq.level).toBe(1);

    const state = (await localGuestRequest("get", "/game/state")).data;
    expect(state.hq_pending).toBeUndefined();
    expect(state.teams.length).toBeGreaterThanOrEqual(1);
    expect(state.employees.length).toBeGreaterThanOrEqual(2);
    expect(state.vehicles.length).toBeGreaterThanOrEqual(1);
    expect(state.opportunities).toHaveLength(5);
    expect(state.opportunities.every((opp) => opp.min_level <= state.player.level)).toBe(true);
    expect(state.caps.employees.max).toBeGreaterThanOrEqual(4);

    const mastermind = (await localGuestRequest("get", "/game/mastermind/state")).data;
    expect(mastermind.targets.length).toBe(3);
    expect(mastermind.rank.level).toBe(1);
  });

  test("dispatches a mission through the same API contract used by the UI", async () => {
    enableLocalGuestMode();
    await localGuestRequest("post", "/game/hq/place", {
      lat: 38.7223,
      lng: -9.1393,
    });

    let state = (await localGuestRequest("get", "/game/state")).data;
    const team = state.teams[0];
    const opportunity = state.opportunities.find((o) => o.min_level <= state.player.level);

    const preview = await localGuestRequest("post", "/game/dispatch/preview", {
      team_id: team.id,
      opportunity_id: opportunity.id,
    });
    expect(preview.data.chance).toBeGreaterThan(0);
    expect(preview.data.breakdown.length).toBeGreaterThan(0);

    const dispatch = await localGuestRequest("post", "/game/dispatch", {
      team_id: team.id,
      opportunity_id: opportunity.id,
    });
    expect(dispatch.data.ok).toBe(true);

    state = (await localGuestRequest("get", "/game/state")).data;
    expect(state.missions.length).toBe(1);
    expect(state.teams[0].status).toBe("on_mission");
  });

  test("persists pre-routed mission geometry before movement starts", async () => {
    enableLocalGuestMode();
    await localGuestRequest("post", "/game/hq/place", { lat: 38.7223, lng: -9.1393 });
    let state = (await localGuestRequest("get", "/game/state")).data;
    const team = state.teams[0];
    const opportunity = state.opportunities[0];
    const origin = state.player.hq;
    const target = { lat: opportunity.lat, lng: opportunity.lng };
    const outward = {
      latlngs: [[origin.lat, origin.lng], [(origin.lat + target.lat) / 2, (origin.lng + target.lng) / 2], [target.lat, target.lng]],
      times: [0, 30, 60], duration: 60, distance: 900, source: "test", unavailable: false,
    };
    const inward = {
      latlngs: [[target.lat, target.lng], [(origin.lat + target.lat) / 2, (origin.lng + target.lng) / 2], [origin.lat, origin.lng]],
      times: [0, 35, 70], duration: 70, distance: 920, source: "test", unavailable: false,
    };

    const dispatch = await localGuestRequest("post", "/game/dispatch", {
      team_id: team.id,
      opportunity_id: opportunity.id,
      route_outward: outward,
      route_inward: inward,
    });
    expect(dispatch.data.ok).toBe(true);

    state = (await localGuestRequest("get", "/game/state")).data;
    const mission = state.missions[0];
    expect(mission.road_outward.latlngs).toHaveLength(3);
    expect(mission.road_inward.latlngs).toHaveLength(3);
    expect(mission.road_outward.times[0]).toBe(0);
    expect(mission.road_outward.times[mission.road_outward.times.length - 1]).toBeGreaterThanOrEqual(20);
    expect(mission.road_inward.times[mission.road_inward.times.length - 1]).toBeGreaterThanOrEqual(20);
    expect(Date.parse(mission.arrive_at)).toBeGreaterThan(Date.parse(mission.depart_at));
    expect(Date.parse(mission.return_at)).toBeGreaterThan(Date.parse(mission.finish_at));
  });

  test("persists the guest career across leaving guest mode", async () => {
    enableLocalGuestMode();
    await localGuestRequest("post", "/game/hq/place", {
      lat: 37.0194,
      lng: -7.9304,
    });

    const before = (await localGuestRequest("get", "/game/state")).data;
    disableLocalGuestMode();
    expect(isLocalGuestMode()).toBe(false);

    enableLocalGuestMode();
    const after = (await localGuestRequest("get", "/game/state")).data;

    expect(after.player.hq.lat).toBe(before.player.hq.lat);
    expect(after.player.hq.lng).toBe(before.player.hq.lng);
    expect(after.teams[0].id).toBe(before.teams[0].id);
  });

  test("deleting guest data really resets the local career", async () => {
    enableLocalGuestMode();
    await localGuestRequest("post", "/game/hq/place", {
      lat: 38.7223,
      lng: -9.1393,
    });

    await localGuestRequest("post", "/auth/delete-account", {});
    expect(isLocalGuestMode()).toBe(false);

    enableLocalGuestMode();
    const fresh = (await localGuestRequest("get", "/game/state")).data;
    expect(fresh.hq_pending).toBe(true);
    expect(fresh.player.clean_money).toBe(100000);
  });
  test("supports the existing panels through the local API compatibility layer", async () => {
    enableLocalGuestMode();
    await localGuestRequest("post", "/game/hq/place", {
      lat: 38.7223,
      lng: -9.1393,
    });

    let state = (await localGuestRequest("get", "/game/state")).data;

    const weapon = await localGuestRequest("post", "/game/weapons/buy", {
      model_key: "pistola",
    });
    expect(weapon.data.weapon_id).toBeTruthy();

    const property = await localGuestRequest("post", "/game/properties/buy", {
      type_key: "garagem",
      lat: 38.724,
      lng: -9.141,
    });
    expect(property.data.property_id).toBeTruthy();

    await localGuestRequest("post", "/game/mastermind/heists/intel", {
      target_key: "auction",
    });
    const mastermind = (await localGuestRequest("get", "/game/mastermind/state")).data;
    expect(mastermind.targets.find((target) => target.key === "auction").intel).toBeTruthy();

    await localGuestRequest("post", "/game/shop/cosmetic", {
      category: "team_emblem",
      key: "wolf",
    });
    state = (await localGuestRequest("get", "/game/state")).data;
    await localGuestRequest("post", "/game/teams/equip_emblem", {
      team_id: state.teams[0].id,
      emblem_key: "wolf",
    });
    state = (await localGuestRequest("get", "/game/state")).data;
    expect(state.teams[0].emblem_key).toBe("wolf");

    expect(state.weapons.length).toBe(1);
    expect(state.properties.length).toBe(1);
  });

  test("keeps the organization panel functional and authoritative in guest mode", async () => {
    enableLocalGuestMode();
    await localGuestRequest("post", "/game/hq/place", {
      lat: 38.7223,
      lng: -9.1393,
    });

    const catalog = (await localGuestRequest("get", "/game/catalog")).data;
    expect(Object.keys(catalog.organization.supplies)).toHaveLength(18);
    expect(Object.keys(catalog.organization.prestige).length).toBeGreaterThan(0);

    let state = (await localGuestRequest("get", "/game/state")).data;
    expect(state.organization.inventory_capacity).toBeGreaterThan(0);
    expect(state.organization.protection_cost).toBe(0);

    const moneyBefore = state.player.clean_money;
    await localGuestRequest("post", "/game/org/inventory/buy", {
      item_key: "ammo_sidearm",
      packs: 1,
    });
    state = (await localGuestRequest("get", "/game/state")).data;
    expect(state.organization.inventory.ammo_sidearm).toBe(30);
    expect(state.player.clean_money).toBe(moneyBefore - 90);

    const weapon = await localGuestRequest("post", "/game/weapons/buy", {
      model_key: "pistola",
    });
    await localGuestRequest("post", "/game/org/weapons/reload", {
      id: weapon.data.weapon_id,
    });
    state = (await localGuestRequest("get", "/game/state")).data;
    expect(state.weapons[0].ammo_loaded).toBe(15);
    expect(state.organization.inventory.ammo_sidearm).toBe(15);

    await localGuestRequest("post", "/game/org/teams/doctrine", {
      id: state.teams[0].id,
      doctrine: "cautious",
    });
    state = (await localGuestRequest("get", "/game/state")).data;
    expect(state.teams[0].doctrine).toBe("cautious");

    const finance = (await localGuestRequest("get", "/game/org/finance/summary")).data;
    expect(finance.expenses).toBeGreaterThan(0);
    expect(finance.fleet_value).toBeGreaterThan(0);
    expect(finance.weapon_value).toBeGreaterThan(0);
  });

  test("migrates legacy risk values so rendering can never request a negative repeat count", async () => {
    enableLocalGuestMode();
    await localGuestRequest("post", "/game/hq/place", {
      lat: 38.7223,
      lng: -9.1393,
    });

    const raw = JSON.parse(localStorage.getItem("submundo_guest_save_v2"));
    raw.version = 1;
    raw.opportunities[0].risk = 29;
    raw.opportunities[1].risk = 40;
    raw.opportunities[2].risk = 51;
    raw.opportunities[3].risk = 62;
    localStorage.setItem("submundo_guest_save_v2", JSON.stringify(raw));

    const state = (await localGuestRequest("get", "/game/state")).data;
    expect(state.opportunities.slice(0, 4).map((o) => o.risk)).toEqual([1, 2, 3, 4]);
    expect(state.opportunities.every((o) => o.risk >= 1 && o.risk <= 5)).toBe(true);
  });

  test("migrates legacy activity events used by the network feed", async () => {
    enableLocalGuestMode();
    await localGuestRequest("post", "/game/hq/place", {
      lat: 38.7223,
      lng: -9.1393,
    });
    const raw = JSON.parse(localStorage.getItem("submundo_guest_save_v2"));
    raw.events = [
      {
        id: "legacy-event",
        type: "system",
        text: "Evento antigo do modo convidado.",
        ts: new Date().toISOString(),
      },
    ];
    localStorage.setItem("submundo_guest_save_v2", JSON.stringify(raw));

    const state = (await localGuestRequest("get", "/game/state")).data;
    expect(state.events[0].kind).toBe("system");
    expect(state.events[0].message).toBe("Evento antigo do modo convidado.");
  });

  test("migrates legacy economy values to the Portugal 2026 profile", async () => {
    enableLocalGuestMode();
    await localGuestRequest("post", "/game/hq/place", {
      lat: 38.7223,
      lng: -9.1393,
    });

    const raw = JSON.parse(localStorage.getItem("submundo_guest_save_v2"));
    raw.version = 2;
    raw.employees[0].salary = 260;
    raw.vehicles[0].price = 6000;
    localStorage.setItem("submundo_guest_save_v2", JSON.stringify(raw));

    const state = (await localGuestRequest("get", "/game/state")).data;
    expect(state.employees[0].salary).toBeGreaterThan(260);
    expect(state.vehicles[0].price).toBe(12500);
    expect(state.fuel_prices.gasolina).toBe(2.12);
    expect(state.fuel_prices.gasoleo).toBe(2.22);
    expect(state.weekly_fixed_total).toBeGreaterThan(state.salary_total);
    expect(state.weekly_cost_breakdown.employer_social_security).toBeGreaterThan(0);
  });

  test("scales opportunity rewards with risk without breaking the economy cap", async () => {
    enableLocalGuestMode();
    await localGuestRequest("post", "/game/hq/place", {
      lat: 38.7223,
      lng: -9.1393,
    });
    const state = (await localGuestRequest("get", "/game/state")).data;
    const byRisk = new Map();
    for (const opp of state.opportunities) {
      if (!byRisk.has(opp.risk) || opp.reward < byRisk.get(opp.risk)) {
        byRisk.set(opp.risk, opp.reward);
      }
      expect(opp.reward).toBeGreaterThanOrEqual(1500);
      expect(opp.reward).toBeLessThanOrEqual(90000);
    }
    const risks = [...byRisk.keys()].sort((a, b) => a - b);
    for (let i = 1; i < risks.length; i += 1) {
      expect(byRisk.get(risks[i])).toBeGreaterThan(byRisk.get(risks[i - 1]));
    }
  });

  test("charges the regional property price and persists its market basis", async () => {
    enableLocalGuestMode();
    await localGuestRequest("post", "/game/hq/place", {
      lat: 38.7223,
      lng: -9.1393,
    });

    const before = (await localGuestRequest("get", "/game/state")).data.player.clean_money;
    const result = await localGuestRequest("post", "/game/properties/buy", {
      type_key: "garagem",
      lat: 38.7223,
      lng: -9.1393,
    });

    expect(result.data.price).toBe(71500);
    expect(result.data.market_zone).toBe("Lisboa");

    const after = (await localGuestRequest("get", "/game/state")).data;
    const garage = after.properties.find((p) => p.type_key === "garagem");
    expect(garage.purchase_price).toBe(71500);
    expect(garage.market_multiplier).toBe(1.3);
    expect(after.player.clean_money).toBe(before - 71500);
  });

  test("applies operation profiles and consecutive-repeat anti-farm in guest mode", async () => {
    enableLocalGuestMode();
    await localGuestRequest("post", "/game/hq/place", {
      lat: 38.7223,
      lng: -9.1393,
    });

    const state = (await localGuestRequest("get", "/game/state")).data;
    const team = state.teams[0];
    const opportunity = state.opportunities[0];
    expect(opportunity.profile).toBeTruthy();

    const raw = JSON.parse(localStorage.getItem("submundo_guest_save_v2"));
    raw.teams[0].last_type_key = opportunity.type_key;
    raw.teams[0].last_type_at = new Date().toISOString();
    raw.teams[0].repeat_type_count = 1;
    localStorage.setItem("submundo_guest_save_v2", JSON.stringify(raw));

    const preview = await localGuestRequest("post", "/game/dispatch/preview", {
      team_id: team.id,
      opportunity_id: opportunity.id,
    });
    expect(preview.data.repeat_count).toBe(2);
    expect(preview.data.repeat_penalty_pct).toBeLessThan(0);
    expect(preview.data.operation_profile).toBeTruthy();
    expect(preview.data.operation_profile_label).toBeTruthy();
  });

});
