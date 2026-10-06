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
  const navigation = read("game/navigation.js");
  const hq = read("components/game/HQPanel.jsx");
  const forYou = read("components/game/ForYouPanel.jsx");
  const city = read("components/game/CityPanel.jsx");
  const opportunities = read("components/game/OpportunitiesPanel.jsx");
  const organization = read("components/game/OrganizationPanel.jsx");
  const properties = read("components/game/PropertiesPanel.jsx");
  const hud = read("components/game/hud.jsx");
  const liveMap = read("components/game/LiveMap.jsx");

  test("team management does not duplicate recovery or fleet maintenance mutations", () => {
    for (const forbidden of [
      "restEmployee",
      "refuelVehicle",
      "repairVehicle",
      "recallTeam",
      "team-member-rest-",
      "team-refuel-",
      "team-repair-",
    ]) {
      expect(teams).not.toContain(forbidden);
    }
  });

  test("team composition has a single owner in Teams", () => {
    expect(teams).toContain("optimizeEmployees");
    expect(teams).toContain("optimizeVehicles");
    expect(teams).toContain('data-testid="teams-optimize"');
    expect(teams).toContain('data-testid={`team-add-member-${t.id}`}');
    expect(teams).toContain('data-testid={`team-vehicle-select-${t.id}`}');

    expect(employees).not.toContain("assignEmployee");
    expect(employees).not.toContain('data-testid={`emp-team-select-${e.id}`}');
    expect(employees).not.toContain("unassignWeapon");
    expect(employees).not.toContain('data-testid={`emp-unassign-weapon-${e.id}`}');
    expect(fleet).not.toContain("assignVehicle");
    expect(fleet).not.toContain('data-testid={`vehicle-team-select-${v.id}`}');

    expect(weapons).toContain('data-testid={`weapon-employee-select-${w.id}`}');
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
    // Validate action ownership without coupling the test to the underlying
    // HTML tag. The HUD control is now rendered through the shadcn Button
    // primitive, but its public test id and navigation action stay unchanged.
    expect(gamePage).toContain('data-testid="available-missions-hud"');
    expect(gamePage).toContain('onClick={() => openFromNav("operations")}');

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


  test("reports recover non-zero statistics from persisted history", () => {
    expect(intel).toContain("terminalHistory");
    expect(intel).toContain('Math.max(Number(s.missions_total || 0), terminalHistory.length)');
    expect(intel).toContain("historyEarnedClean");
    expect(intel).toContain("historyEarnedDirty");
    expect(localGuest).toContain("_local_stats_version:3");
    expect(localGuest).toContain('maxStat("missions_total", terminal.length)');
  });


  test("retention features have one canonical UI owner", () => {
    const liveOps = read("components/game/LiveOpsDock.jsx");
    const commandCenter = read("components/game/CommandCenter.jsx");
    expect(gameContext).toContain('action("missions/decision"');
    expect(liveOps).toContain('data-testid="liveops-decision"');
    expect(liveOps).toContain("Não escolher nada mantém o plano original sem penalização.");

    // Para ti owns the three-horizon next-moves view.
    expect(forYou).toContain("state.retention?.next_moves");
    expect(forYou).toContain('title="Próximos movimentos"');
    expect(intel).not.toContain('data-testid="retention-roadmap"');
    expect(intel).not.toContain("retention?.next_moves");

    // Mundo owns the pulse surface. Operations may use the pulse modifier
    // contextually, but must not reproduce the full World card.
    expect(city).toContain('["pulse", "Pulso"');
    expect(opportunities).not.toContain('data-testid="world-pulse-card"');

    expect(intel).toContain('data-testid="organization-records"');
    expect(commandCenter).toContain('group: "Prioridades"');
    expect(localGuest).toContain('if(path==="missions/decision")');
    expect(localGuest).toContain("localWorldPulse");
  });

  test("navigation and panels do not expose duplicate legacy destinations", () => {
    expect(navigation).not.toContain('{ id:"management"');
    expect(navigation).not.toContain('{ id:"organization"');
    expect(navigation).not.toContain('{ id:"city"');
    expect(navigation).toContain('management: "hq"');
    expect(navigation).toContain('organization: "hq"');
    expect(navigation).toContain('city: "world"');

    expect(gamePage).not.toContain('data-testid="open-management-button"');
    expect(gamePage).not.toContain('openPanel === "management"');
    expect(gamePage).not.toContain('openPanel === "organization"');
    expect(gamePage).not.toContain('openPanel === "city"');

    expect(hq).not.toContain("Recomendações do consultor");
    expect(hq).not.toContain('onNavigate("organization")');
    expect(hq).not.toContain("Gestão avançada");
    expect(empire).not.toContain('data-testid="empire-level-card"');
    expect(empire).not.toContain('title="Quartel-general"');
    expect(hq).not.toContain('data-testid="hq-departments"');
  });

  test("unique advanced systems stay under their canonical owner", () => {
    expect(navigation).toContain('id:"teamops"');
    expect(navigation).toContain('id:"fleetcare"');
    expect(navigation).toContain('id:"weaponworkshop"');
    expect(navigation).toContain('id:"propertyinfra"');
    expect(navigation).toContain('id:"hqsystems"');

    expect(teams).toContain('data-testid="teams-open-doctrines"');
    expect(fleet).toContain('data-testid="fleet-open-lifecycle"');
    expect(weapons).toContain('data-testid="weapons-open-workshop"');
    expect(properties).toContain('data-testid="properties-open-infrastructure"');
    expect(hq).toContain('data-testid="hq-open-systems"');

    expect(gamePage).toContain('visibleTabs={["crew"]}');
    expect(gamePage).toContain('visibleTabs={["frota"]}');
    expect(gamePage).toContain('visibleTabs={["arsenal"]}');
    expect(gamePage).toContain('visibleTabs={["imoveis"]}');
    expect(gamePage).toContain('visibleTabs={["centro"]}');

    expect(organization).not.toContain("Centro Financeiro");
    expect(organization).not.toContain("Inteligência operacional");
    expect(organization).not.toContain("Auditoria recente");
    expect(organization).not.toContain("Gestão do Império");
  });

  test("Map and World are reliable primary navigation destinations", () => {
    expect(gamePage).toContain("world: true");
    expect(gamePage).toContain('testId="nav-map"');
    expect(gamePage).toContain("onClick={returnToMap}");
    expect(gamePage).toContain('testId="nav-group-world"');
    expect(gamePage).toContain('onClick={() => openFromNav("world")}');
    expect(gamePage).toContain('className="sub-bottom-nav-shell pointer-events-auto absolute left-1/2 z-[70]"');
    expect(gamePage).toMatch(/const openFromNav = \(panel\) => \{[\s\S]*?setCommandOpen\(false\);[\s\S]*?setSelectedOpp\(null\);[\s\S]*?setOpenPanel\(canonicalGamePanel\(panel\)\);/);
    expect(gamePage).toMatch(/const toggleNavGroup = \(group\) => \{[\s\S]*?setOpenPanel\(null\);[\s\S]*?setNavGroup/);
  });

  test("clickable management entities open exact individual dossiers", () => {
    expect(hud).toContain("EntityDetailBar");
    expect(hud).toContain("openEntityFromCard");

    expect(teams).toContain("selectedTeamId");
    expect(teams).toContain('testId="team-detail-bar"');
    expect(teams).toContain("data-entity-detail");

    expect(employees).toContain("selectedEmployeeId");
    expect(employees).toContain('testId="employee-detail-bar"');
    expect(employees).toContain("onOpenDetail");

    expect(fleet).toContain("selectedVehicleId");
    expect(fleet).toContain('testId="vehicle-detail-bar"');
    expect(fleet).toContain("data-entity-detail");

    expect(weapons).toContain("selectedWeaponId");
    expect(weapons).toContain('testId="weapon-detail-bar"');
    expect(weapons).toContain("data-entity-detail");

    expect(properties).toContain("selectedPropertyId");
    expect(properties).toContain('testId="property-detail-bar"');
    expect(properties).toContain("data-entity-detail");

    expect(city).toContain("selectedRivalId");
    expect(city).toContain('testId="rival-detail-bar"');
    expect(city).toContain("selectedBusinessId");
    expect(city).toContain('testId="business-detail-bar"');

    expect(teams).toContain('data-testid={`team-member-open-${m.id}`}');
    expect(teams).toContain('focusTestId: `employee-card-${m.id}`');
    expect(teams).toContain('data-testid={`team-vehicle-open-${vehicle.id}`}');
    expect(teams).toContain('focusTestId: `vehicle-card-${vehicle.id}`');
  });

  test("map entities drill directly into their exact dossier", () => {
    expect(gamePage).toContain('onSelectHQ={() => openFromNav("hq")}');
    expect(gamePage).toContain('focusTestId: `property-card-${property.id}`');
    expect(gamePage).toContain('focusTestId: `team-card-${teamId}`');
    expect(gamePage).toContain('focusTestId: `vehicle-card-${vehicleId}`');

    expect(liveMap).toContain("onSelectProperty && onSelectProperty(p)");
    expect(liveMap).toContain("onSelectTeam?.(mission.team_id)");
    expect(liveMap).toContain("onSelectVehicle?.(vehicle.id)");
  });

  test("World has one navigation surface", () => {
    expect(gamePage).not.toContain('data-testid="open-world-pulse"');
    expect(gamePage).not.toContain('data-testid="open-world-news"');
    expect(gamePage).not.toContain('data-testid="open-world-rivals"');
    expect(gamePage).not.toContain('data-testid="open-world-social"');
    expect(gamePage).toContain('testId="nav-group-world"');
    expect(city).toContain('["pulse", "Pulso"');
    expect(city).toContain('["news", "Notícias"');
    expect(city).toContain('["rivals", "Rivais"');
    expect(city).toContain('["social", "Rede"');
  });


});
