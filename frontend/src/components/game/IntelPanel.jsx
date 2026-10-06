import { Button } from "../ui/button";
import { useGame } from "../../context/GameContextV2";
import { fmtMoney, SPEC_LABELS, chanceColor, sellValueOf } from "../../lib/game";
import { Tip, PanelWatermark, EmptyState, SectionHeader } from "./hud";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription } from "../ui/alert";
import { BrainCircuit, Lightbulb, ArrowRight, Crosshair, Trophy, Fuel, AlertTriangle } from "lucide-react";

const OUTCOME_LABELS = { success: "Sucesso", partial: "Parcial", failure: "Falhou", police: "Polícia", recalled: "Cancelada" };
const OUTCOME_COLORS = { success: "#34D399", partial: "#38BDF8", failure: "#F59E0B", police: "#EF4444", recalled: "#8E8E93" };

const questTabFor = (quest) => {
  if (quest?.type === "principal") return "historia";
  if (quest?.type === "diaria") return "diarias";
  if (quest?.type === "semanal") return "semanais";
  return "alertas";
};

const RetentionRoadmap = ({ onNavigate }) => {
  const { state } = useGame();
  const moves = state?.retention?.next_moves || [];
  if (!moves.length) return null;

  const horizonLabel = {
    agora: "AGORA",
    sessao: "ESTA SESSÃO",
    plano: "PRÓXIMO PASSO",
  };

  return (
    <div className="mt-4" data-testid="retention-roadmap">
      <SectionHeader icon={Crosshair} title="Próximos movimentos" meta="3 horizontes" />
      <div className="space-y-1.5">
        {moves.map((move) => {
          const pct = Math.max(0, Math.min(100, Number(move.progress?.pct || 0)));
          return (
            <Button variant="bare" size="bare"
              key={move.id}
              type="button"
              data-testid={`retention-move-${move.id}`}
              onClick={() => onNavigate && onNavigate(move.panel, move.focus_test_id ? { focusTestId: move.focus_test_id } : undefined)}
              className="block min-h-16 w-full rounded-lg border border-white/[0.07] bg-black/20 p-2.5 text-left transition-colors hover:border-white/15 hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/45"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                  {horizonLabel[move.horizon] || move.horizon}
                </span>
                <span className="font-mono text-[10px] tabular-nums text-zinc-600">
                  {Math.round(pct)}%
                </span>
              </span>
              <span className="mt-1 block text-[11px] font-bold text-white">{move.title}</span>
              <span className="mt-0.5 block text-[10px] leading-relaxed text-zinc-500">{move.description}</span>
              <span className="mt-2 block h-1 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true">
                <span
                  className="block h-full rounded-full bg-red-500/75 transition-[width]"
                  style={{ width: `${pct}%` }}
                />
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
};

const LatestReturnSummary = ({ onNavigate }) => {
  const { state } = useGame();
  const latest=(state?.history || []).find((mission)=>["success","partial","failure","police"].includes(
    mission.chase_outcome === "caught" ? "police" : mission.outcome
  ));
  if(!latest) return null;
  const outcome=latest.chase_outcome === "caught" ? "police" : latest.outcome;
  const reward=Number(latest.pending_reward || 0);
  const fuelCost=Number(latest.fuel_cost || 0);
  const critical=(latest.top_negatives || [])[0];
  const eventCount=Array.isArray(latest.live_log) ? latest.live_log.length : 0;
  const nextMove=state?.retention?.next_moves?.[0] || null;
  return (
    <div className="mt-3" data-testid="latest-return-summary">
      <SectionHeader icon={ArrowRight} title="Último regresso" meta={OUTCOME_LABELS[outcome] || outcome} />
      <Card className="sub-card p-3 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{latest.opportunity?.name || "Operação"}</p>
            <p className="mt-0.5 font-mono text-[10px] text-zinc-500">{latest.team_name || "Equipa"} · {latest.opportunity?.district || "zona desconhecida"}</p>
          </div>
          <span className="shrink-0 font-mono text-[10px] font-bold uppercase" style={{color:OUTCOME_COLORS[outcome] || "#8E8E93"}}>
            {OUTCOME_LABELS[outcome] || outcome}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <div className="rounded-md border border-white/[0.06] bg-black/25 p-2">
            <p className="font-mono text-[9px] uppercase text-zinc-600">Ganho</p>
            <p className="mt-0.5 font-mono text-[11px] font-bold text-emerald-300">{reward>0?`+${fmtMoney(reward)}`:"0 €"}</p>
          </div>
          <div className="rounded-md border border-white/[0.06] bg-black/25 p-2">
            <p className="flex items-center gap-1 font-mono text-[9px] uppercase text-zinc-600"><Fuel size={9}/> Combustível</p>
            <p className="mt-0.5 font-mono text-[11px] font-bold text-amber-300">{fuelCost>0?`−${fmtMoney(fuelCost)}`:"—"}</p>
          </div>
          <div className="rounded-md border border-white/[0.06] bg-black/25 p-2">
            <p className="font-mono text-[9px] uppercase text-zinc-600">Chance inicial</p>
            <p className="mt-0.5 font-mono text-[11px] font-bold text-cyan-300">{latest.success_chance!=null?`${Math.round(Number(latest.success_chance)*100)}%`:"—"}</p>
          </div>
        </div>
        <div className="mt-2 rounded-md border border-white/[0.06] bg-black/20 p-2 text-[10px] leading-relaxed text-zinc-400">
          <p className="flex items-start gap-1.5"><AlertTriangle size={10} className="mt-0.5 shrink-0 text-zinc-500"/>
            <span>{critical ? `Fator crítico: ${critical.label} (${Math.round(Number(critical.pct||0)*100)}%).` : "Sem fator crítico negativo dominante no despacho."} {eventCount ? `Foram registados ${eventCount} eventos durante a operação.` : "Sem eventos adicionais registados."}</span>
          </p>
        </div>
        {nextMove && (
          <Button variant="bare" size="bare" type="button"
            onClick={()=>onNavigate && onNavigate(nextMove.panel, nextMove.focus_test_id ? {focusTestId:nextMove.focus_test_id} : undefined)}
            className="mt-2 flex w-full items-center justify-between rounded-md border border-white/[0.06] bg-white/[0.025] px-2.5 py-2 text-left hover:bg-white/[0.05]"
          >
            <span>
              <span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-600">Próximo passo</span>
              <span className="mt-0.5 block text-[10px] font-semibold text-zinc-200">{nextMove.title}</span>
            </span>
            <ArrowRight size={12} className="shrink-0 text-zinc-500"/>
          </Button>
        )}
      </Card>
    </div>
  );
};

const OrganizationRecords = () => {
  const { state } = useGame();
  const records = state?.retention?.records || [];
  if (!records.length) return null;

  const valueOf = (record) => {
    if (record.key === "best_mission") return fmtMoney(record.value);
    if (record.key === "clutch_success") return `${Number(record.value || 0).toLocaleString("pt-PT")}%`;
    if (record.key === "road_car") return `${Number(record.value || 0).toLocaleString("pt-PT")} km`;
    return Number(record.value || 0).toLocaleString("pt-PT");
  };

  return (
    <div className="mt-5" data-testid="organization-records">
      <SectionHeader icon={Trophy} title="Marcas da organização" meta={records.length} />
      <div className="grid grid-cols-2 gap-1.5">
        {records.map((record) => (
          <Card key={record.key} className="sub-card min-w-0 p-2.5 shadow-none">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-600">{record.label}</p>
            <p className="mt-1 truncate font-mono text-sm font-bold text-white">{valueOf(record)}</p>
            <p className="mt-0.5 truncate text-[10px] text-zinc-500">{record.detail}</p>
          </Card>
        ))}
      </div>
    </div>
  );
};

const RecommendedActions = ({ onNavigate }) => {
  const { state } = useGame();
  const p = state.player;
  const recs = [];
  const go = (panel, testId, extra = {}) =>
    onNavigate && onNavigate(panel, { ...extra, focusTestId: testId });

  const bribeCost = Math.max(1000, Math.round(p.heat * 150));
  if (p.heat >= 40) {
    recs.push({
      id: "empire-heat",
      text: `Calor a ${Math.round(p.heat)}% — suborno estimado em ${fmtMoney(bribeCost)}.`,
      action: "Ir ao suborno",
      run: () => go("empire", "bribe-police-button"),
      can: true,
    });
  }

  const dirtyCap = state.caps?.dirty_money?.max || 0;
  const dirtyNearCap = dirtyCap > 0 && p.dirty_money >= dirtyCap * 0.9;
  if (dirtyNearCap || p.dirty_money >= 15000) {
    recs.push({
      id: "empire-dirty",
      text: dirtyNearCap
        ? `Cofre de dinheiro sujo a ${Math.round((p.dirty_money / dirtyCap) * 100)}% — lava antes de atingir o limite.`
        : `${fmtMoney(p.dirty_money)} em dinheiro sujo por gerir.`,
      action: "Ir à lavagem",
      run: () => go("empire", "launder-amount-input"),
      can: true,
    });
  }

  state.vehicles.forEach((vehicle) => {
    const issues = [];
    if (vehicle.condition < 50) issues.push(`condição ${Math.round(vehicle.condition)}%`);
    if (vehicle.fuel_l < vehicle.tank_l * 0.25) {
      issues.push(`combustível ${Math.round((vehicle.fuel_l / Math.max(1, vehicle.tank_l)) * 100)}%`);
    }
    if (!issues.length) return;
    recs.push({
      id: `fleet-${vehicle.id}`,
      text: `${vehicle.name}: ${issues.join(" · ")}.`,
      action: "Ver veículo",
      run: () => go("fleet", `vehicle-card-${vehicle.id}`),
      can: true,
    });
  });

  state.employees.forEach((employee) => {
    const issues = [];
    if (employee.fatigue > 60) issues.push(`fadiga ${Math.round(employee.fatigue)}%`);
    if (employee.status === "injured") issues.push("ferido");
    if (employee.status === "arrested") issues.push("preso");
    if ((employee.betrayal_risk || 0) >= 25) issues.push(`risco de traição ${Math.round(employee.betrayal_risk)}%`);
    if (!issues.length) return;
    recs.push({
      id: `employee-${employee.id}`,
      text: `${employee.name}: ${issues.join(" · ")}.`,
      action: "Ver operacional",
      run: () => go("employees", `employee-card-${employee.id}`),
      can: true,
    });
  });

  if (state.salary_total > 0 && p.clean_money < state.salary_total) {
    recs.push({
      id: "employees-payroll",
      text: `Reserva salarial curta — precisas de ${fmtMoney(state.salary_total)} para os salários atuais.`,
      action: "Ver fecho",
      run: () => go("employees", "employee-payroll-card"),
      can: true,
    });
  }

  state.teams.forEach((team) => {
    const issues = [];
    if (!team.vehicle_id) issues.push("sem veículo");
    if (state.employees.every((employee) => employee.team_id !== team.id)) issues.push("sem membros");
    if (!issues.length) return;
    recs.push({
      id: `team-${team.id}`,
      text: `${team.name}: ${issues.join(" · ")}.`,
      action: "Ver equipa",
      run: () => go("teams", `team-card-${team.id}`),
      can: true,
    });
  });

  (state.quests || []).filter((quest) => quest.status === "completed").forEach((quest) => {
    recs.push({
      id: `quest-${quest.id || quest.quest_key}`,
      text: `${quest.name || "Objetivo concluído"} — recompensa pronta a reclamar.`,
      action: "Ver objetivo",
      run: () => go(
        "quests",
        `quest-card-${quest.id || quest.quest_key}`,
        { tab: questTabFor(quest) }
      ),
      can: true,
    });
  });

  (state.properties || []).filter((property) => (property.condition ?? 100) < 50).forEach((property) => {
    recs.push({
      id: `property-${property.id}`,
      text: `${property.name}: condição ${Math.round(property.condition ?? 100)}% — manutenção em atraso.`,
      action: "Ver imóvel",
      run: () => go("properties", `property-card-${property.id}`),
      can: true,
    });
  });

  return (
    <div className="mt-4" data-testid="intel-recommendations">
      <SectionHeader icon={Lightbulb} title="Ações recomendadas" meta={recs.length > 0 ? `${recs.length}` : null} />
      {recs.length === 0 ? (
        <Alert className="border-emerald-500/20 bg-emerald-500/5 py-2">
          <AlertDescription className="font-mono text-[11px] text-emerald-400">
            Tudo sob controlo. O império está a funcionar em pleno.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="sub-action-list overflow-hidden rounded-xl border border-white/[0.065]">
          {recs.map((r) => (
            <Button variant="bare" size="bare"
              key={r.id}
              type="button"
              data-testid={`intel-rec-${r.id}`}
              onClick={r.run}
              disabled={!r.can}
              aria-label={`${r.action}: ${r.text}`}
              title={`${r.action}: ${r.text}`}
              className="sub-action-row flex w-full items-center justify-between gap-2 rounded-none border-0 px-3 py-2.5 text-left shadow-none transition-colors hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500/45 disabled:opacity-45"
            >
              <span className="min-w-0 text-[11px] leading-snug text-zinc-300">{r.text}</span>
              <span
                data-testid={`intel-rec-action-${r.id}`}
                className="flex shrink-0 items-center gap-1 font-mono text-[10px] font-bold text-cyan-300"
              >
                {r.action} <ArrowRight size={10} />
              </span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};

export const IntelPanel = ({ open, onOpenChange, onNavigate }) => {
  const { state, catalog } = useGame();
  if (!state) return null;
  const s = state.player.stats || {};
  // Fallback defensivo: se um save antigo chegar com stats a zero, o próprio
  // histórico visível impede a UI de mentir enquanto a reconciliação V5 do
  // servidor reconstitui o histórico completo.
  const terminalHistory = (state.history || []).filter((mission) =>
    ["success", "partial", "failure", "police"].includes(
      mission.chase_outcome === "caught" ? "police" : mission.outcome
    )
  );
  const historyCount = (outcome) => terminalHistory.filter((mission) =>
    (mission.chase_outcome === "caught" ? "police" : mission.outcome) === outcome
  ).length;
  const total = Math.max(Number(s.missions_total || 0), terminalHistory.length);
  const successes = Math.max(Number(s.missions_success || 0), historyCount("success"));
  const partials = Math.max(Number(s.missions_partial || 0), historyCount("partial"));
  const failures = Math.max(Number(s.missions_failure || 0), historyCount("failure"));
  const police = Math.max(Number(s.missions_police || 0), historyCount("police"));
  const successRate = total ? Math.round(((successes + partials) / total) * 100) : null;

  const historyEarnedClean = terminalHistory.reduce((sum, mission) => {
    const outcome = mission.chase_outcome === "caught" ? "police" : mission.outcome;
    return outcome !== "police" && mission.pending_pays === "clean"
      ? sum + Number(mission.pending_reward || 0)
      : sum;
  }, 0);
  const historyEarnedDirty = terminalHistory.reduce((sum, mission) => {
    const outcome = mission.chase_outcome === "caught" ? "police" : mission.outcome;
    return outcome !== "police" && mission.pending_pays !== "clean"
      ? sum + Number(mission.pending_reward || 0)
      : sum;
  }, 0);
  const earnedClean = Math.max(Number(s.earned_clean || 0), historyEarnedClean);
  const earnedDirty = Math.max(Number(s.earned_dirty || 0), historyEarnedDirty);

  const vehs = state.vehicles;

  const pt = catalog?.property_types || {};
  const fleetValue = vehs.reduce((a, v) => a + sellValueOf(v), 0);
  const propValue = state.properties.reduce((a, p) => a + (pt[p.type_key] ? Math.round(pt[p.type_key].price * 0.7 * p.level) : 0), 0);
  const netWorth = state.player.clean_money + state.player.dirty_money + fleetValue + propValue;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sub-panel">
        <SheetHeader>
          <PanelWatermark icon={BrainCircuit} />
          <SheetTitle className="flex items-center gap-2 text-white">
            <BrainCircuit size={18} className="text-primary" /> Relatórios
          </SheetTitle>
          <SheetDescription className="text-zinc-500">Alertas acionáveis, resumo essencial e histórico da organização.</SheetDescription>
        </SheetHeader>

        <RecommendedActions onNavigate={onNavigate} />

        <LatestReturnSummary onNavigate={onNavigate} />

        <Section title="Resumo de operações" testId="intel-operations">
          <Grid>
            <Cell label="Operações" value={total} tip="Total de operações concluídas. Sucessos, parciais, falhas e interceções passam a formar categorias exclusivas." />
            <Cell label="Taxa de êxito" value={successRate === null ? "—" : `${successRate}%`}
                  color={successRate === null ? undefined : chanceColor(successRate / 100)}
                  tip="Percentagem de operações que terminaram com sucesso total ou parcial." />
            <Cell label="Sucessos" value={successes} color="#34D399" tip="Operações concluídas com sucesso e com regresso seguro ao QG." />
            <Cell label="Parciais" value={partials} color="#38BDF8" tip="Operações em que a equipa salvou parte do objetivo e regressou ao QG." />
            <Cell label="Falhadas" value={failures} color="#F59E0B" tip="Operações falhadas — sem recompensa e com possíveis ferimentos." />
            <Cell label="Interceções" value={police} color="#EF4444" tip="Operações terminadas em interceção policial, incluindo equipas apanhadas no regresso." />
          </Grid>
          {(() => {
            const milestones = catalog?.achievement_milestones || [];
            const perMilestone = catalog?.achievement_bonus_pct_per_milestone || 0;
            if (!milestones.length) return null;
            const successes = s.missions_success || 0;
            const bonusPct = Math.round((state.player.achievement_bonus_pct || 0) * 100);
            const next = milestones.find((m) => successes < m);
            return (
              <Tip
                tip={`Marcos de reputação: cada ${milestones.join("/")} operações bem-sucedidas dá +${Math.round(perMilestone * 100)}% permanente a todas as recompensas. Tens ${successes} sucessos.`}
                block
              >
                <div className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5" data-testid="intel-achievements">
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-amber-300">Bónus permanente de recompensas</span>
                    <span className="font-mono text-xs font-bold text-amber-300">+{bonusPct}%</span>
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-zinc-500">
                    {next
                      ? <>Próximo marco: {next} sucessos — faltam <span className="text-white">{next - successes}</span> para +{Math.round(perMilestone * 100)}%</>
                      : "Todos os marcos atingidos — bónus máximo."}
                  </p>
                </div>
              </Tip>
            );
          })()}
          {Object.keys(s.by_category || {}).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.entries(s.by_category).map(([cat, n]) => (
                <Badge key={cat} variant="outline" className="border-transparent bg-white/5 px-1.5 py-0.5 font-mono text-[10px] font-normal text-zinc-400">
                  {SPEC_LABELS[cat] || cat}: <span className="text-white">{n}</span>
                </Badge>
              ))}
            </div>
          )}
        </Section>

        <Section title="Resumo financeiro" testId="intel-economy">
          <Grid>
            <Cell label="Ganho sujo" value={fmtMoney(earnedDirty)} color="#F59E0B" tip="Total de dinheiro sujo ganho em operações desde o início." />
            <Cell label="Ganho limpo" value={fmtMoney(earnedClean)} color="#10B981" tip="Total de dinheiro limpo ganho diretamente em operações." />
            <Cell label="Lavado total" value={fmtMoney(s.laundered_total || 0)} color="#34D399" tip="Total convertido de sujo para limpo (manual e passivo)." />
            <Cell label="Multas/Apreensões" value={fmtMoney(s.fines_paid || 0)} color="#EF4444" tip="Dinheiro perdido para a polícia em multas e apreensões." />
            <Cell label="Fortuna total" value={fmtMoney(netWorth)} tip="Caixa (limpo + sujo) + valor de revenda da frota e do património." />
            <Cell label="Salários/semana" value={fmtMoney(state.salary_total || 0)} color="#F59E0B" tip="Salários brutos atuais. O fecho de custos fixos acontece à segunda-feira, às 20:00." />
          </Grid>
        </Section>

        

        

        

        <RetentionRoadmap onNavigate={onNavigate} />
        <OrganizationRecords />

        <Section title="Histórico" testId="intel-history">
          {state.history.length === 0 && (
            <EmptyState
              title="Historial em branco"
              sub="As primeiras operações concluídas escrevem-se aqui — seleciona um alvo no mapa e despacha uma equipa."
              testId="intel-history-empty"
            />
          )}
          <div className="space-y-1">
            {state.history.map((m) => {
              const outcome = m.chase_outcome === "caught" ? "police" : m.outcome;
              const paidReward = Number(m.pending_reward || 0);
              return (
                <Button variant="bare" size="bare"
                  key={m.id}
                  type="button"
                  data-testid={`intel-history-row-${m.id}`}
                  onClick={() => onNavigate && onNavigate("teams", { focusTestId: `team-card-${m.team_id}` })}
                  title={`Abrir ${m.team_name} e destacar a equipa deste relatório`}
                  className="block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/45"
                >
                  <Card className="flex flex-col items-stretch gap-2 sub-card px-2.5 py-2 shadow-none transition-colors hover:border-white/20 hover:bg-white/[0.035] sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold text-white">
                        {m.opportunity.name} <span className="font-mono text-[10px] text-zinc-500">{m.opportunity.district}</span>
                      </p>
                      <p className="font-mono text-[10px] text-zinc-500">
                        {m.team_name}
                        {m.success_chance != null && <> · prob. {Math.round(m.success_chance * 100)}%</>}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-left sm:justify-end sm:text-right">
                      <div>
                        <p className="font-mono text-[10px] font-bold uppercase" style={{ color: OUTCOME_COLORS[outcome] || "#8E8E93" }}>
                          {OUTCOME_LABELS[outcome] || outcome}
                        </p>
                        {(outcome === "success" || outcome === "partial") && paidReward > 0 && (
                          <p className={`font-mono text-[10px] ${outcome === "success" ? "text-emerald-400" : "text-sky-400"}`}>
                            +{fmtMoney(paidReward)}
                          </p>
                        )}
                      </div>
                      <ArrowRight size={12} className="shrink-0 text-zinc-600" />
                    </div>
                  </Card>
                </Button>
              );
            })}
          </div>
        </Section>

      </SheetContent>
    </Sheet>
  );
};

const Section = ({ title, testId, children }) => (
  <div className="mt-6" data-testid={testId}>
    <SectionHeader title={title} />
    {children}
  </div>
);

const Grid = ({ children }) => <div className="sub-kpi-grid grid grid-cols-2 overflow-hidden rounded-xl border border-white/[0.065]">{children}</div>;

const Cell = ({ label, value, color = "#FFFFFF", tip }) => (
  <Tip tip={tip} block>
    <Card className="sub-kpi-cell h-full rounded-none border-0 sub-card p-2.5 shadow-none">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-bold" style={{ color }}>{value}</p>
    </Card>
  </Tip>
);
