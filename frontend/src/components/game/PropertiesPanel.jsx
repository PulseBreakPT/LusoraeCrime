import { useEffect, useState } from "react";
import { useGame } from "../../context/GameContextV2";
import { usePanelFocus } from "../../hooks/usePanelFocus";
import {
  fmtMoney, fmtDuration, propertyBenefit, passiveRates, LARGE_PURCHASE_THRESHOLD, matchesSearch,
  propertyTier, propertyStackRank, propertyStackMult, propertyUpgradeCost, propertyMaintPerWeek,
  propertyUpgradePaybackH,
} from "../../lib/game";
import { cn } from "../../lib/utils";
import { Tip, Kpi, SummaryStrip, InlineRename, MiniBar, ConfirmButton, PurchaseButton, PanelWatermark, SectionHeader } from "./hud";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Alert, AlertDescription } from "../ui/alert";
import {
  Warehouse, ArrowUpCircle, Trash2, Lock, Siren, TrendingUp, Droplets, Flame, Banknote,
  Wrench, Clock, Search, Sparkles, MapPin, Layers, Timer, Landmark,
} from "lucide-react";

const useTick = (active) => {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setT((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
};

// Chip do tier (Bairro/Cidade/Sindicato/Imperial) — derivado do nível de
// desbloqueio do tipo, com a cor a alimentar toda a moldura do cartão.
const TierChip = ({ tier }) => (
  <Tip tip={`Tier ${tier.label} — classe do imóvel pelo nível de desbloqueio no mercado.`}>
    <span
      className="shrink-0 rounded-sm border px-1 py-px font-mono text-[10px] font-bold uppercase tracking-widest"
      style={{ borderColor: `${tier.color}55`, color: tier.color, backgroundColor: `${tier.color}14` }}
    >
      {tier.label}
    </span>
  </Tip>
);

// Pontos de nível (●●○) com o mesmo tom do tier.
const LevelDots = ({ level, max, color }) => (
  <Tip tip={`Nível ${level} de ${max} — cada nível multiplica o benefício do imóvel.`}>
    <span className="font-mono text-[10px] tracking-wider" style={{ color }}>
      {"●".repeat(level)}
      <span className="text-zinc-700">{"○".repeat(Math.max(0, max - level))}</span>
    </span>
  </Tip>
);

export const PropertiesPanel = ({ open, onOpenChange, onNavigate, focusTarget }) => {
  const { state, catalog, serverNow, sellProperty, upgradeProperty, renameProperty, startPlacement, optimizeProperties } = useGame();
  const [query, setQuery] = useState("");
  useTick(open);
  usePanelFocus(open, focusTarget);
  useEffect(() => {
    if (open && focusTarget?.testId?.startsWith("property-card-")) setQuery("");
  }, [open, focusTarget?.token, focusTarget?.testId]);
  if (!state) return null;

  const meta = catalog?.property_meta || {};
  const maxLevel = catalog?.property_max_level || 3;
  const sellFrac = meta.sell_fraction ?? 0.7;
  const props = state.properties || [];

  const isUpgrading = (p) => p.upgrading_until && Date.parse(p.upgrading_until) > serverNow();
  const upgradableCount = props.filter((p) => p.level < maxLevel && !isUpgrading(p)).length;
  const canOptimize = props.length > 0 && upgradableCount > 0;
  const reserve = state.weekly_fixed_total || state.salary_total || 0;

  const maintWeekTotal = props.reduce((a, p) => {
    const pt = catalog?.property_types?.[p.type_key];
    if (!pt) return a;
    const basis = p.purchase_price || pt.price;
    return a + propertyMaintPerWeek({ ...pt, price: basis }, p.level, meta);
  }, 0);
  const avgCondition = props.length ? Math.round(props.reduce((a, p) => a + (p.condition ?? 100), 0) / props.length) : 100;

  const filtered = props.filter((p) =>
    matchesSearch(query, p.name, catalog?.property_types?.[p.type_key]?.name || p.type_key, p.district)
  );
  // Em obras para o fim — o jogador quer ver primeiro o que pode gerir já.
  const sorted = [...filtered].sort((a, b) => {
    const rank = (p) => (isUpgrading(p) ? 1 : 0);
    return rank(a) - rank(b);
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sub-panel">
        <SheetHeader>
          <PanelWatermark icon={Warehouse} />
          <SheetTitle className="flex items-center gap-2 text-white">
            <Warehouse size={18} className="text-primary" /> Imóveis
            <span className="ml-auto font-mono text-xs text-zinc-500" data-testid="properties-count">{props.length}</span>
          </SheetTitle>
          <SheetDescription className="text-zinc-500">Cada esquina comprada é uma esquina controlada — expande o território.</SheetDescription>
        </SheetHeader>

        <Button
          type="button"
          variant="outline"
          size="compact"
          data-testid="properties-open-infrastructure"
          onClick={() => onNavigate && onNavigate("propertyinfra")}
          className="mt-3 w-full justify-between font-mono text-[10px] text-zinc-300"
        >
          Módulos · pessoal destacado
          <Warehouse size={11} className="text-cyan-300" />
        </Button>

        {state.player.heat >= 70 && props.some((p) => p.type_key === "laboratorio") && (
          <Alert variant="destructive" data-testid="raid-warning" className="mt-3 border-red-600/40 bg-red-600/10 py-2">
            <AlertDescription className="flex items-center gap-1.5 font-mono text-[10px] text-red-400">
              <Siren size={12} /> Calor alto: risco de rusga policial aos laboratórios!
            </AlertDescription>
          </Alert>
        )}

        {(() => {
          const { dirtyPerH, launderPerH, heatPerH } = passiveRates(state, catalog, serverNow());
          const sellTotal = props.reduce((a, p) => {
            const pt = catalog?.property_types?.[p.type_key];
            return a + (pt ? Math.round((p.purchase_price || pt.price) * sellFrac * p.level) : 0);
          }, 0);
          return (
            <SummaryStrip cols={4} className="mt-3" testId="properties-summary">
              <Kpi icon={TrendingUp} label="Produção" value={`${fmtMoney(dirtyPerH)}/h`} color="#F59E0B"
                tip="Dinheiro sujo gerado por hora pelos laboratórios — acumula automaticamente à condição atual (rendimentos decrescentes por unidade repetida), mas gera calor." />
              <Kpi icon={Droplets} label="Lavagem" value={`${fmtMoney(launderPerH)}/h`} color="#34D399"
                tip="Capacidade de lavagem passiva por hora das empresas de fachada. O dinheiro convertido devolve 82% em limpo, à condição atual de cada imóvel." />
              <Kpi icon={Flame} label="Calor" value={`+${heatPerH.toFixed(1)}/h`} color={heatPerH > 0 ? "#EF4444" : "#71717A"}
                tip="Calor policial gerado por hora pelas propriedades ilegais (laboratórios). Acima de 70 de calor há risco de rusga." />
              <Kpi icon={Banknote} label="Valor" value={fmtMoney(sellTotal)} sub={`manut. ${fmtMoney(maintWeekTotal)}/semana`} subColor="#F59E0B"
                tip={`Valor de revenda total do património. A manutenção fixa semanal (${fmtMoney(maintWeekTotal)}) entra no fecho de segunda-feira às 20:00, juntamente com salários, TSU e frota. Se o fecho falhar, a condição dos imóveis degrada-se.`} />
            </SummaryStrip>
          );
        })()}

        <div className="sub-route-toolbar mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={11} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-zinc-600" />
            <Input
              data-testid="properties-search"
              value={query}
              onChange={(ev) => setQuery(ev.target.value)}
              aria-label="Pesquisar imóveis"
              placeholder="Pesquisar imóvel..."
              size="compact" className="pl-7 font-mono text-white placeholder:text-zinc-600"
            />
          </div>
          <Tip tip={canOptimize
            ? `Lança as melhorias com melhor retorno real e preserva ${fmtMoney(reserve)} para o próximo fecho semanal (salários + TSU + frota + imóveis).`
            : props.length === 0 ? "Sem imóveis no património." : "Nenhum imóvel elegível — tudo no nível máximo ou já em obras."}>
            <Button
              type="button"
              data-testid="properties-optimize"
              variant="outline"
              size="compact"
              onClick={() => canOptimize && optimizeProperties()}
              disabled={!canOptimize}
              className={cn(
                "shrink-0 gap-1 font-mono font-bold uppercase",
                canOptimize ? "text-cyan-300" : "text-zinc-600"
              )}
            >
              <Sparkles size={11} /> Otimizar
            </Button>
          </Tip>
        </div>

        <div className="mt-3 flex flex-col gap-2" data-testid="properties-list">
          {props.length === 0 && (
            <p className="col-span-full rounded-lg border border-dashed border-white/10 p-3 text-center font-mono text-[11px] text-zinc-500">
              Ainda não tens propriedades — expande o teu império no mercado abaixo.
            </p>
          )}
          {props.length > 0 && sorted.length === 0 && (
            <p className="rounded-lg border border-dashed border-white/10 p-3 text-center font-mono text-[11px] text-zinc-500">
              Nenhum imóvel com esse nome no património.
            </p>
          )}
          {sorted.map((p) => {
            const pt = catalog?.property_types?.[p.type_key];
            if (!pt) return null;
            const tier = propertyTier(pt);
            const maxed = p.level >= maxLevel;
            const marketBasis = p.purchase_price || pt.price;
            const pricedType = { ...pt, price: marketBasis };
            const upgradeCost = propertyUpgradeCost(pricedType, p.level, meta);
            const sellValue = Math.round(marketBasis * sellFrac * p.level);
            const originalName = `${pt.name} — ${p.district}`;
            const renamed = p.name !== originalName;
            const condition = p.condition ?? 100;
            const upgrading = isUpgrading(p);
            const upgradeRemaining = upgrading ? Math.max(0, (Date.parse(p.upgrading_until) - serverNow()) / 1000) : 0;
            const upgradeDuration = (meta.upgrade_base_s ?? 0) + (meta.upgrade_per_level_s ?? 0) * (p.level + 1);
            const maintWeek = propertyMaintPerWeek(pricedType, p.level, meta);
            const stackRank = propertyStackRank(props, p);
            const stackMult = propertyStackMult(stackRank, meta);
            const stacks = stackRank > 0 && (pt.bonus_pct || pt.repair_discount_pct || pt.dirty_per_h || pt.launder_per_h);
            const paybackH = !maxed ? propertyUpgradePaybackH(pt, condition, upgradeCost) : null;
            return (
              <Card key={p.id} data-testid={`property-card-${p.id}`} className="h-full min-w-0 sub-card sub-doss-card p-2.5 shadow-none" style={{ "--dtier": tier.color }}>
                {/* Cabeçalho: identidade do imóvel sem ilustração decorativa */}
                <div className="relative z-[1]">
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-1.5">
                      <InlineRename
                        testId={`property-rename-${p.id}`} value={p.name} onSave={(name) => renameProperty(p.id, name)}
                        textClassName="text-sm font-bold text-white"
                      />
                      <TierChip tier={tier} />
                    </div>
                    <p className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                      <MapPin size={9} className="shrink-0" /> {p.district}
                      {renamed && (
                        <Tip tip="Tipo original desta propriedade, antes de a renomeares.">
                          <span data-testid={`property-original-tag-${p.id}`} className="rounded bg-black/40 px-1 py-px text-zinc-400">{pt.name}</span>
                        </Tip>
                      )}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <LevelDots level={p.level} max={maxLevel} color={tier.color} />
                      <Tip tip={`Manutenção fixa semanal deste imóvel: ${fmtMoney(maintWeek)}. É cobrada no fecho de segunda-feira às 20:00; falhar o fecho reduz a condição e os benefícios do imóvel.`}>
                        <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-zinc-500">
                          <Wrench size={9} /> {fmtMoney(maintWeek)}/semana
                        </span>
                      </Tip>
                      {stacks && (
                        <Tip tip={`${stackRank + 1}.ª unidade deste tipo (por ordem de compra) — rendimentos decrescentes do motor: esta unidade rende ${Math.round(stackMult * 100)}% do benefício.`}>
                          <span data-testid={`property-stack-${p.id}`} className="inline-flex items-center gap-0.5 font-mono text-[10px] text-amber-400">
                            <Layers size={9} /> {stackRank + 1}.ª · {Math.round(stackMult * 100)}%
                          </span>
                        </Tip>
                      )}
                      {paybackH != null && !upgrading && (
                        <Tip tip={`Payback da melhoria para N${p.level + 1}: ~${paybackH >= 48 ? `${Math.round(paybackH / 24)} dias` : `${Math.round(paybackH)}h`} de produção à condição atual — a mesma régua que o botão Otimizar usa para ordenar melhorias.`}>
                          <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-cyan-400">
                            <Timer size={9} /> payback {paybackH >= 48 ? `${Math.round(paybackH / 24)}d` : `${Math.round(paybackH)}h`}
                          </span>
                        </Tip>
                      )}
                    </div>
                  </div>
                </div>

                {/* Condição — alimenta diretamente o rendimento passivo */}
                <div className="relative z-[1] mt-2">
                  <div className="flex justify-between font-mono text-[10px] uppercase text-zinc-500">
                    <span>Condição</span>
                    <Tip tip={`Condição ${Math.round(condition)}% — os benefícios passivos rendem proporcionalmente. Degrada-se ${meta.condition_decay_per_hour ?? 2}%/h sem manutenção paga e recupera ${meta.condition_recovery_per_hour ?? 4}%/h com ela em dia.`}>
                      <span style={{ color: condition < 50 ? "#EF4444" : condition < 90 ? "#F59E0B" : "#34D399" }}>
                        {Math.round(condition)}%{condition < 100 && ` · rende ${Math.round(condition)}%`}
                      </span>
                    </Tip>
                  </div>
                  <MiniBar value={condition} color={condition < 50 ? "#EF4444" : condition < 90 ? "#F59E0B" : "#34D399"} className="mt-0.5" />
                </div>

                {/* Benefício atual / em obras / próximo nível */}
                {upgrading ? (
                  <p data-testid={`property-upgrading-${p.id}`} className="relative z-[1] mt-2 flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-cyan-400">
                    <Clock size={11} /> A melhorar para nível {p.level + 1} — pronto em {fmtDuration(upgradeRemaining)}
                  </p>
                ) : (
                  <Tip tip="Benefício passivo atual deste imóvel ao nível e condição atuais." block>
                    <p className="relative z-[1] mt-2 font-mono text-[10px] text-emerald-400">{propertyBenefit(pt, p.level)}</p>
                  </Tip>
                )}
                {!maxed && !upgrading && (
                  <p className="relative z-[1] mt-0.5 font-mono text-[10px] text-cyan-400/80">
                    N{p.level + 1}: {propertyBenefit(pt, p.level + 1)}
                  </p>
                )}
                {(p.total_dirty_generated > 0 || p.total_laundered > 0) && (
                  <p className="relative z-[1] mt-1 font-mono text-[10px] text-zinc-500">
                    {p.total_dirty_generated > 0 && <>Gerado: <span className="text-amber-400">{fmtMoney(p.total_dirty_generated)}</span></>}
                    {p.total_dirty_generated > 0 && p.total_laundered > 0 && " · "}
                    {p.total_laundered > 0 && <>Lavado: <span className="text-emerald-400">{fmtMoney(p.total_laundered)}</span></>}
                  </p>
                )}

                <div className="relative z-[1] mt-2 flex gap-1.5">
                  <PurchaseButton
                    testId={`upgrade-property-${p.id}`}
                    icon={ArrowUpCircle}
                    label={upgrading ? "A melhorar..." : maxed ? "Máx." : fmtMoney(upgradeCost)}
                    can={!maxed && !upgrading && state.player.clean_money >= upgradeCost}
                    blockedReasons={[
                      upgrading ? `Melhoria em curso — pronto em ${fmtDuration(upgradeRemaining)}.` : null,
                      !upgrading && maxed ? "Nível máximo atingido." : null,
                      !upgrading && !maxed && state.player.clean_money < upgradeCost ? "Dinheiro insuficiente." : null,
                    ].filter(Boolean)}
                    availableTip={`Melhorar para o nível ${p.level + 1} por ${fmtMoney(upgradeCost)} — obras durante ${fmtDuration(upgradeDuration)}, benefício passa a: ${propertyBenefit(pt, p.level + 1)}.`}
                    onConfirm={() => upgradeProperty(p.id)}
                    className="flex-1"
                    density="compact"
                  />
                  <ConfirmButton
                    testId={`sell-property-${p.id}`}
                    icon={Trash2}
                    label={fmtMoney(sellValue)}
                    confirmLabel="Vender?"
                    color="text-red-400"
                    onConfirm={() => sellProperty(p.id)}
                    disabled={upgrading}
                    className="flex-1"
                    density="compact"
                    tip={
                      upgrading
                        ? "Não podes vender uma propriedade a meio de uma melhoria."
                        : `Vender por ${fmtMoney(sellValue)} (${Math.round(sellFrac * 100)}% do investido). Perdes o benefício imediatamente — cuidado com as capacidades. Ação irreversível.`
                    }
                  />
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-6">
          <SectionHeader icon={Landmark} title="Mercado imobiliário" meta={catalog ? `${Object.keys(catalog.property_types || {}).length} tipos` : undefined} />
          <div className="flex flex-col gap-2">
            {catalog &&
              Object.entries(catalog.property_types).map(([key, pt]) => {
                const tier = propertyTier(pt);
                const locked = state.player.level < pt.min_level;
                const ownedOfType = props.filter((pr) => pr.type_key === key).length;
                const roiDays = pt.dirty_per_h ? Math.ceil(pt.price / (pt.dirty_per_h * 24)) : null;
                const diminished = ownedOfType > 0 && (pt.bonus_pct || pt.repair_discount_pct || pt.dirty_per_h || pt.launder_per_h);
                const nextStackPct = Math.round(propertyStackMult(ownedOfType, meta) * 100);
                const maintWeek = propertyMaintPerWeek(pt, 1, meta);
                const buyTip = locked
                  ? `Desbloqueia ao nível ${pt.min_level} da organização.`
                  : `${fmtMoney(pt.price)} limpos — escolhes a localização exacta no mapa antes de pagar. Benefício imediato: ${propertyBenefit(pt, 1)}.${
                      diminished ? ` Já tens ${ownedOfType} — esta unidade rende apenas ${nextStackPct}% do benefício (rendimentos decrescentes).` : ""
                    }`;
                return (
                  <Card key={key} data-testid={`market-card-${key}`} className={cn("h-full min-w-0 sub-card sub-doss-card p-2.5 shadow-none", locked && "opacity-80")} style={{ "--dtier": tier.color }}>
                    <div className="relative z-[1]">
                      <div className="min-w-0">
                        <div className="flex items-start justify-between gap-1.5">
                          <p className="truncate text-sm font-semibold text-white">{pt.name}</p>
                          <TierChip tier={tier} />
                        </div>
                        <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                          {locked && (
                            <span className="mr-1.5 inline-flex items-center gap-0.5 text-amber-400">
                              <Lock size={9} /> nível {pt.min_level}
                            </span>
                          )}
                          {pt.heat_per_h ? (
                            <Tip tip={`Propriedade ilegal — gera +${pt.heat_per_h} de calor por hora por nível e pode ser alvo de rusgas acima de 70 de calor.`}>
                              <span className="mr-1.5 inline-flex items-center gap-0.5 text-red-400">
                                <Flame size={9} /> ilegal
                              </span>
                            </Tip>
                          ) : null}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-zinc-500">{pt.desc}</p>
                      </div>
                    </div>

                    <Tip tip="Benefício passivo ao nível 1 — cada nível seguinte multiplica estes valores." block>
                      <p className="relative z-[1] mt-2 font-mono text-[10px] text-emerald-400">{propertyBenefit(pt, 1)}</p>
                    </Tip>

                    <div className="relative z-[1] mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                      <Tip tip={`Manutenção semanal base ao nível 1: ${fmtMoney(maintWeek)}. O preço final e a manutenção variam com a localização escolhida no mapa.`}>
                        <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-zinc-400">
                          <Wrench size={9} /> {fmtMoney(maintWeek)}/semana
                        </span>
                      </Tip>
                      {roiDays != null && (
                        <Tip tip={`Retorno do investimento em ~${roiDays} dias de produção contínua a 100% de condição.`}>
                          <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-cyan-400">
                            <Timer size={9} /> ROI ~{roiDays}d
                          </span>
                        </Tip>
                      )}
                      {diminished && (
                        <Tip tip={`Rendimentos decrescentes: já tens ${ownedOfType} unidade(s) deste tipo — a próxima rende ${nextStackPct}% do benefício.`}>
                          <span data-testid={`market-stack-${key}`} className="inline-flex items-center gap-0.5 font-mono text-[10px] text-amber-400">
                            <Layers size={9} /> próxima {nextStackPct}%
                          </span>
                        </Tip>
                      )}
                    </div>

                    <div className="relative z-[1] mt-2 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
                      {ownedOfType > 0 ? (
                        <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">no património: <span className="text-zinc-300">{ownedOfType}</span></span>
                      ) : <span />}
                      <PurchaseButton
                        testId={`buy-property-${key}`}
                        label={fmtMoney(pt.price)}
                        can={!locked && state.player.clean_money >= pt.price}
                        requireConfirm={pt.price >= LARGE_PURCHASE_THRESHOLD}
                        blockedReasons={[
                          locked ? `Requer Nível ${pt.min_level}.` : null,
                          state.player.clean_money < pt.price ? "Dinheiro insuficiente." : null,
                        ].filter(Boolean)}
                        availableTip={buyTip}
                        onConfirm={() => { startPlacement(key); onOpenChange(false); }}
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
