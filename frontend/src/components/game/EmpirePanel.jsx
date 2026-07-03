import { useState } from "react";
import { useGame } from "../../context/GameContext";
import { useAuth } from "../../context/AuthContext";
import { fmtMoney, passiveRates, heatStatus, orgAlerts } from "../../lib/game";
import { Tip } from "./hud";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Building2, Banknote, LogOut, MapPin, Siren, LayoutGrid, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";

export const EmpirePanel = ({ open, onOpenChange, onNavigate }) => {
  const { state, catalog, launder, bribePolice } = useGame();
  const { logout } = useAuth();
  const [amount, setAmount] = useState("");
  if (!state) return null;
  const p = state.player;
  const nav = (panel) => onNavigate && onNavigate(panel);
  const { dirtyPerH, launderPerH, heatPerH } = passiveRates(state, catalog);
  const hs = heatStatus(p.heat);
  const alerts = orgAlerts(state);
  const salaryPerH = (state.salary_total || 0) * 2;
  const netPerH = dirtyPerH + launderPerH - salaryPerH;

  const handleLaunder = async () => {
    const value = parseInt(amount, 10);
    if (!value || value <= 0) return;
    const res = await launder(value);
    if (res.ok) setAmount("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full max-w-sm overflow-y-auto border-white/10 bg-[#0a0a0a]/95 backdrop-blur-xl sm:max-w-sm">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white">
            <Building2 size={18} className="text-red-500" /> {p.org_name}
          </SheetTitle>
          <SheetDescription className="text-zinc-500">Visão geral do império e economia.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <StatBox label="Nível" value={p.level} tip={p.next_level_respect ? `Nível ${p.level} — faltam ${p.next_level_respect - p.respect} de respeito para o próximo.` : "Nível máximo."} />
          <StatBox label="Respeito" value={p.respect} tip="Ganho em operações bem-sucedidas — determina o nível e o que está desbloqueado." />
          <StatBox label="€ Limpo" value={fmtMoney(p.clean_money)} accent="#10B981" tip="Pronto a gastar: compras, salários, reparações e subornos." />
          <StatBox label="€ Sujo" value={fmtMoney(p.dirty_money)} accent="#F59E0B" tip="Precisa de ser lavado antes de poder ser gasto. Lava abaixo ou usa empresas de fachada." />
        </div>

        <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3" data-testid="empire-cashflow">
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            <TrendingUp size={11} className="text-emerald-400" /> Fluxo de caixa passivo
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Tip tip="Dinheiro sujo gerado por hora pelos laboratórios." block>
              <div>
                <p className="text-[8px] uppercase tracking-wider text-zinc-600">Produção</p>
                <p className="font-mono text-[11px] font-bold text-amber-400">+{fmtMoney(dirtyPerH)}/h</p>
              </div>
            </Tip>
            <Tip tip="Lavagem passiva por hora das empresas de fachada (sem taxa)." block>
              <div>
                <p className="text-[8px] uppercase tracking-wider text-zinc-600">Lavagem</p>
                <p className="font-mono text-[11px] font-bold text-emerald-400">+{fmtMoney(launderPerH)}/h</p>
              </div>
            </Tip>
            <Tip tip={`Folha salarial: ${fmtMoney(state.salary_total || 0)} a cada 30 min (${fmtMoney(salaryPerH)}/h).`} block>
              <div>
                <p className="text-[8px] uppercase tracking-wider text-zinc-600">Salários</p>
                <p className="font-mono text-[11px] font-bold text-red-400">-{fmtMoney(salaryPerH)}/h</p>
              </div>
            </Tip>
          </div>
          <Tip tip={`Balanço passivo por hora (produção + lavagem - salários). Não inclui recompensas de operações.${heatPerH > 0 ? ` Os laboratórios também geram +${heatPerH.toFixed(1)} calor/h.` : ""}`} block>
            <p className="mt-2 flex items-center gap-1 border-t border-white/10 pt-1.5 font-mono text-[10px]">
              {netPerH >= 0 ? <TrendingUp size={10} className="text-emerald-400" /> : <TrendingDown size={10} className="text-red-400" />}
              <span className="uppercase tracking-wider text-zinc-500">Balanço:</span>
              <span className="font-bold" style={{ color: netPerH >= 0 ? "#34D399" : "#EF4444" }}>
                {netPerH >= 0 ? "+" : ""}{fmtMoney(netPerH)}/h
              </span>
            </p>
          </Tip>
        </div>

        {p.next_level_respect && (
          <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="flex justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              <span>Progresso nível {p.level + 1}</span>
              <span>{p.respect}/{p.next_level_respect}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-red-600 transition-all duration-700"
                style={{ width: `${Math.min(100, (p.respect / p.next_level_respect) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            <MapPin size={11} className="text-red-500" /> Quartel-general
          </p>
          <p className="mt-1 text-sm font-semibold text-white">{p.hq.name}</p>
          <p className="font-mono text-[10px] text-zinc-500">Cais do Sodré, Lisboa</p>
        </div>

        <div className="mt-3">
          <h3 className="mb-2 flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">
            <LayoutGrid size={12} /> Gestão rápida
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <QuickNav testId="empire-nav-employees" label="Funcionários"
              value={`${state.caps.employees.used}/${state.caps.employees.max} · ${fmtMoney(state.salary_total || 0)}/ciclo`}
              alert={alerts.hr > 0} alertText={alerts.hr > 0 ? `${alerts.hr} a precisar de atenção` : null}
              tip={alerts.hr > 0 ? `${alerts.hr} funcionário(s) feridos, presos, exaustos ou com risco de traição — abre o RH.` : "Plantel, recrutamento, formações e promoções."}
              onClick={() => nav("employees")} />
            <QuickNav testId="empire-nav-fleet" label="Frota"
              value={`${state.caps.vehicles.used}/${state.caps.vehicles.max} veículos`}
              alert={alerts.fleet > 0} alertText={alerts.fleet > 0 ? `${alerts.fleet} a precisar de atenção` : null}
              tip={alerts.fleet > 0 ? `${alerts.fleet} veículo(s) sem combustível ou avariados — abre a Frota.` : "Combustível, reparações e atribuições."}
              onClick={() => nav("fleet")} />
            <QuickNav testId="empire-nav-properties" label="Imóveis"
              value={`${state.properties.length} propriedades`}
              alert={alerts.raidRisk} alertText={alerts.raidRisk ? "risco de rusga!" : null}
              tip={alerts.raidRisk ? "Calor alto — risco de rusga aos laboratórios." : "Capacidades, produção passiva e lavagem automática."}
              onClick={() => nav("properties")} />
            <QuickNav testId="empire-nav-quests" label="Missões"
              value={`${alerts.claimable} por reclamar`}
              alert={alerts.claimable > 0}
              tip={alerts.claimable > 0 ? `${alerts.claimable} recompensa(s) à tua espera.` : "História, diárias, semanais e alertas."}
              onClick={() => nav("quests")} />
          </div>
        </div>

        <div className="mt-6">
          <h3 className="mb-2 flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">
            <Banknote size={12} /> Lavagem de dinheiro
          </h3>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs text-zinc-500">Converte dinheiro sujo em limpo. Taxa de 25%.</p>
            <div className="mt-2 flex gap-2">
              <Input
                data-testid="launder-amount-input"
                type="number"
                min="1"
                placeholder="Montante"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="border-white/10 bg-white/5 font-mono text-white placeholder:text-zinc-600"
              />
              <Button
                data-testid="launder-submit-button"
                onClick={handleLaunder}
                disabled={!amount || parseInt(amount, 10) > p.dirty_money}
                className="shrink-0 bg-white text-xs font-bold uppercase text-black hover:bg-gray-200 disabled:opacity-40"
              >
                Lavar
              </Button>
            </div>
            <div className="mt-2 flex gap-1.5">
              {[0.25, 0.5, 1].map((f) => (
                <button
                  key={f}
                  data-testid={`launder-quick-${f * 100}`}
                  onClick={() => setAmount(String(Math.floor(p.dirty_money * f)))}
                  disabled={p.dirty_money <= 0}
                  className="rounded border border-white/10 px-2 py-1 font-mono text-[10px] text-zinc-400 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40"
                >
                  {f === 1 ? "MAX" : `${f * 100}%`}
                </button>
              ))}
            </div>
            {amount && parseInt(amount, 10) > 0 && (
              <p className="mt-2 font-mono text-[11px] text-emerald-400">
                Recebes {fmtMoney(Math.floor(parseInt(amount, 10) * 0.75))} limpos
              </p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <h3 className="mb-2 flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">
            <Siren size={12} /> Polícia
          </h3>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="flex justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              <Tip tip={hs.desc}>
                <span>Calor policial · <span style={{ color: hs.color }}>{hs.label}</span></span>
              </Tip>
              <span>{Math.round(p.heat)}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${p.heat}%`, background: hs.color }}
              />
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-[9px] text-zinc-600">
              <Tip tip="Aos 70% há risco de rusgas aos laboratórios."><span className={p.heat >= 70 ? "text-orange-400" : ""}>70% rusgas</span></Tip>
              <Tip tip="Aos 90% todas as operações ficam bloqueadas até o calor baixar."><span className={p.heat >= 90 ? "text-red-500" : ""}>90% bloqueio</span></Tip>
            </div>
            {p.heat >= 90 && (
              <p className="mt-1.5 font-mono text-[10px] text-red-500">Alerta máximo: operações bloqueadas</p>
            )}
            <Tip tip={`Suborno: paga ${fmtMoney(Math.max(1000, Math.round(p.heat * 150)))} limpos para reduzir o calor em 40 pontos. O custo sobe com o calor atual.`} block>
              <Button
                data-testid="bribe-police-button"
                onClick={bribePolice}
                disabled={p.heat < 10 || p.clean_money < Math.max(1000, Math.round(p.heat * 150))}
                size="sm"
                className="mt-2 w-full bg-white text-[10px] font-bold uppercase tracking-wider text-black hover:bg-gray-200 disabled:opacity-40"
              >
                Subornar polícia · {fmtMoney(Math.max(1000, Math.round(p.heat * 150)))} (-40 calor)
              </Button>
            </Tip>
          </div>
        </div>

        <Button
          data-testid="logout-button"
          onClick={logout}
          variant="outline"
          className="mt-8 w-full border-white/10 bg-transparent text-xs font-bold uppercase tracking-wider text-zinc-400 hover:bg-white/5 hover:text-white"
        >
          <LogOut size={14} className="mr-1.5" /> Sair da rede
        </Button>
      </SheetContent>
    </Sheet>
  );
};

const StatBox = ({ label, value, accent = "#FFFFFF", tip }) => (
  <Tip tip={tip} block>
    <div className="h-full rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-bold" style={{ color: accent }}>{value}</p>
    </div>
  </Tip>
);

const QuickNav = ({ testId, label, value, alert, alertText, tip, onClick }) => (
  <Tip tip={tip} block>
    <button
      data-testid={testId}
      onClick={onClick}
      className="group relative h-full w-full rounded-lg border border-white/10 bg-white/[0.03] p-3 text-left transition-colors hover:bg-white/[0.08]"
    >
      <p className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-500">
        {label} <ChevronRight size={11} className="text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-white" />
      </p>
      <p className="mt-0.5 font-mono text-[11px] font-bold text-white">{value}</p>
      {alertText && <p className="mt-0.5 font-mono text-[9px] text-amber-400">{alertText}</p>}
      {alert && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />}
    </button>
  </Tip>
);
