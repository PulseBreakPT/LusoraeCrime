import { useGame } from "../../context/GameContext";
import { fmtMoney, SPEC_LABELS, chanceColor } from "../../lib/game";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { BrainCircuit } from "lucide-react";

const OUTCOME_LABELS = { success: "Sucesso", failure: "Falhou", police: "Polícia", recalled: "Cancelada" };
const OUTCOME_COLORS = { success: "#34D399", failure: "#F59E0B", police: "#EF4444", recalled: "#8E8E93" };

export const IntelPanel = ({ open, onOpenChange }) => {
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
