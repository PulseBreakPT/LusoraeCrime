import { useEffect, useState } from "react";
import { useGame } from "../../context/GameContextV2";
import { usePanelFocus } from "../../hooks/usePanelFocus";
import { useSettings } from "../../context/SettingsContext";
import { cn } from "../../lib/utils";
import {
  fmtMoney, fmtDuration, SPEC_LABELS, STATUS_LABELS, STATUS_COLORS, RANK_LABELS, fatigueColor,
  chanceColor, goodBarColor, teamsReadiness, teamReadiness, vehicleRangeKm,
  teamTier, teamMomentum, teamCoordination, teamFamiliarity, teamRoles, teamSynergy, TEAM_OP_CATEGORIES,
} from "../../lib/game";
import { Tip, Kpi, SummaryStrip, MiniBar, FavoriteStar, PurchaseButton, SectionHeader } from "./hud";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "../ui/select";
import {
  Users, Car, UserRound, Undo2, X, Fuel, Wrench, Zap, IdCard, CheckCircle2,
  AlertTriangle, Activity, Target, Clock, PartyPopper, Crown, Gauge, Stethoscope, Scale,
  Brain, Flame, TrendingDown, Link2, FlaskConical,
} from "lucide-react";
import { toast } from "sonner";

const MISSION_NEXT_LABEL = { en_route: "Chega em", operating: "Conclui em", returning: "Regressa em" };

const useTick = (active) => {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setT((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
};

// Chip do tier da unidade (Recruta/Operacional/Veterana/Lendária) — derivado
// das operações concluídas; a cor alimenta toda a moldura do cartão.
const TierChip = ({ tier, missions }) => (
  <Tip tip={`Unidade ${tier.label}: ${missions} operações concluídas. A experiência melhora o entrosamento e a mestria da equipa.`}>
    <span
      className="shrink-0 rounded-sm border px-1 py-px font-mono text-[10px] font-bold uppercase tracking-widest"
      style={{ borderColor: `${tier.color}55`, color: tier.color, backgroundColor: `${tier.color}14` }}
    >
      {tier.label}
    </span>
  </Tip>
);

// Chip de papel a bordo — aceso quando o papel existe na equipa, apagado
// (com dica de como o obter) quando falta. Os números vêm do team_meta.
const RoleChip = ({ icon: Icon, label, on, detail, tip, tone = "#34D399" }) => (
  <Tip tip={tip}>
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide",
        !on && "border-white/5 bg-black/30 text-zinc-600"
      )}
      style={on ? { borderColor: `${tone}44`, color: tone, backgroundColor: `${tone}12` } : undefined}
    >
      <Icon size={9} /> {label}
      {on && detail ? <span className="font-medium normal-case tracking-normal opacity-90">{detail}</span> : null}
    </span>
  </Tip>
);

// Momentum (SSS v3/v4): série de vitórias/derrotas com o bónus/penalização
// EXATOS do motor (mod_team_momentum).
const MomentumChip = ({ team, meta, testId }) => {
  const mo = teamMomentum(team.streak, meta);
  if (mo.state === "hot") {
    return (
      <Tip tip={`Momentum: ${mo.streak} vitórias seguidas → +${(mo.pct * 100).toFixed(1)}% de chance (máx. +${Math.round((meta.momentum_bonus_max ?? 0.06) * 100)}%). Também foge melhor da polícia (+1%/vitória, até +${Math.round((meta.momentum_escape_bonus_max ?? 0.05) * 100)}%). Uma falha apaga a série.`}>
        <span data-testid={testId} className="inline-flex items-center gap-0.5 font-mono text-[10px] font-bold text-emerald-400">
          <Flame size={9} /> {mo.streak} vitórias · +{(mo.pct * 100).toFixed(1)}%
        </span>
      </Tip>
    );
  }
  if (mo.state === "cold") {
    return (
      <Tip tip={`Confiança abalada: ${-mo.streak} falhas consecutivas → ${(mo.pct * 100).toFixed(1)}% de chance (máx. −${Math.round((meta.momentum_penalty_max ?? 0.06) * 100)}%). Uma vitória limpa restaura tudo — escolhe uma operação segura.`}>
        <span data-testid={testId} className="inline-flex items-center gap-0.5 font-mono text-[10px] font-bold text-red-400">
          <TrendingDown size={9} /> {-mo.streak} falhas · {(mo.pct * 100).toFixed(1)}%
        </span>
      </Tip>
    );
  }
  return (
    <Tip tip={`Sem série ativa. Séries de 2+ vitórias dão +${((meta.momentum_bonus_per_win ?? 0.012) * 100).toFixed(1)}%/vitória (máx. +${Math.round((meta.momentum_bonus_max ?? 0.06) * 100)}%); 2+ falhas penalizam até −${Math.round((meta.momentum_penalty_max ?? 0.06) * 100)}%.`}>
      <span data-testid={testId} className="inline-flex items-center gap-0.5 font-mono text-[10px] text-zinc-600">
        <Flame size={9} /> sem série
      </span>
    </Tip>
  );
};

// Entrosamento do plantel (SSS v4): 50% tempo estável + 50% operações juntos —
// a MESMA fórmula de mod_team_coordination, atualizada ao segundo.
const CohesionBar = ({ team, meta, nowMs, testId }) => {
  const co = teamCoordination(team, meta, nowMs);
  const frac = co.max > 0 ? co.pct / co.max : 0;
  return (
    <Tip
      tip={`Entrosamento: +${(co.pct * 100).toFixed(1)}% de chance. Aumenta com tempo de plantel estável e operações feitas em conjunto. Mudar membros reinicia o progresso.`}
      block
    >
      <div data-testid={testId}>
        <div className="flex justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-500">
          <span className="inline-flex items-center gap-1"><Link2 size={9} /> Entrosamento</span>
          <span className={frac >= 0.999 ? "text-emerald-400" : "text-cyan-400"}>+{(co.pct * 100).toFixed(1)}%</span>
        </div>
        <MiniBar value={frac * 100} color={frac >= 0.999 ? "#34D399" : "#22D3EE"} className="mt-0.5" />
      </div>
    </Tip>
  );
};

