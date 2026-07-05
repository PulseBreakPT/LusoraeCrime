import { useEffect, useState } from "react";
import { useGame } from "../context/GameContext";
import { useSettings } from "../context/SettingsContext";
import LiveMap, { MapLegend } from "../components/game/LiveMap";
import { ResourceBar } from "../components/game/ResourceBar";
import { OpportunityCard } from "../components/game/OpportunityCard";
import { TeamsPanel } from "../components/game/TeamsPanel";
import { EmpirePanel } from "../components/game/EmpirePanel";
import { EmployeesPanel } from "../components/game/EmployeesPanel";
import { FleetPanel } from "../components/game/FleetPanel";
import { PropertiesPanel } from "../components/game/PropertiesPanel";
import { IntelPanel } from "../components/game/IntelPanel";
import { QuestsPanel } from "../components/game/QuestsPanel";
import { SettingsPanel } from "../components/game/SettingsPanel";
import { ActivityFeed, ActivityFeedMobile } from "../components/game/ActivityFeed";
import { Tip } from "../components/game/hud";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { fmtMoney, orgAlerts, teamsReadiness, opportunityReachable, NOTIFY_COLOR } from "../lib/game";
import { Building2, Users, IdCard, Car, Warehouse, BrainCircuit, Target, Loader2, Settings } from "lucide-react";

