import { useGame } from "../../context/GameContext";
import { fmtMoney, SPEC_LABELS, STATUS_LABELS, STATUS_COLORS, fatigueColor } from "../../lib/game";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Button } from "../ui/button";
import { Users, Car, UserRound, Undo2, X, Fuel, Wrench, BedDouble, Zap, IdCard, CheckCircle2, AlertTriangle } from "lucide-react";

export const TeamsPanel = ({ open, onOpenChange, onNavigate }) => {
  const {
    state, catalog, createTeam, recallTeam, assignEmployee, assignVehicle,
    refuelVehicle, repairVehicle, restEmployee, dispatchTeam,
  } = useGame();
  if (!state) return null;
  const money = state.player.clean_money;

  const membersOf = (teamId) => state.employees.filter((e) => e.team_id === teamId);
  const vehicleOf = (team) => state.vehicles.find((v) => v.id === team.vehicle_id);
  const enRouteMissionOf = (team) => state.missions.find((m) => m.team_id === team.id && m.phase === "en_route");
  const freeEmployees = state.employees.filter((e) => !e.team_id && e.status === "idle");
  const freeVehicles = state.vehicles.filter((v) => !v.team_id);
  const nav = (p) => onNavigate && onNavigate(p);

  const readiness = (t, members, vehicle) => {
    if (t.status !== "idle") return { ok: false, reason: STATUS_LABELS[t.status] || "Ocupada" };
    if (members.length === 0) return { ok: false, reason: "Sem membros" };
    const ready = members.filter((e) => e.status === "idle" && e.fatigue < 90);
    if (ready.length === 0) return { ok: false, reason: "Membros indisponíveis" };
    if (!vehicle) return { ok: false, reason: "Sem veículo" };
    if (vehicle.condition < 30) return { ok: false, reason: "Veículo avariado" };
    if (vehicle.fuel_l < vehicle.tank_l * 0.12) return { ok: false, reason: "Combustível baixo" };
    return { ok: true, ready: ready.length };
  };

  const bestOppFor = (t) => {
    if (state.player.heat >= 90) return null;
    const opps = state.opportunities.filter((o) => state.player.level >= o.min_level);
    if (!opps.length) return null;
    const scored = opps
      .map((o) => ({ o, score: o.reward * (o.category === t.spec || o.category === "especial" ? 1.5 : 1) }))
      .sort((a, b) => b.score - a.score);
    return scored[0].o;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-sm overflow-y-auto border-white/10 bg-[#0a0a0a]/95 backdrop-blur-xl sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white">
            <Users size={18} className="text-red-500" /> Equipas
          </SheetTitle>
          <SheetDescription className="text-zinc-500">
            Centro de comando: membros, veículos e despacho num só lugar.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3" data-testid="teams-list">
          {state.teams.map((t) => {
            const members = membersOf(t.id);
            const vehicle = vehicleOf(t);
            const enRoute = enRouteMissionOf(t);
            const r = readiness(t, members, vehicle);
            const best = r.ok ? bestOppFor(t) : null;
            const fuelPct = vehicle ? (vehicle.fuel_l / vehicle.tank_l) * 100 : 0;
            const refuelCost = vehicle ? Math.ceil((vehicle.tank_l - vehicle.fuel_l) * state.fuel_prices[vehicle.fuel_type]) : 0;
            const repairCost = vehicle ? Math.max(50, Math.round((100 - vehicle.condition) * vehicle.price * 0.002)) : 0;
            return (
              <div key={t.id} data-testid={`team-card-${t.id}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">{t.name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                      {SPEC_LABELS[t.spec]} · {t.missions_done} ops
                    </p>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase"
                    style={{ color: STATUS_COLORS[t.status], background: `${STATUS_COLORS[t.status]}1a` }}
                  >
                    {STATUS_LABELS[t.status]}
                  </span>
                </div>

                <p
                  data-testid={`team-readiness-${t.id}`}
                  className={`mt-2 flex items-center gap-1 font-mono text-[10px] font-bold uppercase ${r.ok ? "text-emerald-400" : "text-amber-400"}`}
                >
                  {r.ok ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                  {r.ok ? `Pronta para operar (${r.ready} membros)` : r.reason}
                </p>

                <div className="mt-2 flex items-start gap-1.5">
                  <UserRound size={12} className="mt-1 shrink-0 text-zinc-500" />
                  <div className="min-w-0 flex-1">
                    {members.length === 0 && freeEmployees.length === 0 ? (
                      <button
                        data-testid={`team-nav-rh-${t.id}`}
                        onClick={() => nav("employees")}
                        className="flex items-center gap-1 font-mono text-[10px] text-red-400 underline-offset-2 hover:underline"
                      >
                        <IdCard size={10} /> Sem membros — recrutar no RH
                      </button>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        {members.map((m) => (
                          <span key={m.id} className="flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                            {m.name.split(" ")[0]} <span style={{ color: fatigueColor(m.fatigue) }}>{Math.round(m.fatigue)}%</span>
                            {m.status === "idle" && m.fatigue >= 60 && (
                              <button
                                data-testid={`team-member-rest-${m.id}`}
                                title="Mandar descansar"
                                onClick={() => restEmployee(m.id)}
                                className="text-purple-300 hover:text-purple-200"
                              >
                                <BedDouble size={10} />
                              </button>
                            )}
                            {m.status === "idle" && (
                              <button
                                data-testid={`team-member-remove-${m.id}`}
                                title="Remover da equipa"
                                onClick={() => assignEmployee(m.id, null)}
                                className="text-zinc-500 hover:text-red-400"
                              >
                                <X size={10} />
                              </button>
                            )}
                          </span>
                        ))}
                        {freeEmployees.length > 0 && (
                          <select
                            data-testid={`team-add-member-${t.id}`}
                            value=""
                            onChange={(ev) => ev.target.value && assignEmployee(ev.target.value, t.id)}
                            className="rounded border border-dashed border-white/20 bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-cyan-400"
                          >
                            <option value="">+ membro</option>
                            {freeEmployees.map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.name.split(" ")[0]} · {catalog?.specializations?.[e.role_key]?.name || e.role_key} N{e.level}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-1.5">
                  <Car size={12} className="shrink-0 text-cyan-400" />
                  {t.status === "idle" ? (
                    <select
                      data-testid={`team-vehicle-select-${t.id}`}
                      value={t.vehicle_id || ""}
                      onChange={(ev) => {
                        const vid = ev.target.value;
                        if (vid) assignVehicle(vid, t.id);
                        else if (t.vehicle_id) assignVehicle(t.vehicle_id, null);
                      }}
                      className="flex-1 rounded border border-white/10 bg-black/60 px-2 py-1 font-mono text-[11px] text-white"
                    >
                      <option value="">Sem veículo</option>
                      {vehicle && <option value={vehicle.id}>{vehicle.name}</option>}
                      {freeVehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} · {Math.round((v.fuel_l / v.tank_l) * 100)}% comb.
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="font-mono text-[11px] text-zinc-400">{vehicle ? vehicle.name : "Sem veículo"}</span>
                  )}
                  {!vehicle && freeVehicles.length === 0 && (
                    <button
                      data-testid={`team-nav-fleet-${t.id}`}
                      onClick={() => nav("fleet")}
                      className="shrink-0 font-mono text-[10px] text-amber-400 underline-offset-2 hover:underline"
                    >
                      Comprar na Frota
                    </button>
                  )}
                </div>

                {vehicle && t.status === "idle" && (
                  <div className="mt-1.5 flex items-center gap-1.5 pl-5">
                    <span className="font-mono text-[10px]" style={{ color: fuelPct < 25 ? "#EF4444" : "#F59E0B" }}>
                      {Math.round(fuelPct)}% comb.
                    </span>
                    <span className="font-mono text-[10px]" style={{ color: vehicle.condition < 30 ? "#EF4444" : "#34D399" }}>
                      {Math.round(vehicle.condition)}% cond.
                    </span>
                    {fuelPct < 60 && (
                      <button
                        data-testid={`team-refuel-${t.id}`}
                        onClick={() => refuelVehicle(vehicle.id)}
                        disabled={money < refuelCost}
                        className="flex items-center gap-0.5 rounded border border-white/10 px-1.5 py-0.5 font-mono text-[9px] text-amber-400 hover:bg-white/5 disabled:opacity-40"
                      >
                        <Fuel size={9} /> {fmtMoney(refuelCost)}
                      </button>
                    )}
                    {vehicle.condition < 60 && (
                      <button
                        data-testid={`team-repair-${t.id}`}
                        onClick={() => repairVehicle(vehicle.id)}
                        disabled={money < repairCost}
                        className="flex items-center gap-0.5 rounded border border-white/10 px-1.5 py-0.5 font-mono text-[9px] text-emerald-400 hover:bg-white/5 disabled:opacity-40"
                      >
                        <Wrench size={9} /> {fmtMoney(repairCost)}
                      </button>
                    )}
                  </div>
                )}

                {best && (
                  <button
                    data-testid={`team-dispatch-best-${t.id}`}
                    onClick={() => dispatchTeam(best.id, t.id)}
                    className="mt-2 flex w-full items-center justify-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-1.5 font-mono text-[10px] font-bold uppercase text-red-400 transition-colors hover:bg-red-500/20"
                  >
                    <Zap size={11} /> Despachar → {best.name} ({fmtMoney(best.reward)})
                  </button>
                )}

                {enRoute && (
                  <button
                    data-testid={`recall-team-${t.id}`}
                    onClick={() => recallTeam(enRoute.id)}
                    className="mt-2 flex w-full items-center justify-center gap-1 rounded border border-amber-500/30 px-2 py-1.5 font-mono text-[10px] font-bold uppercase text-amber-400 transition-colors hover:bg-amber-500/10"
                  >
                    <Undo2 size={11} /> Chamar de volta ({enRoute.opportunity.name})
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6">
          <h3 className="mb-2 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">
            Formar nova equipa · {catalog && fmtMoney(catalog.team_create_cost)}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {catalog &&
              Object.entries(catalog.team_specs).map(([key, ts]) => (
                <Button
                  key={key}
                  data-testid={`create-team-${key}`}
                  onClick={() => createTeam(key)}
                  disabled={state.player.clean_money < catalog.team_create_cost}
                  variant="outline"
                  className="h-auto flex-col items-start border-white/10 bg-white/[0.03] px-3 py-2 text-left hover:bg-white/[0.08] disabled:opacity-40"
                >
                  <span className="text-xs font-bold text-white">{SPEC_LABELS[key]}</span>
                  <span className="whitespace-normal text-[10px] leading-tight text-zinc-500">{ts.desc}</span>
                </Button>
              ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
