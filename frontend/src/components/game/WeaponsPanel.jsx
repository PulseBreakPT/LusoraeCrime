import { useEffect, useState } from "react";
import { useGame } from "../../context/GameContextV2";
import { usePanelFocus } from "../../hooks/usePanelFocus";
import { cn } from "../../lib/utils";
import {
  fmtMoney, SPEC_LABELS, ATTR_FULL, conditionBand, weaponCompatibility, matchesSearch, LARGE_PURCHASE_THRESHOLD,
  weaponTier, WEAPON_STATS, weaponStatValue, weaponJamRisk, weaponConditionFactor, weaponSkillInfo,
  weaponWearPerMission, weaponAdequacy,
} from "../../lib/game";
import { Tip, Kpi, SummaryStrip, MiniBar, ConfirmButton, PurchaseButton, PanelWatermark, SectionHeader } from "./hud";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "../ui/select";
import {
  Swords, Wrench, Trash2, Lock, Volume2, Search, ShieldAlert, UserRound, Wand2, CheckCircle2,
  AlertTriangle, Sparkles, Banknote, Crosshair, ShieldCheck,
} from "lucide-react";

const useTick = (active) => {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setT((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
};

// Chip do tier (Rua/Profissional/Militar/Pesado) — derivado do nível de
// desbloqueio do modelo, com a cor a alimentar toda a moldura do cartão.
const TierChip = ({ tier }) => (
  <Tip tip={`Tier ${tier.label} — classe de equipamento pelo nível de desbloqueio no mercado.`}>
    <span
      className="shrink-0 rounded-sm border px-1 py-px font-mono text-[10px] font-bold uppercase tracking-widest"
      style={{ borderColor: `${tier.color}55`, color: tier.color, backgroundColor: `${tier.color}14` }}
    >
      {tier.label}
    </span>
  </Tip>
);

// Grelha das 6 dimensões do score de combate — os mesmos números que
// WEAPON_CATEGORY_WEIGHTS pondera na chance de missão.
const StatGrid = ({ model }) => (
  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
    {WEAPON_STATS.map((s) => {
      const v = weaponStatValue(model, s.key);
      const display = s.key === "magazine" ? String(model.magazine_capacity ?? 0) : String(v);
      return (
        <Tip key={s.key} tip={s.tip} block>
          <div>
            <div className="flex justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              <span>{s.label}</span>
              <span className="text-zinc-300">{display}</span>
            </div>
            <MiniBar value={v} color="#A1A1AA" className="mt-0.5" />
          </div>
        </Tip>
      );
    })}
  </div>
);

// Adequação por categoria de operação — score de combate × multiplicador
// best_for, a MESMA régua que o motor usa (weapon_effective_score).
const AdequacyRow = ({ model, catalog, testId }) => {
  const cells = weaponAdequacy(model, catalog);
  return (
    <div data-testid={testId} className="grid grid-cols-5 gap-1">
      {cells.map((c) => (
        <Tip
          key={c.category}
          tip={`${c.label}: adequação ${Math.round(c.score * 100)}%${c.best ? " — categoria ideal para esta arma." : "."}`}
          block
        >
          <div className={cn("rounded-sm border px-1 py-0.5", c.best ? "border-emerald-500/30 bg-emerald-500/[0.06]" : "border-white/5 bg-black/30")}>
            <p className={cn("truncate text-center font-mono text-[10px] uppercase tracking-wide", c.best ? "text-emerald-400" : "text-zinc-600")}>
              {c.label.slice(0, 3)}
            </p>
            <MiniBar value={c.score * 100} color={c.best ? "#34D399" : "#71717A"} className="mt-0.5" />
          </div>
        </Tip>
      ))}
    </div>
  );
};

// Risco de encravamento (SSS v5) — fiabilidade do modelo + défice de condição.
const JamChip = ({ model, condition, meta, testId }) => {
  const jam = weaponJamRisk(model, condition, meta);
  const warn = meta.jam_warn_risk ?? 0.15;
  if ((model.magazine_capacity || 0) < 2 && !model.loud) {
    return (
      <Tip tip="Arma sem mecanismo de fogo — nunca encrava, independentemente da condição.">
        <span data-testid={testId} className="inline-flex items-center gap-0.5 font-mono text-[10px] text-emerald-400">
          <ShieldCheck size={9} /> nunca encrava
        </span>
      </Tip>
    );
  }
  const pct = Math.round(jam * 100);
  const critical = jam >= 0.25;
  const warned = jam >= warn;
  return (
    <Tip tip={`Risco de encravar por missão: ${pct}%. Aumenta com baixa fiabilidade e mau estado. Um encravamento reduz a probabilidade de sucesso e aumenta o desgaste.`}>
    <span
      data-testid={testId}
      className={cn(
        "inline-flex items-center gap-0.5 font-mono text-[10px]",
        critical ? "text-red-400" : warned ? "text-amber-400" : "text-zinc-500"
      )}
    >
      <AlertTriangle size={9} /> encrava {pct}%
    </span>
    </Tip>
  );
};

export const WeaponsPanel = ({ open, onOpenChange, onNavigate, focusTarget }) => {
  const {
    state, catalog, buyWeapon, sellWeapon, repairWeapon, assignWeapon, unassignWeapon, autoAssignWeapon,
    optimizeWeapons, repairWeaponsAll,
  } = useGame();
  const [query, setQuery] = useState("");
  useTick(open);
  usePanelFocus(open, focusTarget);
  useEffect(() => {
    if (open && focusTarget?.testId?.startsWith("weapon-card-")) setQuery("");
  }, [open, focusTarget?.token, focusTarget?.testId]);
  if (!state) return null;

  const meta = catalog?.weapon_meta || {};
  const repairMult = meta.repair_cost_multiplier ?? 0.5;
  const sellFrac = meta.sell_fraction ?? 0.4;
  const weapons = state.weapons || [];
  const employeeOf = (w) => state.employees.find((e) => e.id === w.employee_id);
  const weaponBusy = (w) => {
    const e = employeeOf(w);
    return e && e.status !== "idle";
  };

  const repairCostOf = (w) => {
    const model = catalog?.weapon_models?.[w.model_key];
    return Math.max(20, Math.round((100 - w.condition) * (model?.maintenance_cost || 100) * repairMult / 100));
  };
  const sellValueOf = (w) => {
    const model = catalog?.weapon_models?.[w.model_key];
    return Math.round((model?.price || 0) * sellFrac * (w.condition / 100));
  };

  const repairableIds = weapons.filter((w) => !weaponBusy(w) && w.condition < 99.5).map((w) => w.id);
  const repairAllCost = weapons.filter((w) => repairableIds.includes(w.id)).reduce((a, w) => a + repairCostOf(w), 0);
  const repairAll = () => repairWeaponsAll();

  const filteredWeapons = weapons.filter((w) =>
    matchesSearch(query, w.name, catalog?.weapon_models?.[w.model_key]?.name || w.model_key)
  );
  const sortedWeapons = [...filteredWeapons].sort((a, b) => {
    const rank = (w) => {
      if (weaponBusy(w)) return 1;
      if (w.condition < 30) return 2;
      return 0;
    };
    return rank(a) - rank(b);
  });

  const avgCondition = weapons.length ? Math.round(weapons.reduce((a, w) => a + w.condition, 0) / weapons.length) : 0;
  const equippedCount = weapons.filter((w) => w.employee_id).length;
  const maxJam = weapons.reduce((a, w) => {
    const m = catalog?.weapon_models?.[w.model_key];
    return m ? Math.max(a, weaponJamRisk(m, w.condition, meta)) : a;
  }, 0);
  const jamWarn = meta.jam_warn_risk ?? 0.15;
  const arsenalValue = weapons.reduce((a, w) => a + sellValueOf(w), 0);
  const idleCount = state.employees.filter((e) => e.status === "idle").length;
  const canOptimize = weapons.length > 0 && idleCount > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sub-panel">
        <SheetHeader>
          <PanelWatermark icon={Swords} />
          <SheetTitle className="flex items-center gap-2 text-white">
            <Swords size={18} className="text-primary" /> Armamento
            <span className="ml-auto font-mono text-xs text-zinc-500" data-testid="weapons-count">{weapons.length}</span>
          </SheetTitle>
          <SheetDescription className="text-zinc-500">As ferramentas do ofício — compra, mantém e distribui com cabeça.</SheetDescription>
        </SheetHeader>

        <SummaryStrip cols={4} className="mt-3" testId="weapons-summary">
          <Kpi icon={CheckCircle2} label="Equipadas" value={`${equippedCount}/${weapons.length}`} color={equippedCount === weapons.length && weapons.length > 0 ? "#34D399" : "#F59E0B"}
            tip="Armas atualmente atribuídas a um funcionário vs. total no inventário." />
          <Kpi icon={Wrench} label="Condição" value={`${avgCondition}%`} color={avgCondition < 50 ? "#EF4444" : "#34D399"} bar={avgCondition} barColor={avgCondition < 50 ? "#EF4444" : "#34D399"}
            tip="Condição média do armamento. Abaixo de 40% a eficácia cai rapidamente." />
          <Kpi icon={AlertTriangle} label="Encravar" value={`${Math.round(maxJam * 100)}%`} color={maxJam >= 0.25 ? "#EF4444" : maxJam >= jamWarn ? "#F59E0B" : "#34D399"}
            tip="Pior risco de encravamento do arsenal — sobe com a falta de fiabilidade do modelo e com a condição abaixo do limiar de manutenção." />
          <Kpi icon={Banknote} label="Revenda" value={fmtMoney(arsenalValue)} color="#22D3EE"
            tip={`Valor de revenda do arsenal inteiro (${Math.round(sellFrac * 100)}% do preço × condição de cada arma).`} />
        </SummaryStrip>

        <div className="mt-3 flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search size={11} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-zinc-600" />
            <Input
              data-testid="weapons-search"
              value={query}
              onChange={(ev) => setQuery(ev.target.value)}
              aria-label="Pesquisar armamento"
              placeholder="Pesquisar arma..."
              className="h-auto w-full border-white/10 bg-black/60 py-1.5 pl-6 pr-2 font-mono text-[11px] text-white placeholder:text-zinc-600"
            />
          </div>
          <Tip tip={canOptimize
            ? `Distribui o arsenal pelos ${idleCount} operacionais disponíveis, procurando a melhor combinação para cada um.`
            : weapons.length === 0 ? "Sem armas no arsenal." : "Nenhum operacional disponível para equipar."}>
            <button type="button"
              data-testid="weapons-optimize"
              onClick={() => canOptimize && optimizeWeapons()}
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
              testId="weapons-repair-all"
              icon={Wrench}
              label="Reparar"
              can={state.player.clean_money >= repairAllCost}
              blockedReasons={["Dinheiro insuficiente."]}
              availableTip={`Repara todo o armamento disponível abaixo de 100% de condição (${repairableIds.length}) por ${fmtMoney(repairAllCost)} no total.`}
              onConfirm={repairAll}
              className="w-full shrink-0 sm:w-auto"
            />
          )}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="weapons-list">
          {weapons.length === 0 && (
            <p className="col-span-full rounded-lg border border-dashed border-white/10 p-3 text-center font-mono text-[11px] text-zinc-500">
              Ainda não tens armas — compra a primeira no arsenal abaixo.
            </p>
          )}
          {weapons.length > 0 && sortedWeapons.length === 0 && (
            <p className="col-span-full rounded-lg border border-dashed border-white/10 p-3 text-center font-mono text-[11px] text-zinc-500">
              Nenhuma arma com esse nome no arsenal.
            </p>
          )}
          {weapons.some((w) => !w.employee_id) && state.employees.length === 0 && (
            <button type="button"
              data-testid="weapons-nav-employees"
              onClick={() => onNavigate && onNavigate("employees")}
              className="col-span-full w-full rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-center font-mono text-[10px] text-amber-400 underline-offset-2 hover:underline"
            >
              Sem operacionais para equipar — recruta em Operacionais
            </button>
          )}
          {sortedWeapons.map((w) => {
            const model = catalog?.weapon_models?.[w.model_key];
            if (!model) return null;
            const tier = weaponTier(model);
            const emp = employeeOf(w);
            const busy = weaponBusy(w);
            const repairCost = repairCostOf(w);
            const sellValue = sellValueOf(w);
            const compat = emp ? weaponCompatibility(emp, model) : null;
            const band = conditionBand(w.condition);
            const effCond = Math.round(weaponConditionFactor(w.condition, meta) * 100);
            const wear = weaponWearPerMission(model, meta);
            const skill = emp ? weaponSkillInfo(emp, model, meta) : null;
            const prof = emp ? ((emp.weapon_proficiency || {})[model.category] || 0) : 0;
            const profMax = meta.proficiency_max ?? 100;
            const profBonus = Math.sqrt(Math.max(0, prof) / profMax) * (meta.proficiency_bonus_max_pct ?? 0.08);
            return (
              <Card key={w.id} data-testid={`weapon-card-${w.id}`} className="h-full min-w-0 sub-card sub-weapon-card p-2.5 shadow-none" style={{ "--wtier": tier.color }}>
                <div className="relative z-[1] min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-bold text-white">{w.name}</p>
                    <TierChip tier={tier} />
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    {catalog?.weapon_categories?.[model.category]?.name || model.category}
                    {model.loud && (
                      <Tip tip={`Arma ruidosa — multiplica o calor da operação por ×${meta.loud_heat_mult ?? 1.3} e denuncia abordagens discretas.`}>
                        <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-400">
                          <Volume2 size={9} /> ruidosa
                        </span>
                      </Tip>
                    )}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <JamChip model={model} condition={w.condition} meta={meta} testId={`weapon-jam-${w.id}`} />
                    <Tip tip={`Desgaste base de condição por missão deste modelo (durabilidade ${model.durability}): missões arriscadas desgastam ainda mais (+${Math.round((meta.wear_risk_mult ?? 1.5) * 100) / 100} por ponto de risco).`}>
                      <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-zinc-500">
                        <Wrench size={9} /> −{wear.toFixed(1)}/missão
                      </span>
                    </Tip>
                    <Tip tip={`${w.missions_done ?? 0} missões no total, ${w.missions_since_repair ?? 0} desde a última reparação.`}>
                      <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-zinc-500">
                        <Crosshair size={9} /> {w.missions_done ?? 0} op.
                      </span>
                    </Tip>
                  </div>
                </div>

                {/* Condição com curva não-linear do motor */}
                <div className="relative z-[1] mt-2">
                  <div className="flex justify-between font-mono text-[10px] uppercase text-zinc-500">
                    <span>Condição</span>
                    <Tip tip={`${Math.round(w.condition)}% de condição — eficácia real ${effCond}% (abaixo de ${meta.condition_soft_knee ?? 40}% a curva é quadrática: uma arma a 20% é quase sucata).`}>
                      <span>
                        <span style={{ color: band.color }}>{band.label}</span>
                        {effCond < Math.round(w.condition) - 1 && (
                          <span className="ml-1 text-red-400">eficácia {effCond}%</span>
                        )}
                      </span>
                    </Tip>
                  </div>
                  <MiniBar value={w.condition} color={w.condition < 30 ? "#EF4444" : w.condition < (meta.condition_soft_knee ?? 40) ? "#F59E0B" : "#34D399"} className="mt-0.5" />
                </div>

                {/* Portador: habilidade + proficiência — a mão que segura a arma */}
                {emp && skill && (
                  <div className="relative z-[1] mt-2 rounded-md border border-white/5 bg-black/30 p-1.5" data-testid={`weapon-holder-${w.id}`}>
                    <div className="flex items-center justify-between gap-1">
                      <p className="flex min-w-0 items-center gap-1 font-mono text-[10px] text-zinc-300">
                        <UserRound size={10} className="shrink-0 text-zinc-500" />
                        <span className="truncate">{emp.name}</span>
                        <span className="shrink-0 text-zinc-600">· {SPEC_LABELS[emp.spec] || emp.spec}</span>
                      </p>
                      {compat && !compat.compatible && (
                        <Tip tip={`${emp.name} não cumpre os requisitos mínimos (${compat.missing.map((k) => ATTR_FULL[k] || k).join(", ")}) — usa a arma com eficácia reduzida (nunca bloqueia).`}>
                          <span className="inline-flex shrink-0 items-center gap-0.5 font-mono text-[10px] text-amber-400">
                            <ShieldAlert size={10} /> requisitos
                          </span>
                        </Tip>
                      )}
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-x-3">
                      <Tip tip={`A arma certa na mão errada rende pouco: a eficácia escala com ${ATTR_FULL[skill.attr] || skill.attr} (${skill.value}/${meta.skill_attr_cap ?? 8}) — este portador extrai ${Math.round(skill.factor * 100)}% do potencial.`} block>
                        <div>
                          <div className="flex justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                            <span>Mão · {ATTR_FULL[skill.attr] || skill.attr}</span>
                            <span className={skill.factor >= 0.9 ? "text-emerald-400" : skill.factor >= 0.75 ? "text-zinc-300" : "text-amber-400"}>{Math.round(skill.factor * 100)}%</span>
                          </div>
                          <MiniBar value={skill.factor * 100} color={skill.factor >= 0.9 ? "#34D399" : skill.factor >= 0.75 ? "#A1A1AA" : "#F59E0B"} className="mt-0.5" />
                        </div>
                      </Tip>
                      <Tip tip={`Proficiência com armas ${catalog?.weapon_categories?.[model.category]?.name || model.category}: ${Math.round(prof)}/${profMax} (+${(meta.proficiency_gain_per_mission ?? 4)} por missão). Bónus de chance atual: +${(profBonus * 100).toFixed(1)}% (máx. +${Math.round((meta.proficiency_bonus_max_pct ?? 0.08) * 100)}%).`} block>
                        <div>
                          <div className="flex justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                            <span>Proficiência</span>
                            <span className="text-cyan-400">+{(profBonus * 100).toFixed(1)}%</span>
                          </div>
                          <MiniBar value={(prof / profMax) * 100} color="#22D3EE" className="mt-0.5" />
                        </div>
                      </Tip>
                    </div>
                  </div>
                )}

                {/* Adequação por operação */}
                <div className="relative z-[1] mt-2">
                  <AdequacyRow model={model} catalog={catalog} testId={`weapon-adequacy-${w.id}`} />
                </div>

                <Select
                  value={w.employee_id || "__none__"}
                  disabled={busy}
                  onValueChange={(eid) => (eid === "__none__" ? unassignWeapon(w.employee_id) : assignWeapon(w.id, eid))}
                >
                  <SelectTrigger data-testid={`weapon-employee-select-${w.id}`} className="relative z-[1] mt-2 w-full border-white/10 bg-black/60 font-mono text-[11px] text-white disabled:opacity-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" className="font-mono text-xs">Sem operacional (inventário)</SelectItem>
                    {state.employees.map((e) => (
                      <SelectItem key={e.id} value={e.id} className="font-mono text-xs">
                        {e.name} · {SPEC_LABELS[e.spec] || e.spec}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!w.employee_id && (
                  <button type="button"
                    data-testid={`weapon-auto-assign-${w.id}`}
                    onClick={() => autoAssignWeapon(w.id)}
                    className="relative z-[1] mt-1 flex items-center gap-1 font-mono text-[10px] text-cyan-400 underline-offset-2 hover:underline"
                  >
                    <Wand2 size={10} /> Atribuir automaticamente ao mais adequado
                  </button>
                )}

                <div className="relative z-[1] mt-2 flex gap-1.5">
                  <PurchaseButton
                    testId={`repair-weapon-${w.id}`}
                    icon={Wrench}
                    label={fmtMoney(repairCost)}
                    can={!busy && w.condition <= 99 && state.player.clean_money >= repairCost}
                    blockedReasons={[
                      busy ? "Arma equipada por operacional em serviço." : null,
                      w.condition > 99 ? "Já está a 100% de condição." : null,
                      state.player.clean_money < repairCost ? "Dinheiro insuficiente." : null,
                    ].filter(Boolean)}
                    availableTip="Reparar até 100% de condição — repõe a eficácia e elimina o risco de encravar por desgaste."
                    onConfirm={() => repairWeapon(w.id)}
                    className="flex-1"
                  />
                  <ConfirmButton
                    testId={`sell-weapon-${w.id}`}
                    icon={Trash2}
                    label={fmtMoney(sellValue)}
                    confirmLabel="Vender?"
                    color="text-red-400"
                    onConfirm={() => sellWeapon(w.id)}
                    disabled={busy}
                    className="flex-1"
                    tip={`Vender esta arma por ${fmtMoney(sellValue)} (${Math.round(sellFrac * 100)}% do preço × condição). Ação irreversível.`}
                  />
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-6">
          <SectionHeader icon={Swords} title="Arsenal" meta={catalog ? `${Object.keys(catalog.weapon_models || {}).length} modelos` : undefined} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {catalog &&
              Object.entries(catalog.weapon_models).map(([key, m]) => {
                const tier = weaponTier(m);
                const locked = state.player.level < m.min_level;
                const reqAttrs = Object.entries(m.requires_attr || {});
                const owned = weapons.filter((w) => w.model_key === key).length;
                const wear = weaponWearPerMission(m, meta);
                return (
                  <Card key={key} data-testid={`arsenal-card-${key}`} className={cn("h-full min-w-0 sub-card sub-weapon-card p-2.5 shadow-none", locked && "opacity-80")} style={{ "--wtier": tier.color }}>
                    <div className="relative z-[1] min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-semibold text-white">{m.name}</p>
                        <TierChip tier={tier} />
                      </div>
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                        {catalog?.weapon_categories?.[m.category]?.name || m.category}
                        {locked && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-400">
                            <Lock size={9} /> nível {m.min_level}
                          </span>
                        )}
                        {m.loud && (
                          <Tip tip={`Arma ruidosa — multiplica o calor da operação por ×${meta.loud_heat_mult ?? 1.3}.`}>
                            <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-400">
                              <Volume2 size={9} /> ruidosa
                            </span>
                          </Tip>
                        )}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[10px] leading-tight text-zinc-500">{m.desc}</p>
                    </div>

                    <div className="relative z-[1] mt-2">
                      <StatGrid model={m} />
                    </div>

                    <div className="relative z-[1] mt-2">
                      <AdequacyRow model={m} catalog={catalog} testId={`arsenal-adequacy-${key}`} />
                    </div>

                    <div className="relative z-[1] mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                      <Tip tip={`Fiabilidade ${m.reliability}% — risco base de encravar ${Math.round(weaponJamRisk(m, 100, meta) * 100)}% mesmo em perfeitas condições.`}>
                        <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-zinc-400">
                          <ShieldCheck size={9} className={m.reliability >= 85 ? "text-emerald-400" : m.reliability >= 70 ? "text-amber-400" : "text-red-400"} /> fiab. {m.reliability}%
                        </span>
                      </Tip>
                      <Tip tip={`Durabilidade ${m.durability} — perde ~${wear.toFixed(1)} de condição por missão (mais em operações arriscadas).`}>
                        <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-zinc-400">
                          <Wrench size={9} /> −{wear.toFixed(1)}/missão
                        </span>
                      </Tip>
                      <Tip tip={`Discrição ${m.discretion}/100 — armas discretas escondem-se melhor em operações furtivas.`}>
                        <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-zinc-400">
                          <Search size={9} /> discr. {m.discretion}
                        </span>
                      </Tip>
                      <Tip tip={`Custo de manutenção de referência: reparação total custa até ${fmtMoney(Math.round(m.maintenance_cost * (meta.repair_cost_multiplier ?? 0.5)))}.`}>
                        <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-zinc-400">
                          <Banknote size={9} /> manut. {fmtMoney(m.maintenance_cost)}
                        </span>
                      </Tip>
                    </div>

                    {reqAttrs.length > 0 && (
                      <Tip tip="Atributos mínimos recomendados — abaixo destes valores o portador continua a poder equipar, mas extrai menos eficácia (nunca bloqueia)." block>
                        <p className="relative z-[1] mt-1.5 font-mono text-[10px] uppercase tracking-wide text-zinc-500">
                          requer: <span className="text-zinc-300">{reqAttrs.map(([a, v]) => `${ATTR_FULL[a] || a} ${v}+`).join(" · ")}</span>
                        </p>
                      </Tip>
                    )}

                    <div className="relative z-[1] mt-2 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
                      {owned > 0 ? (
                        <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">no arsenal: <span className="text-zinc-300">{owned}</span></span>
                      ) : <span />}
                      <PurchaseButton
                        testId={`buy-weapon-${key}`}
                        label={fmtMoney(m.price)}
                        can={!locked && state.player.clean_money >= m.price}
                        requireConfirm={m.price >= LARGE_PURCHASE_THRESHOLD}
                        blockedReasons={[
                          locked ? `Requer Nível ${m.min_level}.` : null,
                          state.player.clean_money < m.price ? "Dinheiro insuficiente." : null,
                        ].filter(Boolean)}
                        availableTip={`Comprar por ${fmtMoney(m.price)} limpos.`}
                        onConfirm={() => buyWeapon(key)}
                        className="w-full shrink-0 sm:w-auto"
                      />
                    </div>
                  </Card>
                );
              })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
