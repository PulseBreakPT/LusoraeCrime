import fs from "fs";
import path from "path";

const read = (relativePath) =>
  fs.readFileSync(path.join(process.cwd(), "src", relativePath), "utf8");

describe("UI action ownership", () => {
  const teams = read("components/game/TeamsPanel.jsx");
  const intel = read("components/game/IntelPanel.jsx");
  const empire = read("components/game/EmpirePanel.jsx");
  const employees = read("components/game/EmployeesPanel.jsx");
  const fleet = read("components/game/FleetPanel.jsx");
  const opportunity = read("components/game/OpportunityCard.jsx");
  const gamePage = read("pages/GamePage.jsx");

  test("team management does not duplicate recovery or fleet maintenance mutations", () => {
    for (const forbidden of [
      "restEmployee",
      "refuelVehicle",
      "repairVehicle",
      "recallTeam",
      "optimizeEmployees",
      "optimizeVehicles",
      "team-member-rest-",
      "team-refuel-",
      "team-repair-",
      "teams-optimize",
    ]) {
      expect(teams).not.toContain(forbidden);
    }
  });

  test("Intel recommends destinations instead of executing Empire mutations", () => {
    expect(intel).not.toContain("bribePolice");
    expect(intel).not.toMatch(/\blaunder\s*\(/);
    expect(intel.match(/action: "Abrir Frota"/g)?.length || 0).toBeLessThanOrEqual(1);
    expect(intel.match(/action: "Abrir Operacionais"/g)?.length || 0).toBeLessThanOrEqual(1);
    expect(intel.match(/action: "Abrir Equipas"/g)?.length || 0).toBeLessThanOrEqual(1);
  });

  test("Empire does not reproduce the global navigation dock", () => {
    expect(empire).not.toContain("Acesso rápido");
    expect(empire).not.toContain("empire-nav-");
  });

  test("property placement starts only from Properties", () => {
    expect(employees).not.toContain("startPlacement");
    expect(fleet).not.toContain("startPlacement");
  });

  test("operation quick fixes do not duplicate fleet maintenance mutations", () => {
    expect(opportunity).not.toContain("refuelVehicle");
    expect(opportunity).not.toContain("repairVehicle");
    expect(opportunity).not.toMatch(/run:\s*\(\)\s*=>\s*assignVehicle/);
  });

  test("HUD counters are indicators, not duplicate navigation buttons", () => {
    const missions = gamePage.match(/<div[\s\S]{0,260}data-testid="available-missions-hud"[\s\S]{0,380}<\/div>/);
    const wanted = gamePage.match(/<div[\s\S]{0,260}data-testid="wanted-stars-hud"[\s\S]{0,500}<\/div>/);
    expect(missions?.[0]).toBeTruthy();
    expect(wanted?.[0]).toBeTruthy();
    expect(missions?.[0]).not.toContain("onClick=");
    expect(wanted?.[0]).not.toContain("onClick=");
  });
});
