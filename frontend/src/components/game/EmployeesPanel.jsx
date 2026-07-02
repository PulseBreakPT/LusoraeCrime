import { useEffect, useState } from "react";
import { useGame } from "../../context/GameContext";
import { fmtMoney, fmtDuration, ROLE_LABELS, EMP_STATUS_LABELS, EMP_STATUS_COLORS, fatigueColor, SPEC_LABELS } from "../../lib/game";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Button } from "../ui/button";
import { IdCard, GraduationCap, ChevronDown } from "lucide-react";

export const EmployeesPanel = ({ open, onOpenChange }) => {
  const { state, catalog, hireEmployee, assignEmployee, trainEmployee, serverNow } = useGame();
  const [trainOpen, setTrainOpen] = useState(null);
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [open]);

  if (!state) return null;
  const caps = state.caps.employees;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-sm overflow-y-auto border-white/10 bg-[#0a0a0a]/95 backdrop-blur-xl sm:max-w-sm">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white">
            <IdCard size={18} className="text-red-500" /> Funcionários
            <span className="ml-auto font-mono text-xs text-zinc-500" data-testid="employee-caps">{caps.used}/{caps.max}</span>
          </SheetTitle>
          <SheetDescription className="text-zinc-500">Contrata, forma e atribui membros às equipas.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2" data-testid="employees-list">
          {state.employees.map((e) => {
            const xpNext = catalog?.emp_level_xp?.[e.level] ?? null;
            const xpPrev = catalog?.emp_level_xp?.[e.level - 1] ?? 0;
            const xpPct = xpNext ? Math.min(100, ((e.xp - xpPrev) / (xpNext - xpPrev)) * 100) : 100;
            const trainingLeft = e.training ? (Date.parse(e.training.ends_at) - serverNow()) / 1000 : 0;
            return (
              <div key={e.id} data-testid={`employee-card-${e.id}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">
                      {e.name} <span className="font-mono text-[10px] text-cyan-400">N{e.level}</span>
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                      {ROLE_LABELS[e.role_key]} · {SPEC_LABELS[e.spec]}
                    </p>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase"
                    style={{ color: EMP_STATUS_COLORS[e.status], background: `${EMP_STATUS_COLORS[e.status]}1a` }}
                  >
                    {e.status === "training" && trainingLeft > 0 ? `Formação ${fmtDuration(trainingLeft)}` : EMP_STATUS_LABELS[e.status]}
                  </span>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex justify-between font-mono text-[9px] uppercase text-zinc-500">
                      <span>XP</span>
                      <span>{e.xp}{xpNext ? `/${xpNext}` : ""}</span>
                    </div>
                    <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full bg-cyan-400 transition-all duration-500" style={{ width: `${xpPct}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between font-mono text-[9px] uppercase text-zinc-500">
                      <span>Fadiga</span>
                      <span>{Math.round(e.fatigue)}%</span>
                    </div>
                    <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full transition-all duration-500" style={{ width: `${e.fatigue}%`, background: fatigueColor(e.fatigue) }} />
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <select
                    data-testid={`employee-team-select-${e.id}`}
                    value={e.team_id || ""}
                    disabled={e.status !== "idle"}
                    onChange={(ev) => assignEmployee(e.id, ev.target.value || null)}
                    className="flex-1 rounded border border-white/10 bg-black/60 px-2 py-1 font-mono text-[11px] text-white disabled:opacity-40"
                  >
                    <option value="">Sem equipa</option>
                    {state.teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <button
                    data-testid={`employee-train-toggle-${e.id}`}
                    onClick={() => setTrainOpen(trainOpen === e.id ? null : e.id)}
                    className="flex items-center gap-1 font-mono text-[10px] uppercase text-zinc-500 transition-colors hover:text-white"
                  >
                    <GraduationCap size={12} /> Formação
                    <ChevronDown size={11} className={`transition-transform ${trainOpen === e.id ? "rotate-180" : ""}`} />
                  </button>
                </div>

                {trainOpen === e.id && catalog && (
                  <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                    {Object.entries(catalog.training_courses).map(([key, c]) => (
                      <button
                        key={key}
                        data-testid={`train-course-${key}-${e.id}`}
                        onClick={() => trainEmployee(e.id, key)}
                        disabled={e.status !== "idle" || state.player.clean_money < c.cost}
                        className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left transition-colors hover:bg-white/5 disabled:opacity-40"
                      >
                        <span className="text-xs text-white">
                          {c.name}{" "}
                          <span className="font-mono text-[10px] text-cyan-400">
                            +{c.spec === e.spec ? Math.round(c.xp * 1.5) : c.xp}xp · {fmtDuration(c.duration_s)}
                          </span>
                        </span>
                        <span className="font-mono text-[10px] text-emerald-400">{fmtMoney(c.cost)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6">
          <h3 className="mb-2 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">Contratar</h3>
          <div className="space-y-2">
            {catalog &&
              Object.entries(catalog.employee_roles).map(([key, r]) => (
                <div key={key} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{r.name}</p>
                    <p className="text-[10px] text-zinc-500">{r.desc}</p>
                  </div>
                  <Button
                    data-testid={`hire-employee-${key}`}
                    onClick={() => hireEmployee(key)}
                    disabled={state.player.clean_money < r.cost || caps.used >= caps.max}
                    size="sm"
                    className="shrink-0 bg-white text-[10px] font-bold uppercase text-black hover:bg-gray-200 disabled:opacity-40"
                  >
                    {fmtMoney(r.cost)}
                  </Button>
                </div>
              ))}
          </div>
          {caps.used >= caps.max && (
            <p className="mt-2 font-mono text-[10px] text-amber-400">Capacidade máxima. Compra um esconderijo em Imóveis.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
