import { useEffect, useState } from "react";
import { useGame } from "../../context/GameContextV2";
import { fmtMoney, fmtDuration, propertyBenefit, passiveRates, LARGE_PURCHASE_THRESHOLD } from "../../lib/game";
import { Tip, Kpi, SummaryStrip, InlineRename, MiniBar, ConfirmButton } from "./hud";
import { Thumb, PanelBanner } from "./GameImage";
import { propertyImage } from "../../lib/images";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Alert, AlertDescription } from "../ui/alert";
import { Warehouse, ArrowUpCircle, Trash2, Lock, Siren, TrendingUp, Droplets, Flame, Banknote, Wrench, Clock } from "lucide-react";

const useTick = (active) => {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setT((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
};

export const PropertiesPanel = ({ open, onOpenChange }) => {
  const { state, catalog, serverNow, buyProperty, sellProperty, upgradeProperty, renameProperty } = useGame();
  useTick(open);
  if (!state) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-sm overflow-y-auto border-border bg-background/95 backdrop-blur-xl sm:max-w-sm">
        <PanelBanner panelKey="properties" />
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white">
            <Warehouse size={18} className="text-primary" /> Imóveis
            <span className="ml-auto font-mono text-xs text-zinc-500" data-testid="properties-count">{state.properties.length}</span>
          </SheetTitle>
          <SheetDescription className="text-zinc-500">Compra, melhora e vende propriedades do império.</SheetDescription>
        </SheetHeader>

        {(() => {
          const { dirtyPerH, launderPerH, heatPerH } = passiveRates(state, catalog, serverNow());
          const sellTotal = state.properties.reduce((a, p) => {
            const pt = catalog?.property_types?.[p.type_key];
            return a + (pt ? Math.round(pt.price * 0.7 * p.level) : 0);
          }, 0);
          return (
            <SummaryStrip cols={4} className="mt-3" testId="properties-summary">
              <Kpi icon={TrendingUp} label="Produção" value={`${fmtMoney(dirtyPerH)}/h`} color="#F59E0B"
                tip="Dinheiro sujo gerado por hora pelos laboratórios — acumula automaticamente, mas gera calor." />
              <Kpi icon={Droplets} label="Lavagem" value={`${fmtMoney(launderPerH)}/h`} color="#34D399"
                tip="Lavagem passiva por hora das empresas de fachada — converte sujo em limpo sem taxa." />
              <Kpi icon={Flame} label="Calor" value={`+${heatPerH.toFixed(1)}/h`} color={heatPerH > 0 ? "#EF4444" : "#71717A"}
                tip="Calor policial gerado por hora pelas propriedades ilegais (laboratórios)." />
              <Kpi icon={Banknote} label="Valor" value={fmtMoney(sellTotal)}
                tip="Valor de revenda total do património (70% do preço × nível de cada propriedade)." />
            </SummaryStrip>
          );
        })()}

        <div className="mt-4 space-y-2" data-testid="properties-list">
          {state.player.heat >= 70 && state.properties.some((p) => p.type_key === "laboratorio") && (
            <Alert variant="destructive" data-testid="raid-warning" className="border-red-600/40 bg-red-600/10 py-2">
              <AlertDescription className="flex items-center gap-1.5 font-mono text-[10px] text-red-400">
                <Siren size={12} /> Calor alto: risco de rusga policial aos laboratórios!
              </AlertDescription>
            </Alert>
          )}
          {state.properties.length === 0 && (
            <p className="rounded-lg border border-dashed border-white/10 p-4 text-center font-mono text-[11px] text-zinc-600">
              Ainda não tens propriedades. Expande o teu império abaixo.
            </p>
          )}
          {state.properties.map((p) => {
            const pt = catalog?.property_types?.[p.type_key];
            if (!pt) return null;
            const maxed = p.level >= (catalog?.property_max_level || 3);
            const upgradeCost = Math.round(pt.price * 0.6 * (p.level + 1));
            const sellValue = Math.round(pt.price * 0.7 * p.level);
            const originalName = `${pt.name} — ${p.district}`;
            const renamed = p.name !== originalName;
            const condition = p.condition ?? 100;
            const upgrading = p.upgrading_until && Date.parse(p.upgrading_until) > serverNow();
            const upgradeRemaining = upgrading ? Math.max(0, (Date.parse(p.upgrading_until) - serverNow()) / 1000) : 0;
            return (
              <Card key={p.id} data-testid={`property-card-${p.id}`} className="border-white/10 bg-white/[0.03] p-3 shadow-none">
                <div className="flex items-center justify-between gap-2">
                  <Thumb src={propertyImage(p.type_key)} alt={pt.name} icon={Warehouse} iconColor="#c4b5fd" className="h-11 w-16" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <InlineRename
                        testId={`property-rename-${p.id}`} value={p.name} onSave={(name) => renameProperty(p.id, name)}
                        textClassName="text-sm font-bold text-white"
                      />
                      {renamed && (
                        <Tip tip="Nome original desta propriedade, antes de a renomeares.">
                          <span data-testid={`property-original-tag-${p.id}`} className="shrink-0 rounded bg-black/40 px-1.5 py-0.5 font-mono text-[9px] uppercase text-zinc-500">
                            {pt.name} · {p.district}
                          </span>
                        </Tip>
                      )}
                    </div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                      Nível {"●".repeat(p.level)}{"○".repeat((catalog?.property_max_level || 3) - p.level)}
                    </p>
                  </div>
                </div>
                <div className="mt-1.5">
                  <Tip tip={`Condição: ${Math.round(condition)}% — degrada-se se não conseguires pagar a manutenção diária, e recupera enquanto a pagares. Abaixo de 100% os benefícios passivos rendem proporcionalmente menos.`} block>
                    <div className="flex items-center gap-1.5">
                      <Wrench size={9} className="shrink-0" style={{ color: condition < 50 ? "#EF4444" : "#34D399" }} />
                      <MiniBar value={condition} color={condition < 50 ? "#EF4444" : "#34D399"} height="h-1" />
                      <span className="shrink-0 font-mono text-[9px]" style={{ color: condition < 50 ? "#EF4444" : "#34D399" }}>{Math.round(condition)}%</span>
                    </div>
                  </Tip>
                </div>
                {upgrading ? (
                  <p data-testid={`property-upgrading-${p.id}`} className="mt-1.5 flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-cyan-400">
                    <Clock size={11} /> A melhorar para nível {p.level + 1} — pronto em {fmtDuration(upgradeRemaining)}
                  </p>
                ) : (
                  <p className="mt-1.5 font-mono text-[10px] text-emerald-400">{propertyBenefit(pt, p.level)}</p>
                )}
                {(p.total_dirty_generated > 0 || p.total_laundered > 0) && (
                  <p className="mt-0.5 font-mono text-[10px] text-zinc-500">
                    {p.total_dirty_generated > 0 && <>Gerado: <span className="text-amber-400">{fmtMoney(p.total_dirty_generated)}</span></>}
                    {p.total_dirty_generated > 0 && p.total_laundered > 0 && " · "}
                    {p.total_laundered > 0 && <>Lavado: <span className="text-emerald-400">{fmtMoney(p.total_laundered)}</span></>}
                  </p>
                )}
                {!maxed && !upgrading && (
                  <p className="mt-1 font-mono text-[10px] text-cyan-400/80">
                    Nível {p.level + 1}: {propertyBenefit(pt, p.level + 1)}
                  </p>
                )}
                <div className="mt-2 flex gap-1.5">
                  <Tip
                    tip={
                      upgrading
                        ? `Melhoria em curso — pronto em ${fmtDuration(upgradeRemaining)}.`
                        : maxed
                        ? "Nível máximo atingido."
                        : `Melhorar para o nível ${p.level + 1} por ${fmtMoney(upgradeCost)} (demora um tempo a ficar concluído) — benefício passa a: ${propertyBenefit(pt, p.level + 1)}.`
                    }
                    block
                    className="flex-1"
                  >
                    <Button
                      data-testid={`upgrade-property-${p.id}`}
                      variant="outline"
                      onClick={() => upgradeProperty(p.id)}
                      disabled={maxed || upgrading || state.player.clean_money < upgradeCost}
                      className={`h-auto w-full gap-1 px-2 py-1.5 font-mono text-[10px] ${
                        maxed || upgrading || state.player.clean_money < upgradeCost
                          ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                          : "border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                      }`}
                    >
                      <ArrowUpCircle size={11} /> {upgrading ? "A melhorar..." : maxed ? "Máx." : fmtMoney(upgradeCost)}
                    </Button>
                  </Tip>
                  <ConfirmButton
                    testId={`sell-property-${p.id}`}
                    icon={Trash2}
                    label={fmtMoney(sellValue)}
                    confirmLabel="Vender?"
                    color="text-red-400"
                    onConfirm={() => sellProperty(p.id)}
                    disabled={upgrading}
                    className="flex-1"
                    tip={
                      upgrading
                        ? "Não podes vender uma propriedade a meio de uma melhoria."
                        : `Vender por ${fmtMoney(sellValue)} (70% do investido). Perdes o benefício imediatamente — cuidado com as capacidades. Ação irreversível.`
                    }
                  />
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-6">
          <h3 className="mb-2 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">Mercado imobiliário</h3>
          <div className="space-y-2">
            {catalog &&
              Object.entries(catalog.property_types).map(([key, pt]) => {
                const locked = state.player.level < pt.min_level;
                const ownedOfType = state.properties.filter((pr) => pr.type_key === key).length;
                const roiDays = pt.dirty_per_h ? Math.ceil(pt.price / (pt.dirty_per_h * 24)) : null;
                const diminished = ownedOfType > 0 && (pt.bonus_pct || pt.repair_discount_pct);
                const nextStackPct = ownedOfType >= 2 ? 50 : 70;
                const buyTip = locked
                  ? `Desbloqueia ao nível ${pt.min_level} da organização.`
                  : `Comprar por ${fmtMoney(pt.price)} limpos. Benefício imediato: ${propertyBenefit(pt, 1)}.${
                      diminished ? ` Já tens ${ownedOfType} — esta unidade rende apenas ${nextStackPct}% do bónus (rendimentos decrescentes).` : ""
                    }`;
                return (
                  <Card key={key} className="border-white/10 bg-white/[0.03] p-3 shadow-none">
                    <Thumb src={propertyImage(key)} alt={pt.name} icon={Warehouse} iconColor="#c4b5fd" className="mb-2 h-20 w-full" />
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-white">
                        {pt.name}
                        {locked && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 font-mono text-[9px] uppercase text-amber-400">
                            <Lock size={9} /> Nível {pt.min_level}
                          </span>
                        )}
                      </p>
                      {pt.price >= LARGE_PURCHASE_THRESHOLD ? (
                        <ConfirmButton
                          testId={`buy-property-${key}`}
                          label={fmtMoney(pt.price)}
                          confirmLabel="Confirmar?"
                          color="text-cyan-300"
                          onConfirm={() => buyProperty(key)}
                          disabled={locked || state.player.clean_money < pt.price}
                          className="w-auto shrink-0"
                          tip={buyTip}
                        />
                      ) : (
                        <Tip tip={buyTip} align="end">
                          <Button
                            data-testid={`buy-property-${key}`}
                            onClick={() => buyProperty(key)}
                            disabled={locked || state.player.clean_money < pt.price}
                            size="sm"
                            className={`shrink-0 text-[10px] font-bold uppercase ${
                              locked || state.player.clean_money < pt.price
                                ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                                : "border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                            }`}
                          >
                            {fmtMoney(pt.price)}
                          </Button>
                        </Tip>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] text-zinc-500">{pt.desc}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-emerald-400">{propertyBenefit(pt, 1)}</p>
                    {roiDays != null && (
                      <p className="mt-0.5 font-mono text-[10px] text-cyan-400">Retorno estimado: ~{roiDays} dias de produção</p>
                    )}
                    {diminished && (
                      <p className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-amber-400">
                        Já tens {ownedOfType} — próxima unidade rende {nextStackPct}% do bónus
                      </p>
                    )}
                  </Card>
                );
              })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
