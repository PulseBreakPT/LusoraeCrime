import { parseActivityMessage, resolveEventNavigation } from "./game";

describe("activity feed message safety", () => {
  test("does not crash when a legacy event has no message field", () => {
    expect(() => parseActivityMessage(undefined)).not.toThrow();
    expect(parseActivityMessage(undefined)).toBe("");
  });

  test("still parses valid activity text", () => {
    const result = parseActivityMessage("Crew Alfa saiu para Operação Centro.");
    expect(Array.isArray(result) || typeof result === "string").toBe(true);
  });
});


describe("contextual activity navigation", () => {
  const state = {
    employees: [{ id: "emp-1", name: "Inês Rocha" }],
    teams: [{ id: "team-1", name: "Crew Alfa" }],
    vehicles: [{ id: "veh-1", name: "Ibiza FR", model_key: "ibiza" }],
    weapons: [{ id: "wpn-1", name: "Pistola 9mm" }],
    properties: [{ id: "prop-1", name: "Armazém Norte", district: "Norte" }],
    quests: [{ id: "quest-1", quest_key: "daily_1", name: "Recolha", type: "diaria", status: "completed" }],
  };

  test("employee notification resolves to the exact operative card", () => {
    expect(resolveEventNavigation(state, {
      kind: "team",
      message: "Inês Rocha foi descansar.",
    })).toMatchObject({
      panel: "employees",
      focusTestId: "employee-card-emp-1",
    });
  });

  test("team dispatch resolves to the exact team card", () => {
    expect(resolveEventNavigation(state, {
      kind: "dispatch",
      message: "Crew Alfa destacada para uma operação.",
    })).toMatchObject({
      panel: "teams",
      focusTestId: "team-card-team-1",
    });
  });

  test("quest notification resolves to the exact quest and tab", () => {
    expect(resolveEventNavigation(state, {
      kind: "success",
      message: "Recolha concluída.",
    })).toMatchObject({
      panel: "quests",
      tab: "diarias",
      focusTestId: "quest-card-quest-1",
    });
  });
});
