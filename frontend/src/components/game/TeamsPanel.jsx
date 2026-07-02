import { useState } from "react";
import { useGame } from "../../context/GameContext";
import { fmtMoney, SPEC_LABELS, STATUS_LABELS, STATUS_COLORS } from "../../lib/game";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Button } from "../ui/button";
import { Users, Car, ChevronDown, Plus } from "lucide-react";

export const TeamsPanel = ({ open, onOpenChange }) => {
  const { state, catalog, recruitTeam, buyVehicle } = useGame();
  const [garageOpen, setGarageOpen] = useState(null);
  if (!state) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-sm overflow-y-auto border-white/10 bg-[#0a0a0a]/95 backdrop-blur-xl sm:max-w-sm">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white">
            <Users size={18} className="text-red-500" /> Equipas
          </SheetTitle>
          <SheetDescription className="text-zinc-500">Gere as tuas crews, veículos e recrutamento.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2" data-testid="teams-list">
          {state.teams.map((t) => (
            <div key={t.id} data-testid={`team-card-${t.id}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white">{t.name}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    {SPEC_LABELS[t.spec]} · Skill {t.skill.toFixed(0)} · {t.missions_done} ops
                  </p>
                </div>
                <span
                  className="rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase"
                  style={{ color: STATUS_COLORS[t.status], background: `${STATUS_COLORS[t.status]}1a` }}
                >
                  {STATUS_LABELS[t.status]}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-400">
                  <Car size={12} className="text-cyan-400" /> {t.vehicle.name} · {t.vehicle.speed} m/s
                </p>
                <button
                  data-testid={`garage-toggle-${t.id}`}
                  onClick={() => setGarageOpen(garageOpen === t.id ? null : t.id)}
                  className="flex items-center gap-1 font-mono text-[10px] uppercase text-zinc-500 transition-colors hover:text-white"
                >
                  Garagem <ChevronDown size={12} className={`transition-transform ${garageOpen === t.id ? "rotate-180" : ""}`} />
                </button>
              </div>

              {garageOpen === t.id && catalog && (
                <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                  {Object.entries(catalog.vehicle_types)
                    .filter(([key, v]) => key !== t.vehicle.key && v.cost > 0)
                    .map(([key, v]) => (
                      <button
                        key={key}
                        data-testid={`buy-vehicle-${key}-${t.id}`}
                        onClick={() => buyVehicle(t.id, key)}
                        disabled={t.status !== "idle" || state.player.clean_money < v.cost}
                        className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left transition-colors hover:bg-white/5 disabled:opacity-40"
                      >
                        <span className="text-xs text-white">{v.name} <span className="font-mono text-[10px] text-cyan-400">{v.speed} m/s</span></span>
                        <span className="font-mono text-[10px] text-emerald-400">{fmtMoney(v.cost)}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6">
          <h3 className="mb-2 flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">
            <Plus size={12} /> Recrutar
          </h3>
          <div className="space-y-2">
            {catalog &&
              Object.entries(catalog.team_types).map(([key, tt]) => (
                <div key={key} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">{tt.name}</p>
                    <span className="font-mono text-xs text-emerald-400">{fmtMoney(tt.cost)}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{tt.desc}</p>
                  <Button
                    data-testid={`recruit-team-${key}`}
                    onClick={() => recruitTeam(key)}
                    disabled={state.player.clean_money < tt.cost}
                    size="sm"
                    className="mt-2 w-full bg-white text-xs font-bold uppercase tracking-wider text-black hover:bg-gray-200 disabled:opacity-40"
                  >
                    Recrutar
                  </Button>
                </div>
              ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