export default function GamePage() {
  const { state, serverNow, autoOpenReportSignal } = useGame();
  const { hideImpossibleMissions } = useSettings();
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [openPanel, setOpenPanel] = useState(null);

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
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 font-mono text-xs uppercase tracking-[0.3em] text-zinc-500">A ligar à rede...</p>
        </div>
      </div>
    );
  }

  const alerts = orgAlerts(state);
  const tr = teamsReadiness(state);
  const p = state.player;
  const empireAlert = p.heat >= 70 || p.dirty_money >= 15000;

  const hrTipParts = [];
  if (alerts.injured) hrTipParts.push(`${alerts.injured} ferido(s)`);
  if (alerts.arrested) hrTipParts.push(`${alerts.arrested} preso(s)`);
  if (alerts.exhausted) hrTipParts.push(`${alerts.exhausted} exausto(s)`);
  if (alerts.nearExhausted) hrTipParts.push(`${alerts.nearExhausted} perto da exaustão`);
  if (alerts.betrayal) hrTipParts.push(`${alerts.betrayal} risco de traição`);
  if (alerts.payrollDueSoon) hrTipParts.push("salários por pagar em breve");
  const fleetTipParts = [];
  if (alerts.lowFuel) fleetTipParts.push(`${alerts.lowFuel} sem combustível`);
  if (alerts.damaged) fleetTipParts.push(`${alerts.damaged} avariado(s)`);
  if (alerts.nearBreakdown) fleetTipParts.push(`${alerts.nearBreakdown} perto de avariar`);
  const hrAlertCount = alerts.hr + alerts.nearExhausted + (alerts.payrollDueSoon ? 1 : 0);
  const fleetAlertCount = alerts.fleet + alerts.nearBreakdown;
  const mapState = hideImpossibleMissions
    ? { ...state, opportunities: state.opportunities.filter((o) => opportunityReachable(state, o)) }
    : state;

  return (
    <div data-testid="game-page" className="fixed inset-0 overflow-hidden bg-background">
      <LiveMap
        state={mapState}
        serverNow={serverNow}
        selectedOppId={selectedOpp?.id}
        onSelectOpp={(opp) => setSelectedOpp(opp)}
      />

      <ResourceBar />
      <Tip
        tip={alerts.total > 0 ? `Central de Inteligência — ${alerts.total} alerta(s) e ações recomendadas, estatísticas e registo de missões.` : "Central de Inteligência — estatísticas, ações recomendadas e registo de missões."}
        side="bottom"
        align="end"
        className="pointer-events-auto absolute right-2 top-16 z-20"
      >
        <Button
          data-testid="open-intel-button"
          variant="outline"
          onClick={() => setOpenPanel("intel")}
          className="relative h-auto gap-1.5 rounded-full border-white/10 bg-black/80 p-2.5 text-white shadow-2xl backdrop-blur-xl hover:bg-black hover:text-white md:px-3"
        >
          <BrainCircuit size={16} className="text-primary" />
          <span className="hidden font-mono text-[10px] font-bold uppercase tracking-wider md:inline">Intel</span>
          {alerts.total > 0 && (
            <Badge data-testid="intel-alert-badge" className="rounded-full px-1.5 py-0 font-mono text-[10px] font-bold" style={{ background: NOTIFY_COLOR }}>{alerts.total}</Badge>
          )}
        </Button>
      </Tip>
      <Tip tip="Definições — conta, interface, automatizações e notificações." side="bottom" align="end" className="pointer-events-auto absolute right-2 top-32 z-20">
        <Button
          data-testid="open-settings-button"
          variant="outline"
          onClick={() => setOpenPanel("settings")}
          className="h-auto gap-1.5 rounded-full border-white/10 bg-black/80 p-2.5 text-white shadow-2xl backdrop-blur-xl hover:bg-black hover:text-white md:px-3"
        >
          <Settings size={16} className="text-zinc-400" />
          <span className="hidden font-mono text-[10px] font-bold uppercase tracking-wider md:inline">Definições</span>
        </Button>
      </Tip>
      <ActivityFeed onNavigate={setOpenPanel} />
      <ActivityFeedMobile onNavigate={setOpenPanel} />
      {selectedOpp && <OpportunityCard opp={selectedOpp} onClose={() => setSelectedOpp(null)} onNavigate={setOpenPanel} />}

      <MapLegend />

      <div
        className="pointer-events-auto absolute left-2 z-30 flex gap-1 md:left-1/2 md:-translate-x-1/2 md:gap-1.5"
        style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <HudButton
          testId="open-quests-button" icon={Target} label="Missões" color="text-rose-400"
          badge={alerts.claimable} badgeColor="#059669"
          alert={alerts.claimable > 0}
          tip={alerts.claimable > 0 ? `${alerts.claimable} recompensa(s) por reclamar — história, diárias e semanais.` : "Missões de história, diárias, semanais e alertas dinâmicos."}
          onClick={() => setOpenPanel("quests")}
        />
        <HudButton
          testId="open-empire-button" icon={Building2} label="Império" color="text-red-500"
          alert={empireAlert}
          tip={empireAlert ? `Atenção: ${p.heat >= 70 ? `calor a ${Math.round(p.heat)}%` : ""}${p.heat >= 70 && p.dirty_money >= 15000 ? " · " : ""}${p.dirty_money >= 15000 ? `${fmtMoney(p.dirty_money)} sujos por lavar` : ""} — abre o Império para agir.` : "Visão geral da organização, lavagem de dinheiro e suborno à polícia."}
          onClick={() => setOpenPanel("empire")}
        />
        <HudButton
          testId="open-teams-button" icon={Users} label="Equipas" color="text-cyan-400"
          badge={tr.busy} badgeColor="#0E7490"
          alert={alerts.teams > 0}
          tip={`${tr.ready} equipa(s) prontas · ${tr.busy} em operação${alerts.teams > 0 ? ` · ${alerts.teams} com problemas (sem membros ou veículo)` : ""}. Gestão de membros, veículos e despacho rápido.`}
          onClick={() => setOpenPanel("teams")}
        />
        <HudButton
          testId="open-employees-button" icon={IdCard} label="RH" color="text-emerald-400"
          badge={hrAlertCount} badgeColor={NOTIFY_COLOR}
          tip={hrAlertCount > 0 ? `Plantel precisa de atenção: ${hrTipParts.join(" · ")}.` : "Recrutar, treinar, promover e manter o plantel leal."}
          onClick={() => setOpenPanel("employees")}
        />
        <HudButton
          testId="open-fleet-button" icon={Car} label="Frota" color="text-amber-400"
          badge={fleetAlertCount} badgeColor="#D97706"
          tip={fleetAlertCount > 0 ? `Frota precisa de atenção: ${fleetTipParts.join(" · ")}.` : "Abastecer, reparar, comprar e atribuir veículos às equipas."}
          onClick={() => setOpenPanel("fleet")}
        />
        <HudButton
          testId="open-properties-button" icon={Warehouse} label="Imóveis" color="text-purple-300"
          alert={alerts.raidRisk}
          tip={alerts.raidRisk ? "Risco de rusga policial aos laboratórios (calor ≥ 70%) — suborna a polícia ou aguenta o risco." : "Propriedades: capacidade, rendimento passivo e lavagem automática."}
          onClick={() => setOpenPanel("properties")}
        />
      </div>

      <TeamsPanel open={openPanel === "teams"} onOpenChange={(o) => setOpenPanel(o ? "teams" : null)} onNavigate={setOpenPanel} />
      <QuestsPanel open={openPanel === "quests"} onOpenChange={(o) => setOpenPanel(o ? "quests" : null)} onNavigate={setOpenPanel} />
      <EmpirePanel open={openPanel === "empire"} onOpenChange={(o) => setOpenPanel(o ? "empire" : null)} onNavigate={setOpenPanel} />
      <EmployeesPanel open={openPanel === "employees"} onOpenChange={(o) => setOpenPanel(o ? "employees" : null)} onNavigate={setOpenPanel} />
      <FleetPanel open={openPanel === "fleet"} onOpenChange={(o) => setOpenPanel(o ? "fleet" : null)} onNavigate={setOpenPanel} />
      <PropertiesPanel open={openPanel === "properties"} onOpenChange={(o) => setOpenPanel(o ? "properties" : null)} onNavigate={setOpenPanel} />
      <IntelPanel open={openPanel === "intel"} onOpenChange={(o) => setOpenPanel(o ? "intel" : null)} onNavigate={setOpenPanel} />
      <SettingsPanel open={openPanel === "settings"} onOpenChange={(o) => setOpenPanel(o ? "settings" : null)} />
    </div>
  );
}

const HudButton = ({ testId, icon: Icon, label, color, badge, badgeColor = NOTIFY_COLOR, alert, tip, onClick }) => (
  <Tip tip={tip} side="top">
    <Button
      data-testid={testId}
      variant="outline"
      onClick={onClick}
      className="relative h-auto gap-1.5 rounded-full border-white/10 bg-black/80 px-2 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-2xl backdrop-blur-xl hover:bg-black hover:text-white md:px-3 md:py-2.5"
    >
      <Icon size={15} className={color} />
      <span className="hidden md:inline">{label}</span>
      {badge > 0 && (
        <Badge className="rounded-full px-1.5 py-0 font-mono text-[10px] font-bold" style={{ background: badgeColor }}>{badge}</Badge>
      )}
      {alert && (
        <span
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full"
          style={{ background: NOTIFY_COLOR, boxShadow: `0 0 6px ${NOTIFY_COLOR}` }}
        />
      )}
    </Button>
  </Tip>
);
