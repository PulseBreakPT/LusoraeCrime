import { useGame } from "../../context/GameContext";
import { fmtMoney, SPEC_LABELS, STATUS_LABELS, STATUS_COLORS } from "../../lib/game";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Button } from "../ui/button";
import { Users, Car, UserRound, Undo2 } from "lucide-react";

export const TeamsPanel = ({ open, onOpenChange }) => {
  const { state, catalog, createTeam, recallTeam } = useGame();
  if (!state) return null;

  const membersOf = (teamId) => state.employees.filter((e) => e.team_id === teamId);
  const vehicleOf = (team) => state.vehicles.find((v) => v.id === team.vehicle_id);
  const enRouteMissionOf = (team) => state.missions.find((m) => m.team_id === team.id && m.phase === "en_route");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-sm overflow-y-auto border-white/10 bg-[#0a0a0a]/95 backdrop-blur-xl sm:max-w-sm">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white">
            <Users size={18} className="text-red-500" /> Equipas
          </SheetTitle>
          <SheetDescription className="text-zinc-500">Membros geridos no RH, veículos na Frota.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2" data-testid="teams-list">
          {state.teams.map((t) => {
            const members = membersOf(t.id);
            const vehicle = vehicleOf(t);
            const enRoute = enRouteMissionOf(t);
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

                <div className="mt-2 flex items-center gap-1.5">
                  <UserRound size={12} className="shrink-0 text-zinc-500" />
                  {members.length === 0 ? (
                    <span className="font-mono text-[10px] text-red-400">Sem membros — atribui no RH</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {members.map((m) => (
                        <span key={m.id} className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                          {m.name.split(" ")[0]} <span className="text-zinc-500">N{m.level}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[11px] text-zinc-400">
                  <Car size={12} className="shrink-0 text-cyan-400" />
                  {vehicle ? (
                    <>
                      {vehicle.name} · <span className="text-amber-400">{Math.round((vehicle.fuel_l / vehicle.tank_l) * 100)}% comb.</span> ·{" "}
                      <span className={vehicle.condition < 30 ? "text-red-400" : "text-emerald-400"}>{Math.round(vehicle.condition)}% cond.</span>
                    </>
                  ) : (
                    <span className="text-red-400">Sem veículo — atribui na Frota</span>
                  )}
                </p>

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
