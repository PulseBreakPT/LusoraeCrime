import { useState } from "react";
import { useGame } from "../../context/GameContext";
import { useAuth } from "../../context/AuthContext";
import { fmtMoney } from "../../lib/game";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Building2, Banknote, LogOut, MapPin, Siren, LayoutGrid, ChevronRight } from "lucide-react";

export const EmpirePanel = ({ open, onOpenChange, onNavigate }) => {
  const { state, launder, bribePolice } = useGame();
  const { logout } = useAuth();
  const [amount, setAmount] = useState("");
  if (!state) return null;
  const p = state.player;
  const nav = (panel) => onNavigate && onNavigate(panel);

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
          <StatBox label="Nível" value={p.level} />
          <StatBox label="Respeito" value={p.respect} />
          <StatBox label="€ Limpo" value={fmtMoney(p.clean_money)} accent="#10B981" />
          <StatBox label="€ Sujo" value={fmtMoney(p.dirty_money)} accent="#F59E0B" />
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
            <QuickNav testId="empire-nav-employees" label="Funcionários" value={`${state.caps.employees.used}/${state.caps.employees.max} · ${fmtMoney(state.salary_total || 0)}/ciclo`} onClick={() => nav("employees")} />
            <QuickNav testId="empire-nav-fleet" label="Frota" value={`${state.caps.vehicles.used}/${state.caps.vehicles.max} veículos`} onClick={() => nav("fleet")} />
            <QuickNav testId="empire-nav-properties" label="Imóveis" value={`${state.properties.length} propriedades`} onClick={() => nav("properties")} />
            <QuickNav testId="empire-nav-quests" label="Missões" value={`${(state.quests || []).filter((q) => q.status === "completed").length} por reclamar`} onClick={() => nav("quests")} />
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
              <span>Calor policial</span>
              <span>{Math.round(p.heat)}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${p.heat}%`, background: p.heat >= 70 ? "#DC2626" : p.heat >= 40 ? "#F59E0B" : "#34D399" }}
              />
            </div>
            {p.heat >= 90 && (
              <p className="mt-1.5 font-mono text-[10px] text-red-500">Alerta máximo: operações bloqueadas</p>
            )}
            <Button
              data-testid="bribe-police-button"
              onClick={bribePolice}
              disabled={p.heat < 10 || p.clean_money < Math.max(1000, Math.round(p.heat * 150))}
              size="sm"
              className="mt-2 w-full bg-white text-[10px] font-bold uppercase tracking-wider text-black hover:bg-gray-200 disabled:opacity-40"
            >
              Subornar polícia · {fmtMoney(Math.max(1000, Math.round(p.heat * 150)))} (-40 calor)
            </Button>
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

const StatBox = ({ label, value, accent = "#FFFFFF" }) => (
  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
    <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
    <p className="mt-0.5 font-mono text-sm font-bold" style={{ color: accent }}>{value}</p>
  </div>
);

const QuickNav = ({ testId, label, value, onClick }) => (
  <button
    data-testid={testId}
    onClick={onClick}
    className="group rounded-lg border border-white/10 bg-white/[0.03] p-3 text-left transition-colors hover:bg-white/[0.08]"
  >
    <p className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-500">
      {label} <ChevronRight size={11} className="text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-white" />
    </p>
    <p className="mt-0.5 font-mono text-[11px] font-bold text-white">{value}</p>
  </button>
);
