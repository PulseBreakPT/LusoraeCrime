import { useState } from "react";
import { useGame } from "../../context/GameContext";
import { fmtMoney, FUEL_LABELS, effectiveSpeed } from "../../lib/game";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Button } from "../ui/button";
import { Car, Fuel, Wrench, Trash2, Lock, BarChart3, ChevronDown } from "lucide-react";

const VStat = ({ label, value }) => (
  <div className="rounded bg-black/40 px-1.5 py-1 text-center">
    <p className="text-[8px] uppercase tracking-wider text-zinc-600">{label}</p>
    <p className="font-mono text-[10px] font-bold text-white">{value}</p>
  </div>
);

export const FleetPanel = ({ open, onOpenChange }) => {
  const { state, catalog, buyVehicle, sellVehicle, refuelVehicle, repairVehicle, assignVehicle } = useGame();
  const [statsOpen, setStatsOpen] = useState(null);
  if (!state) return null;
  const caps = state.caps.vehicles;

  const teamOf = (v) => state.teams.find((t) => t.id === v.team_id);
  const vehicleBusy = (v) => {
    const t = teamOf(v);
    return t && t.status !== "idle";
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-sm overflow-y-auto border-white/10 bg-[#0a0a0a]/95 backdrop-blur-xl sm:max-w-sm">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white">
            <Car size={18} className="text-red-500" /> Frota
            <span className="ml-auto font-mono text-xs text-zinc-500" data-testid="vehicle-caps">{caps.used}/{caps.max}</span>
          </SheetTitle>
          <SheetDescription className="text-zinc-500">Abastece, repara, atribui e abate veículos.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2" data-testid="fleet-list">
          {state.vehicles.map((v) => {
            const busy = vehicleBusy(v);
            const fuelPct = (v.fuel_l / v.tank_l) * 100;
            const refuelCost = Math.ceil((v.tank_l - v.fuel_l) * state.fuel_prices[v.fuel_type]);
            const repairCost = Math.max(50, Math.round((100 - v.condition) * v.price * 0.002));
            const sellValue = Math.round(v.price * 0.4 * (v.condition / 100));
            const effSpeed = effectiveSpeed(v);
            const speedReduced = effSpeed < v.speed - 0.05;
            return (
              <div key={v.id} data-testid={`vehicle-card-${v.id}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">{v.name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                      {v.speed} m/s · {FUEL_LABELS[v.fuel_type]} · {Math.round(v.km_total)} km
                    </p>
                  </div>
                  {busy && <span className="rounded-full bg-red-600/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-red-400">Em missão</span>}
                </div>
                {speedReduced && (
                  <p className="mt-1 font-mono text-[10px] text-amber-400">
                    Velocidade reduzida para {effSpeed.toFixed(1)} m/s — repara o veículo
                  </p>
                )}

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex justify-between font-mono text-[9px] uppercase text-zinc-500">
                      <span>Combustível</span>
                      <span>{v.fuel_l.toFixed(0)}/{v.tank_l.toFixed(0)}L</span>
                    </div>
                    <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${fuelPct}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between font-mono text-[9px] uppercase text-zinc-500">
                      <span>Condição</span>
                      <span>{Math.round(v.condition)}%</span>
                    </div>
                    <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full transition-all duration-500"
                        style={{ width: `${v.condition}%`, background: v.condition < 30 ? "#EF4444" : "#34D399" }}
                      />
                    </div>
                  </div>
                </div>

                <select
                  data-testid={`vehicle-team-select-${v.id}`}
                  value={v.team_id || ""}
                  disabled={busy}
                  onChange={(ev) => assignVehicle(v.id, ev.target.value || null)}
                  className="mt-2 w-full rounded border border-white/10 bg-black/60 px-2 py-1 font-mono text-[11px] text-white disabled:opacity-40"
                >
                  <option value="">Na garagem (sem equipa)</option>
                  {state.teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>

                <div className="mt-2 flex gap-1.5">
                  <button
                    data-testid={`refuel-vehicle-${v.id}`}
                    onClick={() => refuelVehicle(v.id)}
                    disabled={busy || fuelPct > 99 || state.player.clean_money < refuelCost}
                    className="flex flex-1 items-center justify-center gap-1 rounded border border-white/10 px-2 py-1.5 font-mono text-[10px] text-amber-400 transition-colors hover:bg-white/5 disabled:opacity-40"
                  >
                    <Fuel size={11} /> {fmtMoney(refuelCost)}
                  </button>
                  <button
                    data-testid={`repair-vehicle-${v.id}`}
                    onClick={() => repairVehicle(v.id)}
                    disabled={busy || v.condition > 99 || state.player.clean_money < repairCost}
                    className="flex flex-1 items-center justify-center gap-1 rounded border border-white/10 px-2 py-1.5 font-mono text-[10px] text-emerald-400 transition-colors hover:bg-white/5 disabled:opacity-40"
                  >
                    <Wrench size={11} /> {fmtMoney(repairCost)}
                  </button>
                  <button
                    data-testid={`sell-vehicle-${v.id}`}
                    onClick={() => sellVehicle(v.id)}
                    disabled={busy}
                    className="flex flex-1 items-center justify-center gap-1 rounded border border-white/10 px-2 py-1.5 font-mono text-[10px] text-red-400 transition-colors hover:bg-white/5 disabled:opacity-40"
                  >
                    <Trash2 size={11} /> {fmtMoney(sellValue)}
                  </button>
                </div>

                <button
                  data-testid={`vehicle-stats-toggle-${v.id}`}
                  onClick={() => setStatsOpen(statsOpen === v.id ? null : v.id)}
                  className="mt-2 flex w-full items-center justify-center gap-1 font-mono text-[10px] uppercase text-zinc-500 transition-colors hover:text-white"
                >
                  <BarChart3 size={11} /> Estatísticas
                  <ChevronDown size={11} className={`transition-transform ${statsOpen === v.id ? "rotate-180" : ""}`} />
                </button>
                {statsOpen === v.id && (
                  <div data-testid={`vehicle-stats-${v.id}`} className="mt-1.5 grid grid-cols-3 gap-1.5 border-t border-white/10 pt-2">
                    <VStat label="Missões" value={`${v.missions_success || 0}✓/${v.missions_done || 0}`} />
                    <VStat label="Sucesso" value={v.missions_done ? `${Math.round(((v.missions_success || 0) / v.missions_done) * 100)}%` : "—"} />
                    <VStat label="Km" value={Math.round(v.km_total)} />
                    <VStat label="Comb. gasto" value={fmtMoney(v.fuel_spent_total || 0)} />
                    <VStat label="Reparações" value={fmtMoney(v.repair_spent_total || 0)} />
                    <VStat label="Vel. efetiva" value={`${effSpeed.toFixed(1)} m/s`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6">
          <h3 className="mb-2 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">Stand de veículos</h3>
          <div className="space-y-2">
            {catalog &&
              Object.entries(catalog.vehicle_models).map(([key, m]) => {
                const locked = state.player.level < m.min_level;
                return (
                  <div key={key} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {m.name}
                        {locked && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 font-mono text-[9px] uppercase text-amber-400">
                            <Lock size={9} /> Nível {m.min_level}
                          </span>
                        )}
                      </p>
                      <p className="font-mono text-[10px] text-zinc-500">
                        {m.speed} m/s · {FUEL_LABELS[m.fuel_type]} · {m.tank_l}L · {m.cons}L/100km
                      </p>
                    </div>
                    <Button
                      data-testid={`buy-vehicle-${key}`}
                      onClick={() => buyVehicle(key)}
                      disabled={locked || state.player.clean_money < m.price || caps.used >= caps.max}
                      size="sm"
                      className="shrink-0 bg-white text-[10px] font-bold uppercase text-black hover:bg-gray-200 disabled:opacity-40"
                    >
                      {fmtMoney(m.price)}
                    </Button>
                  </div>
                );
              })}
          </div>
          {caps.used >= caps.max && (
            <p className="mt-2 font-mono text-[10px] text-amber-400">Garagem cheia. Compra uma garagem em Imóveis.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
