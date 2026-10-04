import { useEffect, useState } from "react";
import { useGame } from "../../context/GameContextV2";
import {
  fmtMoney, fmtDuration, STATUS_LABELS, effectiveSpeed, vehicleRangeKm, conditionBand, matchesSearch,
  LARGE_PURCHASE_THRESHOLD, vehicleTier, vehicleAdequacy, vehicleSpeedFactor, vehicleMissionScore, SPEC_LABELS,
} from "../../lib/game";
import { cn } from "../../lib/utils";
import { Tip, Kpi, SummaryStrip, MiniBar, InlineRename, FavoriteStar, ConfirmButton, PurchaseButton, PanelWatermark, SectionHeader } from "./hud";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "../ui/select";
import {
  Car, Fuel, Wrench, Trash2, Lock, BarChart3, ChevronDown, Warehouse, UserRound, Route,
  CheckCircle2, Banknote, Gem, Users, Search, Clock, ShoppingCart, Sparkles, Gauge,
} from "lucide-react";

const VStat = ({ label, value }) => (
  <Card className="rounded bg-black/40 px-1.5 py-1 text-center shadow-none">
    <p className="text-[8px] uppercase tracking-wider text-zinc-600">{label}</p>
    <p className="font-mono text-[10px] font-bold text-white">{value}</p>
  </Card>
);

