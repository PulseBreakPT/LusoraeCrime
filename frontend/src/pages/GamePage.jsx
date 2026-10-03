import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useGame } from "../context/GameContextV2";
import { useSettings } from "../context/SettingsContext";
import LiveMap, { MapLegend, PlacementControls } from "../components/game/LiveMap";
import { ResourceBar } from "../components/game/ResourceBar";
import { OpportunityCard } from "../components/game/OpportunityCard";
import OperationView from "../components/game/OperationView";
import { TeamsPanel } from "../components/game/TeamsPanel";
import { EmpirePanel } from "../components/game/EmpirePanel";
import { EmployeesPanel } from "../components/game/EmployeesPanel";
import { FleetPanel } from "../components/game/FleetPanel";
import { WeaponsPanel } from "../components/game/WeaponsPanel";
import { PropertiesPanel } from "../components/game/PropertiesPanel";
import { HQPanel } from "../components/game/HQPanel";
import { IntelPanel } from "../components/game/IntelPanel";
import { QuestsPanel } from "../components/game/QuestsPanel";
import { OpportunitiesPanel } from "../components/game/OpportunitiesPanel";
import { ShopPanel } from "../components/game/ShopPanel";
import { SettingsPanel } from "../components/game/SettingsPanel";
import { StreetPanel } from "../components/game/StreetPanel";
import { MastermindPanel } from "../components/game/MastermindPanel";
import { CommandCenter } from "../components/game/CommandCenter";
import { ActivityFeedMobile } from "../components/game/ActivityFeed";
import HQOnboarding from "../components/game/HQOnboarding";
import { DisclaimerModal } from "../components/game/DisclaimerModal";
import { FpsMeter } from "../components/game/FpsMeter";
import { Tip } from "../components/game/hud";
import { Button } from "../components/ui/button";
import { orgAlerts, opportunityReachable, NOTIFY_COLOR } from "../lib/game";
import { initialGamePanel, useGameShell } from "../hooks/useGameShell";
import { Building2, Users, IdCard, Car, Warehouse, BrainCircuit, Target, Loader2, Settings, AlertTriangle, Swords, Crosshair, ShoppingBag, Search, WifiOff, RefreshCw, Radar, Star, Vault, Landmark, Map as MapIcon, Menu as MenuIcon } from "lucide-react";