// Memória da equipa por categoria de operação (SSS v4): familiaridade com
// curva sqrt até à mestria — o análogo da "adequação" nos cartões de arma.
const FamiliarityRow = ({ team, meta, testId }) => (
  <div data-testid={testId} className="grid grid-cols-5 gap-1">
    {TEAM_OP_CATEGORIES.map((cat) => {
      const fam = teamFamiliarity((team.category_missions || {})[cat] || 0, meta);
      const isSpec = team.spec === cat;
      const color = fam.mastery ? "#F59E0B" : isSpec ? "#34D399" : fam.active ? "#A1A1AA" : "#52525B";
      return (
        <Tip
          key={cat}
          tip={`${SPEC_LABELS[cat] || cat}: ${fam.count} operações concluídas — ${fam.active ? `bónus +${(fam.pct * 100).toFixed(1)}%` : `sem bónus (conta a partir da ${fam.min}.ª)`}${fam.mastery ? " · MESTRIA (máximo atingido)" : ` · mestria às ${fam.ramp}`}. ${isSpec ? "Especialidade desta equipa — recebe um bónus adicional." : "A equipa melhora à medida que repete este tipo de trabalho."}`}
          block
        >
          <div className={cn("rounded-sm border px-1 py-0.5", isSpec ? "border-emerald-500/30 bg-emerald-500/[0.06]" : "border-white/5 bg-black/30")}>
            <p className={cn("truncate text-center font-mono text-[10px] uppercase tracking-wide", fam.mastery ? "text-amber-400" : isSpec ? "text-emerald-400" : "text-zinc-600")}>
              {(SPEC_LABELS[cat] || cat).slice(0, 3)}{fam.mastery ? " ★" : ""}
            </p>
            <MiniBar value={fam.frac * 100} color={color} className="mt-0.5" />
          </div>
        </Tip>
      );
    })}
  </div>
);

// Sinais vitais médios do plantel — com as curvas reais do motor nas dicas
// (assimetria da moral, curva convexa da fadiga, tectos da lealdade).
const VitalsRow = ({ members, meta, testId }) => {
  const avg = (fn) => members.reduce((a, e) => a + fn(e), 0) / members.length;
  const morale = Math.round(avg((e) => e.morale ?? 70));
  const loyalty = Math.round(avg((e) => e.loyalty ?? 70));
  const fatigue = Math.round(avg((e) => e.fatigue ?? 0));
  return (
    <div data-testid={testId} className="grid grid-cols-3 gap-x-3">
      <Tip tip={`Moral média ${morale}%. Moral baixa reduz o desempenho; bónus e vitórias ajudam a recuperar.`} block>
        <div>
          <div className="flex justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            <span>Moral</span><span style={{ color: goodBarColor(morale) }}>{morale}%</span>
          </div>
          <MiniBar value={morale} color={goodBarColor(morale)} className="mt-0.5" />
        </div>
      </Tip>
      <Tip tip={`Lealdade média ${loyalty}% — acima de 70 dá até +${Math.round((meta.loyalty_bonus_max ?? 0.04) * 100)}% de chance; abaixo penaliza até −${Math.round((meta.loyalty_penalty_max ?? 0.06) * 100)}% e aumenta o risco de traições. Promoções e bónus sobem a lealdade.`} block>
        <div>
          <div className="flex justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            <span>Lealdade</span><span style={{ color: goodBarColor(loyalty) }}>{loyalty}%</span>
          </div>
          <MiniBar value={loyalty} color={goodBarColor(loyalty)} className="mt-0.5" />
        </div>
      </Tip>
      <Tip tip={`Fadiga média ${fatigue}% — acima de 30% penaliza em curva convexa (exp. ${meta.fatigue_curve_exp ?? 1.35}): moderada custa pouco, extrema é um perigo real. A 90%+ o membro fica indisponível.`} block>
        <div>
          <div className="flex justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            <span>Fadiga</span><span style={{ color: fatigueColor(fatigue) }}>{fatigue}%</span>
          </div>
          <MiniBar value={fatigue} color={fatigueColor(fatigue)} className="mt-0.5" />
        </div>
      </Tip>
    </div>
  );
};


