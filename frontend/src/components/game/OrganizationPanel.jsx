import { useEffect, useMemo, useState } from "react";
import { useGame } from "../../context/GameContextV2";
import { fmtMoney } from "../../lib/game";
import {
  Kpi, SummaryStrip, MiniBar, PanelWatermark, SectionHeader,
  InlineRename, PurchaseButton, ConfirmButton, EmptyState,
} from "./hud";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Network, Wallet, PackageOpen, Users, Car, Swords, Warehouse, MapPinned,
  TrendingUp, ShieldCheck, Gauge, Wrench, Fuel, Shield, ClipboardCheck,
  Crosshair, Plus, Minus, Crown,
  Boxes, UserRoundCog, Landmark, Banknote,
} from "lucide-react";

const TABS = [
  { key: "centro", label: "Centro", icon: Network },
  { key: "crew", label: "Crew", icon: Users },
  { key: "frota", label: "Frota", icon: Car },
  { key: "arsenal", label: "Arsenal", icon: Swords },
  { key: "stock", label: "Stock", icon: PackageOpen },
  { key: "imoveis", label: "Imóveis", icon: Warehouse },
  { key: "territorios", label: "Territ.", icon: MapPinned },
];

const LOADOUT_KEYS = [
  "medical_kit", "body_armor", "disguise_kit", "entry_tools",
  "electronics_kit", "surveillance_kit", "burner_phones", "evidence_cleanup",
];

const pct = (v) => Math.max(0, Math.min(100, Number(v || 0)));
const daysLeft = (iso, now) => iso ? Math.max(0, Math.ceil((Date.parse(iso) - now) / 86400000)) : 0;

const SmallAction = ({ children, dense = false, className = "", ...props }) => (
  <Button
    variant="outline"
    size="sm"
    className={`${dense ? "h-7 min-h-0 px-1.5" : "h-8 min-h-0 px-2"} border-white/10 bg-white/[0.03] font-mono text-[10px] ${className}`}
    {...props}
  >
    {children}
  </Button>
);

