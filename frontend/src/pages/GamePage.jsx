import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useGame } from "../context/GameContextV2";
import { useSettings } from "../context/SettingsContext";
import LiveMap, { MapLegend, PlacementControls, MapBaseFilter } from "../components/game/LiveMap";
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
import { ActivityFeed, ActivityFeedMobile } from "../components/game/ActivityFeed";
import HQOnboarding from "../components/game/HQOnboarding";
import { DisclaimerModal } from "../components/game/DisclaimerModal";
import { FpsMeter } from "../components/game/FpsMeter";
import { Tip } from "../components/game/hud";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { fmtMoney, orgAlerts, teamsReadiness, opportunityReachable, NOTIFY_COLOR } from "../lib/game";
import { initialGamePanel, useGameShell } from "../hooks/useGameShell";
import { Building2, Users, IdCard, Car, Warehouse, BrainCircuit, Target, Loader2, Settings, AlertTriangle, Swords, Crosshair, ShoppingBag, Search, WifiOff, RefreshCw, Radar, Star, Vault } from "lucide-react";

export default function GamePage() {
  const { state, stateError, catalog, refresh, serverNow, lastSyncAt, autoOpenReportSignal, placement } = useGame();
  const settings = useSettings();
  const { hideImpossibleMissions, showFps, focusMode } = settings;
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [openPanel, setOpenPanel] = useState(initialGamePanel);
  const [commandOpen, setCommandOpen] = useState(false);
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
    setOpenPanel(panel);
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
  const tr = teamsReadiness(state);
  const p = state.player;
  const wantedStars = state.street?.wanted?.stars || 0;
  const empireAlert = p.heat >= 70 || p.dirty_money >= 15000;

  const hrTipParts = [];
  if (alerts.injured) hrTipParts.push(`${alerts.injured} ferido(s)`);
  if (alerts.arrested) hrTipParts.push(`${alerts.arrested} preso(s)`);
  if (alerts.exhausted) hrTipParts.push(`${alerts.exhausted} exausto(s)`);
  if (alerts.nearExhausted) hrTipParts.push(`${alerts.nearExhausted} perto da exaustão`);
  if (alerts.betrayal) hrTipParts.push(`${alerts.betrayal} risco de traição`);
  if (alerts.payrollShort) hrTipParts.push("fundos insuficientes para os salários");
  else if (alerts.payrollDueSoon) hrTipParts.push("salários por pagar em breve");
  const fleetTipParts = [];
  if (alerts.lowFuel) fleetTipParts.push(`${alerts.lowFuel} sem combustível`);
  if (alerts.damaged) fleetTipParts.push(`${alerts.damaged} avariado(s)`);
  if (alerts.nearBreakdown) fleetTipParts.push(`${alerts.nearBreakdown} perto de avariar`);
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

  return (
    <div data-testid="game-page" className="fixed inset-0 overflow-hidden bg-background">
      <LiveMap
        state={mapState}
        serverNow={serverNow}
        selectedOppId={selectedOpp?.id}
        onSelectOpp={(opp) => setSelectedOpp(opp)}
        onSelectHQ={() => setOpenPanel("hq")}
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
          className="lus-optional-hud pointer-events-auto absolute left-2 top-16 z-20 rounded-xl border border-amber-500/25 bg-black/85 px-3 py-2 shadow-xl backdrop-blur"
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
          <span className="mt-1 block font-mono text-[8px] font-bold uppercase tracking-wider text-red-300">
            Polícia em alerta
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
      <Tip
        tip={alerts.total > 0 ? `Central de Inteligência — ${alerts.total} alerta(s) e ações recomendadas, estatísticas e registo de missões.` : "Central de Inteligência — estatísticas, ações recomendadas e registo de missões."}
        side="bottom"
        align="end"
        className="lus-optional-hud pointer-events-auto absolute right-2 top-16 z-20"
      >
        <Button
          data-testid="open-intel-button"
          variant="outline"
          onClick={() => setOpenPanel("intel")}
          className="lus-hud-btn relative h-auto gap-1.5 rounded-full p-2.5 text-white hover:text-white md:px-3"
        >
          <BrainCircuit size={16} className="h-[18px] w-[18px] text-primary md:h-4 md:w-4" />
          <span className="hidden font-mono text-[10px] font-bold uppercase tracking-wider md:inline">Intel</span>
          {alerts.total > 0 && (
            <Badge data-testid="intel-alert-badge" className="rounded-full px-1.5 py-0 font-mono text-[10px] font-bold" style={{ background: NOTIFY_COLOR }}>{alerts.total}</Badge>
          )}
        </Button>
      </Tip>
      <Tip tip="Definições — conta, interface, automatizações e notificações." side="bottom" align="end" className="lus-optional-hud pointer-events-auto absolute right-2 top-32 z-20">
        <Button
          data-testid="open-settings-button"
          variant="outline"
          onClick={() => setOpenPanel("settings")}
          className="lus-hud-btn h-auto gap-1.5 rounded-full p-2.5 text-white hover:text-white md:px-3"
        >
          <Settings size={16} className="h-[18px] w-[18px] text-zinc-400 md:h-4 md:w-4" />
          <span className="hidden font-mono text-[10px] font-bold uppercase tracking-wider md:inline">Definições</span>
        </Button>
      </Tip>
      <Tip tip="Centro de Comandos — pesquisa global e ações rápidas (Ctrl K ou /)." side="bottom" align="end" className="pointer-events-auto absolute right-2 top-48 z-20">
        <Button
          data-testid="open-command-center"
          variant="outline"
          onClick={() => setCommandOpen(true)}
          className="lus-hud-btn h-auto gap-1.5 rounded-full p-2.5 text-white hover:text-white md:px-3"
        >
          <Search size={16} className="h-[18px] w-[18px] text-sky-300 md:h-4 md:w-4" />
          <span className="hidden font-mono text-[10px] font-bold uppercase tracking-wider md:inline">Comandos</span>
          <kbd className="hidden rounded border border-white/10 bg-black/40 px-1 font-mono text-[8px] text-zinc-500 lg:inline">Ctrl K</kbd>
        </Button>
      </Tip>
      {/* Modo de colocação = modo focado: só o mapa e os controlos de colocação
          ficam visíveis; central, cartões, legenda, filtro e dock saem do
          caminho para nada tapar o Confirmar/Cancelar. */}
      {!placement && !focusMode && <ActivityFeed onNavigate={navigateTo} suppressed={!!selectedOpp} />}
      {!placement && !focusMode && <ActivityFeedMobile onNavigate={navigateTo} suppressed={!!selectedOpp} />}
      {selectedOpp && !placement && <OpportunityCard opp={selectedOpp} onClose={() => setSelectedOpp(null)} onNavigate={navigateTo} />}

      {!placement && !focusMode && <MapLegend />}
      {!placement && !focusMode && <MapBaseFilter value={baseFilter} onChange={setBaseFilter} />}
      <PlacementControls />

      {!placement && !focusMode && (
      <div
        className="pointer-events-auto absolute left-2 z-30 max-w-[calc(100vw-4rem)] md:left-1/2 md:max-w-none md:-translate-x-1/2"
        style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      >
      <div className="lus-dock flex items-center gap-0.5 overflow-x-auto rounded-2xl border px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-1 md:overflow-visible md:px-1.5">
        <HudButton
          testId="open-operations-button" shortcut="1" icon={Crosshair} label="Operações" color="text-sky-400"
          tip="Lista de todas as oportunidades no mapa — ordena por ETA, recompensa ou risco, filtra e despacha sem procurar pino a pino."
          active={openPanel === "operations"} onClick={() => setOpenPanel("operations")}
        />
        <HudButton
          testId="open-quests-button" shortcut="2" icon={Target} label="Missões" color="text-rose-400"
          alert={alerts.claimable > 0}
          tip={alerts.claimable > 0 ? `${alerts.claimable} recompensa(s) por reclamar — história, diárias e semanais.` : "Missões de história, diárias, semanais e alertas dinâmicos."}
          active={openPanel === "quests"} onClick={() => setOpenPanel("quests")}
        />
        <HudButton
          testId="open-empire-button" shortcut="3" icon={Building2} label="Império" color="text-red-500"
          alert={empireAlert}
          tip={empireAlert ? `Atenção: ${p.heat >= 70 ? `calor a ${Math.round(p.heat)}%` : ""}${p.heat >= 70 && p.dirty_money >= 15000 ? " · " : ""}${p.dirty_money >= 15000 ? `${fmtMoney(p.dirty_money)} sujos por lavar` : ""} — abre o Império para agir.` : "Visão geral da organização, lavagem de dinheiro e suborno à polícia."}
          active={openPanel === "empire"} onClick={() => setOpenPanel("empire")}
        />
        <HudButton
          testId="open-teams-button" shortcut="4" icon={Users} label="Equipas" color="text-cyan-400"
          alert={alerts.teams > 0}
          tip={`${tr.ready} equipa(s) prontas · ${tr.busy} em operação${alerts.teams > 0 ? ` · ${alerts.teams} com problemas (sem membros ou veículo)` : ""}. Coordenação de membros, veículos e despacho rápido.`}
          active={openPanel === "teams"} onClick={() => setOpenPanel("teams")}
        />
        <HudButton
          testId="open-employees-button" shortcut="5" icon={IdCard} label="Operacionais" color="text-emerald-400"
          tip={hrAlertCount > 0 ? `Efetivo precisa de atenção: ${hrTipParts.join(" · ")}.` : "Recrutar, treinar, promover e manter o efetivo leal."}
          active={openPanel === "employees"} onClick={() => setOpenPanel("employees")}
        />
        <HudButton
          testId="open-fleet-button" shortcut="6" icon={Car} label="Frota" color="text-amber-400"
          tip={fleetAlertCount > 0 ? `Frota precisa de atenção: ${fleetTipParts.join(" · ")}.` : "Abastecer, reparar, comprar e atribuir veículos às equipas."}
          active={openPanel === "fleet"} onClick={() => setOpenPanel("fleet")}
        />
        <HudButton
          testId="open-properties-button" shortcut="7" icon={Warehouse} label="Imóveis" color="text-purple-300"
          alert={alerts.raidRisk}
          tip={alerts.raidRisk ? "Risco de rusga policial aos laboratórios (calor ≥ 70%) — suborna a polícia ou aguenta o risco." : "Propriedades: capacidade, rendimento passivo e lavagem automática."}
          active={openPanel === "properties"} onClick={() => setOpenPanel("properties")}
        />
        <HudButton
          testId="open-weapons-button" shortcut="8" icon={Swords} label="Armamento" color="text-red-400"
          alert={weaponsDamaged > 0}
          tip={
            weaponsDamaged > 0
              ? `${weaponsDamaged} arma(s) avariada(s)${weaponsUnequipped > 0 ? ` · ${weaponsUnequipped} por atribuir` : ""}.`
              : weaponsUnequipped > 0
              ? `${weaponsUnequipped} arma(s) por atribuir.`
              : "Compra, repara, atribui e vende equipamento operacional."
          }
          active={openPanel === "weapons"} onClick={() => setOpenPanel("weapons")}
        />
        <HudButton
          testId="open-street-button" icon={Radar} label="Cidade" color="text-cyan-300"
          alert={wantedStars >= 3 || (state.street?.districts || []).some((district) => district.rival_pressure >= 70)}
          tip="Cidade Viva — nível de procurado, territórios, contactos, corridas, entregas e garagem clandestina."
          active={openPanel === "street"} onClick={() => setOpenPanel("street")}
        />
        <HudButton
          testId="open-mastermind-button" icon={Vault} label="Golpes" color="text-violet-300"
          alert={state.mastermind?.active_heist?.finale?.status === "ready" || state.mastermind?.bounty?.tier >= 3}
          tip="Mastermind — golpes por fases, preparações, mercado negro, caçadores rivais e caches de sinal."
          active={openPanel === "mastermind"} onClick={() => setOpenPanel("mastermind")}
        />
        <HudButton
          testId="open-shop-button" shortcut="9" icon={ShoppingBag} label="Loja" color="text-amber-300"
          tip="Acelerar tempo, cosméticos, VIP e slots extra — tudo pago em dinheiro do jogo."
          active={openPanel === "shop"} onClick={() => setOpenPanel("shop")}
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

const HudButton = ({ testId, icon: Icon, label, color, alert, active, tip, shortcut, onClick }) => (
  <Tip tip={tip} side="top">
    <Button
      data-testid={testId}
      variant="outline"
      onClick={onClick}
      className={`lus-hud-btn relative h-auto shrink-0 gap-1.5 rounded-full px-2.5 py-2.5 text-xs font-bold uppercase tracking-wider md:px-3 ${
        active
          ? "lus-hud-btn-active text-white hover:text-white"
          : "text-white hover:text-white"
      }`}
    >
      <Icon size={15} className={`${color} h-[17px] w-[17px] md:h-[15px] md:w-[15px]`} />
      <span className="hidden md:inline">{label}</span>
      {alert && (
        <span
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full"
          style={{ background: NOTIFY_COLOR, boxShadow: `0 0 6px ${NOTIFY_COLOR}` }}
        />
      )}
      {shortcut && (
        <kbd className="hidden rounded border border-white/10 bg-black/40 px-1 font-mono text-[8px] text-zinc-600 lg:inline">
          {shortcut}
        </kbd>
      )}
    </Button>
  </Tip>
);
