import { useEffect, useState } from "react";
import { useGame } from "../../context/GameContextV2";
import { useSettings } from "../../context/SettingsContext";
import { fmtMoney, fmtDuration, SPEC_LABELS, STATUS_LABELS, STATUS_COLORS, fatigueColor, chanceColor, teamsReadiness, vehicleRangeKm } from "../../lib/game";
import { Tip, Kpi, SummaryStrip, MiniBar, FavoriteStar } from "./hud";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "../ui/select";
import { Users, Car, UserRound, Undo2, X, Fuel, Wrench, BedDouble, Zap, IdCard, CheckCircle2, AlertTriangle, Activity, Target, Clock, PartyPopper } from "lucide-react";

const MISSION_NEXT_LABEL = { en_route: "Chega em", operating: "Conclui em", returning: "Regressa em" };

const useTick = (active) => {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setT((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
};

export const TeamsPanel = ({ open, onOpenChange, onNavigate }) => {
  const {
    state, catalog, serverNow, createTeam, recallTeam, assignEmployee, assignVehicle,
    refuelVehicle, repairVehicle, restEmployee, dispatchTeam, recommendOpportunityForTeam,
    recommendRepeatForTeam, favoriteTeamIds, toggleFavoriteTeam, justReturnedTeamIds,
  } = useGame();
  const { autoSelectBestVehicle } = useSettings();
  const [recommendations, setRecommendations] = useState({});
  const [repeatRecs, setRepeatRecs] = useState({});
  useTick(open);

  // Equipas sem veículo recebem automaticamente o melhor disponível (o que
  // combina com a especialização, senão o de melhor condição) — só quando a
  // definição está ligada, para não lutar contra uma remoção manual do jogador.
  useEffect(() => {
    if (!autoSelectBestVehicle || !state) return;
    const withoutVehicle = state.teams.filter((t) => t.status === "idle" && !t.vehicle_id);
    if (withoutVehicle.length === 0) return;
    const assignedIds = new Set(state.teams.map((t) => t.vehicle_id).filter(Boolean));
    const pool = state.vehicles.filter((v) => !assignedIds.has(v.id));
    withoutVehicle.forEach((t) => {
      const candidates = pool.filter((v) => !assignedIds.has(v.id));
      if (candidates.length === 0) return;
      const best = [...candidates].sort((a, b) => {
        const idealA = catalog?.vehicle_models?.[a.model_key]?.best_for?.includes(t.spec) ? 1 : 0;
        const idealB = catalog?.vehicle_models?.[b.model_key]?.best_for?.includes(t.spec) ? 1 : 0;
        if (idealA !== idealB) return idealB - idealA;
        return b.condition - a.condition;
      })[0];
      assignedIds.add(best.id);
      assignVehicle(best.id, t.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSelectBestVehicle, state?.teams, state?.vehicles, catalog]);

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
    Promise.all(readyIds.map((id) => recommendRepeatForTeam(id).then((r) => [id, r.ok ? r.data : null])))
      .then((pairs) => {
        if (!cancelled) setRepeatRecs(Object.fromEntries(pairs));
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recomputeKey, recommendOpportunityForTeam, recommendRepeatForTeam]);

  const { repeatLastConfig } = useSettings();
  // Repetir automaticamente: assim que uma equipa fica pronta e há uma
  // sugestão de repetição válida, despacha sem esperar por um clique — a
  // equipa deixa de estar "idle" assim que despachada, o que naturalmente
  // impede repetir o mesmo despacho duas vezes.
  useEffect(() => {
    if (!repeatLastConfig || !state) return;
    readyIds.forEach((id) => {
      const rec = repeatRecs[id];
      if (!rec?.opportunity_id) return;
      const opp = state.opportunities.find((o) => o.id === rec.opportunity_id);
      if (opp) dispatchTeam(opp.id, id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeatLastConfig, repeatRecs]);

  if (!state) return null;
  const money = state.player.clean_money;
  const teamMaxMembers = catalog?.team_max_members || 4;

  const membersOf = (teamId) => state.employees.filter((e) => e.team_id === teamId);
  const vehicleOf = (team) => state.vehicles.find((v) => v.id === team.vehicle_id);
  const missionOf = (team) => state.missions.find((m) => m.team_id === team.id);
  const enRouteMissionOf = (team) => state.missions.find((m) => m.team_id === team.id && m.phase === "en_route");
  const freeEmployees = state.employees.filter((e) => !e.team_id && e.status === "idle");
  const freeVehicles = state.vehicles.filter((v) => !v.team_id);
  const nav = (p) => onNavigate && onNavigate(p);

  const readiness = (t, members, vehicle) => {
    if (t.status !== "idle") return { ok: false, reason: STATUS_LABELS[t.status] || "Ocupada" };
    if (t.available_at && Date.parse(t.available_at) > serverNow()) {
      const remaining = Math.max(0, (Date.parse(t.available_at) - serverNow()) / 1000);
      return { ok: false, reorg: true, reason: `A reorganizar-se (${fmtDuration(remaining)})` };
    }
    if (members.length === 0) return { ok: false, reason: "Sem membros" };
    const ready = members.filter((e) => e.status === "idle" && e.fatigue < 90);
    if (ready.length === 0) return { ok: false, reason: "Membros indisponíveis" };
    if (!vehicle) return { ok: false, reason: "Sem veículo" };
    if (vehicle.condition < 30) return { ok: false, reason: "Veículo avariado" };
    if (vehicle.refueling_until && Date.parse(vehicle.refueling_until) > serverNow()) {
      return { ok: false, reason: "A abastecer" };
    }
    if (vehicle.fuel_l < vehicle.tank_l * 0.12) return { ok: false, reason: "Combustível baixo" };
    const seats = catalog?.vehicle_models?.[vehicle.model_key]?.seats;
    if (seats != null && ready.length > seats) return { ok: false, reason: `Poucos lugares (${seats})` };
    return { ok: true, ready: ready.length };
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-sm overflow-y-auto border-border bg-background/95 backdrop-blur-xl sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white">
            <Users size={18} className="text-primary" /> Equipas
          </SheetTitle>
          <SheetDescription className="text-zinc-500">
            Centro de comando: membros, veículos e despacho num só lugar.
          </SheetDescription>
        </SheetHeader>

        {(() => {
          const tr = teamsReadiness(state, serverNow());
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
          {state.teams.length === 0 && (
            <p className="rounded-lg border border-dashed border-white/10 p-3 text-center font-mono text-[11px] text-zinc-500">
              Ainda não tens equipas — forma a primeira abaixo para começares a operar.
            </p>
          )}
          {/* Favoritas sempre no topo; dentro de cada grupo, equipas ocupadas primeiro (o
              jogador quer ver o que está em ação), depois prontas, e por fim bloqueadas. */}
          {[...state.teams]
            .sort((a, b) => {
              const favA = favoriteTeamIds.includes(a.id) ? 0 : 1;
              const favB = favoriteTeamIds.includes(b.id) ? 0 : 1;
              if (favA !== favB) return favA - favB;
              const rank = (t) => (t.status !== "idle" ? 0 : 1);
              return rank(a) - rank(b);
            })
            .map((t) => {
            const members = membersOf(t.id);
            const vehicle = vehicleOf(t);
            const enRoute = enRouteMissionOf(t);
            const r = readiness(t, members, vehicle);
            const rec = r.ok ? recommendations[t.id] : null;
            const best = rec?.opportunity_id ? state.opportunities.find((o) => o.id === rec.opportunity_id) : null;
            const repeatRec = r.ok ? repeatRecs[t.id] : null;
            const repeatOpp = repeatRec?.opportunity_id && repeatRec.opportunity_id !== rec?.opportunity_id
              ? state.opportunities.find((o) => o.id === repeatRec.opportunity_id)
              : null;
            const vehicleSeats = vehicle ? catalog?.vehicle_models?.[vehicle.model_key]?.seats : null;
            const mission = t.status !== "idle" ? missionOf(t) : null;
            let missionEtaS = null;
            if (mission) {
              const nextAt = mission.phase === "en_route" ? mission.arrive_at : mission.phase === "operating" ? mission.finish_at : mission.return_at;
              missionEtaS = Math.max(0, (Date.parse(nextAt) - serverNow()) / 1000);
            }
            let recallLate = false;
            if (enRoute) {
              const total = Math.max(1, Date.parse(enRoute.arrive_at) - Date.parse(enRoute.depart_at));
              const elapsed = Math.max(0, serverNow() - Date.parse(enRoute.depart_at));
              recallLate = elapsed / total >= (catalog?.recall_penalty_fraction ?? 0.5);
            }
            const fuelPct = vehicle ? (vehicle.fuel_l / vehicle.tank_l) * 100 : 0;
            const refuelCost = vehicle ? Math.ceil((vehicle.tank_l - vehicle.fuel_l) * state.fuel_prices[vehicle.fuel_type]) : 0;
            const repairCost = vehicle ? Math.max(50, Math.round((100 - vehicle.condition) * vehicle.price * 0.002)) : 0;
            const justReturned = justReturnedTeamIds.includes(t.id);
            return (
              <Card
                key={t.id}
                data-testid={`team-card-${t.id}`}
                className={`border-white/10 bg-white/[0.03] p-3 shadow-none ${justReturned ? "lus-flash" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <FavoriteStar testId={`team-favorite-${t.id}`} active={favoriteTeamIds.includes(t.id)} onToggle={() => toggleFavoriteTeam(t.id)} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">
                        {t.name}
                        {justReturned && (
                          <Tip tip="Esta equipa acabou de regressar ao QG e já está pronta a operar.">
                            <span className="ml-1.5 inline-flex items-center gap-0.5 font-mono text-[9px] uppercase text-emerald-400">
                              <PartyPopper size={9} /> regressou
                            </span>
                          </Tip>
                        )}
                      </p>
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
                  </div>
                  <Tip tip={t.status === "idle" ? "Na base — pronta a receber ordens." : "Em operação — volta a estar disponível quando regressar ao QG."} align="end">
                    <Badge
                      variant="outline"
                      className="shrink-0 rounded-full border-transparent px-2 py-0.5 font-mono text-[10px] font-bold uppercase"
                      style={{ color: STATUS_COLORS[t.status], background: `${STATUS_COLORS[t.status]}1a` }}
                    >
                      {STATUS_LABELS[t.status]}
                    </Badge>
                  </Tip>
                </div>

                <p
                  data-testid={`team-readiness-${t.id}`}
                  className={`mt-2 flex items-center gap-1 font-mono text-[10px] font-bold uppercase ${
                    r.ok ? "text-emerald-400" : mission || r.reorg ? "text-cyan-400" : "text-amber-400"
                  }`}
                >
                  {r.ok ? <CheckCircle2 size={11} /> : mission || r.reorg ? <Clock size={11} /> : <AlertTriangle size={11} />}
                  {r.ok
                    ? `Pronta para operar (${r.ready} membros)`
                    : mission
                    ? `${MISSION_NEXT_LABEL[mission.phase] || "A caminho"} ${fmtDuration(missionEtaS)}`
                    : r.reason}
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
                          <Select value="" onValueChange={(v) => v && assignEmployee(v, t.id)}>
                            <SelectTrigger
                              data-testid={`team-add-member-${t.id}`}
                              className="h-auto w-auto gap-1 rounded border-dashed border-white/20 bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-cyan-400 [&>svg]:h-3 [&>svg]:w-3"
                            >
                              <SelectValue placeholder="+ membro" />
                            </SelectTrigger>
                            <SelectContent>
                              {freeEmployees.map((e) => (
                                <SelectItem key={e.id} value={e.id} className="font-mono text-xs">
                                  {e.name.split(" ")[0]} · {catalog?.specializations?.[e.role_key]?.name || e.role_key} N{e.level}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                    <Select
                      value={t.vehicle_id || "__none__"}
                      onValueChange={(vid) => {
                        if (vid === "__none__") { if (t.vehicle_id) assignVehicle(t.vehicle_id, null); }
                        else assignVehicle(vid, t.id);
                      }}
                    >
                      <SelectTrigger data-testid={`team-vehicle-select-${t.id}`} className="h-7 flex-1 border-white/10 bg-black/60 font-mono text-[11px] text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__" className="font-mono text-xs">Sem veículo</SelectItem>
                        {vehicle && <SelectItem value={vehicle.id} className="font-mono text-xs">{vehicle.name}</SelectItem>}
                        {freeVehicles.map((v) => {
                          const ideal = catalog?.vehicle_models?.[v.model_key]?.best_for?.includes(t.spec);
                          return (
                            <SelectItem key={v.id} value={v.id} className="font-mono text-xs">
                              {ideal ? "★ " : ""}{v.name} · {Math.round((v.fuel_l / v.tank_l) * 100)}% comb.
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="font-mono text-[11px] text-zinc-400">{vehicle ? vehicle.name : "Sem veículo"}</span>
                  )}
                  {vehicle && vehicleSeats != null && (
                    <Tip tip={`Lugares ocupados pela equipa vs. capacidade do veículo (${vehicleSeats}). Se a equipa tiver mais membros disponíveis do que lugares, o despacho fica bloqueado.`}>
                      <span
                        data-testid={`team-vehicle-seats-${t.id}`}
                        className={`shrink-0 font-mono text-[9px] ${members.length > vehicleSeats ? "text-red-400" : "text-zinc-500"}`}
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
                          <Button
                            data-testid={`team-refuel-${t.id}`}
                            variant="outline" size="sm"
                            onClick={() => refuelVehicle(vehicle.id)}
                            disabled={money < refuelCost}
                            className={`h-auto gap-0.5 px-1.5 py-0.5 font-mono text-[9px] ${
                              money < refuelCost
                                ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                                : "border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                            }`}
                          >
                            <Fuel size={9} /> {fmtMoney(refuelCost)}
                          </Button>
                        </Tip>
                      )}
                      {vehicle.condition < 60 && (
                        <Tip tip="Reparação completa — devolve o veículo a 100% de condição e velocidade máxima.">
                          <Button
                            data-testid={`team-repair-${t.id}`}
                            variant="outline" size="sm"
                            onClick={() => repairVehicle(vehicle.id)}
                            disabled={money < repairCost}
                            className={`h-auto gap-0.5 px-1.5 py-0.5 font-mono text-[9px] ${
                              money < repairCost
                                ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                                : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                            }`}
                          >
                            <Wrench size={9} /> {fmtMoney(repairCost)}
                          </Button>
                        </Tip>
                      )}
                    </div>
                  </div>
                )}

                <Tip
                  tip={
                    best && rec
                      ? `Melhor operação para esta equipa: ${best.name}, a ${rec.dist_km}km (${fmtDuration(rec.eta_s)} de viagem), ${Math.round(rec.chance * 100)}% de probabilidade de sucesso. Escolhida por distância, probabilidade e requisitos mínimos cumpridos.`
                      : r.ok
                      ? `Equipa pronta, mas sem missões disponíveis ou elegíveis neste momento. Certifica-te que: tens missões geradas no mapa (cria novas se necessário), a equipa cumpre os requisitos de nível mínimo, e tem membros suficientes (${r.ready || 0} disponíveis).`
                      : r.reason
                  }
                  block
                >
                  <Button
                    data-testid={`team-dispatch-best-${t.id}`}
                    variant="outline"
                    onClick={() => best && rec && dispatchTeam(best.id, t.id)}
                    disabled={!best || !rec}
                    className={`mt-2 h-auto w-full flex-col items-start gap-1 px-2 py-1.5 font-mono text-[9px] font-bold uppercase md:flex-row md:items-center md:text-[10px] ${
                      best && rec
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
                        : "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                    }`}
                  >
                    <div className="flex items-center gap-1 truncate">
                      <Zap size={11} className="shrink-0" />
                      {best && rec ? (
                        <>Despachar → {best.name}</>
                      ) : (
                        <>Sem missões elegíveis</>
                      )}
                    </div>
                    {best && rec && (
                      <div className="flex flex-wrap items-center gap-1">
                        <span style={{ color: chanceColor(rec.chance) }}>({Math.round(rec.chance * 100)}%)</span>
                        <span className="text-zinc-500">ETA {fmtDuration(rec.eta_s)}</span>
                        <span className="text-zinc-500">{fmtMoney(rec.reward)}</span>
                      </div>
                    )}
                  </Button>
                </Tip>

                {repeatOpp && repeatRec && (
                  <Tip
                    tip={`Repetir o último tipo de missão desta equipa: ${repeatOpp.name}, a ${repeatRec.dist_km}km, ${Math.round(repeatRec.chance * 100)}% de probabilidade de sucesso.`}
                    block
                  >
                    <Button
                      data-testid={`team-repeat-last-${t.id}`}
                      variant="outline"
                      onClick={() => dispatchTeam(repeatOpp.id, t.id)}
                      className="mt-1.5 h-auto w-full flex-col items-start gap-1 border-cyan-500/30 bg-cyan-500/10 px-2 py-1.5 font-mono text-[9px] font-bold uppercase text-cyan-400 hover:bg-cyan-500/20 md:flex-row md:items-center md:text-[10px]"
                    >
                      <div className="flex items-center gap-1 truncate">
                        <Undo2 size={11} className="shrink-0 rotate-180" /> Repetir última → {repeatOpp.name}
                      </div>
                      <span className="text-zinc-500">({Math.round(repeatRec.chance * 100)}%)</span>
                    </Button>
                  </Tip>
                )}

                {enRoute && (
                  <Tip
                    tip={
                      recallLate
                        ? "Cancela a operação — a equipa já vai a mais de metade do caminho: regressa sem recompensa e com uma pequena penalização de calor e fadiga."
                        : "Cancela a operação — a equipa dá meia-volta e regressa ao QG sem recompensa nem penalização."
                    }
                    block
                  >
                    <Button
                      data-testid={`recall-team-${t.id}`}
                      variant="outline"
                      onClick={() => recallTeam(enRoute.id)}
                      className={`mt-2 h-auto w-full flex-col items-start gap-1 px-2 py-1.5 font-mono text-[9px] font-bold uppercase md:flex-row md:items-center md:text-[10px] ${
                        recallLate
                          ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                          : "border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                      }`}
                    >
                      <div className="flex items-center gap-1 truncate">
                        <Undo2 size={11} className="shrink-0" /> Chamar de volta
                      </div>
                      <span className="text-zinc-500 md:text-inherit">({enRoute.opportunity.name})</span>
                    </Button>
                  </Tip>
                )}
              </Card>
            );
          })}
        </div>

        <div className="mt-6">
          <h3 className="mb-2 flex items-center justify-between font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">
            <span>Formar nova equipa · {catalog && fmtMoney(catalog.team_create_cost)}</span>
            {state.caps?.teams && (
              <Tip tip="Nº de equipas vs. o limite atual — sobe de nível da organização para desbloquear mais.">
                <span className={state.caps.teams.used >= state.caps.teams.max ? "text-amber-400" : "text-zinc-500"}>
                  {state.caps.teams.used}/{state.caps.teams.max}
                </span>
              </Tip>
            )}
          </h3>
          {state.caps?.teams && state.caps.teams.used >= state.caps.teams.max && (
            <p className="mb-2 font-mono text-[10px] text-amber-400">
              Limite de equipas atingido para o nível {state.player.level} — sobe de nível para desbloquear mais.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {catalog &&
              Object.entries(catalog.team_specs).map(([key, ts]) => {
                const atCap = state.caps?.teams && state.caps.teams.used >= state.caps.teams.max;
                return (
                  <Tip key={key} tip={atCap ? `Limite de equipas atingido para o nível ${state.player.level}.` : `${ts.desc} Bónus de sucesso em operações da categoria ${SPEC_LABELS[key]}. Custo: ${fmtMoney(catalog.team_create_cost)} limpos.`} block>
                    <Button
                      data-testid={`create-team-${key}`}
                      onClick={() => createTeam(key)}
                      disabled={atCap || state.player.clean_money < catalog.team_create_cost}
                      variant="outline"
                      className="h-full w-full flex-col items-start border-white/10 bg-white/[0.03] px-3 py-2 text-left hover:bg-white/[0.08] disabled:opacity-40"
                    >
                      <span className="text-xs font-bold text-white">{SPEC_LABELS[key]}</span>
                      <span className="whitespace-normal text-[10px] leading-tight text-zinc-500">{ts.desc}</span>
                    </Button>
                  </Tip>
                );
              })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
