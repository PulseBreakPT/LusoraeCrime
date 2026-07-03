import { useEffect, useState } from "react";
import { useGame } from "../../context/GameContext";
import { fmtMoney, fmtDuration, SPEC_LABELS, STATUS_LABELS, STATUS_COLORS, fatigueColor, chanceColor, teamsReadiness, vehicleRangeKm } from "../../lib/game";
import { Tip, Kpi, SummaryStrip, MiniBar } from "./hud";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Button } from "../ui/button";
import { Users, Car, UserRound, Undo2, X, Fuel, Wrench, BedDouble, Zap, IdCard, CheckCircle2, AlertTriangle, Activity, Target } from "lucide-react";

export const TeamsPanel = ({ open, onOpenChange, onNavigate }) => {
  const {
    state, catalog, createTeam, recallTeam, assignEmployee, assignVehicle,
    refuelVehicle, repairVehicle, restEmployee, dispatchTeam, recommendOpportunityForTeam,
  } = useGame();
  const [recommendations, setRecommendations] = useState({});

  // Para cada equipa pronta, pergunta ao servidor qual é a melhor oportunidade
  // que ela consegue mesmo cumprir (nunca uma abaixo dos requisitos mínimos).
  // Só volta a perguntar quando o conjunto de equipas prontas ou o número de
  // oportunidades disponíveis muda — não a cada refrescamento de 4s.
  const readyIds = state ? state.teams.filter((t) => t.status === "idle").map((t) => t.id) : [];
  const recomputeKey = `${readyIds.join(",")}|${state?.opportunities?.length || 0}|${state?.player?.heat || 0}`;
  useEffect(() => {
    if (!state || readyIds.length === 0) return;
    let cancelled = false;
    Promise.all(readyIds.map((id) => recommendOpportunityForTeam(id).then((r) => [id, r.ok ? r.data : null])))
      .then((pairs) => {
        if (!cancelled) setRecommendations(Object.fromEntries(pairs));
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recomputeKey, recommendOpportunityForTeam]);

  if (!state) return null;
  const money = state.player.clean_money;
  const teamMaxMembers = catalog?.team_max_members || 4;

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

        {(() => {
          const tr = teamsReadiness(state);
          const assigned = state.employees.filter((e) => e.team_id);
          const avgFat = assigned.length ? Math.round(assigned.reduce((a, e) => a + e.fatigue, 0) / assigned.length) : 0;
          const opsDone = state.teams.reduce((a, t) => a + (t.missions_done || 0), 0);
          return (
            <SummaryStrip cols={4} className="mt-3" testId="teams-summary">
              <Kpi icon={CheckCircle2} label="Prontas" value={`${tr.ready}/${tr.total}`} color={tr.ready > 0 ? "#34D399" : "#EF4444"}
                tip="Equipas prontas a operar já: com membros disponíveis, veículo abastecido e em condições." />
              <Kpi icon={Activity} label="Em operação" value={tr.busy} color={tr.busy > 0 ? "#22D3EE" : "#FFFFFF"}
                tip="Equipas em viagem ou a executar operações neste momento — acompanha-as no mapa." />
              <Kpi icon={UserRound} label="Afetos" value={`${assigned.length}/${state.employees.length}`}
                tip="Funcionários atribuídos a equipas vs. total do plantel. Só membros de equipas participam em operações." />
              <Kpi icon={Target} label="Fadiga" value={`${avgFat}%`} color={fatigueColor(avgFat)} bar={avgFat} barColor={fatigueColor(avgFat)}
                tip={`Fadiga média dos membros das equipas. Acima de 90% ficam indisponíveis. Total de operações concluídas: ${opsDone}.`} />
            </SummaryStrip>
          );
        })()}

        <div className="mt-4 space-y-3" data-testid="teams-list">
          {state.teams.map((t) => {
            const members = membersOf(t.id);
            const vehicle = vehicleOf(t);
            const enRoute = enRouteMissionOf(t);
            const r = readiness(t, members, vehicle);
            const rec = r.ok ? recommendations[t.id] : null;
            const best = rec?.opportunity_id ? state.opportunities.find((o) => o.id === rec.opportunity_id) : null;
            const vehicleSeats = vehicle ? catalog?.vehicle_models?.[vehicle.model_key]?.seats : null;
            const fuelPct = vehicle ? (vehicle.fuel_l / vehicle.tank_l) * 100 : 0;
            const refuelCost = vehicle ? Math.ceil((vehicle.tank_l - vehicle.fuel_l) * state.fuel_prices[vehicle.fuel_type]) : 0;
            const repairCost = vehicle ? Math.max(50, Math.round((100 - vehicle.condition) * vehicle.price * 0.002)) : 0;
            return (
              <div key={t.id} data-testid={`team-card-${t.id}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">{t.name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                      <Tip tip={`Especialização ${SPEC_LABELS[t.spec]} — bónus de sucesso em operações desta categoria.`}>
                        <span>{SPEC_LABELS[t.spec]}</span>
                      </Tip>
                      {" · "}
                      <Tip tip="Operações concluídas por esta equipa desde a sua formação.">
                        <span>{t.missions_done} ops</span>
                      </Tip>
                    </p>
                  </div>
                  <Tip tip={t.status === "idle" ? "Na base — pronta a receber ordens." : "Em operação — volta a estar disponível quando regressar ao QG."} align="end">
                    <span
                      className="rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase"
                      style={{ color: STATUS_COLORS[t.status], background: `${STATUS_COLORS[t.status]}1a` }}
                    >
                      {STATUS_LABELS[t.status]}
                    </span>
                  </Tip>
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
                    <Tip tip={`Membros atuais na equipa vs. capacidade máxima (${teamMaxMembers}).`}>
                      <span data-testid={`team-members-cap-${t.id}`} className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">
                        Membros: <span className={members.length >= teamMaxMembers ? "text-amber-400" : "text-zinc-300"}>{members.length}/{teamMaxMembers}</span>
                      </span>
                    </Tip>
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
                        {freeEmployees.length > 0 && members.length < teamMaxMembers && (
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
                        {freeEmployees.length > 0 && members.length >= teamMaxMembers && (
                          <span className="font-mono text-[9px] text-zinc-600">equipa cheia</span>
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
                  {vehicle && vehicleSeats != null && (
                    <Tip tip={`Lugares ocupados pela equipa vs. capacidade do veículo (${vehicleSeats}). Só informativo — não impede o despacho.`}>
                      <span
                        data-testid={`team-vehicle-seats-${t.id}`}
                        className={`shrink-0 font-mono text-[9px] ${members.length > vehicleSeats ? "text-amber-400" : "text-zinc-500"}`}
                      >
                        {members.length}/{vehicleSeats} lugares
                      </span>
                    </Tip>
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
                  <div className="mt-1.5 space-y-1 pl-5">
                    <div className="flex items-center gap-2">
                      <Tip tip={`Combustível: ${vehicle.fuel_l.toFixed(0)}/${vehicle.tank_l.toFixed(0)}L — autonomia ~${Math.round(vehicleRangeKm(vehicle))} km. Sem combustível a equipa não sai do QG.`} block className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Fuel size={9} className="shrink-0" style={{ color: fuelPct < 25 ? "#EF4444" : "#F59E0B" }} />
                          <MiniBar value={fuelPct} color={fuelPct < 25 ? "#EF4444" : "#F59E0B"} height="h-1" />
                          <span className="shrink-0 font-mono text-[9px]" style={{ color: fuelPct < 25 ? "#EF4444" : "#F59E0B" }}>{Math.round(fuelPct)}%</span>
                        </div>
                      </Tip>
                      <Tip tip={`Condição: ${Math.round(vehicle.condition)}% — abaixo de 30% o veículo não opera; abaixo de 50% perde velocidade.`} block className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Wrench size={9} className="shrink-0" style={{ color: vehicle.condition < 30 ? "#EF4444" : "#34D399" }} />
                          <MiniBar value={vehicle.condition} color={vehicle.condition < 30 ? "#EF4444" : "#34D399"} height="h-1" />
                          <span className="shrink-0 font-mono text-[9px]" style={{ color: vehicle.condition < 30 ? "#EF4444" : "#34D399" }}>{Math.round(vehicle.condition)}%</span>
                        </div>
                      </Tip>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {fuelPct < 60 && (
                        <Tip tip="Atestar o depósito por completo com dinheiro limpo.">
                          <button
                            data-testid={`team-refuel-${t.id}`}
                            onClick={() => refuelVehicle(vehicle.id)}
                            disabled={money < refuelCost}
                            className="flex items-center gap-0.5 rounded border border-white/10 px-1.5 py-0.5 font-mono text-[9px] text-amber-400 hover:bg-white/5 disabled:opacity-40"
                          >
                            <Fuel size={9} /> {fmtMoney(refuelCost)}
                          </button>
                        </Tip>
                      )}
                      {vehicle.condition < 60 && (
                        <Tip tip="Reparação completa — devolve o veículo a 100% de condição e velocidade máxima.">
                          <button
                            data-testid={`team-repair-${t.id}`}
                            onClick={() => repairVehicle(vehicle.id)}
                            disabled={money < repairCost}
                            className="flex items-center gap-0.5 rounded border border-white/10 px-1.5 py-0.5 font-mono text-[9px] text-emerald-400 hover:bg-white/5 disabled:opacity-40"
                          >
                            <Wrench size={9} /> {fmtMoney(repairCost)}
                          </button>
                        </Tip>
                      )}
                    </div>
                  </div>
                )}

                {best && rec && (
                  <Tip
                    tip={`Melhor operação para esta equipa: ${best.name}, a ${rec.dist_km}km (${fmtDuration(rec.eta_s)} de viagem), ${Math.round(rec.chance * 100)}% de probabilidade de sucesso. Escolhida por distância, probabilidade e requisitos mínimos cumpridos.`}
                    block
                  >
                    <button
                      data-testid={`team-dispatch-best-${t.id}`}
                      onClick={() => dispatchTeam(best.id, t.id)}
                      className="mt-2 flex w-full items-center justify-center gap-1 rounded border border-green-500/30 bg-green-500/10 px-2 py-1.5 font-mono text-[10px] font-bold uppercase text-green-400 transition-colors hover:bg-green-500/20"
                    >
                      <Zap size={11} /> Despachar → {best.name}
                      <span style={{ color: chanceColor(rec.chance) }}>({Math.round(rec.chance * 100)}%)</span>
                      <span className="text-zinc-500">· {fmtMoney(rec.reward)}</span>
                    </button>
                  </Tip>
                )}

                {enRoute && (
                  <Tip tip="Cancela a operação — a equipa dá meia-volta e regressa ao QG sem recompensa." block>
                    <button
                      data-testid={`recall-team-${t.id}`}
                      onClick={() => recallTeam(enRoute.id)}
                      className="mt-2 flex w-full items-center justify-center gap-1 rounded border border-amber-500/30 px-2 py-1.5 font-mono text-[10px] font-bold uppercase text-amber-400 transition-colors hover:bg-amber-500/10"
                    >
                      <Undo2 size={11} /> Chamar de volta ({enRoute.opportunity.name})
                    </button>
                  </Tip>
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
                <Tip key={key} tip={`${ts.desc} Bónus de sucesso em operações da categoria ${SPEC_LABELS[key]}. Custo: ${fmtMoney(catalog.team_create_cost)} limpos.`} block>
                  <Button
                    data-testid={`create-team-${key}`}
                    onClick={() => createTeam(key)}
                    disabled={state.player.clean_money < catalog.team_create_cost}
                    variant="outline"
                    className="h-full w-full flex-col items-start border-white/10 bg-white/[0.03] px-3 py-2 text-left hover:bg-white/[0.08] disabled:opacity-40"
                  >
                    <span className="text-xs font-bold text-white">{SPEC_LABELS[key]}</span>
                    <span className="whitespace-normal text-[10px] leading-tight text-zinc-500">{ts.desc}</span>
                  </Button>
                </Tip>
              ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