export default function GamePage() {
  const { state, stateError, catalog, refresh, serverNow, lastSyncAt, autoOpenReportSignal, placement } = useGame();
  const settings = useSettings();
  const { hideImpossibleMissions, showFps, focusMode } = settings;
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [openPanel, setOpenPanel] = useState(initialGamePanel);
  const [commandOpen, setCommandOpen] = useState(false);
  const [navGroup, setNavGroup] = useState(null);
  const [mapLegendOpen, setMapLegendOpen] = useState(false);
  const [hudAwake, setHudAwake] = useState(true);
  const shellAlerts = state ? orgAlerts(state) : { total: 0 };
  const { online, stale } = useGameShell({
    state,
    alerts: shellAlerts,
    openPanel,
    setOpenPanel,
    selectedOpp,
    setSelectedOpp,
    refresh,
    lastSyncAt,
    commandOpen,
    setCommandOpen,
    settings,
  });
  useEffect(() => {
    let timer = null;
    const wake = () => {
      setHudAwake(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setHudAwake(false), 5500);
    };
    const events = ["pointerdown", "touchstart", "keydown", "wheel"];
    events.forEach((name) => window.addEventListener(name, wake, { passive: true }));
    wake();
    return () => {
      if (timer) clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, wake));
    };
  }, []);

  const [questsFocusTab, setQuestsFocusTab] = useState(null);
  const [baseFilter, setBaseFilter] = useState("all");
  const [stamp, setStamp] = useState(null);
  // Câmara da Operação — id da missão cujo interior está a ser acompanhado.
  // Aberta por CustomEvent (marcador-alvo no mapa, botão na Central da rede,
  // cartão da oportunidade) para não acoplar esses componentes a esta página.
  const [operationId, setOperationId] = useState(null);
  const placementRef = useRef(placement);
  const promptedOpsRef = useRef(new Set());
  useEffect(() => { placementRef.current = placement; }, [placement]);
  useEffect(() => {
    const onOpen = (ev) => {
      if (!placementRef.current && ev.detail?.id) setOperationId(ev.detail.id);
    };
    window.addEventListener("lus:open-operation", onOpen);
    return () => window.removeEventListener("lus:open-operation", onOpen);
  }, []);
  // Missão terminou/desapareceu do estado → destruir a simulação interior.
  useEffect(() => {
    if (operationId && state && !state.missions.some((m) => m.id === operationId)) setOperationId(null);
  }, [state, operationId]);
  // Convite automático: quando uma equipa entra no alvo (janela de operação),
  // um toast com ação permite abrir a câmara sem procurar o marcador no mapa.
  useEffect(() => {
    if (!state) return;
    const nowMs = serverNow();
    for (const m of state.missions || []) {
      if (promptedOpsRef.current.has(m.id)) continue;
      if (m.outcome || m.phase === "returning" || m.phase === "done") { promptedOpsRef.current.add(m.id); continue; }
      if (nowMs >= Date.parse(m.arrive_at) && nowMs < Date.parse(m.finish_at)) {
        promptedOpsRef.current.add(m.id);
        toast(`${m.team_name} entrou no alvo`, {
          id: `op-cam-${m.id}`,
          description: `${m.opportunity?.name || "Operação"} — acompanha a equipa no interior.`,
          action: {
            label: "Abrir câmara",
            onClick: () => window.dispatchEvent(new CustomEvent("lus:open-operation", { detail: { id: m.id } })),
          },
        });
      }
    }
  }, [state, serverNow]);

  // Carimbo de confirmação de despacho — celebração breve (1.7s) no centro do
  // ecrã quando uma equipa é destacada. Disparado por CustomEvent para não
  // acoplar o OpportunityCard ao estado desta página.
  useEffect(() => {
    const onStamp = (ev) => setStamp({ team: ev.detail?.team || "Equipa", key: Date.now() });
    window.addEventListener("lus:dispatch-stamp", onStamp);
    return () => window.removeEventListener("lus:dispatch-stamp", onStamp);
  }, []);
  useEffect(() => {
    if (!stamp) return;
    const id = setTimeout(() => setStamp(null), 1700);
    return () => clearTimeout(id);
  }, [stamp]);

  // Ponto único de navegação a partir de eventos/registos — decide o painel a
  // abrir e, se o evento apontar para uma aba específica (ex.: uma decisão
  // pendente nas Missões), abre já nessa aba em vez da última usada.
  const navigateTo = (panel, opts) => {
    if (opts?.tab && panel === "quests") setQuestsFocusTab(opts.tab);
    setNavGroup(null);
    setMapLegendOpen(false);
    setOpenPanel(panel);
  };

  const openFromNav = (panel) => {
    setNavGroup(null);
    setMapLegendOpen(false);
    setOpenPanel(panel);
  };

  const toggleNavGroup = (group) => {
    setMapLegendOpen(false);
    setNavGroup((current) => (current === group ? null : group));
  };

  useEffect(() => {
    if (!selectedOpp || !state) return;
    const still = state.opportunities.find((o) => o.id === selectedOpp.id);
    if (!still) setSelectedOpp(null);
    else if (still !== selectedOpp) setSelectedOpp(still);
  }, [state, selectedOpp]);

  useEffect(() => {
    if (autoOpenReportSignal) setOpenPanel((prev) => prev || "intel");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenReportSignal]);

  if (!state) {
    if (stateError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="max-w-sm text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-3 font-mono text-xs uppercase tracking-[0.3em] text-zinc-500">Não foi possível ligar à rede</p>
            <p className="mt-2 text-sm text-zinc-400">{stateError}</p>
            <Button onClick={refresh} className="mt-4" data-testid="game-state-retry-button">
              Tentar novamente
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 font-mono text-xs uppercase tracking-[0.3em] text-zinc-500">A ligar à rede...</p>
        </div>
      </div>
    );
  }

  // Onboarding: conta nova ainda sem QG — o jogo só arranca depois de o
  // jogador escolher o local no mapa (POST /game/hq/place). Sem este guard,
  // o LiveMap rebentava com player.hq undefined ("reading 'lat'").
  if (state.hq_pending || !state.player?.hq) {
    return <HQOnboarding />;
  }

  const alerts = shellAlerts;
  const p = state.player;
  const wantedStars = state.street?.wanted?.stars || 0;
  const empireAlert = p.heat >= 70 || p.dirty_money >= 15000;

  const weaponsDamaged = (state.weapons || []).filter((w) => w.condition < 30).length;
  const weaponsUnequipped = (state.weapons || []).filter((w) => !w.employee_id).length;
  const hrAlertCount = alerts.hr + alerts.nearExhausted + (alerts.payrollShort ? 1 : alerts.payrollDueSoon ? 1 : 0);
  const fleetAlertCount = alerts.fleet + alerts.nearBreakdown;
  const mapState = hideImpossibleMissions
    ? { ...state, opportunities: state.opportunities.filter((o) => opportunityReachable(state, o, serverNow(), catalog)) }
    : state;

  // Missão com a câmara aberta + roster real (nome/especialização/patente) —
  // alimenta a IA por papéis da simulação interior. Calculado apenas quando a
  // câmara está aberta; o OperationView gera/destrói o interior ao montar/desmontar.
  const operationMission = operationId ? state.missions.find((m) => m.id === operationId) : null;
  let operationRoster = [];
  if (operationMission) {
    const byId = {};
    for (const e of state.employees || []) byId[e.id] = e;
    operationRoster = (operationMission.member_ids || [])
      .map((id) => byId[id])
      .filter(Boolean)
      .map((e) => ({ name: e.name, role_key: e.role_key, spec: e.spec, rank: e.rank }));
  }

  const hudPinned = Boolean(openPanel || selectedOpp || placement || commandOpen || operationId || navGroup || mapLegendOpen);

  return (
    <div
      data-testid="game-page"
      className={`fixed inset-0 overflow-hidden bg-background ${hudAwake || hudPinned ? "lus-hud-awake" : "lus-hud-idle"}`}
    >
      <LiveMap
        state={mapState}
        serverNow={serverNow}
        selectedOppId={selectedOpp?.id}
        onSelectOpp={(opp) => {
          setSelectedOpp(opp);
          if (!opp) setNavGroup(null);
          else {
            setNavGroup(null);
            setMapLegendOpen(false);
          }
        }}
        onSelectHQ={() => openFromNav("hq")}
        onSelectProperty={() => openFromNav("properties")}
        baseFilter={baseFilter}
      />
      <div className="lus-vignette" aria-hidden="true" />
      <div className="lus-grid" aria-hidden="true" />
      <div className="lus-hud-frame" aria-hidden="true">
        <span className="c-tl" /><span className="c-tr" /><span className="c-bl" /><span className="c-br" />
      </div>
      {stamp && (
        <div key={stamp.key} className="lus-stamp" aria-hidden="true" data-testid="dispatch-stamp">
          <div className="lus-stamp-box">
            <p className="font-display text-2xl font-bold uppercase tracking-[0.25em] text-emerald-400">Equipa destacada</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-200/70">{stamp.team} · em rota para o alvo</p>
          </div>
        </div>
      )}

      {!focusMode && <ResourceBar />}
      {!focusMode && showFps && <FpsMeter />}
      {!focusMode && wantedStars > 0 && (
        <button
          type="button"
          data-testid="wanted-stars-hud"
          onClick={() => setOpenPanel("street")}
          className="lus-optional-hud pointer-events-auto absolute left-2 top-14 z-20 rounded-full px-1.5 py-1"
          aria-label={`Nível de procurado: ${wantedStars} de 5 estrelas`}
        >
          <span className="flex gap-0.5">
            {[0, 1, 2, 3, 4].map((index) => (
              <Star
                key={index}
                size={13}
                className={index < wantedStars ? "fill-amber-400 text-amber-300" : "text-zinc-700"}
              />
            ))}
          </span>
        </button>
      )}
      {(!online || stale) && (
        <div
          role="status"
          data-testid="connection-banner"
          className="pointer-events-auto absolute left-1/2 top-2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-500/30 bg-black/90 px-3 py-1.5 font-mono text-[10px] text-amber-300 shadow-xl backdrop-blur"
        >
          {online ? <RefreshCw size={12} /> : <WifiOff size={12} />}
          <span>{online ? "Dados desatualizados" : "Sem ligação à internet"}</span>
          <button type="button" onClick={refresh} className="font-bold text-white underline underline-offset-2">
            Sincronizar
          </button>
        </div>
      )}
      {/* Modo de colocação = modo focado: só o mapa e os controlos de colocação
          ficam visíveis; central, cartões, legenda, filtro e dock saem do
          caminho para nada tapar o Confirmar/Cancelar. */}
      {!placement && !focusMode && <ActivityFeedMobile onNavigate={navigateTo} suppressed={!!selectedOpp} />}
      {selectedOpp && !placement && <OpportunityCard opp={selectedOpp} onClose={() => setSelectedOpp(null)} onNavigate={navigateTo} />}

      {!placement && !focusMode && (
        <MapLegend open={mapLegendOpen} onOpenChange={setMapLegendOpen} hideTrigger />
      )}
      <PlacementControls />

      {!placement && !focusMode && (
        <div
          className="pointer-events-auto absolute left-1/2 z-40 -translate-x-1/2"
          style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
        >
          {navGroup && (
            <div className="lus-nav-tray absolute bottom-full left-1/2 mb-2 w-[min(92vw,25rem)] -translate-x-1/2">
              {navGroup === "operations" && (
                <div className="grid grid-cols-3 gap-1">
                  <NavAction testId="open-operations-button" icon={Crosshair} label="Operações" color="text-sky-400" onClick={() => openFromNav("operations")} />
                  <NavAction testId="open-quests-button" icon={Target} label="Missões" color="text-rose-400" alert={alerts.claimable > 0} onClick={() => openFromNav("quests")} />
                  <NavAction testId="open-mastermind-button" icon={Vault} label="Golpes" color="text-violet-300" alert={state.mastermind?.active_heist?.finale?.status === "ready" || state.mastermind?.bounty?.tier >= 3} onClick={() => openFromNav("mastermind")} />
                </div>
              )}

              {navGroup === "organization" && (
                <div className="grid grid-cols-4 gap-1">
                  <NavAction testId="open-teams-button" icon={Users} label="Equipas" color="text-cyan-400" alert={alerts.teams > 0} onClick={() => openFromNav("teams")} />
                  <NavAction testId="open-employees-button" icon={IdCard} label="Operacionais" color="text-emerald-400" alert={hrAlertCount > 0} onClick={() => openFromNav("employees")} />
                  <NavAction testId="open-fleet-button" icon={Car} label="Frota" color="text-amber-400" alert={fleetAlertCount > 0} onClick={() => openFromNav("fleet")} />
                  <NavAction testId="open-weapons-button" icon={Swords} label="Armamento" color="text-red-400" alert={weaponsDamaged > 0 || weaponsUnequipped > 0} onClick={() => openFromNav("weapons")} />
                </div>
              )}

              {navGroup === "empire" && (
                <div className="grid grid-cols-3 gap-1">
                  <NavAction testId="open-empire-button" icon={Building2} label="Império" color="text-red-500" alert={empireAlert} onClick={() => openFromNav("empire")} />
                  <NavAction testId="open-properties-button" icon={Warehouse} label="Imóveis" color="text-purple-300" alert={alerts.raidRisk} onClick={() => openFromNav("properties")} />
                  <NavAction testId="open-hq-button" icon={Landmark} label="QG" color="text-zinc-200" onClick={() => openFromNav("hq")} />
                </div>
              )}

              {navGroup === "menu" && (
                <>
                  <div className="grid grid-cols-3 gap-1">
                    <NavAction testId="open-street-button" icon={Radar} label="Cidade" color="text-cyan-300" alert={wantedStars >= 3 || (state.street?.districts || []).some((district) => district.rival_pressure >= 70)} onClick={() => openFromNav("street")} />
                    <NavAction testId="open-intel-button" icon={BrainCircuit} label="Intel" color="text-red-400" alert={alerts.total > 0} onClick={() => openFromNav("intel")} />
                    <NavAction testId="open-shop-button" icon={ShoppingBag} label="Loja" color="text-amber-300" onClick={() => openFromNav("shop")} />
                    <NavAction testId="open-command-center" icon={Search} label="Pesquisar" color="text-sky-300" onClick={() => { setNavGroup(null); setCommandOpen(true); }} />
                    <NavAction testId="map-legend-toggle" icon={MapIcon} label="Legenda" color="text-zinc-300" active={mapLegendOpen} onClick={() => { setNavGroup(null); setMapLegendOpen((value) => !value); }} />
                    <NavAction testId="open-settings-button" icon={Settings} label="Definições" color="text-zinc-400" onClick={() => openFromNav("settings")} />
                  </div>

                  {(state.properties || []).length > 0 && (
                    <label className="mt-2 flex items-center gap-2 border-t border-white/[0.06] pt-2">
                      <span className="shrink-0 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">Base no mapa</span>
                      <select
                        data-testid="map-base-filter"
                        value={baseFilter}
                        onChange={(event) => {
                          setBaseFilter(event.target.value);
                          setNavGroup(null);
                        }}
                        className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/60 px-2 py-1.5 font-mono text-[10px] text-zinc-200 outline-none"
                      >
                        <option value="all">Todas</option>
                        <option value="hq">Quartel-General</option>
                        {(state.properties || []).map((property) => (
                          <option key={property.id} value={property.id}>{property.name}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </>
              )}
            </div>
          )}

          <div className="lus-dock flex items-center gap-3 px-1 py-1">
            <GroupButton
              testId="nav-group-operations"
              icon={Crosshair}
              label="Operações"
              color="text-sky-400"
              alert={alerts.claimable > 0 || state.mastermind?.active_heist?.finale?.status === "ready"}
              active={navGroup === "operations" || ["operations", "quests", "mastermind"].includes(openPanel)}
              onClick={() => toggleNavGroup("operations")}
            />
            <GroupButton
              testId="nav-group-organization"
              icon={Users}
              label="Organização"
              color="text-cyan-400"
              alert={alerts.teams > 0 || hrAlertCount > 0 || fleetAlertCount > 0 || weaponsDamaged > 0}
              active={navGroup === "organization" || ["teams", "employees", "fleet", "weapons"].includes(openPanel)}
              onClick={() => toggleNavGroup("organization")}
            />
            <GroupButton
              testId="nav-group-empire"
              icon={Building2}
              label="Império"
              color="text-red-400"
              alert={empireAlert || alerts.raidRisk}
              active={navGroup === "empire" || ["empire", "properties", "hq"].includes(openPanel)}
              onClick={() => toggleNavGroup("empire")}
            />
            <GroupButton
              testId="nav-group-menu"
              icon={MenuIcon}
              label="Menu"
              color="text-zinc-200"
              alert={alerts.total > 0 || wantedStars >= 3}
              active={navGroup === "menu" || ["street", "intel", "shop", "settings"].includes(openPanel) || commandOpen || mapLegendOpen}
              onClick={() => toggleNavGroup("menu")}
            />
          </div>
        </div>
      )}

      <StreetPanel open={openPanel === "street"} onOpenChange={(o) => setOpenPanel(o ? "street" : null)} />
      <MastermindPanel open={openPanel === "mastermind"} onOpenChange={(o) => setOpenPanel(o ? "mastermind" : null)} />
      <CommandCenter
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onNavigate={navigateTo}
        onSelectOpp={(opp) => { setSelectedOpp(opp); setOpenPanel(null); }}
      />
      <ShopPanel open={openPanel === "shop"} onOpenChange={(o) => setOpenPanel(o ? "shop" : null)} />
      <OpportunitiesPanel
        open={openPanel === "operations"}
        onOpenChange={(o) => setOpenPanel(o ? "operations" : null)}
        onSelectOpp={(o) => { setSelectedOpp(o); setOpenPanel(null); }}
      />
      <TeamsPanel open={openPanel === "teams"} onOpenChange={(o) => setOpenPanel(o ? "teams" : null)} onNavigate={navigateTo} />
      <QuestsPanel
        open={openPanel === "quests"}
        onOpenChange={(o) => setOpenPanel(o ? "quests" : null)}
        onNavigate={navigateTo}
        focusTab={questsFocusTab}
        onFocusTabConsumed={() => setQuestsFocusTab(null)}
      />
      <EmpirePanel open={openPanel === "empire"} onOpenChange={(o) => setOpenPanel(o ? "empire" : null)} onNavigate={navigateTo} />
      <EmployeesPanel open={openPanel === "employees"} onOpenChange={(o) => setOpenPanel(o ? "employees" : null)} onNavigate={navigateTo} />
      <FleetPanel open={openPanel === "fleet"} onOpenChange={(o) => setOpenPanel(o ? "fleet" : null)} onNavigate={navigateTo} />
      <PropertiesPanel open={openPanel === "properties"} onOpenChange={(o) => setOpenPanel(o ? "properties" : null)} onNavigate={navigateTo} />
      <WeaponsPanel open={openPanel === "weapons"} onOpenChange={(o) => setOpenPanel(o ? "weapons" : null)} onNavigate={navigateTo} />
      <HQPanel open={openPanel === "hq"} onOpenChange={(o) => setOpenPanel(o ? "hq" : null)} onNavigate={navigateTo} />
      <IntelPanel open={openPanel === "intel"} onOpenChange={(o) => setOpenPanel(o ? "intel" : null)} onNavigate={navigateTo} />
      <SettingsPanel open={openPanel === "settings"} onOpenChange={(o) => setOpenPanel(o ? "settings" : null)} />

      {/* Câmara da Operação — overlay tático do interior do alvo. O mapa
          continua montado e sincronizado por baixo (mesmos timestamps). */}
      {operationMission && (
        <OperationView
          mission={operationMission}
          roster={operationRoster}
          serverNow={serverNow}
          onClose={() => setOperationId(null)}
        />
      )}

      {/* Disclaimer de ficção — mostrado uma única vez por conta (primeira
          entrada; fonte de verdade: user.disclaimer_accepted no servidor),
          por cima de toda a UI (z-[130]); "Sim" regista o compromisso e
          liberta o jogo, "Não" leva a um ecrã de recusa com logout seguro. */}
      <DisclaimerModal />
    </div>
  );
}

const GroupButton = ({ testId, icon: Icon, label, color, alert, active, onClick }) => (
  <Tip tip={label} side="top">
    <Button
      data-testid={testId}
      variant="outline"
      onClick={onClick}
      aria-label={label}
      aria-expanded={active}
      className={`lus-hud-btn relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-0 ${active ? "lus-hud-btn-active" : ""}`}
    >
      <Icon size={19} className={color} />
      {alert && (
        <span
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full"
          style={{ background: NOTIFY_COLOR, boxShadow: `0 0 4px ${NOTIFY_COLOR}` }}
        />
      )}
    </Button>
  </Tip>
);

const NavAction = ({ testId, icon: Icon, label, color, alert, active, onClick }) => (
  <button
    type="button"
    data-testid={testId}
    onClick={onClick}
    className={`lus-nav-action relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-center ${active ? "is-active" : ""}`}
  >
    <Icon size={17} className={color} />
    <span className="max-w-full truncate font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-zinc-300">
      {label}
    </span>
    {alert && (
      <span
        className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full"
        style={{ background: NOTIFY_COLOR }}
      />
    )}
  </button>
);
