import { useEffect, useState } from "react";
import { useGame } from "../../context/GameContextV2";
import { fmtMoney, fmtDuration } from "../../lib/game";
import { Tip, Kpi, SummaryStrip, PurchaseButton, PanelKicker, PanelWatermark } from "./hud";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { Card } from "../ui/card";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "../ui/select";
import {
  ShoppingBag, Zap, Palette, Crown, PlusSquare, Fuel, Route, ArrowUpCircle,
  Landmark, Users, Car, Clock, CheckCircle2,
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
  { key: "acelerar", label: "Acelerar", icon: Zap },
  { key: "cosmeticos", label: "Cosméticos", icon: Palette },
  { key: "vip", label: "VIP", icon: Crown },
  { key: "slots", label: "Slots", icon: PlusSquare },
];

// Espelho EXATO de _speedup_cost (backend/routes_game.py) — a mesma fórmula
// dos dois lados para o preço mostrado bater sempre com o cobrado.
const speedupCost = (remainingS, perMin, min) =>
  Math.max(min, Math.round((Math.max(0, remainingS) / 60) * perMin));

const COSMETIC_META = {
  vehicle_paint: { label: "Pinturas de veículo", icon: Car },
  team_emblem: { label: "Emblemas de equipa", icon: Users },
  hq_skin: { label: "Skins do Quartel-General", icon: Landmark },
};

