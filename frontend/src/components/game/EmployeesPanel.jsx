import { useEffect, useState } from "react";
import { useGame } from "../../context/GameContextV2";
import {
  fmtMoney, fmtDuration, SPEC_LABELS, EMP_STATUS_LABELS, EMP_STATUS_COLORS, STATUS_LABELS,
  ATTR_LABELS, ATTR_FULL, RARITY_LABELS, RARITY_COLORS, RANK_LABELS, fatigueColor, goodBarColor,
  matchesSearch, conditionBand, weaponCompatibility, employeeAdequacy,
} from "../../lib/game";
import { cn } from "../../lib/utils";
import { usePreferenceState } from "../../lib/persist";
import { useSettings } from "../../context/SettingsContext";
import { usePanelFocus } from "../../hooks/usePanelFocus";
import { Tip, Kpi, SummaryStrip, MiniBar, InlineRename, FavoriteStar, ConfirmButton, PurchaseButton, PanelWatermark, EmptyState, SectionHeader, ActionGrid } from "./hud";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Alert, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "../ui/select";
import {
  IdCard, GraduationCap, BedDouble, ChevronUp, Gift, UserX, Lock,
  Cross, Gavel, Sparkles, History, ChevronDown, RefreshCw, AlertTriangle,
  HeartPulse, ShieldCheck, BatteryMedium, UserCheck, Car, Leaf, Search, Eye, EyeOff,
  Swords, ShieldAlert, Loader2, UserPlus, ArrowUpDown,
} from "lucide-react";

const EMP_STATUS_TIPS = {
  idle: "Disponível para operações, formação ou descanso.",
  on_mission: "Em operação — regressa quando a equipa voltar à base.",
  training: "Em formação — ganha atributos e experiência quando terminar.",
  resting: "Em descanso — recupera 50 de fadiga e +5 de moral.",
  injured: "Ferido — não pode operar. Paga a clínica para o recuperar.",
  arrested: "Preso — contrata o advogado ou paga um suborno para o libertar.",
  absent: "Fora de serviço por moral demasiado baixa — regressa sozinho passado um tempo.",
};