const TeamBuilder = ({ state, catalog, createTeam, onNavigate }) => {
  const [spec, setSpec] = useState("");
  const [memberIds, setMemberIds] = useState([]);
  const [vehicleId, setVehicleId] = useState("__none__");

  const maxMembers = catalog?.team_max_members || 4;
  const meta = catalog?.team_meta || {};
  const freeEmployees = (state.employees || []).filter((employee) => !employee.team_id && employee.status === "idle");
  const freeVehicles = (state.vehicles || []).filter((vehicle) => !vehicle.team_id && !vehicle.transfer);
  const atCap = !!state.caps?.teams && state.caps.teams.used >= state.caps.teams.max;
  const lackMoney = state.player.clean_money < (catalog?.team_create_cost || 0);

  const employeeFit = (employee, targetSpec = spec) => {
    if (!targetSpec) return 0;
    const attrs = meta.category_attrs?.[targetSpec] || [];
    const attrScore = attrs.length
      ? attrs.reduce((sum, key) => sum + Number(employee.attrs?.[key] || 0), 0) / attrs.length
      : 5;
    const roleSpec = catalog.specializations?.[employee.role_key]?.spec;
    const matchBonus = employee.spec === targetSpec || roleSpec === targetSpec ? 18 : 0;
    const fatiguePenalty = Math.min(14, Number(employee.fatigue || 0) * 0.14);
    return Math.max(0, Math.min(100, Math.round(attrScore * 8.2 + matchBonus - fatiguePenalty)));
  };

  const vehicleSeats = (vehicle) => Number(catalog.vehicle_models?.[vehicle?.model_key]?.seats || 0);
  const vehicleFit = (vehicle, targetSpec = spec, memberCount = memberIds.length) => {
    const model = catalog.vehicle_models?.[vehicle.model_key] || {};
    const seats = Number(model.seats || 0);
    if (memberCount > 0 && seats > 0 && seats < memberCount) return -1000;
    const ideal = model.best_for?.includes(targetSpec) ? 45 : 0;
    const condition = Number(vehicle.condition || 0) * 0.35;
    const fuel = vehicle.tank_l ? (Number(vehicle.fuel_l || 0) / Number(vehicle.tank_l)) * 20 : 0;
    const spareSeats = Math.max(0, seats - memberCount);
    return ideal + condition + fuel - spareSeats * 0.8;
  };

  const suggestedMembers = (targetSpec = spec) =>
    [...freeEmployees]
      .sort((a, b) => employeeFit(b, targetSpec) - employeeFit(a, targetSpec))
      .slice(0, maxMembers);

  const suggestedVehicle = (targetSpec = spec, count = memberIds.length) =>
    [...freeVehicles]
      .filter((vehicle) => count === 0 || vehicleSeats(vehicle) >= count)
      .sort((a, b) => vehicleFit(b, targetSpec, count) - vehicleFit(a, targetSpec, count))[0] || null;

  const applyRecommendation = (targetSpec = spec) => {
    if (!targetSpec) return;
    const members = suggestedMembers(targetSpec);
    setMemberIds(members.map((employee) => employee.id));
    setVehicleId(suggestedVehicle(targetSpec, members.length)?.id || "__none__");
  };

  const chooseSpec = (nextSpec) => {
    setSpec(nextSpec);
    const members = suggestedMembers(nextSpec);
    setMemberIds(members.map((employee) => employee.id));
    setVehicleId(suggestedVehicle(nextSpec, members.length)?.id || "__none__");
  };

  const toggleMember = (employeeId) => {
    setMemberIds((current) => {
      const selected = current.includes(employeeId);
      const next = selected
        ? current.filter((id) => id !== employeeId)
        : current.length < maxMembers
        ? [...current, employeeId]
        : current;

      const currentVehicle = freeVehicles.find((vehicle) => vehicle.id === vehicleId);
      if (currentVehicle && next.length > vehicleSeats(currentVehicle)) {
        setVehicleId(suggestedVehicle(spec, next.length)?.id || "__none__");
      }
      return next;
    });
  };

  const selectedMembers = memberIds
    .map((id) => freeEmployees.find((employee) => employee.id === id))
    .filter(Boolean);
  const selectedVehicle = vehicleId === "__none__" ? null : freeVehicles.find((vehicle) => vehicle.id === vehicleId);
  const seats = selectedVehicle ? vehicleSeats(selectedVehicle) : 0;
  const seatMismatch = !!selectedVehicle && selectedMembers.length > seats;
  const roles = teamRoles(selectedMembers, meta, catalog.ranks || []);
  const synergy = spec && selectedMembers.length >= 2 ? teamSynergy(selectedMembers, spec, meta) : null;
  const readyStructure = selectedMembers.length > 0 && !!selectedVehicle && !seatMismatch;

  const blockers = [
    !spec ? "Escolhe a especialização da equipa." : null,
    selectedMembers.length === 0 ? "Escolhe pelo menos um operacional." : null,
    atCap ? `Limite de equipas atingido para o nível ${state.player.level}.` : null,
    lackMoney ? "Dinheiro limpo insuficiente." : null,
    seatMismatch ? `O veículo escolhido só tem ${seats} lugares.` : null,
  ].filter(Boolean);

  const createConfiguredTeam = async () => {
    const result = await createTeam(spec, memberIds, selectedVehicle?.id || null);
    if (!result.ok) return;
    setSpec("");
    setMemberIds([]);
    setVehicleId("__none__");
  };

  return (
    <div className="mt-6" data-testid="team-builder">
      <SectionHeader
        icon={Users}
        title="Formar nova equipa"
        meta={state.caps?.teams ? (
          <Tip tip="Equipas atuais face ao limite desbloqueado pelo teu nível.">
            <span className={atCap ? "text-amber-400" : "text-zinc-500"}>
              {state.caps.teams.used}/{state.caps.teams.max}
            </span>
          </Tip>
        ) : null}
      />

      <Card className="sub-card overflow-hidden p-0 shadow-none">
        <div className="border-b border-white/[0.07] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-300">1 · Especialização</p>
              <p className="mt-0.5 text-[10px] text-zinc-600">Define que tipo de operações esta equipa deve dominar.</p>
            </div>
            {spec && (
              <button
                type="button"
                onClick={() => applyRecommendation(spec)}
                className="flex min-h-9 shrink-0 items-center gap-1 rounded-md border border-cyan-500/20 bg-cyan-500/[0.06] px-2 font-mono text-[10px] text-cyan-300"
              >
                <Brain size={11} /> Recomendar
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-1.5 min-[430px]:grid-cols-2">
            {Object.entries(catalog.team_specs || {}).map(([key, cfg]) => {
              const selected = spec === key;
              return (
                <button
                  key={key}
                  type="button"
                  data-testid={`team-builder-spec-${key}`}
                  aria-pressed={selected}
                  onClick={() => chooseSpec(key)}
                  className={cn(
                    "min-h-[70px] rounded-lg border p-2.5 text-left transition-colors",
                    selected
                      ? "border-red-500/45 bg-red-500/[0.09]"
                      : "border-white/[0.07] bg-black/20 hover:border-white/15 hover:bg-white/[0.025]"
                  )}
                >
                  <span className={cn("block text-xs font-bold", selected ? "text-white" : "text-zinc-300")}>
                    {SPEC_LABELS[key] || cfg.name}
                  </span>
                  <span className="mt-1 block text-[10px] leading-relaxed text-zinc-500">{cfg.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className={cn("border-b border-white/[0.07] p-3", !spec && "opacity-45")}>
          <div className="mb-2 flex items-end justify-between gap-2">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-300">2 · Plantel</p>
              <p className="mt-0.5 text-[10px] text-zinc-600">Escolhe até {maxMembers} operacionais livres. A recomendação prioriza aptidão e fadiga.</p>
            </div>
            <span className="shrink-0 font-mono text-[10px] text-zinc-500">{selectedMembers.length}/{maxMembers}</span>
          </div>

          {!spec ? (
            <p className="font-mono text-[10px] text-zinc-600">Escolhe primeiro uma especialização.</p>
          ) : freeEmployees.length === 0 ? (
            <div className="rounded-md border border-amber-500/20 bg-amber-500/[0.05] p-2.5">
              <p className="font-mono text-[10px] text-amber-300">Não tens operacionais livres para formar uma nova equipa.</p>
              <button
                type="button"
                onClick={() => onNavigate && onNavigate("employees")}
                className="mt-1 font-mono text-[10px] text-cyan-300"
              >
                Abrir Operacionais
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {[...freeEmployees]
                .sort((a, b) => employeeFit(b) - employeeFit(a))
                .map((employee) => {
                  const selected = memberIds.includes(employee.id);
                  const score = employeeFit(employee);
                  const specialization = catalog.specializations?.[employee.role_key]?.name || employee.role_key;
                  return (
                    <button
                      key={employee.id}
                      type="button"
                      data-testid={`team-builder-member-${employee.id}`}
                      aria-pressed={selected}
                      disabled={!selected && memberIds.length >= maxMembers}
                      onClick={() => toggleMember(employee.id)}
                      className={cn(
                        "flex min-h-12 w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors disabled:opacity-35",
                        selected
                          ? "border-emerald-500/30 bg-emerald-500/[0.06]"
                          : "border-white/[0.06] bg-black/20 hover:border-white/15"
                      )}
                    >
                      <span className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono text-[10px]",
                        selected ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300" : "border-white/10 text-zinc-600"
                      )}>
                        {selected ? "✓" : "+"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-white">{employee.name}</span>
                        <span className="block truncate font-mono text-[10px] text-zinc-500">
                          {specialization} · fadiga {Math.round(employee.fatigue || 0)}%
                        </span>
                      </span>
                      <span className={cn(
                        "shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold",
                        score >= 75 ? "bg-emerald-500/10 text-emerald-400" : score >= 55 ? "bg-cyan-500/10 text-cyan-300" : "bg-white/[0.04] text-zinc-500"
                      )}>
                        {score}%
                      </span>
                    </button>
                  );
                })}
            </div>
          )}

          {selectedMembers.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              <RoleChip icon={Crown} label="Líder" on={roles.leader.present} tip={roles.leader.present ? "A equipa já tem liderança adequada." : "Sem líder com patente suficiente."} />
              <RoleChip icon={Gauge} label="Condutor" on={roles.driver.active} tip={roles.driver.active ? "Há um condutor acima do limiar de condução." : "Sem condutor forte — viagens e fugas ficam piores."} tone="#22D3EE" />
              <RoleChip icon={Brain} label="Estratega" on={roles.strategist.present} tip={roles.strategist.present ? "A equipa tem inteligência suficiente para apoio estratégico." : "Sem estratega forte."} tone="#60A5FA" />
              <RoleChip icon={Stethoscope} label="Médico" on={roles.medic.present} tip={roles.medic.present ? "Médico presente." : "Sem médico clandestino."} tone="#34D399" />
              {synergy && (
                <span className={cn(
                  "rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-bold",
                  synergy.pct >= 0 ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400" : "border-amber-500/20 bg-amber-500/[0.06] text-amber-300"
                )}>
                  Sinergia {synergy.pct >= 0 ? "+" : ""}{(synergy.pct * 100).toFixed(1)}%
                </span>
              )}
            </div>
          )}
        </div>

        <div className={cn("border-b border-white/[0.07] p-3", !spec && "opacity-45")}>
          <div className="mb-2">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-300">3 · Veículo</p>
            <p className="mt-0.5 text-[10px] text-zinc-600">Escolhe transporte com lugares suficientes para o plantel.</p>
          </div>

          {!spec ? (
            <p className="font-mono text-[10px] text-zinc-600">Escolhe primeiro uma especialização.</p>
          ) : freeVehicles.length === 0 ? (
            <div className="rounded-md border border-amber-500/20 bg-amber-500/[0.05] p-2.5">
              <p className="font-mono text-[10px] text-amber-300">Não tens veículos livres.</p>
              <button
                type="button"
                onClick={() => onNavigate && onNavigate("fleet")}
                className="mt-1 font-mono text-[10px] text-cyan-300"
              >
                Abrir Frota
              </button>
            </div>
          ) : (
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger data-testid="team-builder-vehicle" className="min-h-11 w-full border-white/10 bg-black/60 font-mono text-[11px] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" className="font-mono text-xs">Sem veículo por agora</SelectItem>
                {[...freeVehicles]
                  .sort((a, b) => vehicleFit(b) - vehicleFit(a))
                  .map((vehicle) => {
                    const model = catalog.vehicle_models?.[vehicle.model_key] || {};
                    const capacity = Number(model.seats || 0);
                    const ideal = model.best_for?.includes(spec);
                    const tooSmall = selectedMembers.length > 0 && capacity < selectedMembers.length;
                    return (
                      <SelectItem key={vehicle.id} value={vehicle.id} disabled={tooSmall} className="font-mono text-xs">
                        {ideal ? "★ " : ""}{vehicle.name} · {capacity} lugares · {Math.round(vehicle.condition || 0)}%
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
          )}

          {selectedVehicle && (
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <div className="rounded-md border border-white/[0.06] bg-black/20 p-2 text-center">
                <p className="text-[10px] uppercase text-zinc-600">Lugares</p>
                <p className={cn("font-mono text-xs font-bold", seatMismatch ? "text-red-400" : "text-white")}>{selectedMembers.length}/{seats}</p>
              </div>
              <div className="rounded-md border border-white/[0.06] bg-black/20 p-2 text-center">
                <p className="text-[10px] uppercase text-zinc-600">Condição</p>
                <p className="font-mono text-xs font-bold text-white">{Math.round(selectedVehicle.condition || 0)}%</p>
              </div>
              <div className="rounded-md border border-white/[0.06] bg-black/20 p-2 text-center">
                <p className="text-[10px] uppercase text-zinc-600">Combustível</p>
                <p className="font-mono text-xs font-bold text-white">
                  {Math.round((Number(selectedVehicle.fuel_l || 0) / Math.max(1, Number(selectedVehicle.tank_l || 1))) * 100)}%
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-300">4 · Revisão</p>
              <p className="mt-0.5 text-[10px] text-zinc-600">Confirma a estrutura antes de pagar.</p>
            </div>
            <span className={cn(
              "rounded-full px-2 py-1 font-mono text-[10px] font-bold uppercase",
              readyStructure ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-300"
            )}>
              {readyStructure ? "Estrutura completa" : "Configuração incompleta"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 min-[430px]:grid-cols-4">
            <div className="rounded-md border border-white/[0.06] bg-black/20 p-2">
              <p className="text-[10px] uppercase text-zinc-600">Tipo</p>
              <p className="mt-0.5 truncate font-mono text-[10px] font-bold text-white">{spec ? SPEC_LABELS[spec] : "—"}</p>
            </div>
            <div className="rounded-md border border-white/[0.06] bg-black/20 p-2">
              <p className="text-[10px] uppercase text-zinc-600">Plantel</p>
              <p className="mt-0.5 font-mono text-[10px] font-bold text-white">{selectedMembers.length}/{maxMembers}</p>
            </div>
            <div className="rounded-md border border-white/[0.06] bg-black/20 p-2">
              <p className="text-[10px] uppercase text-zinc-600">Veículo</p>
              <p className="mt-0.5 truncate font-mono text-[10px] font-bold text-white">{selectedVehicle?.name || "Nenhum"}</p>
            </div>
            <div className="rounded-md border border-white/[0.06] bg-black/20 p-2">
              <p className="text-[10px] uppercase text-zinc-600">Custo</p>
              <p className="mt-0.5 font-mono text-[10px] font-bold text-emerald-400">{fmtMoney(catalog.team_create_cost)}</p>
            </div>
          </div>

          {!selectedVehicle && spec && selectedMembers.length > 0 && (
            <p className="mt-2 flex items-center gap-1 font-mono text-[10px] text-amber-400">
              <AlertTriangle size={10} /> Podes formar a equipa, mas precisará de um veículo antes de sair para operações.
            </p>
          )}
          {seatMismatch && (
            <p className="mt-2 flex items-center gap-1 font-mono text-[10px] text-red-400">
              <AlertTriangle size={10} /> O veículo não tem lugares para todos os membros selecionados.
            </p>
          )}

          <PurchaseButton
            testId="team-builder-create"
            icon={Users}
            label={`Formar equipa · ${fmtMoney(catalog.team_create_cost)}`}
            confirmLabel="Confirmar formação?"
            requireConfirm
            can={blockers.length === 0}
            blockedReasons={blockers}
            availableTip={selectedVehicle ? "Cria a equipa já com o plantel e veículo selecionados." : "Cria a equipa com o plantel selecionado; o veículo pode ser atribuído depois."}
            onConfirm={createConfiguredTeam}
            className="mt-3 w-full"
          />
        </div>
      </Card>
    </div>
  );
};

export const TeamsPanel = ({ open, onOpenChange, onNavigate, focusTarget }) => {
  const {
    state, catalog, serverNow, createTeam, assignEmployee, assignVehicle,
    dispatchTeam, recommendOpportunityForTeam, recommendRepeatForTeam,
    favoriteTeamIds, toggleFavoriteTeam, justReturnedTeamIds,
  } = useGame();
  const { autoSelectBestVehicle } = useSettings();
  const [recommendations, setRecommendations] = useState({});
  const [repeatRecs, setRepeatRecs] = useState({});
  const [autoBusy, setAutoBusy] = useState(false);
  useTick(open);
  usePanelFocus(open, focusTarget);

  // Despacho automático: envia cada equipa livre para a melhor oportunidade
  // que o servidor recomendar (a recomendação já valida todos os requisitos).
  const autoDispatchAll = async () => {
    setAutoBusy(true);
    let sent = 0;
    const idleIds = state ? state.teams.filter((t) => t.status === "idle").map((t) => t.id) : [];
    for (const id of idleIds) {
      let rec = recommendations[id];
      if (!rec?.opportunity_id) {
        const r = await recommendOpportunityForTeam(id);
        rec = r.ok ? r.data : null;
      }
      if (rec?.opportunity_id) {
        const res = await dispatchTeam(rec.opportunity_id, id);
        if (res.ok) sent += 1;
      }
    }
    setAutoBusy(false);
    if (sent === 0) toast.info("Nenhuma equipa livre tem missão viável neste momento");
  };

  // Equipas sem veículo recebem automaticamente o melhor disponível (o que
  // combina com a especialização, senão o de melhor condição) — só quando a
  // definição está ligada, para não lutar contra uma remoção manual do jogador.
  useEffect(() => {
    if (!autoSelectBestVehicle || !state) return;
    const withoutVehicle = state.teams.filter((t) => t.status === "idle" && !t.vehicle_id);
    if (withoutVehicle.length === 0) return;
    const assignedIds = new Set(state.teams.map((t) => t.vehicle_id).filter(Boolean));
    const pool = state.vehicles.filter((v) => !assignedIds.has(v.id) && !v.transfer);
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
  const teamMeta = catalog?.team_meta || {};
  const ranksList = catalog?.ranks || [];

  const membersOf = (teamId) => state.employees.filter((e) => e.team_id === teamId);
  const vehicleOf = (team) => state.vehicles.find((v) => v.id === team.vehicle_id);
  const missionOf = (team) => state.missions.find((m) => m.team_id === team.id);
  const freeEmployees = state.employees.filter((e) => !e.team_id && e.status === "idle");
  const freeVehicles = state.vehicles.filter((v) => !v.team_id && !v.transfer);
  const nav = (p) => onNavigate && onNavigate(p);

  // Veredicto via helper unificado (mesma definição do OpportunityCard/
  // opportunityReachable — antes divergiam). Preserva a forma { ok, ready,
  // reorg, reason } que o resto do painel consome, incluindo a contagem de
  // reorganização.
  const readiness = (t) => {
    const r = teamReadiness(state, catalog, t, { now: serverNow() });
    if (r.ok) return { ok: true, ready: r.members };
    if (r.reorg && t.available_at) {
      const remaining = Math.max(0, (Date.parse(t.available_at) - serverNow()) / 1000);
      return { ok: false, reorg: true, reason: `A reorganizar-se (${fmtDuration(remaining)})` };
    }
    return { ok: false, reason: r.reason };
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sub-panel">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white">
            <Users size={18} className="text-primary" /> Equipas
          </SheetTitle>
          <SheetDescription className="text-zinc-500">
            Quem executa as tuas ordens nas ruas — monta, equipa e despacha.
          </SheetDescription>
        </SheetHeader>

        {(() => {
          const tr = teamsReadiness(state, serverNow());
          const assigned = state.employees.filter((e) => e.team_id);
          const avgFat = assigned.length ? Math.round(assigned.reduce((a, e) => a + e.fatigue, 0) / assigned.length) : 0;
          const opsDone = state.teams.reduce((a, t) => a + (t.missions_done || 0), 0);
          const bestStreak = state.teams.reduce((a, t) => Math.max(a, t.streak || 0), 0);
          return (
            <SummaryStrip cols={4} className="mt-3" testId="teams-summary">
              <Kpi icon={CheckCircle2} label="Prontas" value={`${tr.ready}/${tr.total}`} color={tr.ready > 0 ? "#34D399" : "#EF4444"}
                tip="Equipas prontas a operar já: com membros disponíveis, veículo abastecido e em condições." />
              <Kpi icon={Activity} label="Em operação" value={tr.busy} color={tr.busy > 0 ? "#22D3EE" : "#FFFFFF"}
                tip="Equipas em viagem ou a executar operações neste momento — acompanha-as no mapa." />
              <Kpi icon={Target} label="Fadiga" value={`${avgFat}%`} color={fatigueColor(avgFat)} bar={avgFat} barColor={fatigueColor(avgFat)}
                tip={`Fadiga média dos membros das equipas (${assigned.length}/${state.employees.length} afetos). Acima de 90% ficam indisponíveis.`} />
              <Kpi icon={Flame} label="Série" value={bestStreak > 0 ? `${bestStreak}` : "—"} color={bestStreak >= 2 ? "#34D399" : "#FFFFFF"}
                tip={`Maior série de vitórias ativa entre as equipas. A partir de 2 vitórias seguidas o momentum dá +${((teamMeta.momentum_bonus_per_win ?? 0.012) * 100).toFixed(1)}%/vitória de chance (máx. +${Math.round((teamMeta.momentum_bonus_max ?? 0.06) * 100)}%). Total de operações concluídas: ${opsDone}.`} />
            </SummaryStrip>
          );
        })()}

        <div className="mt-3">
          <Tip
            block
            tip="Despacho automático: envia cada equipa livre para a melhor oportunidade que o servidor recomendar — só missões cujos requisitos (membros, veículo, combustível, nível) a equipa cumpre mesmo."
          >
            <button type="button"
              data-testid="teams-auto-dispatch"
              onClick={() => !autoBusy && readyIds.length > 0 && autoDispatchAll()}
              disabled={autoBusy || readyIds.length === 0}
              className={cn(
                "mt-2 flex w-full items-center justify-center gap-1 rounded-md border px-2 py-1.5 font-mono text-[10px] font-bold uppercase transition-colors",
                !autoBusy && readyIds.length > 0
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:border-amber-500/60 hover:bg-amber-500/20"
                  : "cursor-not-allowed border-white/10 bg-white/[0.03] text-zinc-600"
              )}
            >
              <Zap size={11} />
              {autoBusy ? "A despachar…" : `Despacho automático${readyIds.length > 0 ? ` (${readyIds.length})` : ""}`}
            </button>
          </Tip>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="teams-list">
          {state.teams.length === 0 && (
            <p className="col-span-full rounded-lg border border-dashed border-white/10 p-3 text-center font-mono text-[11px] text-zinc-500">
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
            const fuelPct = vehicle ? (vehicle.fuel_l / vehicle.tank_l) * 100 : 0;
            const justReturned = justReturnedTeamIds.includes(t.id);
            // QI da equipa (SSS v4): tier, papéis a bordo e química — os mesmos
            // números que o motor usa na chance, viagem, fuga e consequências.
            const tier = teamTier(t.missions_done);
            const roles = teamRoles(members, teamMeta, ranksList);
            const synergy = teamSynergy(members, t.spec, teamMeta);
            const leaderRankLabel = RANK_LABELS[teamMeta.leader_min_rank || "chefe_equipa"] || "Chefe de Equipa";
            return (
              <Card
                key={t.id}
                data-testid={`team-card-${t.id}`}
                className={`sub-card sub-team-card p-2.5 shadow-none ${justReturned ? "sub-flash" : ""}`}
                style={{ "--ttier": tier.color }}
              >
                {/* Cabeçalho: identidade da unidade sem ilustração decorativa */}
                <div className="relative z-[1]">
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex min-w-0 items-center gap-1">
                        <FavoriteStar testId={`team-favorite-${t.id}`} active={favoriteTeamIds.includes(t.id)} onToggle={() => toggleFavoriteTeam(t.id)} />
                        <p className="truncate text-sm font-bold text-white">{t.name}</p>
                        {justReturned && (
                          <Tip tip="Esta equipa acabou de regressar ao QG e já está pronta a operar.">
                            <span className="inline-flex shrink-0 items-center gap-0.5 font-mono text-[10px] uppercase text-emerald-400">
                              <PartyPopper size={9} /> regressou
                            </span>
                          </Tip>
                        )}
                      </div>
                      <TierChip tier={tier} missions={t.missions_done} />
                    </div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                      <Tip tip={`Especialização ${SPEC_LABELS[t.spec]} — bónus de sucesso em operações desta categoria.`}>
                        <span>{SPEC_LABELS[t.spec]}</span>
                      </Tip>
                      {" · "}
                      <Tip tip="Operações concluídas por esta equipa desde a sua formação.">
                        <span>{t.missions_done} ops</span>
                      </Tip>
                      <Tip tip={t.status === "idle" ? "Na base — pronta a receber ordens." : "Em operação — volta a estar disponível quando regressar ao QG."} align="end">
                        <Badge
                          variant="outline"
                          className="ml-1.5 rounded-full border-transparent px-1.5 py-0 font-mono text-[10px] font-bold uppercase"
                          style={{ color: STATUS_COLORS[t.status], background: `${STATUS_COLORS[t.status]}1a` }}
                        >
                          {STATUS_LABELS[t.status]}
                        </Badge>
                      </Tip>
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <MomentumChip team={t} meta={teamMeta} testId={`team-momentum-${t.id}`} />
                      {synergy && (
                        <Tip tip={`Química da equipa: ${synergy.pct >= 0 ? "+" : ""}${(synergy.pct * 100).toFixed(1)}% de chance. Equipas com atributos e papéis complementares têm melhor desempenho.`}>
                          <span className={cn("inline-flex items-center gap-0.5 font-mono text-[10px]", synergy.pct >= 0.0005 ? "text-emerald-400" : synergy.pct <= -0.0005 ? "text-amber-400" : "text-zinc-600")}>
                            <FlaskConical size={9} /> química {synergy.pct >= 0 ? "+" : ""}{(synergy.pct * 100).toFixed(1)}%
                          </span>
                        </Tip>
                      )}
                    </div>
                  </div>
                </div>

                <p
                  data-testid={`team-readiness-${t.id}`}
                  className={`relative z-[1] mt-2 flex items-center gap-1 font-mono text-[10px] font-bold uppercase ${
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

                {/* Papéis a bordo (SSS v4): quem vai no carro muda o desfecho */}
                <div data-testid={`team-roles-${t.id}`} className="relative z-[1] mt-2 flex flex-wrap gap-1">
                  <RoleChip
                    icon={Crown} label="Líder" tone="#F59E0B"
                    on={roles.leader.present}
                    detail={roles.leader.present ? ` · salva ${Math.round(roles.leader.clutchPct * 100)}%` : null}
                    tip={roles.leader.present
                      ? `${leaderRankLabel}+ a bordo — evita a penalização de −${Math.round((teamMeta.no_leader_penalty ?? 0.03) * 100)}% e pode salvar uma falha in extremis: ${Math.round(roles.leader.clutchPct * 100)}% de probabilidade (${Math.round((teamMeta.clutch_save_max ?? 0.18) * 100)}% máx. × sangue-frio ${roles.leader.cool}/10). À chegada, avisa se o calor subiu muito desde a partida.`
                      : `Sem líder (patente ${leaderRankLabel} ou superior) — a equipa perde ${Math.round((teamMeta.no_leader_penalty ?? 0.03) * 100)}% de chance e não tem salvamentos in extremis. Promove um operacional em RH.`}
                  />
                  <RoleChip
                    icon={Gauge} label="Condutor" tone="#22D3EE"
                    on={roles.driver.active}
                    detail={roles.driver.active ? ` · −${Math.round(roles.driver.travelPct * 100)}% viagem` : null}
                    tip={roles.driver.active
                      ? `Melhor condução da equipa: ${roles.driver.value}/10 — reduz o tempo de viagem em ${Math.round(roles.driver.travelPct * 100)}% (máx. ${Math.round((teamMeta.driver_travel_reduction_max ?? 0.12) * 100)}%) e melhora a fuga à polícia em +${Math.round(roles.driver.escapePct * 100)}% (máx. +${Math.round((teamMeta.driver_escape_bonus_max ?? 0.06) * 100)}%).`
                      : `Nenhum membro com condução acima de ${teamMeta.driver_attr_baseline ?? 5}/10 — sem redução de viagem nem bónus de fuga. Recruta ou treina um motorista.`}
                  />
                  <RoleChip
                    icon={Stethoscope} label="Médico" tone="#34D399"
                    on={roles.medic.present}
                    tip={roles.medic.present
                      ? `Médico a bordo — em falhas, a probabilidade de ferimento é ×${teamMeta.medic_injury_mult ?? 0.5} e a recuperação ×${teamMeta.medic_recovery_mult ?? 0.7} (estabiliza o ferido no local).`
                      : "Sem médico — ferimentos em falhas ficam com probabilidade e duração totais. Recruta um médico em RH."}
                  />
                  <RoleChip
                    icon={Scale} label="Advogado" tone="#C084FC"
                    on={roles.lawyer.present}
                    tip={roles.lawyer.present
                      ? `Advogado a bordo — prisões (interceção ou perseguição) duram ×${teamMeta.lawyer_arrest_mult ?? 0.6} e a libertação começa logo a ser tratada.`
                      : "Sem advogado — prisões duram o tempo total. Recruta um advogado em RH para reduzir o custo das detenções."}
                  />
                  <RoleChip
                    icon={Brain} label="Estratega" tone="#60A5FA"
                    on={roles.strategist.present}
                    detail={roles.strategist.present ? ` · INT ${roles.strategist.intel}` : null}
                    tip={roles.strategist.present
                      ? `Operacional com inteligência ${roles.strategist.intel}/10 (≥${teamMeta.strategist_min_int ?? 7}) estuda o alvo e planeia rotas — recupera ${Math.round((teamMeta.strategist_relief_frac ?? 0.35) * 100)}% da penalização de risco (até ${Math.round((teamMeta.strategist_relief_max ?? 0.06) * 100)}%). Vale mais em operações arriscadas.`
                      : `Sem estratega (inteligência ≥${teamMeta.strategist_min_int ?? 7}) — a penalização de risco da operação fica por inteiro.`}
                  />
                </div>

                {/* Memória da unidade: entrosamento do plantel + familiaridade por categoria */}
                <div className="relative z-[1] mt-2">
                  <CohesionBar team={t} meta={teamMeta} nowMs={serverNow()} testId={`team-cohesion-${t.id}`} />
                </div>
                <div className="relative z-[1] mt-1.5">
                  <FamiliarityRow team={t} meta={teamMeta} testId={`team-familiarity-${t.id}`} />
                </div>

                {/* Sinais vitais médios do plantel */}
                {members.length > 0 && (
                  <div className="relative z-[1] mt-2">
                    <VitalsRow members={members} meta={teamMeta} testId={`team-vitals-${t.id}`} />
                  </div>
                )}

                <div className="relative z-[1] mt-2 flex items-start gap-1.5">
                  <UserRound size={12} className="mt-1 shrink-0 text-zinc-500" />
                  <div className="min-w-0 flex-1">
                    <Tip tip={`Membros atuais na equipa vs. capacidade máxima (${teamMaxMembers}).`}>
                      <span data-testid={`team-members-cap-${t.id}`} className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                        Membros: <span className={members.length >= teamMaxMembers ? "text-amber-400" : "text-zinc-300"}>{members.length}/{teamMaxMembers}</span>
                      </span>
                    </Tip>
                    {members.length === 0 && freeEmployees.length === 0 ? (
                      <button type="button"
                        data-testid={`team-nav-rh-${t.id}`}
                        onClick={() => nav("employees")}
                        className="flex items-center gap-1 font-mono text-[10px] text-red-400 underline-offset-2 hover:underline"
                      >
                        <IdCard size={10} /> Sem membros — recrutar em Operacionais
                      </button>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        {members.map((m) => (
                          <span key={m.id} className="flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                            {m.name.split(" ")[0]} <span style={{ color: fatigueColor(m.fatigue) }}>{Math.round(m.fatigue)}%</span>
                            {m.status === "idle" && (
                              <button type="button"
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
                          <span className="font-mono text-[10px] text-zinc-600">equipa cheia</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative z-[1] mt-2 flex items-center gap-1.5">
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
                        className={`shrink-0 font-mono text-[10px] ${members.length > vehicleSeats ? "text-red-400" : "text-zinc-500"}`}
                      >
                        {members.length}/{vehicleSeats} lugares
                      </span>
                    </Tip>
                  )}
                  {!vehicle && freeVehicles.length === 0 && (
                    <button type="button"
                      data-testid={`team-nav-fleet-${t.id}`}
                      onClick={() => nav("fleet")}
                      className="shrink-0 font-mono text-[10px] text-amber-400 underline-offset-2 hover:underline"
                    >
                      Comprar na Frota
                    </button>
                  )}
                </div>
                {vehicle && (
                  <p className="relative z-[1] mt-1 pl-5 font-mono text-[10px] text-zinc-500">
                    Base: {vehicle.property_id ? (state.properties.find((p) => p.id === vehicle.property_id)?.name || "Quartel-General") : "Quartel-General"}
                  </p>
                )}

                {vehicle && t.status === "idle" && (
                  <div className="relative z-[1] mt-1.5 space-y-1 pl-5">
                    <div className="flex items-center gap-2">
                      <Tip tip={`Combustível: ${vehicle.fuel_l.toFixed(0)}/${vehicle.tank_l.toFixed(0)}L — autonomia ~${Math.round(vehicleRangeKm(vehicle))} km. Sem combustível a equipa não sai do QG.`} block className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Fuel size={9} className="shrink-0" style={{ color: fuelPct < 25 ? "#EF4444" : "#F59E0B" }} />
                          <MiniBar value={fuelPct} color={fuelPct < 25 ? "#EF4444" : "#F59E0B"} height="h-1" />
                          <span className="shrink-0 font-mono text-[10px]" style={{ color: fuelPct < 25 ? "#EF4444" : "#F59E0B" }}>{Math.round(fuelPct)}%</span>
                        </div>
                      </Tip>
                      <Tip tip={`Condição: ${Math.round(vehicle.condition)}% — abaixo de 30% o veículo não opera; abaixo de 50% perde velocidade.`} block className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Wrench size={9} className="shrink-0" style={{ color: vehicle.condition < 30 ? "#EF4444" : "#34D399" }} />
                          <MiniBar value={vehicle.condition} color={vehicle.condition < 30 ? "#EF4444" : "#34D399"} height="h-1" />
                          <span className="shrink-0 font-mono text-[10px]" style={{ color: vehicle.condition < 30 ? "#EF4444" : "#34D399" }}>{Math.round(vehicle.condition)}%</span>
                        </div>
                      </Tip>
                    </div>
                    {(fuelPct < 60 || vehicle.condition < 60) && (
                      <p className="font-mono text-[10px] text-amber-400">
                        Manutenção necessária — gere combustível e reparações na Frota.
                      </p>
                    )}
                  </div>
                )}

                <Tip
                  tip={
                    best && rec
                      ? `Melhor operação para esta equipa: ${best.name}, a ${rec.dist_km}km (${fmtDuration(rec.eta_s)} de viagem), ${Math.round(rec.chance * 100)}% de probabilidade de sucesso. Escolhida por valor esperado real (recompensa, chance, perdas e combustível).`
                      : state.player.heat >= 90
                      ? "Polícia em alerta máximo (calor ≥ 90%) — todas as operações estão bloqueadas até o calor baixar. Suborna a polícia no Império ou aguarda."
                      : r.ok
                      ? `Equipa pronta, mas sem operações disponíveis ou elegíveis neste momento. Certifica-te que: tens operações geradas no mapa (cria novas se necessário), a equipa cumpre os requisitos de nível mínimo, e tem membros suficientes (${r.ready || 0} disponíveis).`
                      : r.reason
                  }
                  block
                >
                  <Button
                    data-testid={`team-dispatch-best-${t.id}`}
                    variant="outline"
                    onClick={() => best && rec && dispatchTeam(best.id, t.id)}
                    disabled={!best || !rec}
                    className={`relative z-[1] mt-2 h-auto w-full flex-col items-start gap-1 px-2 py-1.5 font-mono text-[10px] font-bold uppercase md:flex-row md:items-center md:text-[10px] ${
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
                        <>Sem operações elegíveis</>
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
                    tip={`Repetir o último tipo de operação desta equipa: ${repeatOpp.name}, a ${repeatRec.dist_km}km, ${Math.round(repeatRec.chance * 100)}% de probabilidade de sucesso.`}
                    block
                  >
                    <Button
                      data-testid={`team-repeat-last-${t.id}`}
                      variant="outline"
                      onClick={() => dispatchTeam(repeatOpp.id, t.id)}
                      className="relative z-[1] mt-1.5 h-auto w-full flex-col items-start gap-1 border-cyan-500/30 bg-cyan-500/10 px-2 py-1.5 font-mono text-[10px] font-bold uppercase text-cyan-400 hover:bg-cyan-500/20 md:flex-row md:items-center md:text-[10px]"
                    >
                      <div className="flex items-center gap-1 truncate">
                        <Undo2 size={11} className="shrink-0 rotate-180" /> Repetir última → {repeatOpp.name}
                      </div>
                      <span className="text-zinc-500">({Math.round(repeatRec.chance * 100)}%)</span>
                    </Button>
                  </Tip>
                )}

              </Card>
            );
          })}
        </div>

        <TeamBuilder
          state={state}
          catalog={catalog}
          createTeam={createTeam}
          onNavigate={onNavigate}
        />
      </SheetContent>
    </Sheet>
  );
};
