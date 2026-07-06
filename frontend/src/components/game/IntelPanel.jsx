import { useGame } from "../../context/GameContextV2";
import { fmtMoney, SPEC_LABELS, chanceColor, sellValueOf } from "../../lib/game";
import { Tip } from "./hud";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription } from "../ui/alert";
import { BrainCircuit, Lightbulb, ArrowRight } from "lucide-react";

const OUTCOME_LABELS = { success: "Sucesso", failure: "Falhou", police: "Polícia", recalled: "Cancelada" };
const OUTCOME_COLORS = { success: "#34D399", failure: "#F59E0B", police: "#EF4444", recalled: "#8E8E93" };

const RecommendedActions = ({ onNavigate }) => {
  const { state, bribePolice, launder } = useGame();
  const p = state.player;
  const recs = [];
  const bribeCost = Math.max(1000, Math.round(p.heat * 150));
  if (p.heat >= 40) {
    recs.push({
      id: "bribe", text: `Calor a ${Math.round(p.heat)}% — a polícia aproxima-se`,
      action: `Subornar · ${fmtMoney(bribeCost)}`, run: () => bribePolice(), can: p.clean_money >= bribeCost,
    });
  }
  const dirtyCap = state.caps?.dirty_money?.max || 0;
  const dirtyNearCap = dirtyCap > 0 && p.dirty_money >= dirtyCap * 0.9;
  if (dirtyNearCap) {
    // Prioridade sobre o aviso genérico de lavagem: aqui há produção dos
    // laboratórios a ser deitada fora em tempo real.
    recs.push({
      id: "dirtycap", text: `Cofre de sujo a ${Math.round((p.dirty_money / dirtyCap) * 100)}% (${fmtMoney(p.dirty_money)}/${fmtMoney(dirtyCap)}) — produção a ser desperdiçada`,
      action: `Lavar tudo (+${fmtMoney(Math.floor(p.dirty_money * 0.75))})`, run: () => launder(p.dirty_money), can: true,
    });
  } else if (p.dirty_money >= 15000) {
    recs.push({
      id: "launder", text: `${fmtMoney(p.dirty_money)} sujos no cofre — um alvo apetecível`,
      action: `Lavar tudo (+${fmtMoney(Math.floor(p.dirty_money * 0.75))})`, run: () => launder(p.dirty_money), can: true,
    });
  }
  const damaged = state.vehicles.filter((v) => v.condition < 50).length;
  if (damaged) recs.push({ id: "fleet", text: `${damaged} veículo(s) em mau estado`, action: "Abrir Frota", run: () => onNavigate && onNavigate("fleet"), can: true });
  const lowFuel = state.vehicles.filter((v) => v.fuel_l < v.tank_l * 0.25).length;
  if (lowFuel) recs.push({ id: "fuel", text: `${lowFuel} veículo(s) quase sem combustível`, action: "Abrir Frota", run: () => onNavigate && onNavigate("fleet"), can: true });
  const tired = state.employees.filter((e) => e.fatigue > 60).length;
  if (tired) recs.push({ id: "rest", text: `${tired} operacional(is) exaustos — vão falhar operações`, action: "Abrir Operacionais", run: () => onNavigate && onNavigate("employees"), can: true });
  const troubled = state.employees.filter((e) => e.status === "injured" || e.status === "arrested").length;
  if (troubled) recs.push({ id: "troubled", text: `${troubled} operacional(is) feridos ou presos`, action: "Abrir Operacionais", run: () => onNavigate && onNavigate("employees"), can: true });
  const disloyal = state.employees.filter((e) => (e.betrayal_risk || 0) >= 25).length;
  if (disloyal) recs.push({ id: "loyalty", text: `${disloyal} operacional(is) com risco de traição`, action: "Abrir Operacionais", run: () => onNavigate && onNavigate("employees"), can: true });
  const teamsNoVehicle = state.teams.filter((t) => !t.vehicle_id).length;
  if (teamsNoVehicle) recs.push({ id: "novehicle", text: `${teamsNoVehicle} equipa(s) sem veículo`, action: "Abrir Equipas", run: () => onNavigate && onNavigate("teams"), can: true });
  const teamsNoMembers = state.teams.filter((t) => state.employees.every((e) => e.team_id !== t.id)).length;
  if (teamsNoMembers) recs.push({ id: "nomembers", text: `${teamsNoMembers} equipa(s) sem membros`, action: "Abrir Equipas", run: () => onNavigate && onNavigate("teams"), can: true });
  const claimable = (state.quests || []).filter((q) => q.status === "completed").length;
  if (claimable) recs.push({ id: "quests", text: `${claimable} recompensa(s) de missão por reclamar`, action: "Abrir Missões", run: () => onNavigate && onNavigate("quests"), can: true });
  if (state.salary_total > 0 && p.clean_money < state.salary_total) {
    recs.push({
      id: "payroll", text: `Fundos insuficientes para o ciclo salarial (${fmtMoney(state.salary_total)})`,
      action: "Abrir Operacionais", run: () => onNavigate && onNavigate("employees"), can: true,
    });
  }
  const degraded = (state.properties || []).filter((pr) => (pr.condition ?? 100) < 50).length;
  if (degraded) recs.push({ id: "properties", text: `${degraded} imóvel(is) degradado(s) — manutenção em atraso`, action: "Abrir Imóveis", run: () => onNavigate && onNavigate("properties"), can: true });

  return (
    <div className="mt-4" data-testid="intel-recommendations">
      <h3 className="mb-2 flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">
        <Lightbulb size={12} className="text-amber-400" /> Ações recomendadas
      </h3>
      {recs.length === 0 ? (
        <Alert className="border-emerald-500/20 bg-emerald-500/5 py-2">
          <AlertDescription className="font-mono text-[11px] text-emerald-400">
            Tudo sob controlo. O império está a funcionar em pleno.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-1.5">
          {recs.map((r) => (
            <Card key={r.id} data-testid={`intel-rec-${r.id}`} className="flex items-center justify-between gap-2 border-white/10 bg-white/[0.03] px-3 py-2 shadow-none">
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
  const successRate = total ? Math.round(((s.missions_success || 0) / total) * 100) : null;

  const emps = state.employees;
  const avgLevel = emps.length ? (emps.reduce((a, e) => a + e.level, 0) / emps.length).toFixed(1) : "—";
  const avgFatigue = emps.length ? Math.round(emps.reduce((a, e) => a + e.fatigue, 0) / emps.length) : 0;

  const vehs = state.vehicles;
  const avgCond = vehs.length ? Math.round(vehs.reduce((a, v) => a + v.condition, 0) / vehs.length) : 0;
  const totalKm = Math.round(vehs.reduce((a, v) => a + v.km_total, 0));
  const fleetCosts = vehs.reduce((a, v) => a + (v.fuel_spent_total || 0) + (v.repair_spent_total || 0), 0);

  const pt = catalog?.property_types || {};
  const dirtyPerH = state.properties.reduce((a, p) => a + (pt[p.type_key]?.dirty_per_h || 0) * p.level, 0);
  const launderPerH = state.properties.reduce((a, p) => a + (pt[p.type_key]?.launder_per_h || 0) * p.level, 0);
  const fleetValue = vehs.reduce((a, v) => a + sellValueOf(v), 0);
  const propValue = state.properties.reduce((a, p) => a + (pt[p.type_key] ? Math.round(pt[p.type_key].price * 0.7 * p.level) : 0), 0);
  const netWorth = state.player.clean_money + state.player.dirty_money + fleetValue + propValue;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-sm overflow-y-auto border-border bg-background/95 backdrop-blur-xl sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white">
            <BrainCircuit size={18} className="text-primary" /> Central de Inteligência
          </SheetTitle>
          <SheetDescription className="text-zinc-500">Toda a informação da organização, num só lugar.</SheetDescription>
        </SheetHeader>

        <RecommendedActions onNavigate={onNavigate} />

        <Section title="Operações" testId="intel-operations">
          <Grid>
            <Cell label="Operações" value={total} tip="Total de operações concluídas (com qualquer resultado)." />
            <Cell label="Taxa de sucesso" value={successRate === null ? "—" : `${successRate}%`}
                  color={successRate === null ? undefined : chanceColor(successRate / 100)}
                  tip="Percentagem de operações bem-sucedidas. Melhora com equipas compatíveis, membros treinados e calor baixo." />
            <Cell label="Falhadas" value={s.missions_failure || 0} color="#F59E0B" tip="Operações falhadas — sem recompensa e com possíveis ferimentos." />
            <Cell label="Interceções" value={s.missions_police || 0} color="#EF4444" tip="Operações intercetadas pela polícia — risco de detenções e multas." />
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

        <Section title="Economia" testId="intel-economy">
          <Grid>
            <Cell label="Ganho sujo" value={fmtMoney(s.earned_dirty || 0)} color="#F59E0B" tip="Total de dinheiro sujo ganho em operações desde o início." />
            <Cell label="Ganho limpo" value={fmtMoney(s.earned_clean || 0)} color="#10B981" tip="Total de dinheiro limpo ganho diretamente em operações." />
            <Cell label="Lavado total" value={fmtMoney(s.laundered_total || 0)} color="#34D399" tip="Total convertido de sujo para limpo (manual e passivo)." />
            <Cell label="Multas/Apreensões" value={fmtMoney(s.fines_paid || 0)} color="#EF4444" tip="Dinheiro perdido para a polícia em multas e apreensões." />
            <Cell label="Fortuna total" value={fmtMoney(netWorth)} tip="Caixa (limpo + sujo) + valor de revenda da frota e do património." />
            <Cell label="Salários/ciclo" value={fmtMoney(state.salary_total || 0)} color="#F59E0B" tip="Ciclo salarial atual, pago a cada 30 minutos." />
          </Grid>
        </Section>

        <Section title="Operacionais" testId="intel-hr">
          <Grid>
            <Cell label="Efetivo" value={`${emps.length}/${state.caps.employees.max}`} tip="Operacionais ativos vs. capacidade (compra esconderijos para expandir)." />
            <Cell label="Nível médio" value={avgLevel} tip="Nível médio dos operacionais — sobe com experiência de operações e formações." />
            <Cell label="Fadiga média" value={`${avgFatigue}%`} color={avgFatigue >= 60 ? "#EF4444" : undefined} tip="Fadiga média — aos 90% um operacional fica indisponível." />
            <Cell label="Em formação" value={emps.filter((e) => e.status === "training").length} color="#22D3EE" tip="Operacionais em cursos de formação neste momento." />
          </Grid>
        </Section>

        <Section title="Frota" testId="intel-fleet">
          <Grid>
            <Cell label="Veículos" value={`${vehs.length}/${state.caps.vehicles.max}`} tip="Veículos na garagem vs. capacidade total (compra garagens para expandir)." />
            <Cell label="Condição média" value={`${avgCond}%`} color={avgCond < 50 ? "#EF4444" : undefined} tip="Abaixo de 50% os veículos perdem velocidade; abaixo de 30% não operam." />
            <Cell label="Km totais" value={totalKm} tip="Quilómetros percorridos por toda a frota." />
            <Cell label="Custos frota" value={fmtMoney(fleetCosts)} color="#F59E0B" tip="Total gasto em combustível e reparações." />
            <Cell label="Valor frota" value={fmtMoney(fleetValue)} tip="Valor de revenda atual de todos os veículos (40% do preço × condição)." />
          </Grid>
        </Section>

        <Section title="Património" testId="intel-properties">
          <Grid>
            <Cell label="Propriedades" value={state.properties.length} tip="Número de propriedades do império." />
            <Cell label="Produção passiva" value={`${fmtMoney(dirtyPerH)}/h`} color="#F59E0B" tip="Dinheiro sujo gerado automaticamente pelos laboratórios." />
            <Cell label="Lavagem passiva" value={`${fmtMoney(launderPerH)}/h`} color="#34D399" tip="Lavagem automática das empresas de fachada (sem taxa)." />
            <Cell label="Calor" value={`${Math.round(state.player.heat)}%`} color="#EF4444" tip="Aos 70% há risco de rusgas; aos 90% as operações ficam bloqueadas." />
          </Grid>
        </Section>

        <Section title="Registo de operações" testId="intel-history">
          {state.history.length === 0 && (
            <p className="font-mono text-[11px] text-zinc-600">Nenhuma operação concluída ainda.</p>
          )}
          <div className="space-y-1">
            {state.history.map((m) => (
              <Card key={m.id} className="flex items-center justify-between border-white/10 bg-white/[0.03] px-2.5 py-1.5 shadow-none">
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
                  <p className="font-mono text-[10px] font-bold uppercase" style={{ color: OUTCOME_COLORS[m.outcome] || "#8E8E93" }}>
                    {OUTCOME_LABELS[m.outcome] || m.outcome}
                  </p>
                  {m.outcome === "success" && (
                    <p className="font-mono text-[10px] text-emerald-400">+{fmtMoney(m.opportunity.reward)}</p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </Section>
      </SheetContent>
    </Sheet>
  );
};

const Section = ({ title, testId, children }) => (
  <div className="mt-5" data-testid={testId}>
    <h3 className="mb-2 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">{title}</h3>
    {children}
  </div>
);

const Grid = ({ children }) => <div className="grid grid-cols-2 gap-2">{children}</div>;

const Cell = ({ label, value, color = "#FFFFFF", tip }) => (
  <Tip tip={tip} block>
    <Card className="h-full border-white/10 bg-white/[0.03] p-2.5 shadow-none">
      <p className="text-[9px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-bold" style={{ color }}>{value}</p>
    </Card>
  </Tip>
);