export const OrganizationPanel = ({ open, onOpenChange }) => {
  const {
    state, catalog, serverNow,
    buySupply, sellSupply,
    renameTeam, setTeamDoctrine, setTeamPolicies, setTeamLoadout, dissolveTeam,
    reloadWeapon, upgradeWeaponMod,
    serviceVehicle, replaceVehicleTires, insureVehicle, inspectVehicle,
    upgradePropertyModule, assignPropertyStaff, upgradeDepartment,
    claimTerritory, consolidateTerritory, defendTerritory,
    buyPrestige, buyProtection, fetchFinanceSummary,
  } = useGame();
  const [tab, setTab] = useState("centro");
  const [finance, setFinance] = useState(null);
  const [weaponUpgrade, setWeaponUpgrade] = useState({});
  const [abortThreshold, setAbortThreshold] = useState({});
  const [loadouts, setLoadouts] = useState({});
  const [propertyStaff, setPropertyStaff] = useState({});

  const orgCatalog = catalog?.organization || {};
  const org = state?.organization || {};
  const money = state?.player?.clean_money || 0;
  const now = serverNow();

  useEffect(() => {
    if (!open || tab !== "centro") return;
    let alive = true;
    fetchFinanceSummary().then((res) => {
      if (alive && res.ok) setFinance(res.data);
    });
    return () => { alive = false; };
  }, [open, tab, state?.player?.clean_money, fetchFinanceSummary]);

  useEffect(() => {
    if (!state) return;
    setAbortThreshold(Object.fromEntries(
      (state.teams || []).map((t) => [t.id, t.policies?.abort_below_pct ?? 0])
    ));
    setLoadouts(Object.fromEntries(
      (state.teams || []).map((t) => [t.id, { ...(t.loadout || {}) }])
    ));
    setPropertyStaff(Object.fromEntries(
      (state.properties || []).map((p) => [p.id, new Set(p.staff_employee_ids || [])])
    ));
  }, [state]);

  const inventory = org.inventory || {};
  const storageUsed = Number(org.inventory_used || 0);
  const storageCap = Number(org.inventory_capacity || 0);
  const departments = org.departments || {};
  const territories = org.territories || {};
  const supplyEntries = Object.entries(orgCatalog.supplies || {});
  const ammoMap = orgCatalog.weapon_ammo || {};
  const upgradeCatalog = orgCatalog.weapon_upgrades || {};
  const doctrines = orgCatalog.team_doctrines || {};
  const departmentCatalog = orgCatalog.departments || {};
  const territoryTiers = orgCatalog.territory_tiers || {};
  const propertyModules = orgCatalog.property_modules || {};
  const prestige = orgCatalog.prestige || {};

  const freePropertyStaff = useMemo(
    () => (state?.employees || []).filter((e) => e.status === "idle" && !e.team_id),
    [state?.employees]
  );

  if (!state || !catalog) return null;

  const setLoadoutQty = (teamId, key, checked) => {
    setLoadouts((prev) => {
      const next = { ...(prev[teamId] || {}) };
      if (checked) next[key] = 1;
      else delete next[key];
      return { ...prev, [teamId]: next };
    });
  };

  const togglePropertyStaff = (propertyId, employeeId) => {
    setPropertyStaff((prev) => {
      const next = new Set(prev[propertyId] || []);
      if (next.has(employeeId)) next.delete(employeeId);
      else if (next.size < 4) next.add(employeeId);
      return { ...prev, [propertyId]: next };
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sub-panel" data-testid="organization-panel">
        <SheetHeader>
          <PanelWatermark icon={Network} />
          <SheetTitle className="flex items-center gap-2 text-white">
            <Network size={18} className="text-red-400" /> Organização
          </SheetTitle>
          <SheetDescription className="text-zinc-500">
            Logística, ativos, território e finanças numa única cadeia operacional.
          </SheetDescription>
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-3">
          <TabsList className="grid h-auto w-full grid-cols-4 gap-1 bg-black/40">
            {TABS.map(({ key, label, icon: Icon }) => (
              <TabsTrigger key={key} value={key} className="min-h-9 gap-1 px-1 font-mono text-[10px] uppercase data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Icon size={11} /> {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {tab === "centro" && (
          <div className="mt-3 space-y-4">
            <SummaryStrip cols={3}>
              <Kpi icon={Wallet} label="Caixa" value={fmtMoney(state.player.clean_money)} color="#34D399" />
              <Kpi icon={TrendingUp} label="Resultado 30d" value={finance ? fmtMoney(finance.net) : "—"} color={(finance?.net || 0) >= 0 ? "#34D399" : "#EF4444"} />
              <Kpi icon={Banknote} label="Fixos/sem." value={fmtMoney(state.weekly_fixed_total || 0)} color="#F59E0B" />
            </SummaryStrip>

            {finance && (
              <Card className="sub-card p-3">
                <SectionHeader icon={Wallet} title="Centro Financeiro" meta="últimos 30 dias" />
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="font-mono text-[10px] uppercase text-zinc-500">Receitas</p><p className="font-mono text-xs font-bold text-emerald-300">{fmtMoney(finance.income)}</p></div>
                  <div><p className="font-mono text-[10px] uppercase text-zinc-500">Despesas</p><p className="font-mono text-xs font-bold text-red-300">{fmtMoney(finance.expenses)}</p></div>
                  <div><p className="font-mono text-[10px] uppercase text-zinc-500">Património</p><p className="font-mono text-xs font-bold text-sky-300">{fmtMoney(finance.asset_value)}</p></div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1 text-[10px] text-zinc-500">
                  <span>Imóveis {fmtMoney(finance.property_value)}</span>
                  <span>Frota {fmtMoney(finance.fleet_value)}</span>
                  <span>Arsenal {fmtMoney(finance.weapon_value)}</span>
                </div>
              </Card>
            )}

            <div>
              <SectionHeader icon={UserRoundCog} title="Departamentos do QG" />
              <div className="space-y-2">
                {Object.entries(departmentCatalog).map(([key, d]) => {
                  const level = Number(departments[key] || 0);
                  const unlocked = Number(state.player.hq?.level || 1) >= d.unlock_hq;
                  const maxed = level >= d.max_level;
                  const cost = Math.round(d.base_cost * (1 + 0.75 * level));
                  return (
                    <Card key={key} className="sub-card flex items-center gap-3 p-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-sky-500/20 bg-sky-500/10 text-sky-300">
                        <Landmark size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white">{d.name}</p>
                        <p className="mt-0.5 text-[10px] leading-relaxed text-zinc-500">{d.desc}</p>
                        <p className="mt-1 font-mono text-[10px] uppercase text-zinc-600">{unlocked ? `Nível ${level}/${d.max_level}` : `Requer QG ${d.unlock_hq}`}</p>
                      </div>
                      <PurchaseButton
                        label={maxed ? "Máx." : fmtMoney(cost)}
                        can={unlocked && !maxed && money >= cost}
                        blockedReasons={[
                          !unlocked ? `Requer QG nível ${d.unlock_hq}.` : null,
                          maxed ? "Nível máximo." : null,
                          money < cost ? "Dinheiro insuficiente." : null,
                        ].filter(Boolean)}
                        onConfirm={() => upgradeDepartment(key)}
                        className="shrink-0"
                      />
                    </Card>
                  );
                })}
              </div>
            </div>

            <div>
              <SectionHeader icon={Crown} title="Prestígio e late game" />
              <div className="space-y-2">
                {Object.entries(prestige).map(([key, item]) => {
                  const owned = (org.prestige_items || []).includes(key);
                  const unlocked = state.player.level >= item.unlock_level;
                  return (
                    <Card key={key} className="sub-card flex items-center gap-3 p-3">
                      <Crown size={15} className={owned ? "text-amber-300" : "text-zinc-600"} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white">{item.name}</p>
                        <p className="font-mono text-[10px] text-zinc-500">nível {item.unlock_level} · investimento permanente</p>
                      </div>
                      <PurchaseButton
                        label={owned ? "Adquirido" : fmtMoney(item.cost)}
                        can={!owned && unlocked && money >= item.cost}
                        blockedReasons={[
                          owned ? "Já adquirido." : null,
                          !unlocked ? `Requer nível ${item.unlock_level}.` : null,
                          money < item.cost ? "Dinheiro insuficiente." : null,
                        ].filter(Boolean)}
                        onConfirm={() => buyPrestige(key)}
                      />
                    </Card>
                  );
                })}
              </div>
              <Card className="sub-card mt-2 flex items-center gap-3 p-3">
                <ShieldCheck size={16} className="text-emerald-300" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white">Rede de proteção</p>
                  <p className="font-mono text-[10px] text-zinc-500">
                    {org.governance?.protection_until && Date.parse(org.governance.protection_until) > now
                      ? `ativa por ${daysLeft(org.governance.protection_until, now)} dias`
                      : "inativa · reduz risco de rusga durante 30 dias"}
                  </p>
                </div>
                <PurchaseButton
                  label={org.governance?.last_cost ? fmtMoney(org.governance.last_cost) : "Ativar"}
                  can={state.player.level >= 5}
                  blockedReasons={state.player.level < 5 ? ["Requer nível 5."] : []}
                  onConfirm={buyProtection}
                />
              </Card>
            </div>
          </div>
        )}

        {tab === "stock" && (
          <div className="mt-3 space-y-3">
            <SummaryStrip cols={2}>
              <Kpi icon={Boxes} label="Ocupado" value={`${storageUsed.toFixed(0)}/${storageCap}`} color="#22D3EE" bar={storageCap ? storageUsed / storageCap * 100 : 0} />
              <Kpi icon={Wallet} label="Caixa" value={fmtMoney(money)} color="#34D399" />
            </SummaryStrip>
            <SectionHeader icon={PackageOpen} title="Armazém logístico" meta="18 stocks" />
            <div className="space-y-2">
              {supplyEntries.map(([key, item]) => {
                const qty = Number(inventory[key] || 0);
                const unlocked = state.player.level >= item.min_level;
                return (
                  <Card key={key} className="sub-card flex items-center gap-2.5 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-white">{item.name}</p>
                        <span className="font-mono text-[11px] font-bold text-zinc-200">×{qty}</span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-zinc-500">{item.desc}</p>
                      <p className="mt-1 font-mono text-[10px] uppercase text-zinc-600">
                        pack ×{item.pack} · {fmtMoney(item.price)} · espaço {item.space}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <SmallAction disabled={!unlocked || money < item.price} onClick={() => buySupply(key, 1)}>
                        <Plus size={11} /> Comprar
                      </SmallAction>
                      <SmallAction disabled={qty < item.pack} onClick={() => sellSupply(key, 1)}>
                        <Minus size={11} /> Vender
                      </SmallAction>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {tab === "crew" && (
          <div className="mt-3 space-y-3">
            <SectionHeader icon={Users} title="Doutrinas, políticas e loadouts" meta={`${state.teams.length} equipas`} />
            {state.teams.length === 0 ? (
              <EmptyState icon={Users} title="Sem equipas" sub="Forma uma equipa para configurar doutrina e material." />
            ) : state.teams.map((team) => {
              const draftLoadout = loadouts[team.id] || {};
              return (
                <Card key={team.id} className="sub-card space-y-3 p-3">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <InlineRename value={team.name} onSave={(name) => renameTeam(team.id, name)} />
                      <p className="font-mono text-[10px] uppercase text-zinc-600">{team.spec} · {team.status}</p>
                    </div>
                    <ConfirmButton
                      label="Dissolver"
                      confirmLabel="Confirmar?"
                      disabled={team.status !== "idle"}
                      onConfirm={() => dissolveTeam(team.id)}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className="font-mono text-[10px] uppercase text-zinc-500">Doutrina</span>
                      <select
                        value={team.doctrine || "balanced"}
                        disabled={team.status !== "idle"}
                        onChange={(e) => setTeamDoctrine(team.id, e.target.value)}
                        className="h-9 w-full rounded-md border border-white/10 bg-black/60 px-2 text-xs text-white"
                      >
                        {Object.entries(doctrines).map(([key, d]) => <option key={key} value={key}>{d.name}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="font-mono text-[10px] uppercase text-zinc-500">Abortar abaixo de</span>
                      <div className="flex gap-1">
                        <Input
                          type="number" min="0" max="60"
                          value={abortThreshold[team.id] ?? 0}
                          onChange={(e) => setAbortThreshold((p) => ({ ...p, [team.id]: Number(e.target.value) }))}
                          className="h-9 bg-black/50 text-xs"
                        />
                        <SmallAction onClick={() => setTeamPolicies(team.id, { ...(team.policies || {}), abort_below_pct: abortThreshold[team.id] || 0 })}>
                          Guardar
                        </SmallAction>
                      </div>
                    </label>
                  </div>

                  <div>
                    <p className="mb-2 font-mono text-[10px] uppercase text-zinc-500">Material consumido no despacho</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {LOADOUT_KEYS.map((key) => {
                        const item = orgCatalog.supplies?.[key];
                        if (!item) return null;
                        const checked = !!draftLoadout[key];
                        const available = Number(inventory[key] || 0);
                        return (
                          <label key={key} className={`flex items-center gap-2 rounded-md border px-2 py-2 text-[10px] ${checked ? "border-emerald-500/30 bg-emerald-500/10 text-zinc-200" : "border-white/10 bg-white/[0.02] text-zinc-500"}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={available <= 0}
                              onChange={(e) => setLoadoutQty(team.id, key, e.target.checked)}
                            />
                            <span className="min-w-0 flex-1 truncate">{item.name}</span>
                            <span className="font-mono">×{available}</span>
                          </label>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      className="mt-2 h-8 w-full border-white/10 bg-white/[0.03] font-mono text-[10px]"
                      disabled={team.status !== "idle"}
                      onClick={() => setTeamLoadout(team.id, draftLoadout)}
                    >
                      Guardar loadout
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {tab === "frota" && (
          <div className="mt-3 space-y-2">
            <SectionHeader icon={Car} title="Ciclo de vida da frota" meta={`${state.vehicles.length} veículos`} />
            {state.vehicles.map((v) => {
              const interval = Number(orgCatalog.vehicle_lifecycle?.service_interval_km || 5000);
              const since = Math.max(0, Number(v.km_total || 0) - Number(v.last_service_km || 0));
              const due = Math.max(0, interval - since);
              const seized = v.seized_until && Date.parse(v.seized_until) > now;
              const insured = v.insurance_until && Date.parse(v.insurance_until) > now;
              const inspected = v.inspection_due_at && Date.parse(v.inspection_due_at) > now;
              return (
                <Card key={v.id} className="sub-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-white">{v.name}</p>
                      <p className="font-mono text-[10px] uppercase text-zinc-600">{Math.round(v.km_total || 0)} km · revisão em {Math.round(due)} km</p>
                    </div>
                    {seized && <span className="rounded bg-red-500/10 px-2 py-1 font-mono text-[10px] text-red-300">APREENDIDO</span>}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div><p className="font-mono text-[10px] text-zinc-500">Condição {Math.round(v.condition)}%</p><MiniBar value={v.condition} color={v.condition < 40 ? "#EF4444" : "#34D399"} /></div>
                    <div><p className="font-mono text-[10px] text-zinc-500">Pneus {Math.round(v.tires_pct ?? 100)}%</p><MiniBar value={v.tires_pct ?? 100} color={(v.tires_pct ?? 100) < 35 ? "#EF4444" : "#F59E0B"} /></div>
                    <div><p className="font-mono text-[10px] text-zinc-500">Notoriedade {Math.round(v.notoriety || 0)}%</p><MiniBar value={v.notoriety || 0} color="#EF4444" /></div>
                    <div className="font-mono text-[10px] text-zinc-500">
                      <p>Seguro: {insured ? `${daysLeft(v.insurance_until, now)}d` : "inativo"}</p>
                      <p>IPO: {inspected ? `${daysLeft(v.inspection_due_at, now)}d` : "pendente"}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    <SmallAction dense disabled={seized} onClick={() => serviceVehicle(v.id)}><Wrench size={10} /> Revisão</SmallAction>
                    <SmallAction dense disabled={seized} onClick={() => replaceVehicleTires(v.id)}><Gauge size={10} /> Pneus</SmallAction>
                    <SmallAction dense onClick={() => insureVehicle(v.id)}><Shield size={10} /> Seguro</SmallAction>
                    <SmallAction dense disabled={seized} onClick={() => inspectVehicle(v.id)}><ClipboardCheck size={10} /> IPO</SmallAction>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {tab === "arsenal" && (
          <div className="mt-3 space-y-2">
            <SectionHeader icon={Swords} title="Munições e modificações" meta={`${state.weapons.length} armas`} />
            {state.weapons.length === 0 ? (
              <EmptyState icon={Swords} title="Arsenal vazio" sub="Compra armamento para gerir munições e upgrades." />
            ) : state.weapons.map((w) => {
              const model = catalog.weapon_models?.[w.model_key] || {};
              const ammoKey = ammoMap[w.model_key];
              const cap = Number(model.magazine_capacity || 0);
              const loaded = ammoKey ? Number(w.ammo_loaded || 0) : cap;
              const upgradeCounts = (w.upgrades || []).reduce((acc, u) => ({ ...acc, [u.key]: (acc[u.key] || 0) + 1 }), {});
              const selected = weaponUpgrade[w.id] || Object.keys(upgradeCatalog)[0] || "";
              return (
                <Card key={w.id} className="sub-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-white">{w.name}</p>
                      <p className="font-mono text-[10px] text-zinc-500">{ammoKey ? `${loaded}/${cap} munições · stock ${inventory[ammoKey] || 0}` : "sem munições"}</p>
                    </div>
                    <SmallAction disabled={!ammoKey || loaded >= cap} onClick={() => reloadWeapon(w.id)}>
                      <Fuel size={11} /> Recarregar
                    </SmallAction>
                  </div>
                  <MiniBar value={cap ? loaded / cap * 100 : 100} color={loaded < cap * 0.3 ? "#EF4444" : "#34D399"} className="mt-2" />
                  <div className="mt-3 flex gap-1.5">
                    <select
                      value={selected}
                      onChange={(e) => setWeaponUpgrade((p) => ({ ...p, [w.id]: e.target.value }))}
                      className="h-8 min-w-0 flex-1 rounded-md border border-white/10 bg-black/60 px-2 text-[10px] text-zinc-200"
                    >
                      {Object.entries(upgradeCatalog).map(([key, up]) => (
                        <option key={key} value={key}>{up.name} · N{upgradeCounts[key] || 0}/{up.max_rank}</option>
                      ))}
                    </select>
                    <SmallAction disabled={!selected} onClick={() => upgradeWeaponMod(w.id, selected)}>
                      <Plus size={11} /> Instalar
                    </SmallAction>
                  </div>
                  {(w.upgrades || []).length > 0 && (
                    <p className="mt-2 font-mono text-[10px] text-zinc-600">
                      {(w.upgrades || []).map((u) => upgradeCatalog[u.key]?.name || u.key).join(" · ")}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {tab === "imoveis" && (
          <div className="mt-3 space-y-2">
            <SectionHeader icon={Warehouse} title="Infraestrutura e pessoal" meta={`${state.properties.length} bases`} />
            {state.properties.map((p) => {
              const selectedStaff = propertyStaff[p.id] || new Set();
              return (
                <Card key={p.id} className="sub-card p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-white">{p.name}</p>
                      <p className="font-mono text-[10px] uppercase text-zinc-600">{p.district} · N{p.level}</p>
                    </div>
                    <span className="font-mono text-[10px] text-zinc-500">{selectedStaff.size}/4 destacados</span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {Object.entries(propertyModules).map(([key, mod]) => {
                      const field = `${key}_level`;
                      const level = Number(p[field] || 0);
                      const maxed = level >= mod.max_level;
                      return (
                        <Button
                          key={key}
                          variant="outline"
                          disabled={maxed}
                          onClick={() => upgradePropertyModule(p.id, key)}
                          className="h-auto min-h-10 flex-col border-white/10 bg-white/[0.03] px-1 py-1.5"
                        >
                          <span className="text-[10px] text-zinc-300">{mod.name}</span>
                          <span className="font-mono text-[10px] text-zinc-600">N{level}/{mod.max_level}</span>
                        </Button>
                      );
                    })}
                  </div>
                  <div className="mt-3">
                    <p className="mb-1.5 font-mono text-[10px] uppercase text-zinc-500">Operacionais destacados</p>
                    <div className="max-h-28 space-y-1 overflow-y-auto">
                      {freePropertyStaff.map((e) => (
                        <label key={e.id} className="flex items-center gap-2 rounded border border-white/[0.06] px-2 py-1.5 text-[10px] text-zinc-400">
                          <input
                            type="checkbox"
                            checked={selectedStaff.has(e.id)}
                            disabled={!selectedStaff.has(e.id) && selectedStaff.size >= 4}
                            onChange={() => togglePropertyStaff(p.id, e.id)}
                          />
                          <span className="min-w-0 flex-1 truncate">{e.name}</span>
                          <span className="font-mono text-zinc-600">{e.role_key}</span>
                        </label>
                      ))}
                    </div>
                    <SmallAction className="mt-2 w-full" onClick={() => assignPropertyStaff(p.id, [...selectedStaff])}>
                      <UserRoundCog size={11} /> Guardar destacamento
                    </SmallAction>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {tab === "territorios" && (
          <div className="mt-3 space-y-3">
            <SummaryStrip cols={3}>
              <Kpi icon={MapPinned} label="Controlados" value={Object.keys(territories).length} color="#EF4444" />
              <Kpi icon={TrendingUp} label="Rendimento" value={`${fmtMoney(org.territory_income_h || 0)}/h`} color="#34D399" />
              <Kpi icon={ShieldCheck} label="Nível" value={state.player.level} color="#22D3EE" />
            </SummaryStrip>
            <SectionHeader icon={MapPinned} title="Controlo territorial" />

            {Object.entries(territories).map(([district, info]) => {
              const tier = Number(info.tier || 1);
              const tierCfg = territoryTiers[tier] || {};
              const next = territoryTiers[tier + 1];
              return (
                <Card key={district} className="sub-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-white">{district}</p>
                      <p className="font-mono text-[10px] uppercase text-zinc-600">{tierCfg.name || `Nível ${tier}`} · +{Math.round((tierCfg.reward_bonus || 0) * 100)}% recompensa local</p>
                    </div>
                    <span className="font-mono text-[10px] text-emerald-300">{fmtMoney(tierCfg.income_h || 0)}/h</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div><p className="font-mono text-[10px] text-zinc-500">Defesa {Math.round(info.defense || 0)}%</p><MiniBar value={info.defense || 0} color="#22D3EE" /></div>
                    <div><p className="font-mono text-[10px] text-zinc-500">Pressão {Math.round(info.pressure || 0)}%</p><MiniBar value={info.pressure || 0} color="#EF4444" /></div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-1.5">
                    <SmallAction onClick={() => defendTerritory(district)}><ShieldCheck size={11} /> Reforçar</SmallAction>
                    <SmallAction disabled={!next} onClick={() => consolidateTerritory(district)}><TrendingUp size={11} /> {next ? "Consolidar" : "Máximo"}</SmallAction>
                  </div>
                </Card>
              );
            })}

            <SectionHeader icon={Crosshair} title="Expansão" />
            {(state.player.districts || [])
              .map((d) => d.name || d.key)
              .filter((name) => name && !territories[name])
              .slice(0, 12)
              .map((name) => (
                <Card key={name} className="sub-card flex items-center gap-3 p-3">
                  <MapPinned size={14} className="text-zinc-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white">{name}</p>
                    <p className="font-mono text-[10px] text-zinc-600">Presença inicial · {fmtMoney(territoryTiers[1]?.cost || 0)}</p>
                  </div>
                  <PurchaseButton
                    label="Tomar posição"
                    can={state.player.level >= 5 && money >= (territoryTiers[1]?.cost || 0)}
                    blockedReasons={[
                      state.player.level < 5 ? "Requer nível 5." : null,
                      money < (territoryTiers[1]?.cost || 0) ? "Dinheiro insuficiente." : null,
                    ].filter(Boolean)}
                    onConfirm={() => claimTerritory(name)}
                  />
                </Card>
              ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default OrganizationPanel;
