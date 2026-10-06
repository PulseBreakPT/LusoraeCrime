import { useEffect, useState } from "react";
import { useGame } from "../../context/GameContextV2";
import { fmtMoney, fmtDuration, hqBenefitsAt, hqBenefitDesc } from "../../lib/game";
import { MiniBar, PurchaseButton, PanelWatermark, SectionHeader } from "./hud";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import {
  Landmark, ArrowUpCircle, Clock, Lock, SlidersHorizontal, Wallet,
  UserCog, Truck, Fingerprint, Radio, History, MapPin,
} from "lucide-react";

const useTick = (active) => {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setT((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
};

const TABS = [
  { key: "geral", label: "Geral" },
  { key: "melhorias", label: "Melhorias" },
  { key: "prioridades", label: "Prioridades" },
];

const DEPARTMENT_ICONS = { financeiro: Wallet, rh: UserCog, logistica: Truck, investigacao: Fingerprint, comunicacoes: Radio };

export const HQPanel = ({ open, onOpenChange }) => {
  const { state, catalog, serverNow, upgradeHQ, setOrgPriority, startHqRelocation } = useGame();
  const [tab, setTab] = useState("geral");
  useTick(open);

  if (!state || !catalog) return null;

  const hq = state.player.hq;
  const maxLevel = catalog.hq_max_level || 10;
  const currentTier = hqBenefitsAt(catalog, hq.level);
  const nextTier = hq.level < maxLevel ? hqBenefitsAt(catalog, hq.level + 1) : null;
  const upgrading = hq.upgrading_until && Date.parse(hq.upgrading_until) > serverNow();
  const upgradeRemaining = upgrading ? Math.max(0, (Date.parse(hq.upgrading_until) - serverNow()) / 1000) : 0;
  const upgradeProgressPct = upgrading && nextTier
    ? Math.min(100, Math.max(0, 100 - (upgradeRemaining / nextTier.upgrade_duration_s) * 100))
    : 0;
  const maxed = hq.level >= maxLevel;
  const canAffordNext = !!nextTier && state.player.clean_money >= nextTier.upgrade_cost;
  const meetsOrgLevel = !!nextTier && state.player.level >= nextTier.min_org_level;
  const priority = state.player.priorities?.active || catalog.hq_default_priority || "equilibrio";
  const tutorialRelocatable = Number(state.player.stats?.ops_dispatched || 0) === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sub-panel" data-testid="hq-panel">
        <SheetHeader>
          <PanelWatermark icon={Landmark} />
          <SheetTitle className="flex items-center gap-2 text-white">
            <Landmark size={18} className="text-primary" /> Quartel-General
            <span className="ml-auto font-mono text-xs text-zinc-500" data-testid="hq-level">Nível {hq.level}/{maxLevel}</span>
          </SheetTitle>
          <SheetDescription className="text-zinc-500">
            {currentTier?.name} — {currentTier?.desc}
          </SheetDescription>
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-3">
          <TabsList className="grid w-full grid-cols-2 gap-1 sm:grid-cols-4">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.key}
                data-testid={`hq-tab-${t.key}`}
                value={t.key}
                className="px-1 font-mono text-[10px] font-bold uppercase tracking-wider"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {tab === "geral" && (
          <div className="mt-3 space-y-3" data-testid="hq-tab-geral-content">
            {tutorialRelocatable && (
              <Card data-testid="hq-tutorial-relocation" className="border-cyan-500/20 bg-cyan-500/[0.04] p-3 shadow-none">
                <div className="flex items-start gap-2.5">
                  <MapPin size={15} className="mt-0.5 shrink-0 text-cyan-300" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white">Ainda podes mudar o QG</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-zinc-400">
                      Durante o tutorial, até despachares a primeira operação, podes corrigir a localização sem custo. Não há um bónus secreto por cidade: a consequência principal é geográfica, porque as zonas e deslocações são recalculadas à volta do QG.
                    </p>
                    <Button
                      type="button"
                      data-testid="hq-relocate-tutorial"
                      variant="outline"
                      size="compact"
                      onClick={()=>{startHqRelocation();onOpenChange(false);}}
                      className="mt-2 gap-1.5 font-mono text-[10px] font-bold uppercase text-cyan-300"
                    >
                      <MapPin size={12}/> Escolher outro local no mapa
                    </Button>
                  </div>
                </div>
              </Card>
            )}
            <p className="rounded-md border border-emerald-500/15 bg-emerald-500/[0.04] px-2.5 py-2 font-mono text-[10px] text-emerald-400">
              {hqBenefitDesc(currentTier)}
            </p>

          </div>
        )}

        {tab === "melhorias" && (
          <div className="mt-3 space-y-3" data-testid="hq-tab-melhorias-content">
            <Card className="sub-card p-3 shadow-none">
              {upgrading ? (
                <div className="mt-2">
                  <p className="flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-cyan-400">
                    <Clock size={11} /> A melhorar para nível {hq.level + 1} — pronto em {fmtDuration(upgradeRemaining)}
                  </p>
                  <MiniBar value={upgradeProgressPct} color="#22D3EE" className="mt-1.5" />
                </div>
              ) : maxed ? (
                <p className="mt-2 font-mono text-[10px] font-bold uppercase text-amber-400">Nível máximo atingido</p>
              ) : (
                <>
                  <p className="mt-2 font-mono text-[10px] text-cyan-400/80">
                    Nível {hq.level + 1}: {hqBenefitDesc(nextTier)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10px] text-zinc-500">
                    <span>Custo: <span className={canAffordNext ? "text-white" : "text-red-400"}>{fmtMoney(nextTier.upgrade_cost)}</span></span>
                    <span>·</span>
                    <span>Duração: {fmtDuration(nextTier.upgrade_duration_s)}</span>
                  </div>
                  {!meetsOrgLevel && (
                    <p className="mt-1 flex items-center gap-1 font-mono text-[10px] text-amber-400">
                      <Lock size={10} /> Requer nível de organização {nextTier.min_org_level}
                    </p>
                  )}
                  <PurchaseButton
                    testId="hq-upgrade-button"
                    icon={ArrowUpCircle}
                    label={`Melhorar — ${fmtMoney(nextTier.upgrade_cost)}`}
                    can={canAffordNext && meetsOrgLevel}
                    blockedReasons={[
                      !meetsOrgLevel ? `Requer organização nível ${nextTier.min_org_level}.` : null,
                      meetsOrgLevel && !canAffordNext ? "Dinheiro insuficiente." : null,
                    ].filter(Boolean)}
                    availableTip={`Melhorar para o nível ${hq.level + 1} por ${fmtMoney(nextTier.upgrade_cost)} — demora ${fmtDuration(nextTier.upgrade_duration_s)}.`}
                    onConfirm={() => upgradeHQ()}
                    className="mt-2"
                  />
                </>
              )}
            </Card>

            <div>
              <SectionHeader icon={History} title="Histórico de melhorias" />
              {(!hq.upgrade_history || hq.upgrade_history.length === 0) ? (
                <p className="rounded-lg border border-dashed border-white/10 p-3 text-center font-mono text-[10px] text-zinc-600">
                  Ainda sem melhorias concluídas.
                </p>
              ) : (
                <div className="space-y-1" data-testid="hq-upgrade-history">
                  {[...hq.upgrade_history].reverse().map((h, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md border border-white/5 bg-white/[0.02] px-2 py-1.5 font-mono text-[10px] text-zinc-400">
                      <span>Nível {h.level}</span>
                      <span className="text-zinc-600">{new Date(h.completed_at).toLocaleDateString("pt-PT")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "prioridades" && (
          <div className="mt-3 space-y-3" data-testid="hq-tab-prioridades-content">
            <div>
              <SectionHeader icon={SlidersHorizontal} title="Prioridade da organização" />
              <div className="grid grid-cols-1 gap-1.5 min-[390px]:grid-cols-2" data-testid="hq-priority-options">
                {Object.entries(catalog.hq_priorities || {}).map(([key, label]) => (
                  <Button
                    key={key}
                    data-testid={`hq-priority-${key}`}
                    variant="outline"
                    onClick={() => setOrgPriority(key)}
                    className={`h-auto justify-start px-2 py-1.5 font-mono text-[10px] ${
                      priority === key ? "border-primary bg-primary/10 text-primary" : "border-white/10 text-zinc-400"
                    }`}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <p className="mt-1.5 font-mono text-[10px] text-zinc-600">
                Influencia o desempate das sugestões automáticas de equipa e oportunidade.
              </p>
            </div>

            <div>
              <SectionHeader icon={UserCog} title="Departamentos" />
              <div className="space-y-2" data-testid="hq-departments">
                {Object.entries(catalog.hq_departments || {}).map(([key, dept]) => {
                  const unlockTier = (catalog.hq_level_benefits || []).find((t) => (t.unlocks || []).includes(key));
                  const unlockLevel = unlockTier?.level || 1;
                  const unlocked = hq.level >= unlockLevel;
                  const Icon = DEPARTMENT_ICONS[key] || Lock;
                  const deptLevel = Number(state.organization?.departments?.[key] || 0);
                  const maxLevel = Number(catalog.organization?.departments?.[key]?.max_level || 3);
                  return (
                    <Card key={key} data-testid={`hq-dept-${key}`} className="flex items-center gap-2 sub-card p-2.5 shadow-none">
                      <Icon size={16} className={unlocked ? "text-cyan-400" : "text-zinc-600"} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-[12px] font-semibold ${unlocked ? "text-white" : "text-zinc-500"}`}>{dept.name}</p>
                        <p className="text-[10px] text-zinc-600">{dept.desc}</p>
                      </div>
                      {unlocked ? (
                        <span className="shrink-0 rounded border border-emerald-500/20 bg-emerald-500/[0.06] px-2 py-1 font-mono text-[10px] uppercase text-emerald-400">
                          N{deptLevel}/{maxLevel}
                        </span>
                      ) : (
                        <span className="shrink-0 font-mono text-[10px] uppercase text-zinc-600">Nível {unlockLevel}</span>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
