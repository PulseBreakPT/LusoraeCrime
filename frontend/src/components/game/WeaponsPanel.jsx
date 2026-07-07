import { useEffect, useState } from "react";
import { useGame } from "../../context/GameContextV2";
import { fmtMoney, SPEC_LABELS, conditionBand, weaponBenefit, weaponCompatibility, matchesSearch, LARGE_PURCHASE_THRESHOLD } from "../../lib/game";
import { Tip, Kpi, SummaryStrip, MiniBar, ConfirmButton, PurchaseButton } from "./hud";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "../ui/select";
import { Swords, Wrench, Trash2, Lock, Volume2, Search, ShieldAlert, UserRound, Wand2, CheckCircle2 } from "lucide-react";

const useTick = (active) => {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setT((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
};

export const WeaponsPanel = ({ open, onOpenChange, onNavigate }) => {
  const {
    state, catalog, buyWeapon, sellWeapon, repairWeapon, assignWeapon, unassignWeapon, autoAssignWeapon,
  } = useGame();
  const [query, setQuery] = useState("");
  useTick(open);
  if (!state) return null;

  const weapons = state.weapons || [];
  const employeeOf = (w) => state.employees.find((e) => e.id === w.employee_id);
  const weaponBusy = (w) => {
    const e = employeeOf(w);
    return e && e.status !== "idle";
  };

  const repairableIds = weapons.filter((w) => !weaponBusy(w) && w.condition < 99.5).map((w) => w.id);
  const repairAllCost = weapons
    .filter((w) => repairableIds.includes(w.id))
    .reduce((a, w) => {
      const model = catalog?.weapon_models?.[w.model_key];
      return a + Math.max(20, Math.round((100 - w.condition) * (model?.maintenance_cost || 100) * 0.5 / 100));
    }, 0);
  const repairAll = () => repairableIds.forEach((id) => repairWeapon(id));

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-sm overflow-y-auto border-border bg-background/95 backdrop-blur-xl sm:max-w-sm">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white">
            <Swords size={18} className="text-primary" /> Armamento
            <span className="ml-auto font-mono text-xs text-zinc-500" data-testid="weapons-count">{weapons.length}</span>
          </SheetTitle>
          <SheetDescription className="text-zinc-500">Compra, repara, atribui e vende equipamento operacional.</SheetDescription>
        </SheetHeader>

        <SummaryStrip cols={3} className="mt-3" testId="weapons-summary">
          <Kpi icon={CheckCircle2} label="Equipadas" value={`${equippedCount}/${weapons.length}`} color={equippedCount === weapons.length && weapons.length > 0 ? "#34D399" : "#F59E0B"}
            tip="Armas atualmente atribuídas a um funcionário vs. total no inventário." />
          <Kpi icon={Wrench} label="Condição" value={`${avgCondition}%`} color={avgCondition < 50 ? "#EF4444" : "#34D399"} bar={avgCondition} barColor={avgCondition < 50 ? "#EF4444" : "#34D399"}
            tip="Condição média do armamento — desgasta-se a cada missão." />
          <Kpi icon={UserRound} label="Operacionais" value={state.employees.length} color="#22D3EE"
            tip="Total de operacionais — só quem está disponível pode ser equipado." />
        </SummaryStrip>

        <div className="mt-3 flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search size={11} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-zinc-600" />
            <Input
              data-testid="weapons-search"
              value={query}
              onChange={(ev) => setQuery(ev.target.value)}
              placeholder="Pesquisar arma..."
              className="h-auto w-full border-white/10 bg-black/60 py-1.5 pl-6 pr-2 font-mono text-[11px] text-white placeholder:text-zinc-600"
            />
          </div>
          {repairableIds.length > 0 && (
            <PurchaseButton
              testId="weapons-repair-all"
              icon={Wrench}
              label="Reparar todas"
              can={state.player.clean_money >= repairAllCost}
              blockedReasons={["Dinheiro insuficiente."]}
              availableTip={`Repara todo o armamento disponível abaixo de 100% de condição (${repairableIds.length}) por ${fmtMoney(repairAllCost)} no total.`}
              onConfirm={repairAll}
              className="w-auto shrink-0"
            />
          )}
        </div>

        <div className="mt-3 space-y-2" data-testid="weapons-list">
          {weapons.length === 0 && (
            <p className="rounded-lg border border-dashed border-white/10 p-3 text-center font-mono text-[11px] text-zinc-500">
              Ainda não tens armas — compra a primeira no arsenal abaixo.
            </p>
          )}
          {weapons.length > 0 && sortedWeapons.length === 0 && (
            <p className="rounded-lg border border-dashed border-white/10 p-3 text-center font-mono text-[11px] text-zinc-500">
              Nenhuma arma corresponde à pesquisa.
            </p>
          )}
          {weapons.some((w) => !w.employee_id) && state.employees.length === 0 && (
            <button
              data-testid="weapons-nav-employees"
              onClick={() => onNavigate && onNavigate("employees")}
              className="w-full rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-center font-mono text-[10px] text-amber-400 underline-offset-2 hover:underline"
            >
              Sem operacionais para equipar — recruta em Operacionais
            </button>
          )}
          {sortedWeapons.map((w) => {
            const model = catalog?.weapon_models?.[w.model_key];
            if (!model) return null;
            const emp = employeeOf(w);
            const busy = weaponBusy(w);
            const repairCost = Math.max(20, Math.round((100 - w.condition) * (model.maintenance_cost || 100) * 0.5 / 100));
            const sellValue = Math.round(model.price * 0.4 * (w.condition / 100));
            const compat = emp ? weaponCompatibility(emp, model) : null;
            return (
              <Card key={w.id} data-testid={`weapon-card-${w.id}`} className="border-white/10 bg-white/[0.03] p-3 shadow-none">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white">{w.name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                      {catalog?.weapon_categories?.[model.category]?.name || model.category}
                      {model.loud && (
                        <Tip tip="Arma ruidosa — soma calor extra em operações discretas.">
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-400">
                            <Volume2 size={9} /> ruidosa
                          </span>
                        </Tip>
                      )}
                    </p>
                  </div>
                </div>

                {emp && (
                  <p className="mt-1 flex items-center gap-1 font-mono text-[10px] text-zinc-400">
                    <UserRound size={10} className="shrink-0 text-zinc-500" />
                    {emp.name}
                    {compat && !compat.compatible && (
                      <Tip tip={`${emp.name} não cumpre os requisitos mínimos desta arma (${compat.missing.join(", ")}) — usa-a com menos eficácia.`}>
                        <span className="inline-flex items-center gap-0.5 text-amber-400">
                          <ShieldAlert size={10} /> pouco compatível
                        </span>
                      </Tip>
                    )}
                  </p>
                )}

                <div className="mt-1.5">
                  <div className="flex justify-between font-mono text-[9px] uppercase text-zinc-500">
                    <span>Condição</span>
                    <Tip tip={`${Math.round(w.condition)}% de condição.`}>
                      <span style={{ color: conditionBand(w.condition).color }}>{conditionBand(w.condition).label}</span>
                    </Tip>
                  </div>
                  <MiniBar value={w.condition} color={w.condition < 30 ? "#EF4444" : "#34D399"} className="mt-0.5" />
                </div>

                <Select
                  value={w.employee_id || "__none__"}
                  disabled={busy}
                  onValueChange={(eid) => (eid === "__none__" ? unassignWeapon(w.employee_id) : assignWeapon(w.id, eid))}
                >
                  <SelectTrigger data-testid={`weapon-employee-select-${w.id}`} className="mt-2 w-full border-white/10 bg-black/60 font-mono text-[11px] text-white disabled:opacity-40">
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
                  <button
                    data-testid={`weapon-auto-assign-${w.id}`}
                    onClick={() => autoAssignWeapon(w.id)}
                    className="mt-1 flex items-center gap-1 font-mono text-[10px] text-cyan-400 underline-offset-2 hover:underline"
                  >
                    <Wand2 size={10} /> Atribuir automaticamente ao mais adequado
                  </button>
                )}

                <div className="mt-2 flex gap-1.5">
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
                    availableTip="Reparar até 100% de condição."
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
                    tip={`Vender esta arma por ${fmtMoney(sellValue)} (40% do preço × condição). Ação irreversível.`}
                  />
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-6">
          <h3 className="mb-2 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">Arsenal</h3>
          <div className="space-y-2">
            {catalog &&
              Object.entries(catalog.weapon_models).map(([key, m]) => {
                const locked = state.player.level < m.min_level;
                const reqAttrs = Object.entries(m.requires_attr || {});
                return (
                  <Card key={key} className="flex items-center justify-between border-white/10 bg-white/[0.03] p-3 shadow-none">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">
                        {m.name}
                        {locked && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 font-mono text-[9px] uppercase text-amber-400">
                            <Lock size={9} /> Nível {m.min_level}
                          </span>
                        )}
                        {m.loud && (
                          <Tip tip="Arma ruidosa — soma calor extra em operações discretas.">
                            <span className="ml-1.5 inline-flex items-center gap-0.5 font-mono text-[9px] uppercase text-amber-400">
                              <Volume2 size={9} /> ruidosa
                            </span>
                          </Tip>
                        )}
                      </p>
                      <p className="mt-0.5 text-[10px] text-zinc-500">{m.desc}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-cyan-400">{weaponBenefit(m)}</p>
                      {m.best_for?.length > 0 && (
                        <Tip tip="Categorias de operação em que esta arma dá um bónus extra de probabilidade de sucesso.">
                          <p className="mt-0.5 font-mono text-[10px] text-emerald-400">
                            ideal: {m.best_for.map((c) => SPEC_LABELS[c] || c).join(", ")}
                          </p>
                        </Tip>
                      )}
                      {reqAttrs.length > 0 && (
                        <Tip tip="Atributos mínimos recomendados — funcionários abaixo destes valores continuam a poder equipar a arma, mas com menos eficácia.">
                          <p className="mt-0.5 font-mono text-[10px] text-zinc-500">
                            requer: {reqAttrs.map(([a, v]) => `${a} ${v}+`).join(", ")}
                          </p>
                        </Tip>
                      )}
                    </div>
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
                      className="w-auto shrink-0"
                    />
                  </Card>
                );
              })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