export const ShopPanel = ({ open, onOpenChange }) => {
  const {
    state, catalog, serverNow,
    speedup, buySlot, buyVip, buyCosmetic, equipPaint, equipEmblem, equipHqSkin,
  } = useGame();
  const [tab, setTab] = useState("acelerar");
  useTick(open);

  if (!state || !catalog) return null;

  const shop = catalog.shop || {};
  const owned = state.player.owned_cosmetics || [];
  const isOwned = (cat, key) => owned.includes(`${cat}:${key}`);
  const money = state.player.clean_money;
  const now = serverNow();

  // ---- Acelerar: reúne todos os temporizadores ativos do jogador agora ----
  const timers = [];
  for (const v of state.vehicles || []) {
    if (v.refueling_until && Date.parse(v.refueling_until) > now) {
      timers.push({
        key: `refuel-${v.id}`, kind: "vehicle_refuel", id: v.id, icon: Fuel,
        label: `${v.name} — a abastecer`, remaining: (Date.parse(v.refueling_until) - now) / 1000,
      });
    }
    if (v.transfer && Date.parse(v.transfer.ends_at) > now) {
      timers.push({
        key: `transfer-${v.id}`, kind: "vehicle_transfer", id: v.id, icon: Route,
        label: `${v.name} — em trânsito`, remaining: (Date.parse(v.transfer.ends_at) - now) / 1000,
      });
    }
  }
  for (const p of state.properties || []) {
    if (p.upgrading_until && Date.parse(p.upgrading_until) > now) {
      timers.push({
        key: `propup-${p.id}`, kind: "property_upgrade", id: p.id, icon: ArrowUpCircle,
        label: `${p.name} — a melhorar`, remaining: (Date.parse(p.upgrading_until) - now) / 1000,
      });
    }
  }
  const hq = state.player.hq;
  if (hq?.upgrading_until && Date.parse(hq.upgrading_until) > now) {
    timers.push({
      key: "hqup", kind: "hq_upgrade", id: null, icon: Landmark,
      label: "Quartel-General — a melhorar", remaining: (Date.parse(hq.upgrading_until) - now) / 1000,
    });
  }
  for (const t of state.teams || []) {
    if (t.available_at && Date.parse(t.available_at) > now) {
      timers.push({
        key: `reorg-${t.id}`, kind: "team_reorg", id: t.id, icon: Users,
        label: `${t.name} — a reorganizar-se`, remaining: (Date.parse(t.available_at) - now) / 1000,
      });
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto lus-panel sm:!w-[44rem] sm:!max-w-[96vw] lg:!w-[60rem]" data-testid="shop-panel">
        <SheetHeader>
          <PanelWatermark icon={ShoppingBag} />
          <PanelKicker>Base · Operações</PanelKicker>
          <SheetTitle className="flex items-center gap-2 text-white">
            <ShoppingBag size={18} className="text-primary" /> Loja
          </SheetTitle>
          <SheetDescription className="text-zinc-500">
            Conveniência e conforto pagos em dinheiro do jogo — nada aqui compra sucesso.
          </SheetDescription>
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-3">
          <TabsList className="grid w-full grid-cols-4 bg-black/40">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.key}
                data-testid={`shop-tab-${t.key}`}
                value={t.key}
                className="gap-1 px-1 font-mono text-[10px] font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <t.icon size={12} /> {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* ---------------- Acelerar ---------------- */}
        {tab === "acelerar" && (
          <div className="mt-3 space-y-1.5" data-testid="shop-tab-acelerar-content">
            {timers.length === 0 && (
              <p className="py-8 text-center font-mono text-xs text-zinc-500">
                Nada a acelerar agora — não há temporizadores ativos.
              </p>
            )}
            {timers.map((t) => {
              const cost = speedupCost(t.remaining, shop.speedup_cost_per_min ?? 40, shop.speedup_cost_min ?? 100);
              const can = money >= cost;
              return (
                <Card key={t.key} className="h-full min-w-0 flex items-center gap-2.5 rounded-md border px-2.5 py-2 shadow-none lus-card">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                    <t.icon size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-white">{t.label}</p>
                    <p className="flex items-center gap-1 font-mono text-[10px] text-zinc-500">
                      <Clock size={9} /> pronto em {fmtDuration(t.remaining)}
                    </p>
                  </div>
                  <PurchaseButton
                    testId={`shop-speedup-${t.key}`}
                    label={fmtMoney(cost)}
                    can={can}
                    blockedReasons={[!can ? "Dinheiro insuficiente." : null].filter(Boolean)}
                    onConfirm={() => speedup(t.kind, t.id)}
                    className="w-auto shrink-0"
                  />
                </Card>
              );
            })}
          </div>
        )}

        {/* ---------------- Cosméticos ---------------- */}
        {tab === "cosmeticos" && (
          <div className="mt-3 space-y-4" data-testid="shop-tab-cosmeticos-content">
            {Object.entries(COSMETIC_META).map(([cat, meta]) => {
              const items = shop[`${cat}s`] || {};
              return (
                <div key={cat}>
                  <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    <meta.icon size={11} /> {meta.label}
                  </p>
                  <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(items).map(([key, item]) => {
                      const owns = isOwned(cat, key);
                      const can = money >= item.cost;
                      return (
                        <Card key={key} className="h-full min-w-0 flex items-center gap-2.5 rounded-md border px-2.5 py-2 shadow-none lus-card">
                          <span className="h-6 w-6 shrink-0 rounded-full border border-white/20" style={{ background: item.color }} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-white">{item.label}</p>
                            {owns && <p className="flex items-center gap-1 font-mono text-[9px] text-emerald-400"><CheckCircle2 size={9} /> possuído</p>}
                          </div>
                          {owns ? (
                            cat === "hq_skin" ? (
                              <button
                                data-testid={`shop-equip-hq_skin-${key}`}
                                onClick={() => equipHqSkin(state.player.hq_skin_key === key ? null : key)}
                                className={`shrink-0 rounded-md border px-2 py-1 font-mono text-[10px] font-bold uppercase ${
                                  state.player.hq_skin_key === key
                                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                                    : "border-white/15 text-zinc-300 hover:bg-white/10"
                                }`}
                              >
                                {state.player.hq_skin_key === key ? "Ativa" : "Equipar"}
                              </button>
                            ) : cat === "vehicle_paint" ? (
                              <Select onValueChange={(selection) => {
                                const [mode, vehicleId] = selection.split(":");
                                equipPaint(vehicleId, mode === "remove" ? null : key);
                              }}>
                                <SelectTrigger className="h-7 w-32 shrink-0 border-white/10 bg-black/60 font-mono text-[10px] text-white">
                                  <SelectValue placeholder="Equipar em…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(state.vehicles || []).map((v) => {
                                    const equipped = v.paint_key === key;
                                    return (
                                      <SelectItem
                                        key={v.id}
                                        value={`${equipped ? "remove" : "equip"}:${v.id}`}
                                        className="font-mono text-xs"
                                      >
                                        {equipped ? `Remover de ${v.name}` : v.name}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Select onValueChange={(selection) => {
                                const [mode, teamId] = selection.split(":");
                                equipEmblem(teamId, mode === "remove" ? null : key);
                              }}>
                                <SelectTrigger className="h-7 w-32 shrink-0 border-white/10 bg-black/60 font-mono text-[10px] text-white">
                                  <SelectValue placeholder="Equipar em…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(state.teams || []).map((t) => {
                                    const equipped = t.emblem_key === key;
                                    return (
                                      <SelectItem
                                        key={t.id}
                                        value={`${equipped ? "remove" : "equip"}:${t.id}`}
                                        className="font-mono text-xs"
                                      >
                                        {equipped ? `Remover de ${t.name}` : t.name}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            )
                          ) : (
                            <PurchaseButton
                              testId={`shop-buy-cosmetic-${cat}-${key}`}
                              label={fmtMoney(item.cost)}
                              can={can}
                              blockedReasons={[!can ? "Dinheiro insuficiente." : null].filter(Boolean)}
                              onConfirm={() => buyCosmetic(cat, key)}
                              className="w-auto shrink-0"
                            />
                          )}
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ---------------- VIP ---------------- */}
        {tab === "vip" && (
          <div className="mt-3 space-y-3" data-testid="shop-tab-vip-content">
            {(() => {
              const vipUntil = state.player.vip_until;
              const active = vipUntil && Date.parse(vipUntil) > now;
              const remaining = active ? (Date.parse(vipUntil) - now) / 1000 : 0;
              return active ? (
                <SummaryStrip cols={1}>
                  <Kpi icon={Crown} label="VIP ativo" value={fmtDuration(remaining)} sub="tempo restante" color="#CA8A04" />
                </SummaryStrip>
              ) : (
                <p className="rounded-md border border-dashed border-white/10 p-3 text-center font-mono text-[10px] text-zinc-500">
                  Sem VIP ativo — ativa um plano para rendimento passivo, calor e abastecimento melhores.
                </p>
              );
            })()}
            <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(shop.vip_plans || {}).map(([key, plan]) => {
                const can = money >= plan.cost;
                return (
                  <Card key={key} className="h-full min-w-0 flex items-center gap-2.5 rounded-md border px-2.5 py-2 shadow-none lus-card">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-400">
                      <Crown size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-white">{plan.label}</p>
                      <p className="font-mono text-[10px] text-zinc-500">+15% rendimento · -10% calor · -20% abastecimento</p>
                    </div>
                    <PurchaseButton
                      testId={`shop-vip-${key}`}
                      label={fmtMoney(plan.cost)}
                      can={can}
                      blockedReasons={[!can ? "Dinheiro insuficiente." : null].filter(Boolean)}
                      onConfirm={() => buyVip(key)}
                      className="w-auto shrink-0"
                    />
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* ---------------- Slots ---------------- */}
        {tab === "slots" && (
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2" data-testid="shop-tab-slots-content">
            {[
              { kind: "vehicle", label: "Veículos", icon: Car, used: state.caps?.vehicles?.used ?? (state.vehicles || []).length, cap: state.caps?.vehicles?.max || 0, base: shop.slot_cost_vehicle_base, n: state.player.extra_vehicle_slots || 0 },
              { kind: "employee", label: "Funcionários", icon: Users, used: state.caps?.employees?.used ?? (state.employees || []).length, cap: state.caps?.employees?.max || 0, base: shop.slot_cost_employee_base, n: state.player.extra_employee_slots || 0 },
            ].map((s) => {
              const cost = Math.round((s.base || 0) * (1 + s.n * (shop.slot_cost_scale_per_unit ?? 0.35)));
              const can = money >= cost;
              return (
                <Card key={s.kind} className="h-full min-w-0 flex items-center gap-2.5 rounded-md border px-2.5 py-2 shadow-none lus-card">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-purple-500/30 bg-purple-500/10 text-purple-300">
                    <s.icon size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white">{s.label}</p>
                    <p className="font-mono text-[10px] text-zinc-500">{s.used}/{s.cap} usados · +{s.n} comprado{s.n === 1 ? "" : "s"}</p>
                  </div>
                  <PurchaseButton
                    testId={`shop-slot-${s.kind}`}
                    label={fmtMoney(cost)}
                    can={can}
                    blockedReasons={[!can ? "Dinheiro insuficiente." : null].filter(Boolean)}
                    onConfirm={() => buySlot(s.kind)}
                    className="w-auto shrink-0"
                  />
                </Card>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default ShopPanel;
