import { useGame } from "../../context/GameContextV2";
import { fmtMoney, SPEC_LABELS, chanceColor, sellValueOf } from "../../lib/game";
import { Tip, PanelKicker, PanelWatermark, EmptyState, SectionHeader } from "./hud";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription } from "../ui/alert";
import { BrainCircuit, Lightbulb, ArrowRight } from "lucide-react";

const OUTCOME_LABELS = { success: "Sucesso", partial: "Parcial", failure: "Falhou", police: "Polícia", recalled: "Cancelada" };
const OUTCOME_COLORS = { success: "#34D399", partial: "#38BDF8", failure: "#F59E0B", police: "#EF4444", recalled: "#8E8E93" };

const RecommendedActions = ({ onNavigate }) => {
  const { state } = useGame();
  const p = state.player;
  const recs = [];

  // SSS: uma recomendação por destino. Antes podiam aparecer 3–4 botões
  // "Abrir Operacionais" ou "Abrir Frota" ao mesmo tempo e ainda executar
  // lavagem/suborno diretamente fora do painel canónico do Império.
  const empireIssues = [];
  const bribeCost = Math.max(1000, Math.round(p.heat * 150));
  if (p.heat >= 40) {
    empireIssues.push(`calor ${Math.round(p.heat)}% · suborno ${fmtMoney(bribeCost)}`);
  }
  const dirtyCap = state.caps?.dirty_money?.max || 0;
  const dirtyNearCap = dirtyCap > 0 && p.dirty_money >= dirtyCap * 0.9;
  if (dirtyNearCap) {
    empireIssues.push(`cofre de sujo a ${Math.round((p.dirty_money / dirtyCap) * 100)}%`);
  } else if (p.dirty_money >= 15000) {
    empireIssues.push(`${fmtMoney(p.dirty_money)} sujos por gerir`);
  }
  if (empireIssues.length) {
    recs.push({
      id: "empire",
      text: empireIssues.join(" · "),
      action: "Abrir Império",
      run: () => onNavigate && onNavigate("empire"),
      can: true,
    });
  }

  const fleetIssues = [];
  const damaged = state.vehicles.filter((v) => v.condition < 50).length;
  const lowFuel = state.vehicles.filter((v) => v.fuel_l < v.tank_l * 0.25).length;
  if (damaged) fleetIssues.push(`${damaged} em mau estado`);
  if (lowFuel) fleetIssues.push(`${lowFuel} com pouco combustível`);
  if (fleetIssues.length) {
    recs.push({
      id: "fleet",
      text: `Frota: ${fleetIssues.join(" · ")}`,
      action: "Abrir Frota",
      run: () => onNavigate && onNavigate("fleet"),
      can: true,
    });
  }

  const employeeIssues = [];
  const tired = state.employees.filter((e) => e.fatigue > 60).length;
  const troubled = state.employees.filter((e) => e.status === "injured" || e.status === "arrested").length;
  const disloyal = state.employees.filter((e) => (e.betrayal_risk || 0) >= 25).length;
  if (tired) employeeIssues.push(`${tired} exausto(s)`);
  if (troubled) employeeIssues.push(`${troubled} ferido(s)/preso(s)`);
  if (disloyal) employeeIssues.push(`${disloyal} com risco de traição`);
  if (state.salary_total > 0 && p.clean_money < state.salary_total) {
    employeeIssues.push(`reserva salarial curta: ${fmtMoney(state.salary_total)}`);
  }
  if (employeeIssues.length) {
    recs.push({
      id: "employees",
      text: `Operacionais: ${employeeIssues.join(" · ")}`,
      action: "Abrir Operacionais",
      run: () => onNavigate && onNavigate("employees"),
      can: true,
    });
  }

  const teamIssues = [];
  const teamsNoVehicle = state.teams.filter((t) => !t.vehicle_id).length;
  const teamsNoMembers = state.teams.filter((t) => state.employees.every((e) => e.team_id !== t.id)).length;
  if (teamsNoVehicle) teamIssues.push(`${teamsNoVehicle} sem veículo`);
  if (teamsNoMembers) teamIssues.push(`${teamsNoMembers} sem membros`);
  if (teamIssues.length) {
    recs.push({
      id: "teams",
      text: `Equipas: ${teamIssues.join(" · ")}`,
      action: "Abrir Equipas",
      run: () => onNavigate && onNavigate("teams"),
      can: true,
    });
  }

  const claimable = (state.quests || []).filter((q) => q.status === "completed").length;
  if (claimable) {
    recs.push({
      id: "quests",
      text: `${claimable} recompensa(s) de objetivo por reclamar`,
      action: "Abrir Objetivos",
      run: () => onNavigate && onNavigate("quests"),
      can: true,
    });
  }

  const degraded = (state.properties || []).filter((pr) => (pr.condition ?? 100) < 50).length;
  if (degraded) {
    recs.push({
      id: "properties",
      text: `${degraded} imóvel(is) degradado(s) — manutenção em atraso`,
      action: "Abrir Imóveis",
      run: () => onNavigate && onNavigate("properties"),
      can: true,
    });
  }

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
        <div className="space-y-1.5">
          {recs.map((r) => (
            <Card key={r.id} data-testid={`intel-rec-${r.id}`} className="flex items-center justify-between gap-2 lus-card px-3 py-2 shadow-none">
              <p className="min-w-0 text-[11px] leading-snug text-zinc-300">{r.text}</p>
              <Button
                data-testid={`intel-rec-action-${r.id}`}
                variant="outline" size="sm"
                onClick={r.run}
                disabled={!r.can}
                className="h-auto shrink-0 gap-1 border-white/15 px-2 py-1 font-mono text-[10px] font-bold text-cyan-300 hover:bg-white/10"
              >
                {r.action} <ArrowRight size={10} />
              </Button>
            </Card>
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
  const total = s.missions_total || 0;
  const successes = s.missions_success || 0;
  const partials = s.missions_partial || 0;
  const successRate = total ? Math.round(((successes + partials) / total) * 100) : null;


  const vehs = state.vehicles;

  const pt = catalog?.property_types || {};
  const fleetValue = vehs.reduce((a, v) => a + sellValueOf(v), 0);
  const propValue = state.properties.reduce((a, p) => a + (pt[p.type_key] ? Math.round(pt[p.type_key].price * 0.7 * p.level) : 0), 0);
  const netWorth = state.player.clean_money + state.player.dirty_money + fleetValue + propValue;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto lus-panel">
        <SheetHeader>
          <PanelWatermark icon={BrainCircuit} />
          <PanelKicker>Rede · Relatórios</PanelKicker>
          <SheetTitle className="flex items-center gap-2 text-white">
            <BrainCircuit size={18} className="text-primary" /> Relatórios
          </SheetTitle>
          <SheetDescription className="text-zinc-500">Alertas acionáveis, resumo essencial e histórico da organização.</SheetDescription>
        </SheetHeader>

        <RecommendedActions onNavigate={onNavigate} />

        <Section title="Resumo de operações" testId="intel-operations">
          <Grid>
            <Cell label="Operações" value={total} tip="Total de operações concluídas. Sucessos, parciais, falhas e interceções passam a formar categorias exclusivas." />
            <Cell label="Taxa de êxito" value={successRate === null ? "—" : `${successRate}%`}
                  color={successRate === null ? undefined : chanceColor(successRate / 100)}
                  tip="Percentagem de operações que terminaram com sucesso total ou parcial." />
            <Cell label="Sucessos" value={successes} color="#34D399" tip="Operações concluídas com sucesso e com regresso seguro ao QG." />
            <Cell label="Parciais" value={partials} color="#38BDF8" tip="Operações em que a equipa salvou parte do objetivo e regressou ao QG." />
            <Cell label="Falhadas" value={s.missions_failure || 0} color="#F59E0B" tip="Operações falhadas — sem recompensa e com possíveis ferimentos." />
            <Cell label="Interceções" value={s.missions_police || 0} color="#EF4444" tip="Operações terminadas em interceção policial, incluindo equipas apanhadas no regresso." />
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
            <Cell label="Ganho sujo" value={fmtMoney(s.earned_dirty || 0)} color="#F59E0B" tip="Total de dinheiro sujo ganho em operações desde o início." />
            <Cell label="Ganho limpo" value={fmtMoney(s.earned_clean || 0)} color="#10B981" tip="Total de dinheiro limpo ganho diretamente em operações." />
            <Cell label="Lavado total" value={fmtMoney(s.laundered_total || 0)} color="#34D399" tip="Total convertido de sujo para limpo (manual e passivo)." />
            <Cell label="Multas/Apreensões" value={fmtMoney(s.fines_paid || 0)} color="#EF4444" tip="Dinheiro perdido para a polícia em multas e apreensões." />
            <Cell label="Fortuna total" value={fmtMoney(netWorth)} tip="Caixa (limpo + sujo) + valor de revenda da frota e do património." />
            <Cell label="Salários/semana" value={fmtMoney(state.salary_total || 0)} color="#F59E0B" tip="Salários brutos atuais. O fecho de custos fixos acontece à segunda-feira, às 20:00." />
          </Grid>
        </Section>

        

        

        

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
                <Card key={m.id} className="flex items-center justify-between lus-card px-2.5 py-1.5 shadow-none">
                  <div>
                    <p className="text-xs font-semibold text-white">
                      {m.opportunity.name} <span className="font-mono text-[9px] text-zinc-500">{m.opportunity.district}</span>
                    </p>
                    <p className="font-mono text-[10px] text-zinc-500">
                      {m.team_name}
                      {m.success_chance != null && <> · prob. {Math.round(m.success_chance * 100)}%</>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[10px] font-bold uppercase" style={{ color: OUTCOME_COLORS[outcome] || "#8E8E93" }}>
                      {OUTCOME_LABELS[outcome] || outcome}
                    </p>
                    {(outcome === "success" || outcome === "partial") && paidReward > 0 && (
                      <p className={`font-mono text-[10px] ${outcome === "success" ? "text-emerald-400" : "text-sky-400"}`}>
                        +{fmtMoney(paidReward)}
                      </p>
                    )}
                  </div>
                </Card>
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

const Grid = ({ children }) => <div className="grid grid-cols-2 gap-2">{children}</div>;

const Cell = ({ label, value, color = "#FFFFFF", tip }) => (
  <Tip tip={tip} block>
    <Card className="h-full lus-card p-2.5 shadow-none">
      <p className="text-[9px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-bold" style={{ color }}>{value}</p>
    </Card>
  </Tip>
);
