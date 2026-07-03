import { useGame } from "../../context/GameContext";
import { fmtMoney, SPEC_LABELS, chanceColor } from "../../lib/game";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
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
  if (p.dirty_money >= 15000) {
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
  if (tired) recs.push({ id: "rest", text: `${tired} funcionário(s) exaustos — vão falhar operações`, action: "Abrir RH", run: () => onNavigate && onNavigate("employees"), can: true });
  const troubled = state.employees.filter((e) => e.status === "injured" || e.status === "arrested").length;
  if (troubled) recs.push({ id: "troubled", text: `${troubled} funcionário(s) feridos ou presos`, action: "Abrir RH", run: () => onNavigate && onNavigate("employees"), can: true });
  const disloyal = state.employees.filter((e) => (e.betrayal_risk || 0) >= 25).length;
  if (disloyal) recs.push({ id: "loyalty", text: `${disloyal} funcionário(s) com risco de traição`, action: "Abrir RH", run: () => onNavigate && onNavigate("employees"), can: true });
  const teamsNoVehicle = state.teams.filter((t) => !t.vehicle_id).length;
  if (teamsNoVehicle) recs.push({ id: "novehicle", text: `${teamsNoVehicle} equipa(s) sem veículo`, action: "Abrir Equipas", run: () => onNavigate && onNavigate("teams"), can: true });
  const teamsNoMembers = state.teams.filter((t) => state.employees.every((e) => e.team_id !== t.id)).length;
  if (teamsNoMembers) recs.push({ id: "nomembers", text: `${teamsNoMembers} equipa(s) sem membros`, action: "Abrir Equipas", run: () => onNavigate && onNavigate("teams"), can: true });
  const claimable = (state.quests || []).filter((q) => q.status === "completed").length;
  if (claimable) recs.push({ id: "quests", text: `${claimable} recompensa(s) de missão por reclamar`, action: "Abrir Missões", run: () => onNavigate && onNavigate("quests"), can: true });

  return (
    <div className="mt-4" data-testid="intel-recommendations">
      <h3 className="mb-2 flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">
        <Lightbulb size={12} className="text-amber-400" /> Ações recomendadas
      </h3>
      {recs.length === 0 ? (
        <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 font-mono text-[11px] text-emerald-400">
          Tudo sob controlo. O império está a funcionar em pleno.
        </p>
      ) : (
        <div className="space-y-1.5">
          {recs.map((r) => (
            <div key={r.id} data-testid={`intel-rec-${r.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
              <p className="min-w-0 text-[11px] leading-snug text-zinc-300">{r.text}</p>
              <button
                data-testid={`intel-rec-action-${r.id}`}
                onClick={r.run}
                disabled={!r.can}
                className="flex shrink-0 items-center gap-1 rounded border border-white/15 px-2 py-1 font-mono text-[10px] font-bold text-cyan-300 transition-colors hover:bg-white/10 disabled:opacity-40"
              >
                {r.action} <ArrowRight size={10} />
              </button>
            </div>
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-sm overflow-y-auto border-white/10 bg-[#0a0a0a]/95 backdrop-blur-xl sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white">
            <BrainCircuit size={18} className="text-red-500" /> Central de Inteligência
          </SheetTitle>
          <SheetDescription className="text-zinc-500">Todos os dados do teu império num só lugar.</SheetDescription>
        </SheetHeader>

        <RecommendedActions onNavigate={onNavigate} />

        <Section title="Operações" testId="intel-operations">
          <Grid>
            <Cell label="Missões" value={total} />
            <Cell label="Taxa de sucesso" value={successRate === null ? "—" : `${successRate}%`}
                  color={successRate === null ? undefined : chanceColor(successRate / 100)} />
            <Cell label="Falhadas" value={s.missions_failure || 0} color="#F59E0B" />
            <Cell label="Interceções" value={s.missions_police || 0} color="#EF4444" />
          </Grid>
          {Object.keys(s.by_category || {}).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.entries(s.by_category).map(([cat, n]) => (
                <span key={cat} className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                  {SPEC_LABELS[cat] || cat}: <span className="text-white">{n}</span>
                </span>
              ))}
            </div>
          )}
        </Section>

        <Section title="Economia" testId="intel-economy">
          <Grid>
            <Cell label="Ganho sujo" value={fmtMoney(s.earned_dirty || 0)} color="#F59E0B" />
            <Cell label="Ganho limpo" value={fmtMoney(s.earned_clean || 0)} color="#10B981" />
            <Cell label="Lavado total" value={fmtMoney(s.laundered_total || 0)} color="#34D399" />
            <Cell label="Multas/Apreensões" value={fmtMoney(s.fines_paid || 0)} color="#EF4444" />
          </Grid>
        </Section>

        <Section title="Recursos humanos" testId="intel-hr">
          <Grid>
            <Cell label="Funcionários" value={`${emps.length}/${state.caps.employees.max}`} />
            <Cell label="Nível médio" value={avgLevel} />
            <Cell label="Fadiga média" value={`${avgFatigue}%`} color={avgFatigue >= 60 ? "#EF4444" : undefined} />
            <Cell label="Em formação" value={emps.filter((e) => e.status === "training").length} color="#22D3EE" />
          </Grid>
        </Section>

        <Section title="Frota" testId="intel-fleet">
          <Grid>
            <Cell label="Veículos" value={`${vehs.length}/${state.caps.vehicles.max}`} />
            <Cell label="Condição média" value={`${avgCond}%`} color={avgCond < 50 ? "#EF4444" : undefined} />
            <Cell label="Km totais" value={totalKm} />
            <Cell label="Custos frota" value={fmtMoney(fleetCosts)} color="#F59E0B" />
          </Grid>
        </Section>

        <Section title="Património" testId="intel-properties">
          <Grid>
            <Cell label="Propriedades" value={state.properties.length} />
            <Cell label="Produção passiva" value={`${fmtMoney(dirtyPerH)}/h`} color="#F59E0B" />
            <Cell label="Lavagem passiva" value={`${fmtMoney(launderPerH)}/h`} color="#34D399" />
            <Cell label="Calor" value={`${Math.round(state.player.heat)}%`} color={state.player.heat >= 70 ? "#EF4444" : undefined} />
          </Grid>
        </Section>

        <Section title="Registo de missões" testId="intel-history">
          {state.history.length === 0 && (
            <p className="font-mono text-[11px] text-zinc-600">Ainda sem missões concluídas.</p>
          )}
          <div className="space-y-1">
            {state.history.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5">
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
              </div>
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

const Cell = ({ label, value, color = "#FFFFFF" }) => (
  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
    <p className="text-[9px] uppercase tracking-wider text-zinc-500">{label}</p>
    <p className="mt-0.5 font-mono text-sm font-bold" style={{ color }}>{value}</p>
  </div>
);
