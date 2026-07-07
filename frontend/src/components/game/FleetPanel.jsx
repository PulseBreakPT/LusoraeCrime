import { useEffect, useState } from "react";
import { useGame } from "../../context/GameContextV2";
import { fmtMoney, fmtDuration, STATUS_LABELS, SPEC_LABELS, effectiveSpeed, vehicleRangeKm, conditionBand, matchesSearch, LARGE_PURCHASE_THRESHOLD } from "../../lib/game";
import { Tip, Kpi, SummaryStrip, MiniBar, InlineRename, FavoriteStar, ConfirmButton, PurchaseButton } from "./hud";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "../ui/select";
import { Car, Fuel, Wrench, Trash2, Lock, BarChart3, ChevronDown, Warehouse, UserRound, Route, CheckCircle2, Banknote, Gem, Users, Search, Clock } from "lucide-react";

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

export const FleetPanel = ({ open, onOpenChange, onNavigate }) => {
  const {
    state, catalog, serverNow, buyVehicle, sellVehicle, refuelVehicle, repairVehicle, assignVehicle,
    transferVehicle, renameVehicle, startPlacement, favoriteVehicleIds, toggleFavoriteVehicle,
  } = useGame();
  const [statsOpen, setStatsOpen] = useState(null);
  const [query, setQuery] = useState("");
  useTick(open);
  if (!state) return null;
  const caps = state.caps.vehicles;

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
  const repairAll = () => repairableIds.forEach((id) => repairVehicle(id));

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
      <SheetContent side="right" className="w-full max-w-sm overflow-y-auto lus-panel sm:max-w-sm">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white">
            <Car size={18} className="text-primary" /> Frota
            <span className="ml-auto font-mono text-xs text-zinc-500" data-testid="vehicle-caps">{caps.used}/{caps.max}</span>
          </SheetTitle>
          <SheetDescription className="text-zinc-500">Abastece, repara, atribui e abate veículos.</SheetDescription>
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
                tip="Condição média da frota — veículos degradam-se a cada operação e perdem velocidade abaixo de 50%." />
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
          {repairableIds.length > 0 && (
            <PurchaseButton
              testId="fleet-repair-all"
              icon={Wrench}
              label="Reparar todos"
              can={state.player.clean_money >= repairAllCost}
              blockedReasons={["Dinheiro insuficiente."]}
              availableTip={`Repara todos os veículos disponíveis abaixo de 100% de condição (${repairableIds.length}) por ${fmtMoney(repairAllCost)} no total.`}
              onConfirm={repairAll}
              className="w-auto shrink-0"
            />
          )}
        </div>

        <div className="mt-3 space-y-2" data-testid="fleet-list">
          {state.vehicles.length === 0 && (
            <p className="rounded-lg border border-dashed border-white/10 p-3 text-center font-mono text-[11px] text-zinc-500">
              Ainda não tens veículos — compra o primeiro no stand abaixo.
            </p>
          )}
          {state.vehicles.length > 0 && sortedVehicles.length === 0 && (
            <p className="rounded-lg border border-dashed border-white/10 p-3 text-center font-mono text-[11px] text-zinc-500">
              Nenhum veículo corresponde à pesquisa.
            </p>
          )}
          {sortedVehicles.map((v) => {
            const team = teamOf(v);
            const members = team ? teamMembersList(team.id) : [];
            const busy = vehicleBusy(v);
            const mission = busy ? missionOf(team) : null;
            const refueling = isRefueling(v);
            const refuelRemaining = refueling ? Math.max(0, (Date.parse(v.refueling_until) - serverNow()) / 1000) : 0;
            const transferring = isTransferring(v);
            const transferRemaining = transferring ? Math.max(0, (Date.parse(v.transfer.ends_at) - serverNow()) / 1000) : 0;
            const locked = busy || transferring;
            const seats = catalog?.vehicle_models?.[v.model_key]?.seats;
            const fuelPct = (v.fuel_l / v.tank_l) * 100;
            const refuelCost = Math.ceil((v.tank_l - v.fuel_l) * (state.fuel_prices?.[v.fuel_type] || 0));
            const repairCost = Math.max(50, Math.round((100 - v.condition) * v.price * 0.002));
            const sellValue = Math.round(v.price * 0.4 * (v.condition / 100));
            const effSpeed = effectiveSpeed(v);
            const speedReduced = effSpeed < v.speed - 0.05;
            const modelName = catalog?.vehicle_models?.[v.model_key]?.name || v.model_key;
            const renamed = v.name !== modelName;
            let missionEtaS = null;
            let missionPhaseLabel = "";
            if (mission) {
              const nextAt = mission.phase === "en_route" ? mission.arrive_at : mission.phase === "operating" ? mission.finish_at : mission.return_at;
              missionEtaS = Math.max(0, (Date.parse(nextAt) - serverNow()) / 1000);
              missionPhaseLabel = STATUS_LABELS[mission.phase] || mission.phase;
            }
            return (
              <Card key={v.id} data-testid={`vehicle-card-${v.id}`} className="lus-card p-3 shadow-none">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <FavoriteStar testId={`vehicle-favorite-${v.id}`} active={favoriteVehicleIds.includes(v.id)} onToggle={() => toggleFavoriteVehicle(v.id)} />
                      <InlineRename
                        testId={`vehicle-rename-${v.id}`} value={v.name} onSave={(name) => renameVehicle(v.id, name)}
                        textClassName="text-sm font-bold text-white"
                      />
                      {renamed && (
                        <Tip tip="Modelo original deste veículo, antes de o renomeares.">
                          <span data-testid={`vehicle-model-tag-${v.id}`} className="shrink-0 rounded bg-black/40 px-1.5 py-0.5 font-mono text-[9px] uppercase text-zinc-500">
                            {modelName}
                          </span>
                        </Tip>
                      )}
                    </div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                      {v.speed} m/s · {Math.round(v.km_total)} km ·{" "}
                      <Tip tip={`Autonomia com o combustível atual (${v.fuel_l.toFixed(0)}L, consumo ${v.cons}L/100km). As viagens são ida e volta a partir do QG.`}>
                        <span className="text-cyan-400">~{Math.round(vehicleRangeKm(v))} km rest.</span>
                      </Tip>
                      {seats != null && (
                        <>
                          {" · "}
                          <Tip tip={`Lugares ocupados pela equipa atribuída vs. capacidade do veículo (${seats}). Acima da capacidade, o despacho fica bloqueado.`}>
                            <span className={members.length > seats ? "text-red-400" : "text-zinc-500"}>{members.length}/{seats} lugares</span>
                          </Tip>
                        </>
                      )}
                    </p>
                  </div>
                  {busy && mission && (
                    <Tip tip={`${mission.opportunity?.name || "Operação"} · ${missionPhaseLabel} · termina em ${fmtDuration(missionEtaS)}. Fica disponível quando a equipa regressar ao QG.`} align="end">
                      <span data-testid={`vehicle-mission-badge-${v.id}`} className="rounded-full bg-red-600/20 px-2 py-0.5 text-right font-mono text-[10px] font-bold uppercase text-red-400">
                        {mission.opportunity?.name || "Em missão"}
                        <br />
                        <span className="font-normal normal-case text-red-300/80">{missionPhaseLabel} · {fmtDuration(missionEtaS)}</span>
                      </span>
                    </Tip>
                  )}
                </div>
                {team && (
                  <p className="mt-1 flex items-center gap-1 font-mono text-[10px] text-zinc-400">
                    <UserRound size={10} className="shrink-0 text-zinc-500" />
                    {team.name}
                    {members.length > 0 && (
                      <span className="text-zinc-500">· {members.map((m) => m.name.split(" ")[0]).join(", ")}</span>
                    )}
                  </p>
                )}
                {transferring ? (
                  <p data-testid={`vehicle-transfer-status-${v.id}`} className="mt-1 flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-cyan-400">
                    <Clock size={10} /> Em transferência para {transferDestNameOf(v)} · {fmtDuration(transferRemaining)}
                  </p>
                ) : (
                  <p className="mt-1 flex items-center gap-1 font-mono text-[10px] text-zinc-400">
                    <Warehouse size={10} className="shrink-0 text-zinc-500" /> Base: {baseNameOf(v)}
                  </p>
                )}
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
                    <MiniBar value={fuelPct} color="#FBBF24" className="mt-0.5" />
                  </div>
                  <div>
                    <div className="flex justify-between font-mono text-[9px] uppercase text-zinc-500">
                      <span>Condição</span>
                      <Tip tip={`${Math.round(v.condition)}% de condição.`}>
                        <span style={{ color: conditionBand(v.condition).color }}>{conditionBand(v.condition).label}</span>
                      </Tip>
                    </div>
                    <MiniBar value={v.condition} color={v.condition < 30 ? "#EF4444" : "#34D399"} className="mt-0.5" />
                  </div>
                </div>

                <Select
                  value={v.team_id || "__none__"}
                  disabled={locked}
                  onValueChange={(tid) => assignVehicle(v.id, tid === "__none__" ? null : tid)}
                >
                  <SelectTrigger data-testid={`vehicle-team-select-${v.id}`} className="mt-2 w-full border-white/10 bg-black/60 font-mono text-[11px] text-white disabled:opacity-40">
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
                  <SelectTrigger data-testid={`vehicle-base-select-${v.id}`} className="mt-1.5 w-full border-white/10 bg-black/60 font-mono text-[11px] text-white disabled:opacity-40">
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
                    className="mt-1 flex items-center gap-1 font-mono text-[10px] text-amber-400 underline-offset-2 hover:underline"
                  >
                    <UserRound size={10} /> Equipa sem membros — atribuir em Operacionais
                  </button>
                )}

                <div className="mt-2 flex gap-1.5">
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
                        : `Vender este veículo por ${fmtMoney(sellValue)} (40% do preço × condição). Ação irreversível.`
                    }
                  />
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
                    <VStat label="Desde reparação" value={`${v.missions_since_repair || 0} missões`} />
                  </div>
                )}
              </Card>
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
                  <Card key={key} className="flex items-center justify-between lus-card p-3 shadow-none">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {m.name}
                        {locked && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 font-mono text-[9px] uppercase text-amber-400">
                            <Lock size={9} /> Nível {m.min_level}
                          </span>
                        )}
                        {m.luxury && (
                          <Tip tip="Veículo de luxo — chama mais a atenção e aumenta o calor gerado em operações discretas.">
                            <span className="ml-1.5 inline-flex items-center gap-0.5 font-mono text-[9px] uppercase text-purple-300">
                              <Gem size={9} /> luxo
                            </span>
                          </Tip>
                        )}
                      </p>
                      <p className="font-mono text-[10px] text-zinc-500">
                        {m.speed} m/s · {m.tank_l}L · {m.cons}L/100km ·{" "}
                        <Tip tip="Autonomia máxima com o depósito cheio.">
                          <span className="text-cyan-400">~{Math.round((m.tank_l / m.cons) * 100)} km</span>
                        </Tip>
                        {" · "}
                        <Tip tip="Lugares disponíveis para membros da equipa.">
                          <span className="inline-flex items-center gap-0.5 text-zinc-400">
                            <Users size={9} /> {m.seats}
                          </span>
                        </Tip>
                        {m.best_for?.length > 0 && (
                          <>
                            {" · "}
                            <Tip tip="Categorias de operação em que este veículo dá um bónus extra de probabilidade de sucesso.">
                              <span className="text-emerald-400">
                                ideal: {m.best_for.map((c) => SPEC_LABELS[c] || c).join(", ")}
                              </span>
                            </Tip>
                          </>
                        )}
                      </p>
                    </div>
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
                      className="w-auto shrink-0"
                    />
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
                {canBuy ? (
                  <Button
                    data-testid="fleet-buy-garage-inline"
                    variant="outline" size="sm"
                    onClick={() => { startPlacement("garagem"); onOpenChange(false); }}
                    className="h-auto gap-1 border-purple-500/30 bg-purple-500/10 px-2 py-1 font-mono text-[10px] font-bold text-purple-300 hover:bg-purple-500/20"
                  >
                    <Warehouse size={10} /> Comprar garagem · {fmtMoney(garagem.price)}
                  </Button>
                ) : (
                  <button
                    data-testid="fleet-nav-properties"
                    onClick={() => onNavigate && onNavigate("properties")}
                    className="font-mono text-[10px] text-purple-300 underline-offset-2 hover:underline"
                  >
                    Ver Imóveis
                  </button>
                )}
              </Card>
            );
          })()}
        </div>
      </SheetContent>
    </Sheet>
  );
};
