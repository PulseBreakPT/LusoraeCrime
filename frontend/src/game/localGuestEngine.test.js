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
    expect(initial.data.player.clean_money).toBe(75000);
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
    expect(state.opportunities.length).toBeGreaterThanOrEqual(6);
    expect(state.caps.employees.max).toBeGreaterThanOrEqual(4);

    const street = (await localGuestRequest("get", "/game/street/state")).data;
    expect(street.districts.length).toBeGreaterThan(0);
    expect(street.wanted.stars).toBe(0);

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
    expect(fresh.player.clean_money).toBe(75000);
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

    await localGuestRequest("post", "/game/street/plan", {
      approach_key: "ghost",
      escape_key: "speed",
      gear_keys: [],
    });
    const street = (await localGuestRequest("get", "/game/street/state")).data;
    expect(street.plan.approach_key).toBe("ghost");

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

  test("migrates legacy risk values so rendering can never request a negative repeat count", async () => {
    enableLocalGuestMode();
    await localGuestRequest("post", "/game/hq/place", {
      lat: 38.7223,
      lng: -9.1393,
    });

    const raw = JSON.parse(localStorage.getItem("lusorae_guest_save_v2"));
    raw.version = 1;
    raw.opportunities[0].risk = 29;
    raw.opportunities[1].risk = 40;
    raw.opportunities[2].risk = 51;
    raw.opportunities[3].risk = 62;
    localStorage.setItem("lusorae_guest_save_v2", JSON.stringify(raw));

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
    const raw = JSON.parse(localStorage.getItem("lusorae_guest_save_v2"));
    raw.events = [
      {
        id: "legacy-event",
        type: "system",
        text: "Evento antigo do modo convidado.",
        ts: new Date().toISOString(),
      },
    ];
    localStorage.setItem("lusorae_guest_save_v2", JSON.stringify(raw));

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

    const raw = JSON.parse(localStorage.getItem("lusorae_guest_save_v2"));
    raw.version = 2;
    raw.employees[0].salary = 260;
    raw.vehicles[0].price = 6000;
    localStorage.setItem("lusorae_guest_save_v2", JSON.stringify(raw));

    const state = (await localGuestRequest("get", "/game/state")).data;
    expect(state.employees[0].salary).toBeGreaterThan(260);
    expect(state.vehicles[0].price).toBe(12500);
    expect(state.fuel_prices.gasolina).toBe(2.12);
    expect(state.fuel_prices.gasoleo).toBe(2.22);
  });

});
