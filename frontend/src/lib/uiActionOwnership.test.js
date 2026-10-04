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
  const weapons = read("components/game/WeaponsPanel.jsx");
  const gamePage = read("pages/GamePage.jsx");
  const focusHook = read("hooks/usePanelFocus.js");
  const gameContext = read("context/GameContextV2.js");
  const localGuest = read("game/localGuestEngine.js");

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

  test("bulk maintenance controls are wired to GameContext actions", () => {
    expect(employees).toMatch(/const\s*\{[\s\S]*?restAllEligible[\s\S]*?\}\s*=\s*useGame\(\)/);
    expect(employees).toContain("await restAllEligible()");
    expect(weapons).toMatch(/const\s*\{[\s\S]*?repairWeaponsAll[\s\S]*?\}\s*=\s*useGame\(\)/);
    expect(weapons).toContain("const repairAll = () => repairWeaponsAll()");
  });

  test("available operations HUD opens Operations while wanted stars remain an indicator", () => {
    expect(gamePage).toMatch(/<button[\s\S]*?data-testid="available-missions-hud"[\s\S]*?onClick=\{\(\) => openFromNav\("operations"\)\}[\s\S]*?<\/button>/);

    const marker = 'data-testid="wanted-stars-hud"';
    const at = gamePage.indexOf(marker);
    expect(at).toBeGreaterThan(-1);
    const start = gamePage.lastIndexOf("<div", at);
    const end = gamePage.indexOf("</div>", at);
    const wantedBlock = gamePage.slice(start, end + "</div>".length);
    expect(wantedBlock).not.toContain("onClick=");
  });
  test("recommendations and reports deep-link to exact entities", () => {
    for (const target of [
      "vehicle-card-${vehicle.id}",
      "employee-card-${employee.id}",
      "team-card-${team.id}",
      "quest-card-${quest.id || quest.quest_key}",
      "property-card-${property.id}",
    ]) {
      expect(intel).toContain(target);
    }
    expect(intel).toContain('focusTestId: `team-card-${m.team_id}`');
    expect(gamePage).toContain("focusTarget?.panel");
  });

  test("contextual navigation scrolls and briefly highlights the exact target", () => {
    expect(focusHook).toContain('scrollIntoView({ behavior: "smooth", block: "center"');
    expect(focusHook).toContain('classList.add("sub-nav-focus-flash")');
    expect(focusHook).toContain("2600");
  });

  test("team builder creates the selected configuration in one action", () => {
    expect(teams).toContain('data-testid="team-builder"');
    expect(teams).toContain('data-testid="team-builder-vehicle"');
    expect(teams).toContain('testId="team-builder-create"');
    expect(teams).toContain("createTeam(spec, memberIds, selectedVehicle?.id || null)");
    expect(teams).not.toContain("testId={`create-team-${key}`}");
    expect(gameContext).toContain("employee_ids: employeeIds");
    expect(gameContext).toContain("vehicle_id: vehicleId || null");
    expect(localGuest).toContain("const memberIds=[...new Set(p.employee_ids||[])]");
  });


});
