import { useGame } from "../../context/GameContext";
import { fmtMoney, propertyBenefit } from "../../lib/game";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Button } from "../ui/button";
import { Warehouse, ArrowUpCircle, Trash2, Lock, Siren } from "lucide-react";

export const PropertiesPanel = ({ open, onOpenChange }) => {
  const { state, catalog, buyProperty, sellProperty, upgradeProperty } = useGame();
  if (!state) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-sm overflow-y-auto border-white/10 bg-[#0a0a0a]/95 backdrop-blur-xl sm:max-w-sm">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white">
            <Warehouse size={18} className="text-red-500" /> Imóveis
            <span className="ml-auto font-mono text-xs text-zinc-500" data-testid="properties-count">{state.properties.length}</span>
          </SheetTitle>
          <SheetDescription className="text-zinc-500">Compra, melhora e vende propriedades do império.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2" data-testid="properties-list">
          {state.player.heat >= 70 && state.properties.some((p) => p.type_key === "laboratorio") && (
            <p data-testid="raid-warning" className="flex items-center gap-1.5 rounded-md border border-red-600/40 bg-red-600/10 px-2.5 py-2 font-mono text-[10px] text-red-400">
              <Siren size={12} /> Calor alto: risco de rusga policial aos laboratórios!
            </p>
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
            return (
              <div key={p.id} data-testid={`property-card-${p.id}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">{p.name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                      Nível {"●".repeat(p.level)}{"○".repeat((catalog?.property_max_level || 3) - p.level)}
                    </p>
                  </div>
                </div>
                <p className="mt-1.5 font-mono text-[10px] text-emerald-400">{propertyBenefit(pt, p.level)}</p>
                {(p.total_dirty_generated > 0 || p.total_laundered > 0) && (
                  <p className="mt-0.5 font-mono text-[10px] text-zinc-500">
                    {p.total_dirty_generated > 0 && <>Gerado: <span className="text-amber-400">{fmtMoney(p.total_dirty_generated)}</span></>}
                    {p.total_dirty_generated > 0 && p.total_laundered > 0 && " · "}
                    {p.total_laundered > 0 && <>Lavado: <span className="text-emerald-400">{fmtMoney(p.total_laundered)}</span></>}
                  </p>
                )}
                <div className="mt-2 flex gap-1.5">
                  <button
                    data-testid={`upgrade-property-${p.id}`}
                    onClick={() => upgradeProperty(p.id)}
                    disabled={maxed || state.player.clean_money < upgradeCost}
                    className="flex flex-1 items-center justify-center gap-1 rounded border border-white/10 px-2 py-1.5 font-mono text-[10px] text-cyan-400 transition-colors hover:bg-white/5 disabled:opacity-40"
                  >
                    <ArrowUpCircle size={11} /> {maxed ? "Máx." : fmtMoney(upgradeCost)}
                  </button>
                  <button
                    data-testid={`sell-property-${p.id}`}
                    onClick={() => sellProperty(p.id)}
                    className="flex flex-1 items-center justify-center gap-1 rounded border border-white/10 px-2 py-1.5 font-mono text-[10px] text-red-400 transition-colors hover:bg-white/5"
                  >
                    <Trash2 size={11} /> {fmtMoney(sellValue)}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6">
          <h3 className="mb-2 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">Mercado imobiliário</h3>
          <div className="space-y-2">
            {catalog &&
              Object.entries(catalog.property_types).map(([key, pt]) => {
                const locked = state.player.level < pt.min_level;
                return (
                  <div key={key} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-white">
                        {pt.name}
                        {locked && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 font-mono text-[9px] uppercase text-amber-400">
                            <Lock size={9} /> Nível {pt.min_level}
                          </span>
                        )}
                      </p>
                      <Button
                        data-testid={`buy-property-${key}`}
                        onClick={() => buyProperty(key)}
                        disabled={locked || state.player.clean_money < pt.price}
                        size="sm"
                        className="shrink-0 bg-white text-[10px] font-bold uppercase text-black hover:bg-gray-200 disabled:opacity-40"
                      >
                        {fmtMoney(pt.price)}
                      </Button>
                    </div>
                    <p className="mt-1 text-[10px] text-zinc-500">{pt.desc}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-emerald-400">{propertyBenefit(pt, 1)}</p>
                  </div>
                );
              })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