const useTick = (active) => {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setT((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
};

// Chip do tier (Rua/Profissional/Executiva/Elite) — derivado do nível de
// desbloqueio do modelo, com a cor a alimentar toda a moldura do cartão.
const TierChip = ({ tier }) => (
  <Tip tip={`Tier ${tier.label} — classe do veículo pelo nível de desbloqueio no stand.`}>
    <span
      className="shrink-0 rounded-sm border px-1 py-px font-mono text-[8px] font-bold uppercase tracking-widest"
      style={{ borderColor: `${tier.color}55`, color: tier.color, backgroundColor: `${tier.color}14` }}
    >
      {tier.label}
    </span>
  </Tip>
);

// Adequação por categoria de operação — vehicle_mission_score do motor
// (velocidade+discrição ponderadas por categoria) × realce best_for.
const AdequacyRow = ({ model, catalog, testId }) => {
  const cells = vehicleAdequacy(model, catalog);
  return (
    <div data-testid={testId} className="grid grid-cols-5 gap-1">
      {cells.map((c) => (
        <Tip
          key={c.category}
          tip={`${c.label}: adequação ${Math.round(c.score * 100)}%${c.best ? " — categoria ideal deste veículo (bónus extra do motor)" : ""}. A mesma ponderação velocidade/discrição que a chance de missão usa.`}
          block
        >
          <div className={cn("rounded-sm border px-1 py-0.5", c.best ? "border-emerald-500/30 bg-emerald-500/[0.06]" : "border-white/5 bg-black/30")}>
            <p className={cn("truncate text-center font-mono text-[8px] uppercase tracking-wide", c.best ? "text-emerald-400" : "text-zinc-600")}>
              {c.label.slice(0, 3)}
            </p>
            <MiniBar value={c.score * 100} color={c.best ? "#34D399" : "#71717A"} className="mt-0.5" />
          </div>
        </Tip>
      ))}
    </div>
  );
};

export const FleetPanel = ({ open, onOpenChange, onNavigate }) => {
  const {
    state, catalog, serverNow, buyVehicle, sellVehicle, refuelVehicle, repairVehicle, assignVehicle,
    transferVehicle, renameVehicle, favoriteVehicleIds, toggleFavoriteVehicle, optimizeVehicles, repairFleetAll,
  } = useGame();
  const [statsOpen, setStatsOpen] = useState(null);
  const [query, setQuery] = useState("");
  useTick(open);
  if (!state) return null;
  const caps = state.caps.vehicles;
  const fleetMeta = catalog?.fleet_meta || {};

  const teamOf = (v) => state.teams.find((t) => t.id === v.team_id);
  const teamMembersList = (teamId) => state.employees.filter((e) => e.team_id === teamId);
  const teamMembers = (teamId) => teamMembersList(teamId).length;
  const vehicleBusy = (v) => {
    const t = teamOf(v);
    return t && t.status !== "idle";
  };
  const isRefueling = (v) => v.refueling_until && Date.parse(v.refueling_until) > serverNow();
  const isTransferring = (v) => v.transfer && Date.parse(v.transfer.ends_at) > serverNow();
  const missionOf = (team) => state.missions.find((m) => m.team_id === team.id);
  // Nunca devolve vazio — QG é sempre o fallback quando não há property_id.
  const baseNameOf = (v) => {
    if (!v.property_id) return "Quartel-General";
    return state.properties.find((p) => p.id === v.property_id)?.name || "Quartel-General";
  };
  const transferDestNameOf = (v) => {
    const toId = v.transfer?.to_property_id;
    if (!toId) return "Quartel-General";
    return state.properties.find((p) => p.id === toId)?.name || "Quartel-General";
  };

  const repairableIds = state.vehicles.filter((v) => !vehicleBusy(v) && !isTransferring(v) && v.condition < 99.5).map((v) => v.id);
  const repairAllCost = state.vehicles
    .filter((v) => repairableIds.includes(v.id))
    .reduce((a, v) => a + Math.max(50, Math.round((100 - v.condition) * v.price * 0.002)), 0);
  const repairAll = () => repairFleetAll();

  const idleTeamsCount = state.teams.filter((t) => t.status === "idle").length;
  const canOptimize = state.vehicles.length > 0 && idleTeamsCount > 0;

  const filteredVehicles = state.vehicles.filter((v) =>
    matchesSearch(query, v.name, catalog?.vehicle_models?.[v.model_key]?.name || v.model_key)
  );
  // Disponibilidade primeiro: favoritos, depois operacionais, depois em operação, por fim os que precisam de atenção.
  const sortedVehicles = [...filteredVehicles].sort((a, b) => {
    const favA = favoriteVehicleIds.includes(a.id) ? 0 : 1;
    const favB = favoriteVehicleIds.includes(b.id) ? 0 : 1;
    if (favA !== favB) return favA - favB;
    const rank = (v) => {
      if (vehicleBusy(v) || isRefueling(v)) return 1;
      if (v.condition < 30 || v.fuel_l < v.tank_l * 0.12) return 2;
      return 0;
    };
    return rank(a) - rank(b);
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sub-panel">
        <SheetHeader>
          <PanelWatermark icon={Car} />
          <SheetTitle className="flex items-center gap-2 text-white">
            <Car size={18} className="text-primary" /> Frota
            <span className="ml-auto font-mono text-xs text-zinc-500" data-testid="vehicle-caps">{caps.used}/{caps.max}</span>
          </SheetTitle>
          <SheetDescription className="text-zinc-500">Sem rodas não há golpes — abastece, repara e mantém tudo pronto a sair.</SheetDescription>
        </SheetHeader>

        {(() => {
          const vs = state.vehicles;
          const operational = vs.filter((v) => v.condition >= 30 && v.fuel_l >= v.tank_l * 0.12).length;
          const avgCond = vs.length ? Math.round(vs.reduce((a, v) => a + v.condition, 0) / vs.length) : 0;
          const totalRange = Math.round(vs.reduce((a, v) => a + vehicleRangeKm(v), 0));
          const totalCosts = vs.reduce((a, v) => a + (v.fuel_spent_total || 0) + (v.repair_spent_total || 0), 0);
          return (
            <SummaryStrip cols={4} className="mt-3" testId="fleet-summary">
              <Kpi icon={CheckCircle2} label="Operacionais" value={`${operational}/${vs.length}`} color={operational === vs.length ? "#34D399" : "#F59E0B"}
                tip="Veículos prontos a sair: condição ≥ 30% e combustível suficiente." />
              <Kpi icon={Wrench} label="Condição" value={`${avgCond}%`} color={avgCond < 50 ? "#EF4444" : "#34D399"} bar={avgCond} barColor={avgCond < 50 ? "#EF4444" : "#34D399"}
                tip="Condição média da frota — a velocidade cai em curva contínua com o desgaste (um veículo a 65% já se ressente)." />
              <Kpi icon={Route} label="Autonomia" value={`${totalRange} km`} color="#22D3EE"
                tip="Autonomia total combinada com o combustível atual nos depósitos." />
              <Kpi icon={Banknote} label="Custos" value={fmtMoney(totalCosts)} color="#F59E0B"
                tip="Total acumulado gasto em combustível e reparações de toda a frota." />
            </SummaryStrip>
          );
        })()}

        <div className="mt-3 flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search size={11} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-zinc-600" />
            <Input
              data-testid="fleet-search"
              value={query}
              onChange={(ev) => setQuery(ev.target.value)}
              placeholder="Pesquisar veículo..."
              className="h-auto w-full border-white/10 bg-black/60 py-1.5 pl-6 pr-2 font-mono text-[11px] text-white placeholder:text-zinc-600"
            />
          </div>
          <Tip tip={canOptimize
            ? `Redistribui os veículos disponíveis pelas ${idleTeamsCount} equipas livres, escolhendo os mais adequados e garantindo lugares para todos os membros.`
            : state.vehicles.length === 0 ? "Sem veículos na frota." : "Nenhuma equipa disponível para receber veículos."}>
            <button
              data-testid="fleet-optimize"
              onClick={() => canOptimize && optimizeVehicles()}
              disabled={!canOptimize}
              className={cn(
                "flex shrink-0 items-center justify-center gap-1 rounded-md border px-2 py-1.5 font-mono text-[10px] font-bold uppercase transition-colors",
                canOptimize
                  ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400 hover:border-cyan-500/60 hover:bg-cyan-500/20"
                  : "cursor-not-allowed border-white/10 bg-white/[0.03] text-zinc-600"
              )}
            >
              <Sparkles size={11} /> Otimizar
            </button>
          </Tip>
          {repairableIds.length > 0 && (
            <PurchaseButton
              testId="fleet-repair-all"
              icon={Wrench}
              label="Reparar"
              can={state.player.clean_money >= repairAllCost}
              blockedReasons={["Dinheiro insuficiente."]}
              availableTip={`Repara todos os veículos disponíveis abaixo de 100% de condição (${repairableIds.length}) por ${fmtMoney(repairAllCost)} no total.`}
              onConfirm={repairAll}
              className="w-full shrink-0 sm:w-auto"
            />
          )}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="fleet-list">
          {state.vehicles.length === 0 && (
            <p className="col-span-full rounded-lg border border-dashed border-white/10 p-3 text-center font-mono text-[11px] text-zinc-500">
              Ainda não tens veículos — compra o primeiro no stand abaixo.
            </p>
          )}
          {state.vehicles.length > 0 && sortedVehicles.length === 0 && (
            <p className="col-span-full rounded-lg border border-dashed border-white/10 p-3 text-center font-mono text-[11px] text-zinc-500">
              Nenhum veículo com esse nome na garagem.
            </p>
          )}
          {sortedVehicles.map((v) => {
            const model = catalog?.vehicle_models?.[v.model_key];
            const tier = vehicleTier(model || { min_level: 1 });
            const team = teamOf(v);
            const members = team ? teamMembersList(team.id) : [];
            const busy = vehicleBusy(v);
            const mission = busy ? missionOf(team) : null;
            const refueling = isRefueling(v);
            const refuelRemaining = refueling ? Math.max(0, (Date.parse(v.refueling_until) - serverNow()) / 1000) : 0;
            const transferring = isTransferring(v);
            const transferRemaining = transferring ? Math.max(0, (Date.parse(v.transfer.ends_at) - serverNow()) / 1000) : 0;
            const locked = busy || transferring;
            const seats = model?.seats;
            const fuelPct = (v.fuel_l / v.tank_l) * 100;
            const refuelCost = Math.ceil((v.tank_l - v.fuel_l) * (state.fuel_prices?.[v.fuel_type] || 0));
            const repairCost = Math.max(50, Math.round((100 - v.condition) * v.price * 0.002));
            const sellValue = Math.round(v.price * (fleetMeta.sell_fraction ?? 0.4) * (v.condition / 100));
            const effSpeed = effectiveSpeed(v);
            const speedFactor = vehicleSpeedFactor(v.condition, fleetMeta);
            const speedReduced = effSpeed < v.speed - 0.05;
            const band = conditionBand(v.condition);
            const modelName = model?.name || v.model_key;
            const renamed = v.name !== modelName;
            const teamFit = team && model ? vehicleMissionScore(model, team.spec || "especial", catalog?.vehicle_category_weights) : null;
            const teamBest = team && model ? (model.best_for || []).includes(team.spec) : false;
            let missionEtaS = null;
            let missionPhaseLabel = "";
            if (mission) {
              const nextAt = mission.phase === "en_route" ? mission.arrive_at : mission.phase === "operating" ? mission.finish_at : mission.return_at;
              missionEtaS = Math.max(0, (Date.parse(nextAt) - serverNow()) / 1000);
              missionPhaseLabel = STATUS_LABELS[mission.phase] || mission.phase;
            }
            return (
              <Card key={v.id} data-testid={`vehicle-card-${v.id}`} className="h-full min-w-0 sub-card sub-doss-card p-2.5 shadow-none" style={{ "--dtier": tier.color }}>
                <div className="relative z-[1] min-w-0">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <FavoriteStar testId={`vehicle-favorite-${v.id}`} active={favoriteVehicleIds.includes(v.id)} onToggle={() => toggleFavoriteVehicle(v.id)} />
                        <InlineRename
                          testId={`vehicle-rename-${v.id}`} value={v.name} onSave={(name) => renameVehicle(v.id, name)}
                          textClassName="text-sm font-bold text-white"
                        />
                      </div>
                      <TierChip tier={tier} />
                    </div>
                    <p className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-500">
                      {renamed && (
                        <Tip tip="Modelo original deste veículo, antes de o renomeares.">
                          <span data-testid={`vehicle-model-tag-${v.id}`} className="mr-1.5 rounded bg-black/40 px-1 py-px text-zinc-400">{modelName}</span>
                        </Tip>
                      )}
                      {model?.luxury && (
                        <Tip tip="Veículo de luxo — chama mais a atenção e aumenta o calor gerado em operações discretas.">
                          <span className="mr-1.5 inline-flex items-center gap-0.5 text-purple-300">
                            <Gem size={9} /> luxo
                          </span>
                        </Tip>
                      )}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <Tip tip={`Velocidade efetiva ${effSpeed.toFixed(1)} m/s de ${v.speed} m/s nominais — a condição (${Math.round(v.condition)}%) rende ${Math.round(speedFactor * 100)}% em curva contínua do motor (nunca abaixo de ${Math.round((fleetMeta.speed_floor ?? 0.6) * 100)}%).`}>
                        <span className={cn("inline-flex items-center gap-0.5 font-mono text-[9px]", speedReduced ? "text-amber-400" : "text-zinc-500")}>
                          <Gauge size={9} /> {effSpeed.toFixed(1)} m/s
                        </span>
                      </Tip>
                      <Tip tip={`Autonomia com o combustível atual (${v.fuel_l.toFixed(0)}L, consumo ${v.cons}L/100km). As viagens são ida e volta a partir do QG.`}>
                        <span className="inline-flex items-center gap-0.5 font-mono text-[9px] text-cyan-400">
                          <Route size={9} /> ~{Math.round(vehicleRangeKm(v))} km
                        </span>
                      </Tip>
                      {seats != null && (
                        <Tip tip={`Lugares ocupados pela equipa atribuída vs. capacidade do veículo (${seats}). Acima da capacidade, o despacho fica bloqueado.`}>
                          <span className={cn("inline-flex items-center gap-0.5 font-mono text-[9px]", members.length > seats ? "text-red-400" : "text-zinc-500")}>
                            <Users size={9} /> {members.length}/{seats}
                          </span>
                        </Tip>
                      )}
                      <Tip tip={`${Math.round(Number(v.km_total) || 0)} km percorridos ao serviço da organização.`}>
                        <span className="inline-flex items-center gap-0.5 font-mono text-[9px] text-zinc-500">
                          <BarChart3 size={9} /> {Math.round(Number(v.km_total) || 0)} km
                        </span>
                      </Tip>
                    </div>
                  </div>

                {busy && mission && (
                  <div className="relative z-[1] mt-1.5">
                    <Tip tip={`${mission.opportunity?.name || "Operação"} · ${missionPhaseLabel} · termina em ${fmtDuration(missionEtaS)}. Fica disponível quando a equipa regressar ao QG.`}>
                      <span data-testid={`vehicle-mission-badge-${v.id}`} className="inline-block rounded-full bg-red-600/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-red-400">
                        {mission.opportunity?.name || "Em missão"} <span className="font-normal normal-case text-red-300/80">· {missionPhaseLabel} · {fmtDuration(missionEtaS)}</span>
                      </span>
                    </Tip>
                  </div>
                )}

                {/* Equipa a bordo + adequação à especialização dela */}
                {team && (
                  <div className="relative z-[1] mt-1.5 rounded-md border border-white/5 bg-black/30 p-1.5" data-testid={`vehicle-team-fit-${v.id}`}>
                    <div className="flex items-center justify-between gap-1">
                      <p className="flex min-w-0 items-center gap-1 font-mono text-[10px] text-zinc-300">
                        <UserRound size={10} className="shrink-0 text-zinc-500" />
                        <span className="truncate">{team.name}</span>
                        {members.length > 0 && (
                          <span className="shrink-0 text-zinc-600">· {members.map((m) => m.name.split(" ")[0]).join(", ")}</span>
                        )}
                      </p>
                    </div>
                    {teamFit != null && (
                      <Tip tip={`Adequação à especialização ${SPEC_LABELS[team.spec] || team.spec}: ${Math.round(teamFit * 100)}%${teamBest ? " — modelo ideal para esta equipa." : "."}`} block>
                        <div className="mt-1">
                          <div className="flex justify-between font-mono text-[8.5px] uppercase tracking-wider text-zinc-500">
                            <span>Match · {SPEC_LABELS[team.spec] || team.spec}</span>
                            <span className={teamBest ? "text-emerald-400" : teamFit >= 0.5 ? "text-zinc-300" : "text-amber-400"}>{Math.round(teamFit * 100)}%{teamBest ? " ★" : ""}</span>
                          </div>
                          <MiniBar value={teamFit * 100} color={teamBest ? "#34D399" : teamFit >= 0.5 ? "#A1A1AA" : "#F59E0B"} className="mt-0.5" />
                        </div>
                      </Tip>
                    )}
                  </div>
                )}

                {transferring ? (
                  <p data-testid={`vehicle-transfer-status-${v.id}`} className="relative z-[1] mt-1.5 flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-cyan-400">
                    <Clock size={10} /> Em transferência para {transferDestNameOf(v)} · {fmtDuration(transferRemaining)}
                  </p>
                ) : (
                  <p className="relative z-[1] mt-1.5 flex items-center gap-1 font-mono text-[10px] text-zinc-400">
                    <Warehouse size={10} className="shrink-0 text-zinc-500" /> Base: {baseNameOf(v)}
                  </p>
                )}

                <div className="relative z-[1] mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex justify-between font-mono text-[9px] uppercase text-zinc-500">
                      <span>Combustível</span>
                      <span>{v.fuel_l.toFixed(0)}/{v.tank_l.toFixed(0)}L</span>
                    </div>
                    <MiniBar value={fuelPct} color="#FBBF24" className="mt-0.5" />
                  </div>
                  <div>
                    <div className="flex justify-between font-mono text-[9px] uppercase text-zinc-500">
                      <span>Condição</span>
                      <Tip tip={`${Math.round(v.condition)}% de condição — velocidade real ${Math.round(speedFactor * 100)}% do nominal (curva contínua do motor) e penalização de chance abaixo de ${fleetMeta.condition_penalty_threshold ?? 70}%.`}>
                        <span>
                          <span style={{ color: band.color }}>{band.label}</span>
                          {speedReduced && <span className="ml-1 text-amber-400">vel. {Math.round(speedFactor * 100)}%</span>}
                        </span>
                      </Tip>
                    </div>
                    <MiniBar value={v.condition} color={v.condition < 30 ? "#EF4444" : v.condition < (fleetMeta.condition_penalty_threshold ?? 70) ? "#F59E0B" : "#34D399"} className="mt-0.5" />
                  </div>
                </div>

                {/* Adequação por operação — a mesma régua do motor */}
                {model && (
                  <div className="relative z-[1] mt-2">
                    <AdequacyRow model={model} catalog={catalog} testId={`vehicle-adequacy-${v.id}`} />
                  </div>
                )}

                <Select
                  value={v.team_id || "__none__"}
                  disabled={locked}
                  onValueChange={(tid) => assignVehicle(v.id, tid === "__none__" ? null : tid)}
                >
                  <SelectTrigger data-testid={`vehicle-team-select-${v.id}`} className="relative z-[1] mt-2 w-full border-white/10 bg-black/60 font-mono text-[11px] text-white disabled:opacity-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" className="font-mono text-xs">Na garagem (sem equipa)</SelectItem>
                    {state.teams.map((t) => {
                      const label = t.name + " · " + teamMembers(t.id) + " membros";
                      return <SelectItem key={t.id} value={t.id} className="font-mono text-xs">{label}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
                <Select
                  value={v.property_id || "__hq__"}
                  disabled={locked}
                  onValueChange={(pid) => transferVehicle(v.id, pid === "__hq__" ? null : pid)}
                >
                  <SelectTrigger data-testid={`vehicle-base-select-${v.id}`} className="relative z-[1] mt-1.5 w-full border-white/10 bg-black/60 font-mono text-[11px] text-white disabled:opacity-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__hq__" className="font-mono text-xs">Quartel-General</SelectItem>
                    {state.properties.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="font-mono text-xs">{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {v.team_id && teamMembers(v.team_id) === 0 && (
                  <button
                    data-testid={`vehicle-team-empty-${v.id}`}
                    onClick={() => onNavigate && onNavigate("employees")}
                    className="relative z-[1] mt-1 flex items-center gap-1 font-mono text-[10px] text-amber-400 underline-offset-2 hover:underline"
                  >
                    <UserRound size={10} /> Equipa sem membros — atribuir em Operacionais
                  </button>
                )}

                <div className="relative z-[1] mt-2 flex gap-1.5">
                  {refueling ? (
                    <span
                      data-testid={`refuel-vehicle-${v.id}`}
                      className="flex flex-1 items-center justify-center gap-1 rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 font-mono text-[10px] text-amber-400"
                    >
                      <Clock size={11} /> A abastecer · {fmtDuration(refuelRemaining)}
                    </span>
                  ) : (
                    <PurchaseButton
                      testId={`refuel-vehicle-${v.id}`}
                      icon={Fuel}
                      label={fmtMoney(refuelCost)}
                      can={!locked && fuelPct <= 99 && state.player.clean_money >= refuelCost}
                      blockedReasons={[
                        transferring ? "Veículo em trânsito para outra base." : busy ? "Veículo em operação." : null,
                        fuelPct > 99 ? "Depósito já cheio." : null,
                        state.player.clean_money < refuelCost ? "Dinheiro insuficiente." : null,
                      ].filter(Boolean)}
                      availableTip={`Atestar o depósito (${(v.tank_l - v.fuel_l).toFixed(0)}L a ${(state.fuel_prices?.[v.fuel_type] || 0).toFixed(2)} €/L) — demora alguns segundos.`}
                      onConfirm={() => refuelVehicle(v.id)}
                      className="flex-1"
                    />
                  )}
                  <PurchaseButton
                    testId={`repair-vehicle-${v.id}`}
                    icon={Wrench}
                    label={fmtMoney(repairCost)}
                    can={!locked && v.condition <= 99 && state.player.clean_money >= repairCost}
                    blockedReasons={[
                      transferring ? "Veículo em trânsito para outra base." : busy ? "Veículo em operação." : null,
                      v.condition > 99 ? "Já está a 100% de condição." : null,
                      state.player.clean_money < repairCost ? "Dinheiro insuficiente." : null,
                    ].filter(Boolean)}
                    availableTip={`Reparar até 100% de condição — recupera velocidade máxima${state.bonuses?.repair_discount ? " (desconto de oficina aplicado)" : ""}.`}
                    onConfirm={() => repairVehicle(v.id)}
                    className="flex-1"
                  />
                  <ConfirmButton
                    testId={`sell-vehicle-${v.id}`}
                    icon={Trash2}
                    label={fmtMoney(sellValue)}
                    confirmLabel="Vender?"
                    color="text-red-400"
                    onConfirm={() => sellVehicle(v.id)}
                    disabled={locked}
                    className="flex-1"
                    tip={
                      transferring
                        ? "Não podes vender um veículo em trânsito para outra base."
                        : `Vender este veículo por ${fmtMoney(sellValue)} (${Math.round((fleetMeta.sell_fraction ?? 0.4) * 100)}% do preço × condição). Ação irreversível.`
                    }
                  />
                </div>

                <button
                  data-testid={`vehicle-stats-toggle-${v.id}`}
                  onClick={() => setStatsOpen(statsOpen === v.id ? null : v.id)}
                  className="relative z-[1] mt-2 flex w-full items-center justify-center gap-1 font-mono text-[10px] uppercase text-zinc-500 transition-colors hover:text-white"
                >
                  <BarChart3 size={11} /> Estatísticas
                  <ChevronDown size={11} className={`transition-transform ${statsOpen === v.id ? "rotate-180" : ""}`} />
                </button>
                {statsOpen === v.id && (
                  <div data-testid={`vehicle-stats-${v.id}`} className="relative z-[1] mt-1.5 grid grid-cols-3 gap-1.5 border-t border-white/10 pt-2">
                    <VStat label="Missões" value={`${v.missions_success || 0}✓/${v.missions_done || 0}`} />
                    <VStat label="Sucesso" value={v.missions_done ? `${Math.round(((v.missions_success || 0) / v.missions_done) * 100)}%` : "—"} />
                    <VStat label="Km" value={Math.round(Number(v.km_total) || 0)} />
                    <VStat label="Comb. gasto" value={fmtMoney(v.fuel_spent_total || 0)} />
                    <VStat label="Reparações" value={fmtMoney(v.repair_spent_total || 0)} />
                    <VStat label="Vel. efetiva" value={`${effSpeed.toFixed(1)} m/s`} />
                    <VStat label="Desde reparação" value={`${v.missions_since_repair || 0} missões`} />
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <div className="mt-6">
          <SectionHeader icon={ShoppingCart} title="Stand de veículos" meta={catalog ? `${Object.keys(catalog.vehicle_models || {}).length} modelos` : undefined} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {catalog &&
              Object.entries(catalog.vehicle_models).map(([key, m]) => {
                const tier = vehicleTier(m);
                const locked = state.player.level < m.min_level;
                const owned = state.vehicles.filter((v) => v.model_key === key).length;
                return (
                  <Card key={key} data-testid={`stand-card-${key}`} className={cn("h-full min-w-0 sub-card sub-doss-card p-2.5 shadow-none", locked && "opacity-80")} style={{ "--dtier": tier.color }}>
                    <div className="relative z-[1] min-w-0">
                        <div className="flex items-start justify-between gap-1.5">
                          <p className="truncate text-sm font-semibold text-white">{m.name}</p>
                          <TierChip tier={tier} />
                        </div>
                        <p className="font-mono text-[9.5px] uppercase tracking-wider text-zinc-500">
                          {locked && (
                            <span className="mr-1.5 inline-flex items-center gap-0.5 text-amber-400">
                              <Lock size={9} /> nível {m.min_level}
                            </span>
                          )}
                          {m.luxury && (
                            <Tip tip="Veículo de luxo — chama mais a atenção e aumenta o calor gerado em operações discretas.">
                              <span className="mr-1.5 inline-flex items-center gap-0.5 text-purple-300">
                                <Gem size={9} /> luxo
                              </span>
                            </Tip>
                          )}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <Tip tip={`Velocidade nominal ${m.speed} m/s (referência máxima do catálogo: 26).`}>
                            <span className="inline-flex items-center gap-0.5 font-mono text-[9px] text-zinc-400"><Gauge size={9} /> {m.speed} m/s</span>
                          </Tip>
                          <Tip tip={`Discrição ${m.discretion}/100 — veículos discretos escondem-se melhor em operações furtivas.`}>
                            <span className="inline-flex items-center gap-0.5 font-mono text-[9px] text-zinc-400"><Search size={9} /> discr. {m.discretion}</span>
                          </Tip>
                          <Tip tip="Lugares disponíveis para membros da equipa.">
                            <span className="inline-flex items-center gap-0.5 font-mono text-[9px] text-zinc-400"><Users size={9} /> {m.seats}</span>
                          </Tip>
                          <Tip tip={`Autonomia máxima com o depósito cheio (${m.tank_l}L, ${m.cons}L/100km).`}>
                            <span className="inline-flex items-center gap-0.5 font-mono text-[9px] text-cyan-400"><Route size={9} /> ~{Math.round((m.tank_l / m.cons) * 100)} km</span>
                          </Tip>
                          <Tip tip={`Depósito ${m.tank_l}L de ${m.fuel_type === "gasoleo" ? "gasóleo" : "gasolina"} — consumo ${m.cons}L/100km.`}>
                            <span className="inline-flex items-center gap-0.5 font-mono text-[9px] text-zinc-400"><Fuel size={9} /> {m.cons}L/100</span>
                          </Tip>
                        </div>
                      </div>

                    <div className="relative z-[1] mt-2">
                      <AdequacyRow model={m} catalog={catalog} testId={`stand-adequacy-${key}`} />
                    </div>

                    <div className="relative z-[1] mt-2 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
                      {owned > 0 ? (
                        <span className="font-mono text-[9px] uppercase tracking-wide text-zinc-500">na frota: <span className="text-zinc-300">{owned}</span></span>
                      ) : <span />}
                      <PurchaseButton
                        testId={`buy-vehicle-${key}`}
                        label={fmtMoney(m.price)}
                        can={!locked && state.player.clean_money >= m.price && caps.used < caps.max}
                        requireConfirm={m.price >= LARGE_PURCHASE_THRESHOLD}
                        blockedReasons={[
                          locked ? `Requer Nível ${m.min_level}.` : null,
                          state.player.clean_money < m.price ? "Dinheiro insuficiente." : null,
                          caps.used >= caps.max ? "Capacidade máxima atingida." : null,
                        ].filter(Boolean)}
                        availableTip={`Comprar por ${fmtMoney(m.price)} limpos. Velocidade ${m.speed} m/s, depósito ${m.tank_l}L, consumo ${m.cons}L/100km.`}
                        onConfirm={() => buyVehicle(key)}
                        className="w-full shrink-0 sm:w-auto"
                      />
                    </div>
                  </Card>
                );
              })}
          </div>
          {caps.used >= caps.max && (() => {
            const garagem = catalog?.property_types?.garagem;
            const canBuy = garagem && state.player.level >= garagem.min_level && state.player.clean_money >= garagem.price;
            return (
              <Card className="mt-2 flex items-center justify-between gap-2 border-amber-500/30 bg-amber-500/5 px-2.5 py-2 shadow-none">
                <p className="font-mono text-[10px] text-amber-400">Garagem cheia</p>
                <button
                  data-testid="fleet-nav-properties"
                  onClick={() => onNavigate && onNavigate("properties")}
                  className="font-mono text-[10px] text-purple-300 underline-offset-2 hover:underline"
                >
                  {canBuy ? `Abrir Imóveis · garagem desde ${fmtMoney(garagem.price)}` : "Ver Imóveis"}
                </button>
              </Card>
            );
          })()}
        </div>
      </SheetContent>
    </Sheet>
  );
};