const useTick = (active) => {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setT((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
};

const StatBar = ({ label, value, color }) => (
  <div>
    <div className="flex justify-between font-mono text-[10px] uppercase text-zinc-500">
      <span>{label}</span>
      <span>{Math.round(value)}%</span>
    </div>
    <MiniBar value={value} color={color} className="mt-0.5" />
  </div>
);

const RarityBadge = ({ rarity, rar }) => (
  <Tip tip={rar ? `Raridade ${RARITY_LABELS[rarity]}: atributos ×${rar.mult}, nível máx. ${rar.max_level}, ${rar.talent_slots} slot(s) de talento.` : null} align="end">
    <Badge
      variant="outline"
      className="rounded border-transparent px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider"
      style={{ color: RARITY_COLORS[rarity], background: `${RARITY_COLORS[rarity]}1a` }}
    >
      {RARITY_LABELS[rarity]}
    </Badge>
  </Tip>
);

const ActionBtn = ({ testId, icon, label, onClick, disabled, title, blockedReasons, density = "comfortable" }) => (
  <PurchaseButton
    testId={testId}
    icon={icon}
    label={label}
    can={!disabled}
    blockedReasons={blockedReasons || (title ? [title] : [])}
    availableTip={title}
    onConfirm={onClick}
    density={density}
  />
);

const EmployeeCard = ({ e, onNavigate }) => {
  const {
    state, catalog, serverNow, assignEmployee, trainEmployee, restEmployee,
    promoteEmployee, bonusEmployee, healEmployee, releaseEmployee, fireEmployee, renameEmployee,
    favoriteEmployeeIds, toggleFavoriteEmployee, unassignWeapon,
  } = useGame();
  const [manage, setManage] = useState(false);
  const [course, setCourse] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const sp = catalog.specializations[e.role_key] || {};
  const rar = catalog.rarities[e.rarity] || {};
  const maxLevel = rar.max_level || 5;
  const xpArr = catalog.emp_level_xp || [];
  const nextXp = e.level < maxLevel && e.level < xpArr.length ? xpArr[e.level] : null;
  const prevXp = xpArr[e.level - 1] || 0;
  const xpPct = nextXp ? Math.min(100, ((e.xp - prevXp) / Math.max(1, nextXp - prevXp)) * 100) : 100;

  const untilIso = e.status === "training" ? e.training?.ends_at : e.status_until;
  const remaining = untilIso ? Math.max(0, (Date.parse(untilIso) - serverNow()) / 1000) : null;
  const newbieRampS = catalog?.newbie_ramp_s || 3600;
  const isNewbie = e.hired_at ? (serverNow() - Date.parse(e.hired_at)) / 1000 < newbieRampS : false;
  const heavyUseThreshold = catalog?.employee_heavy_use_threshold || 30;
  const isHeavyUse = (e.missions_done || 0) >= heavyUseThreshold;

  const team = e.team_id ? state.teams.find((t) => t.id === e.team_id) : null;
  const vehicle = team?.vehicle_id ? state.vehicles.find((v) => v.id === team.vehicle_id) : null;
  const weapon = e.weapon_id ? (state.weapons || []).find((w) => w.id === e.weapon_id) : null;
  const weaponModel = weapon ? catalog?.weapon_models?.[weapon.model_key] : null;
  const weaponCompat = weapon && weaponModel ? weaponCompatibility(e, weaponModel) : null;
  const weaponProficiency = weaponModel ? (e.weapon_proficiency || {})[weaponModel.category] || 0 : 0;
  const mission = e.status === "on_mission" && team ? state.missions.find((m) => m.team_id === team.id) : null;
  let missionEtaS = null;
  let missionPhaseLabel = "";
  if (mission) {
    const nextAt = mission.phase === "en_route" ? mission.arrive_at : mission.phase === "operating" ? mission.finish_at : mission.return_at;
    missionEtaS = Math.max(0, (Date.parse(nextAt) - serverNow()) / 1000);
    missionPhaseLabel = STATUS_LABELS[mission.phase] || mission.phase;
  }

  const rankIdx = Math.max(0, catalog.ranks.indexOf(e.rank));
  const isTopRank = rankIdx >= catalog.ranks.length - 1;
  const nextRankReq = isTopRank ? null : catalog.rank_req_level[rankIdx + 1];
  const promoteCost = catalog.hr_costs.promote_base * (rankIdx + 1);
  const bonusCost = Math.max(100, e.salary);
  const healCost = Math.max(200, Math.round(catalog.hr_costs.heal_base * (1 - (state.bonuses?.heal || 0))));
  const releaseCost = Math.max(300, Math.round(
    (catalog.hr_costs.release_base + state.player.heat * 30) *
    (1 - (state.bonuses?.legal || 0)) * (1 - (state.bonuses?.bribe_discount || 0))
  ));
  const fireCost = e.salary * 3;
  const money = state.player.clean_money;
  const idle = e.status === "idle";
  const isNearExhausted = idle && e.fatigue >= 55 && e.fatigue < 70;

  const preferredKeys = sp.attrs || [];
  const rankedAttrs = Object.entries(e.attrs || {}).sort((a, b) => b[1] - a[1]);
  const keyAttrs = [
    ...preferredKeys.map((key) => [key, e.attrs?.[key]]).filter(([, value]) => value != null),
    ...rankedAttrs.filter(([key]) => !preferredKeys.includes(key)),
  ].slice(0, 3);

  return (
    <Card
      data-testid={`employee-card-${e.id}`}
      className="min-w-0 sub-card sub-doss-card p-3 shadow-none"
      style={{ "--dtier": RARITY_COLORS[e.rarity] || "#A1A1AA" }}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <FavoriteStar testId={`emp-favorite-${e.id}`} active={favoriteEmployeeIds.includes(e.id)} onToggle={() => toggleFavoriteEmployee(e.id)} />
            <InlineRename
              testId={`emp-rename-${e.id}`} value={e.name} onSave={(name) => renameEmployee(e.id, name)}
              textClassName="text-sm font-bold text-white"
            />
            <span data-testid={`employee-level-${e.id}`} className="shrink-0 font-mono text-[10px] font-bold text-cyan-400">N{e.level}/{maxLevel}</span>
            <span className="shrink-0 font-mono text-[10px] text-zinc-600">{e.age} anos</span>
          </div>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.10em] text-zinc-500">
            {sp.name || e.role_key} · {RANK_LABELS[e.rank] || e.rank}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <RarityBadge rarity={e.rarity} rar={rar} />
          <Tip
            tip={mission ? `${mission.opportunity?.name || "Operação"} · ${missionPhaseLabel} · ${fmtDuration(missionEtaS)}` : EMP_STATUS_TIPS[e.status]}
            align="end"
          >
            <Badge
              data-testid={`employee-status-${e.id}`}
              variant="outline"
              className="max-w-[160px] rounded-full border-transparent px-2 py-0.5 text-right font-mono text-[10px] font-bold uppercase"
              style={{ color: EMP_STATUS_COLORS[e.status], background: `${EMP_STATUS_COLORS[e.status]}1a` }}
            >
              <span className="truncate">
                {mission ? mission.opportunity?.name || EMP_STATUS_LABELS[e.status] : EMP_STATUS_LABELS[e.status] || e.status}
                {mission ? <> · {fmtDuration(missionEtaS)}</> : remaining !== null && remaining > 0 && <> · {fmtDuration(remaining)}</>}
              </span>
            </Badge>
          </Tip>
        </div>
      </div>

      <div className="mt-2.5">
        <div className="flex justify-between font-mono text-[10px] uppercase text-zinc-600">
          <span>Progresso</span>
          <span>{nextXp ? `${e.xp}/${nextXp} XP` : "Nível máximo"}</span>
        </div>
        <MiniBar value={xpPct} color="#22D3EE" className="mt-1" />
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-2">
        <StatBar label="Moral" value={e.morale} color={goodBarColor(e.morale)} />
        <StatBar label="Lealdade" value={e.loyalty} color={goodBarColor(e.loyalty)} />
        <StatBar label="Fadiga" value={e.fatigue} color={fatigueColor(e.fatigue)} />
      </div>

      {(isNewbie || isHeavyUse || isNearExhausted || e.betrayal_risk >= 25) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {isNewbie && <span className="rounded bg-lime-500/10 px-1.5 py-0.5 font-mono text-[10px] text-lime-400"><Leaf size={9} className="mr-1 inline" />Novato</span>}
          {isHeavyUse && <span className="rounded bg-orange-500/10 px-1.5 py-0.5 font-mono text-[10px] text-orange-400">Muito utilizado</span>}
          {isNearExhausted && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] text-amber-400">Precisa de descanso</span>}
          {e.betrayal_risk >= 25 && (
            <span data-testid={`betrayal-warning-${e.id}`} className="rounded bg-red-500/10 px-1.5 py-0.5 font-mono text-[10px] text-red-400">
              <AlertTriangle size={9} className="mr-1 inline" />Traição {e.betrayal_risk}%
            </span>
          )}
        </div>
      )}

      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
        <div className="min-w-0 rounded-md border border-white/[0.06] bg-black/20 px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600">Equipa</p>
          <p className="truncate font-mono text-[10px] font-semibold text-zinc-300">{team?.name || "Sem equipa"}</p>
        </div>
        <div className="min-w-0 rounded-md border border-white/[0.06] bg-black/20 px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600">Arma</p>
          <p className={cn("truncate font-mono text-[10px] font-semibold", weaponModel ? "text-zinc-300" : "text-amber-400")}>
            {weaponModel?.name || "Sem arma"}
          </p>
        </div>
        <div className="min-w-0 rounded-md border border-white/[0.06] bg-black/20 px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600">Semanal</p>
          <p className="truncate font-mono text-[10px] font-semibold text-zinc-300">{fmtMoney(e.salary)}</p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {keyAttrs.map(([key, value]) => (
          <Tip key={key} tip={`${ATTR_FULL[key] || key}: ${value}`}>
            <span className={cn(
              "rounded border px-1.5 py-0.5 font-mono text-[10px]",
              preferredKeys.includes(key)
                ? "border-red-500/20 bg-red-500/[0.08] text-red-300"
                : "border-white/[0.06] bg-black/20 text-zinc-400"
            )}>
              {ATTR_LABELS[key] || key} <b className="text-white">{value}</b>
            </span>
          </Tip>
        ))}
        {(e.talents || []).slice(0, 2).map((talent) => (
          <Tip key={talent} tip={catalog.talents[talent]?.desc}>
            <span className="rounded border border-amber-500/20 bg-amber-500/[0.08] px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
              <Sparkles size={9} className="mr-1 inline" />{catalog.talents[talent]?.name || talent}
            </span>
          </Tip>
        ))}
      </div>

      {e.status === "injured" && (
        <div className="mt-2">
          <ActionBtn testId={`emp-heal-${e.id}`} icon={Cross} label={`Clínica ${fmtMoney(healCost)}`}
            onClick={() => healEmployee(e.id)} disabled={money < healCost}
            title="Recupera o operacional ferido." blockedReasons={money < healCost ? ["Dinheiro insuficiente."] : []} />
        </div>
      )}
      {e.status === "arrested" && (
        <div className="mt-2">
          <ActionBtn testId={`emp-release-${e.id}`} icon={Gavel} label={`Advogado ${fmtMoney(releaseCost)}`}
            onClick={() => releaseEmployee(e.id)} disabled={money < releaseCost}
            title="Liberta o operacional preso." blockedReasons={money < releaseCost ? ["Dinheiro insuficiente."] : []} />
        </div>
      )}

      <button
        type="button"
        data-testid={`emp-manage-toggle-${e.id}`}
        onClick={() => setManage(!manage)}
        className="mt-2.5 flex min-h-10 w-full items-center justify-center gap-1 rounded-md border border-white/[0.07] bg-white/[0.025] font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400 transition-colors hover:border-white/15 hover:bg-white/[0.05] hover:text-white"
      >
        {manage ? "Fechar gestão" : "Gerir operacional"}
        <ChevronDown size={11} className={`transition-transform ${manage ? "rotate-180" : ""}`} />
      </button>

      {manage && (
        <div className="mt-3 space-y-4 border-t border-white/10 pt-3">
          <div>
            <SectionHeader icon={Sparkles} title="Ações" />
            <ActionGrid count={4}>
              <ActionBtn
                testId={`emp-rest-${e.id}`} icon={BedDouble} label="Descansar"
                onClick={() => restEmployee(e.id)} disabled={!idle || e.fatigue < 15}
                title="Recupera 50 de fadiga e +5 moral."
                blockedReasons={[!idle ? "Operacional indisponível." : null, idle && e.fatigue < 15 ? "Fadiga já baixa." : null].filter(Boolean)}
                density="dense"
              />
              <ActionBtn
                testId={`emp-promote-${e.id}`} icon={ChevronUp}
                label={isTopRank ? "Patente máxima" : `Promover ${fmtMoney(promoteCost)}`}
                onClick={() => promoteEmployee(e.id)}
                disabled={isTopRank || e.status === "on_mission" || e.level < nextRankReq || money < promoteCost}
                title={isTopRank ? "Já atingiu a patente máxima." : `Requer nível ${nextRankReq}.`}
                blockedReasons={[
                  isTopRank ? "Patente máxima." : null,
                  !isTopRank && e.status === "on_mission" ? "Operacional em missão." : null,
                  !isTopRank && e.level < nextRankReq ? `Requer nível ${nextRankReq}.` : null,
                  !isTopRank && e.level >= nextRankReq && money < promoteCost ? "Dinheiro insuficiente." : null,
                ].filter(Boolean)}
                density="dense"
              />
              <ActionBtn
                testId={`emp-bonus-${e.id}`} icon={Gift} label={`Bónus ${fmtMoney(bonusCost)}`}
                onClick={() => bonusEmployee(e.id)} disabled={money < bonusCost}
                title="+15 moral e +10 lealdade." blockedReasons={money < bonusCost ? ["Dinheiro insuficiente."] : []}
                density="dense"
              />
              <ConfirmButton
                testId={`emp-fire-${e.id}`} icon={UserX} label={`Despedir ${fmtMoney(fireCost)}`} confirmLabel="Despedir?"
                color="text-red-400" onConfirm={() => fireEmployee(e.id)}
                disabled={e.status === "on_mission" || money < fireCost}
                tip={e.status === "on_mission" ? "Operacional em missão." : money < fireCost ? "Dinheiro insuficiente." : "Indemnização de 3 salários. Ação irreversível."}
                density="dense"
              />
            </ActionGrid>
          </div>

          <div>
            <SectionHeader icon={UserCheck} title="Alocação" />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Select
                value={e.team_id || "__none__"}
                disabled={!idle}
                onValueChange={(teamId) => assignEmployee(e.id, teamId === "__none__" ? null : teamId)}
              >
                <SelectTrigger data-testid={`emp-team-select-${e.id}`} className="min-h-10 w-full border-white/10 bg-black/60 font-mono text-[11px] text-white disabled:opacity-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="font-mono text-xs">Sem equipa</SelectItem>
                  {state.teams.map((item) => {
                    const memberCount = state.employees.filter((x) => x.team_id === item.id).length;
                    return <SelectItem key={item.id} value={item.id} className="font-mono text-xs">{item.name} · {memberCount} membros</SelectItem>;
                  })}
                </SelectContent>
              </Select>
              <span className="flex min-h-10 items-center font-mono text-[10px] text-zinc-500">{fmtMoney(e.salary)}/semana</span>
            </div>
            {vehicle && (
              <p className="mt-1 flex items-center gap-1 font-mono text-[10px] text-zinc-500">
                <Car size={10} className="text-cyan-400" /> {vehicle.name}
              </p>
            )}
          </div>

          <div>
            <SectionHeader icon={Swords} title="Equipamento" />
            {weapon && weaponModel ? (
              <div className="rounded-md border border-white/[0.07] bg-black/20 p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-mono text-[10px] text-zinc-300">
                    {weaponModel.name} · <span style={{ color: conditionBand(weapon.condition).color }}>{Math.round(weapon.condition)}%</span>
                  </p>
                  <button
                    type="button"
                    data-testid={`emp-unassign-weapon-${e.id}`}
                    onClick={() => unassignWeapon(e.id)}
                    disabled={!idle}
                    className="shrink-0 font-mono text-[10px] text-red-400 disabled:opacity-40"
                  >
                    Desatribuir
                  </button>
                </div>
                {weaponProficiency > 0 && <p className="mt-1 font-mono text-[10px] text-zinc-500">Proficiência {Math.round(weaponProficiency)}%</p>}
                {weaponCompat && !weaponCompat.compatible && (
                  <p className="mt-1 flex items-center gap-1 font-mono text-[10px] text-amber-400">
                    <ShieldAlert size={9} /> Compatibilidade baixa: {weaponCompat.missing.join(", ")}
                  </p>
                )}
              </div>
            ) : (
              <button
                type="button"
                data-testid={`emp-nav-weapons-${e.id}`}
                onClick={() => onNavigate && onNavigate("weapons")}
                className="min-h-10 w-full rounded-md border border-amber-500/20 bg-amber-500/[0.06] px-2 text-left font-mono text-[10px] text-amber-300"
              >
                Sem arma equipada · abrir Armamento
              </button>
            )}
          </div>

          <div>
            <SectionHeader icon={GraduationCap} title="Desenvolvimento" />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Select value={course} onValueChange={setCourse}>
                <SelectTrigger data-testid={`emp-train-select-${e.id}`} size="compact" className="text-white">
                  <SelectValue placeholder="Escolher formação..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(catalog.training_courses).map(([key, training]) => (
                    <SelectItem key={key} value={key} className="font-mono text-xs">
                      {training.name} · {fmtMoney(training.cost)}{training.spec === e.spec ? " ★" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ActionBtn
                testId={`emp-train-btn-${e.id}`} icon={GraduationCap} label="Treinar"
                onClick={() => { trainEmployee(e.id, course); setCourse(""); }}
                disabled={!idle || !course || money < (catalog.training_courses[course]?.cost || Infinity)}
                title="Envia o operacional para a formação escolhida."
                blockedReasons={[
                  !idle ? "Operacional indisponível." : null,
                  idle && !course ? "Escolhe uma formação." : null,
                  idle && course && money < (catalog.training_courses[course]?.cost || Infinity) ? "Dinheiro insuficiente." : null,
                ].filter(Boolean)}
                density="compact"
              />
            </div>
          </div>

          <div>
            <SectionHeader icon={IdCard} title="Perfil operacional" />
            <div className="grid grid-cols-3 gap-1">
              {Object.entries(e.attrs || {}).map(([key, value]) => (
                <Tip key={key} tip={`${ATTR_FULL[key] || key}: ${value}`} block>
                  <div className={cn(
                    "rounded-md border px-1.5 py-1 text-center font-mono text-[10px]",
                    preferredKeys.includes(key) ? "border-red-500/20 bg-red-500/[0.08] text-red-300" : "border-white/[0.06] bg-black/20 text-zinc-500"
                  )}>
                    {ATTR_LABELS[key] || key} <b className="text-white">{value}</b>
                  </div>
                </Tip>
              ))}
            </div>
            <div data-testid={`emp-adequacy-${e.id}`} className="mt-2 grid grid-cols-2 gap-1 min-[430px]:grid-cols-5">
              {employeeAdequacy(e, catalog).map((item) => (
                <Tip key={item.category} tip={`${item.label}: aptidão ${Math.round(item.score * 100)}%`} block>
                  <div className={cn("rounded-md border px-1.5 py-1", item.best ? "border-emerald-500/25 bg-emerald-500/[0.06]" : "border-white/[0.06] bg-black/20")}>
                    <div className="flex items-center justify-between gap-1 font-mono text-[10px] uppercase">
                      <span className={item.best ? "text-emerald-400" : "text-zinc-600"}>{item.label.slice(0, 3)}</span>
                      <span className="text-zinc-400">{Math.round(item.score * 100)}%</span>
                    </div>
                    <MiniBar value={item.score * 100} color={item.best ? "#34D399" : "#71717A"} className="mt-1" />
                  </div>
                </Tip>
              ))}
            </div>
            <div className="mt-2 rounded-md border border-white/[0.06] bg-black/20 p-2">
              <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
                <span className="uppercase text-zinc-500">Stress</span>
                <span className={Number(e.stress || 0) >= 70 ? "text-red-300" : "text-zinc-300"}>{Math.round(e.stress || 0)}%</span>
              </div>
              <MiniBar value={e.stress || 0} color={Number(e.stress || 0) >= 70 ? "#EF4444" : "#F59E0B"} className="mt-1" />
              {(e.traits || []).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {(e.traits || []).map((trait) => (
                    <span key={trait} className="rounded border border-sky-500/15 bg-sky-500/[0.05] px-1.5 py-0.5 font-mono text-[10px] uppercase text-sky-300">
                      {trait.replaceAll("_", " ")}
                    </span>
                  ))}
                </div>
              )}
              {e.injury && (
                <p className="mt-2 font-mono text-[10px] text-red-300">
                  Ferimento {e.injury.severity || "registado"} · {e.injury.source || "operação"}
                </p>
              )}
              {e.sentence && (
                <p className="mt-2 font-mono text-[10px] text-amber-300">
                  Processo ativo · {e.sentence.reason || "detenção"}
                </p>
              )}
              {e.stationed_property_id && (
                <p className="mt-2 font-mono text-[10px] text-cyan-300">Destacado numa instalação da organização</p>
              )}
            </div>
          </div>

          {(e.history || []).length > 0 && (
            <div>
              <button
                type="button"
                data-testid={`emp-history-toggle-${e.id}`}
                onClick={() => setShowHistory(!showHistory)}
                className="flex min-h-9 items-center gap-1 font-mono text-[10px] uppercase text-zinc-500 hover:text-white"
              >
                <History size={10} /> Histórico ({e.history.length})
                <ChevronDown size={10} className={`transition-transform ${showHistory ? "rotate-180" : ""}`} />
              </button>
              {showHistory && (
                <div className="space-y-1 rounded-md border border-white/[0.06] bg-black/20 p-2">
                  {[...e.history].reverse().map((item, index) => (
                    <p key={index} className="font-mono text-[10px] text-zinc-400">
                      <span className="text-zinc-600">{new Date(item.ts).toLocaleDateString("pt-PT")}</span> {item.text}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

const candidateAssessment = (candidate, state, catalog) => {
  const specialization = catalog.specializations[candidate.role_key] || {};
  const keys = specialization.attrs || [];
  const values = keys.map((key) => Number(candidate.attrs?.[key] || 0));
  const skillScore = values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) : 0;
  const maxMembers = catalog.team_max_members || 4;
  const vacancies = (state.teams || []).reduce((total, team) => {
    if (team.status !== "idle" || team.spec !== candidate.spec) return total;
    const used = state.employees.filter((employee) => employee.team_id === team.id).length;
    return total + Math.max(0, maxMembers - used);
  }, 0);
  const talentCount = (candidate.talents || []).length;
  const priority = Math.min(120, skillScore + Math.min(15, vacancies * 5) + Math.min(10, talentCount * 5));
  return { skillScore, vacancies, priority };
};

const CandidateCard = ({ c, assessment, sourceName }) => {
  const { state, catalog, recruitEmployee } = useGame();
  const sp = catalog.specializations[c.role_key] || {};
  const caps = state.caps.employees;
  const lackRespect = state.player.respect < c.min_respect;
  const lackMoney = state.player.clean_money < c.cost;
  const full = caps.used >= caps.max;
  const topAttrs = Object.entries(c.attrs || {}).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const ssRate = catalog?.economy_meta?.employer_social_security_rate ?? 0.2375;
  const weeklyFixed = state.weekly_fixed_total || state.salary_total || 0;
  const candidateWeeklyCost = Math.round(c.salary * (1 + ssRate));
  const newWeeklyFixed = weeklyFixed + candidateWeeklyCost;
  const canRecruit = !lackRespect && !lackMoney && !full;
  const blocker = full
    ? "Capacidade de operacionais esgotada."
    : lackRespect
    ? `Faltam ${(c.min_respect - state.player.respect).toLocaleString("pt-PT")} pontos.`
    : lackMoney
    ? `Faltam ${fmtMoney(c.cost - state.player.clean_money)}.`
    : null;

  return (
    <Card data-testid={`candidate-card-${c.id}`} className="min-w-0 sub-card p-3 shadow-none">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-bold text-white">{c.name}</p>
            <span className="font-mono text-[10px] text-zinc-600">{c.age} anos</span>
          </div>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.10em] text-zinc-500">
            {sp.name || c.role_key} · {SPEC_LABELS[c.spec] || c.spec}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-zinc-600">{sourceName}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <RarityBadge rarity={c.rarity} rar={catalog.rarities[c.rarity]} />
          <span className={cn(
            "rounded-full px-2 py-0.5 font-mono text-[10px] font-bold",
            assessment.skillScore >= 75 ? "bg-emerald-500/10 text-emerald-400" :
            assessment.skillScore >= 55 ? "bg-cyan-500/10 text-cyan-300" : "bg-zinc-500/10 text-zinc-400"
          )}>
            Aptidão {assessment.skillScore}%
          </span>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1">
        {assessment.vacancies > 0 ? (
          <span className="rounded bg-emerald-500/[0.08] px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
            <UserCheck size={9} className="mr-1 inline" />{assessment.vacancies} {assessment.vacancies === 1 ? "vaga compatível" : "vagas compatíveis"}
          </span>
        ) : (
          <span className="rounded bg-white/[0.035] px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">Sem vaga prioritária</span>
        )}
        {topAttrs.map(([key, value]) => (
          <Tip key={key} tip={`${ATTR_FULL[key] || key}: ${value}`}>
            <span className="rounded border border-white/[0.06] bg-black/20 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
              {ATTR_LABELS[key] || key} <b className="text-white">{value}</b>
            </span>
          </Tip>
        ))}
        {(c.talents || []).map((talent) => (
          <Tip key={talent} tip={catalog.talents[talent]?.desc}>
            <span className="rounded border border-amber-500/20 bg-amber-500/[0.08] px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
              <Sparkles size={9} className="mr-1 inline" />{catalog.talents[talent]?.name || talent}
            </span>
          </Tip>
        ))}
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
        <div className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600">Entrada</p>
          <p className="font-mono text-[10px] font-bold text-white">{fmtMoney(c.cost)}</p>
        </div>
        <div className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600">Semanal c/ TSU</p>
          <p className="font-mono text-[10px] font-bold text-white">{fmtMoney(candidateWeeklyCost)}</p>
        </div>
        <div className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600">Novo fecho</p>
          <p className="font-mono text-[10px] font-bold text-amber-300">{fmtMoney(newWeeklyFixed)}</p>
        </div>
      </div>

      {c.min_respect > 0 && (
        <p className={cn("mt-2 font-mono text-[10px]", lackRespect ? "text-red-400" : "text-zinc-500")}>
          Requer {c.min_respect.toLocaleString("pt-PT")} pontos de progressão
        </p>
      )}
      {blocker && <p className="mt-1 font-mono text-[10px] text-red-400">{blocker}</p>}

      <PurchaseButton
        testId={`hire-candidate-${c.id}`}
        icon={UserPlus}
        label={`Recrutar · ${fmtMoney(c.cost)}`}
        can={canRecruit}
        blockedReasons={blocker ? [blocker] : []}
        availableTip={`Contratação: ${fmtMoney(c.cost)} agora + cerca de ${fmtMoney(candidateWeeklyCost)}/semana com TSU.`}
        onConfirm={() => recruitEmployee(c.id)}
        className="mt-2.5 w-full"
      />
    </Card>
  );
};

export const EmployeesPanel = ({ open, onOpenChange, onNavigate, focusTarget }) => {
  const { state, catalog, serverNow, refreshPool, restEmployee, restAllEligible, favoriteEmployeeIds, optimizeEmployees } = useGame();
  const { rememberFilters, rememberSort } = useSettings();
  const [tab, setTab] = usePreferenceState("empTab", "roster", rememberSort);
  const [query, setQuery] = useState("");
  const [rosterSort, setRosterSort] = usePreferenceState("empRosterSort", "priority", rememberSort);
  const [recruitSort, setRecruitSort] = usePreferenceState("empRecruitSort", "recommended", rememberSort);
  const [restAllBusy, setRestAllBusy] = useState(false);
  const [hideUnavailable, setHideUnavailable] = usePreferenceState("empHideUnavailable", true, rememberFilters);
  useTick(open);
  usePanelFocus(open, focusTarget);
  useEffect(() => {
    if (!open || !focusTarget?.testId?.startsWith("employee-card-")) return;
    setQuery("");
    setTab("roster");
    setHideUnavailable(false);
  }, [open, focusTarget?.token, focusTarget?.testId, setHideUnavailable, setTab]);
  if (!state || !catalog) return null;

  const caps = state.caps.employees;
  const hideout = catalog.property_types?.esconderijo;
  const canBuyHideout = hideout && state.player.level >= hideout.min_level && state.player.clean_money >= hideout.price;
  const capFull = caps.used >= caps.max;
  const payrollMs = state.player.next_payroll_at ? Date.parse(state.player.next_payroll_at) - serverNow() : null;
  const weeklyFixed = state.weekly_fixed_total || state.salary_total || 0;
  const weeklyBreakdown = state.weekly_cost_breakdown || {};
  const poolMs = state.player.pool_refresh_at ? Date.parse(state.player.pool_refresh_at) - serverNow() : null;

  const restAllIds = state.employees.filter((e) => e.status === "idle" && e.fatigue >= 15).map((e) => e.id);
  const restAll = async () => {
    if (restAllBusy) return;
    setRestAllBusy(true);
    try {
      await restAllEligible();
    } finally {
      setRestAllBusy(false);
    }
  };

  // QI do efetivo — o Otimizar preenche vagas de equipas disponíveis com quem
  // está de fora, por aptidão à especialização (nunca move membros entre equipas).
  const teamMax = catalog.team_max_members || 4;
  const freeIdleCount = state.employees.filter((e) => e.status === "idle" && !e.team_id).length;
  const openTeamsCount = state.teams.filter(
    (t) => t.status === "idle" && state.employees.filter((e) => e.team_id === t.id).length < teamMax
  ).length;
  const canOptimize = freeIdleCount > 0 && openTeamsCount > 0;

  const searched = state.employees.filter((e) =>
    matchesSearch(query, e.name, catalog.specializations[e.role_key]?.name || e.role_key)
  );
  const unavailableHidden = hideUnavailable
    ? searched.filter((e) => e.status === "idle" || favoriteEmployeeIds.includes(e.id))
    : searched;
  const sortedEmployees = [...unavailableHidden].sort((a, b) => {
    const favA = favoriteEmployeeIds.includes(a.id) ? 0 : 1;
    const favB = favoriteEmployeeIds.includes(b.id) ? 0 : 1;
    if (favA !== favB) return favA - favB;

    if (rosterSort === "name") return a.name.localeCompare(b.name, "pt-PT");
    if (rosterSort === "fatigue") return b.fatigue - a.fatigue;
    if (rosterSort === "loyalty") return a.loyalty - b.loyalty;
    if (rosterSort === "salary") return b.salary - a.salary;

    const statusA = a.status === "idle" ? 0 : 1;
    const statusB = b.status === "idle" ? 0 : 1;
    if (statusA !== statusB) return statusA - statusB;
    if ((a.betrayal_risk || 0) !== (b.betrayal_risk || 0)) return (b.betrayal_risk || 0) - (a.betrayal_risk || 0);
    return b.fatigue - a.fatigue;
  });
  const hiddenCount = searched.length - unavailableHidden.length;

  const rarityOrder = { comum: 0, raro: 1, elite: 2, lendario: 3 };
  const candidateRows = (state.candidates || []).map((candidate) => ({
    c: candidate,
    assessment: candidateAssessment(candidate, state, catalog),
    sourceName: catalog.recruit_sources?.[candidate.source]?.name || candidate.source,
  })).sort((a, b) => {
    if (recruitSort === "aptitude") return b.assessment.skillScore - a.assessment.skillScore;
    if (recruitSort === "cost") return a.c.cost - b.c.cost;
    if (recruitSort === "salary") return a.c.salary - b.c.salary;
    if (recruitSort === "rarity") return (rarityOrder[b.c.rarity] || 0) - (rarityOrder[a.c.rarity] || 0);
    return b.assessment.priority - a.assessment.priority || b.assessment.skillScore - a.assessment.skillScore;
  });
  const lockedRecruitSources = Object.entries(catalog.recruit_sources || {}).filter(([, source]) => state.player.level < source.min_level);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sub-panel" data-testid="employees-panel">
        <SheetHeader>
          <PanelWatermark icon={IdCard} />
          <SheetTitle className="flex items-center gap-2 text-white">
            <IdCard size={18} className="text-primary" /> Operacionais
          </SheetTitle>
          <SheetDescription className="text-zinc-500">
            O coração da organização — recruta bem, paga a horas e vigia a lealdade.
          </SheetDescription>
        </SheetHeader>

        {state.player.clean_money < weeklyFixed && weeklyFixed > 0 && (
          <Alert variant="destructive" data-testid="payroll-warning" className="mt-3 border-red-600/40 bg-red-600/10 py-2">
            <AlertDescription className="flex items-center gap-1.5 font-mono text-[10px] text-red-400">
              <AlertTriangle size={12} /> Fundos insuficientes para o fecho semanal (faltam {fmtMoney(weeklyFixed - state.player.clean_money)}).
              Segunda-feira às 20:00 são liquidados salários, TSU, frota e imóveis.
            </AlertDescription>
          </Alert>
        )}

        <Card data-testid="employee-payroll-card" className="mt-3 flex items-center justify-between sub-card px-3 py-2 shadow-none">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Fecho semanal</p>
            <Tip tip={`Salários ${fmtMoney(weeklyBreakdown.gross_salaries || 0)} + TSU ${fmtMoney(weeklyBreakdown.employer_social_security || 0)} + frota ${fmtMoney(weeklyBreakdown.fleet_fixed || 0)} + imóveis ${fmtMoney(weeklyBreakdown.property_fixed || 0)}.`}>
              <p className="font-mono text-xs font-bold text-white" data-testid="salary-total">{fmtMoney(weeklyFixed)}</p>
            </Tip>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Segunda · 20:00</p>
            <p className="font-mono text-xs font-bold text-amber-400" data-testid="payroll-countdown">
              {payrollMs !== null ? fmtDuration(payrollMs / 1000) : "—"}
            </p>
          </div>
        </Card>

        {(() => {
          const emps = state.employees;
          const avg = (fn) => (emps.length ? Math.round(emps.reduce((a, e) => a + fn(e), 0) / emps.length) : 0);
          const avgMorale = avg((e) => e.morale);
          const avgLoyalty = avg((e) => e.loyalty);
          const avgFatigue = avg((e) => e.fatigue);
          const statusCounts = {};
          emps.forEach((e) => { statusCounts[e.status] = (statusCounts[e.status] || 0) + 1; });
          return (
            <>
              <SummaryStrip cols={3} className="mt-2" testId="hr-summary">
                <Kpi icon={BatteryMedium} label="Fadiga" value={`${avgFatigue}%`} color={fatigueColor(avgFatigue)} bar={avgFatigue}
                  tip="Fadiga média. Aos 90% um operacional fica indisponível — manda-o descansar (recupera 50)." />
                <Kpi icon={HeartPulse} label="Moral" value={`${avgMorale}%`} color={goodBarColor(avgMorale)} bar={avgMorale}
                  tip="Moral média do efetivo. Moral baixa aumenta falhas e abandonos — sobe com bónus, promoções e descanso." />
                <Kpi icon={ShieldCheck} label="Lealdade" value={`${avgLoyalty}%`} color={goodBarColor(avgLoyalty)} bar={avgLoyalty}
                  tip="Lealdade média. Valores baixos aumentam o risco de traições: roubos, fugas de informação e sabotagem." />
              </SummaryStrip>
              {Object.keys(statusCounts).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1" data-testid="hr-status-chips">
                  {Object.entries(statusCounts).map(([s, n]) => (
                    <Tip key={s} tip={EMP_STATUS_TIPS[s]}>
                      <span
                        className="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase"
                        style={{ color: EMP_STATUS_COLORS[s], background: `${EMP_STATUS_COLORS[s]}14` }}
                      >
                        {n} {EMP_STATUS_LABELS[s]}
                      </span>
                    </Tip>
                  ))}
                </div>
              )}
            </>
          );
        })()}

        {capFull && (
          <Card className="mt-2 flex items-center justify-between gap-2 border-amber-500/30 bg-amber-500/5 px-2.5 py-2 shadow-none" data-testid="hr-cap-full">
            <p className="font-mono text-[10px] text-amber-400">Esconderijos cheios</p>
            <button type="button"
              data-testid="hr-nav-properties"
              onClick={() => onNavigate && onNavigate("properties")}
              className="font-mono text-[10px] text-amber-300 underline-offset-2 hover:underline"
            >
              {canBuyHideout ? `Abrir Imóveis · esconderijo desde ${fmtMoney(hideout.price)}` : "Ver Imóveis"}
            </button>
          </Card>
        )}

        <Tabs value={tab} onValueChange={setTab} className="mt-3">
          <TabsList className="grid w-full grid-cols-2 gap-1">
            <TabsTrigger data-testid="tab-roster" value="roster" className="font-mono text-[10px] font-bold uppercase tracking-wider">
              Efetivo ({state.employees.length})
            </TabsTrigger>
            <TabsTrigger data-testid="tab-recruit" value="recruit" className="font-mono text-[10px] font-bold uppercase tracking-wider">
              Recrutar ({(state.candidates || []).length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "roster" && (
          <div className="mt-3">
            {state.employees.length === 0 ? (
              <EmptyState
                icon={IdCard}
                title="Plantel vazio"
                sub="Ainda não tens operacionais. Abre Recrutar para montar o primeiro núcleo da organização."
                testId="employees-empty"
              />
            ) : (
              <>
                <div className="relative">
                  <Search size={12} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                  <Input
                    data-testid="employees-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    aria-label="Pesquisar operacionais"
                    placeholder="Pesquisar por nome ou função..."
                    className="min-h-11 w-full border-white/10 bg-black/60 pl-8 pr-3 font-mono text-[11px] text-white placeholder:text-zinc-600"
                  />
                </div>

                <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  <Select value={rosterSort} onValueChange={setRosterSort}>
                    <SelectTrigger data-testid="employees-sort" size="compact">
                      <ArrowUpDown size={11} className="mr-1 shrink-0 text-zinc-500" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="priority">Prioridade</SelectItem>
                      <SelectItem value="name">Nome</SelectItem>
                      <SelectItem value="fatigue">Mais cansados</SelectItem>
                      <SelectItem value="loyalty">Menor lealdade</SelectItem>
                      <SelectItem value="salary">Maior custo</SelectItem>
                    </SelectContent>
                  </Select>

                  <Tip tip={canOptimize
                    ? `Distribui ${freeIdleCount} operacional(is) sem equipa pelas equipas livres com vagas, respeitando especializações.`
                    : freeIdleCount === 0 ? "Não tens operacionais livres sem equipa." : "Não existem equipas livres com vagas."}>
                    <Button
                      type="button"
                      size="compact"
                      variant="outline"
                      data-testid="employees-optimize"
                      onClick={() => canOptimize && optimizeEmployees()}
                      disabled={!canOptimize}
                      className={cn(
                        "w-full gap-1 font-mono font-bold uppercase",
                        canOptimize ? "text-cyan-300" : "text-zinc-600"
                      )}
                    >
                      <Sparkles size={11} /> Otimizar
                    </Button>
                  </Tip>

                  <Button
                    data-testid="employees-toggle-unavailable"
                    variant="filter"
                    size="compact"
                    aria-pressed={hideUnavailable}
                    onClick={() => setHideUnavailable(!hideUnavailable)}
                    className="w-full gap-1 font-mono"
                  >
                    {hideUnavailable ? <EyeOff size={11} /> : <Eye size={11} />}
                    {hideUnavailable ? `Disponíveis${hiddenCount > 0 ? ` +${hiddenCount}` : ""}` : "Todos"}
                  </Button>

                  <Button
                    data-testid="employees-rest-all"
                    variant="outline"
                    size="compact"
                    onClick={restAll}
                    disabled={restAllBusy || restAllIds.length === 0}
                    aria-busy={restAllBusy}
                    className="w-full gap-1 font-mono text-amber-300 disabled:text-zinc-600"
                  >
                    {restAllBusy ? <Loader2 size={11} className="animate-spin" /> : <BedDouble size={11} />}
                    Descansar {restAllIds.length}
                  </Button>
                </div>

                <SectionHeader
                  icon={IdCard}
                  title="Plantel"
                  meta={`${sortedEmployees.length}/${state.employees.length}`}
                  className="mt-4"
                />

                <div className="flex flex-col gap-2" data-testid="employees-list">
                  {sortedEmployees.length === 0 && (
                    <Card className="border-white/[0.06] bg-white/[0.02] p-3 shadow-none">
                      <p className="font-mono text-[11px] text-zinc-500">Nenhum operacional corresponde à pesquisa e aos filtros atuais.</p>
                      <button
                        type="button"
                        onClick={() => { setQuery(""); setHideUnavailable(false); }}
                        className="mt-2 font-mono text-[10px] text-cyan-300"
                      >
                        Limpar filtros
                      </button>
                    </Card>
                  )}
                  {sortedEmployees.map((employee) => (
                    <EmployeeCard key={employee.id} e={employee} onNavigate={onNavigate} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {tab === "recruit" && (
          <div className="mt-3" data-testid="recruitment-list">
            <SummaryStrip cols={2} testId="recruitment-summary">
              <Kpi
                icon={UserCheck}
                label="Capacidade"
                value={`${caps.used}/${caps.max}`}
                color={capFull ? "#EF4444" : "#34D399"}
                tip="Operacionais contratados face à capacidade total dos teus esconderijos."
              />
              <Kpi
                icon={RefreshCw}
                label="Renovação"
                value={poolMs !== null ? fmtDuration(Math.max(0, poolMs / 1000)) : "—"}
                color="#F59E0B"
                tip="Tempo até a rede de contactos poder ser renovada naturalmente."
              />
            </SummaryStrip>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Select value={recruitSort} onValueChange={setRecruitSort}>
                <SelectTrigger data-testid="recruit-sort" size="compact">
                  <ArrowUpDown size={11} className="mr-1 shrink-0 text-zinc-500" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recommended">Recomendados para a organização</SelectItem>
                  <SelectItem value="aptitude">Maior aptidão</SelectItem>
                  <SelectItem value="cost">Menor custo de entrada</SelectItem>
                  <SelectItem value="salary">Menor custo semanal</SelectItem>
                  <SelectItem value="rarity">Maior raridade</SelectItem>
                </SelectContent>
              </Select>

              <PurchaseButton
                testId="refresh-pool-btn"
                icon={RefreshCw}
                label={`Renovar · ${fmtMoney(catalog.hr_costs.pool_refresh)}`}
                can={state.player.clean_money >= catalog.hr_costs.pool_refresh}
                blockedReasons={state.player.clean_money < catalog.hr_costs.pool_refresh ? ["Dinheiro insuficiente."] : []}
                availableTip="Substitui a lista atual por novos contactos. Os candidatos atuais desaparecem."
                requireConfirm
                onConfirm={() => refreshPool()}
                className="w-full sm:w-auto"
                density="compact"
              />
            </div>

            <Card className="mt-2 border-cyan-500/10 bg-cyan-500/[0.025] px-3 py-2 shadow-none">
              <p className="font-mono text-[10px] leading-relaxed text-zinc-500">
                <span className="font-bold text-cyan-300">Recomendados</span> considera aptidão nos atributos da função, talentos e vagas compatíveis nas tuas equipas. O custo semanal apresentado já inclui TSU patronal.
              </p>
            </Card>

            <SectionHeader
              icon={UserPlus}
              title="Candidatos disponíveis"
              meta={candidateRows.length}
              className="mt-4"
            />

            {candidateRows.length === 0 ? (
              <EmptyState
                icon={UserPlus}
                title="Sem candidatos"
                sub="Renova a rede de contactos para gerar uma nova lista."
                testId="recruitment-empty"
              />
            ) : (
              <div className="flex flex-col gap-2">
                {candidateRows.map((row) => (
                  <CandidateCard
                    key={row.c.id}
                    c={row.c}
                    assessment={row.assessment}
                    sourceName={row.sourceName}
                  />
                ))}
              </div>
            )}

            {lockedRecruitSources.length > 0 && (
              <div className="mt-5">
                <SectionHeader icon={Lock} title="Próximas fontes" />
                <div className="space-y-1.5">
                  {lockedRecruitSources.map(([key, source]) => (
                    <div key={key} className="flex items-center justify-between rounded-md border border-white/[0.06] bg-black/20 px-3 py-2">
                      <span className="font-mono text-[10px] text-zinc-500">{source.name}</span>
                      <span className="flex items-center gap-1 font-mono text-[10px] text-amber-400">
                        <Lock size={9} /> Nível {source.min_level}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
