import { useEffect, useRef, useState } from "react";
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
  Boxes, UserRoundCog, Landmark, Banknote, Activity, AlertTriangle, Bot, History,
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
  "electronics_kit", "surveillance_kit", "burner_phones", "signal_kit",
  "fake_docs", "evidence_cleanup",
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
    renameTeam, setTeamDoctrine, setTeamPolicies, setTeamLoadout, applyTeamPreset, dissolveTeam,
    reloadWeapon, upgradeWeaponMod,
    serviceVehicle, replaceVehicleTires, insureVehicle, inspectVehicle,
    upgradePropertyModule, assignPropertyStaff, upgradeDepartment,
    claimTerritory, consolidateTerritory, defendTerritory,
    buyPrestige, buyProtection, fetchFinanceSummary,
    fetchOrganizationIntelligence, fetchOrganizationAudit,
    setOrganizationPolicy, runOrganizationAutomation, resolveOrganizationEvent,
  } = useGame();
  const [tab, setTab] = useState("centro");
  const [finance, setFinance] = useState(null);
  const [intelligence, setIntelligence] = useState(null);
  const [audit, setAudit] = useState([]);
  const [policyDraft, setPolicyDraft] = useState(null);
  const [policyDirty, setPolicyDirty] = useState(false);
  const [weaponUpgrade, setWeaponUpgrade] = useState({});
  const [abortThreshold, setAbortThreshold] = useState({});
  const [loadouts, setLoadouts] = useState({});
  const [propertyStaff, setPropertyStaff] = useState({});
  const draftsInitializedRef = useRef(false);

  const orgCatalog = catalog?.organization || {};
  const org = state?.organization || {};
  const money = state?.player?.clean_money || 0;
  const now = serverNow();

  useEffect(() => {
    if (!open) return;
    let alive = true;
    Promise.all([
      fetchFinanceSummary(),
      fetchOrganizationIntelligence(),
      fetchOrganizationAudit(12),
    ]).then(([financeRes, intelligenceRes, auditRes]) => {
      if (!alive) return;
      if (financeRes.ok) setFinance(financeRes.data);
      if (intelligenceRes.ok) {
        setIntelligence(intelligenceRes.data);
        if (!policyDirty) setPolicyDraft(intelligenceRes.data.policy);
      }
      if (auditRes.ok) setAudit(auditRes.data?.items || []);
    });
    return () => { alive = false; };
  }, [
    open,
    state?.player?.clean_money,
    state?.weekly_fixed_total,
    fetchFinanceSummary,
    fetchOrganizationIntelligence,
    fetchOrganizationAudit,
    policyDirty,
  ]);

  useEffect(() => {
    if (!open) {
      draftsInitializedRef.current = false;
      return;
    }
    if (!state || draftsInitializedRef.current) return;
    setAbortThreshold(Object.fromEntries(
      (state.teams || []).map((t) => [t.id, t.policies?.abort_below_pct ?? 0])
    ));
    setLoadouts(Object.fromEntries(
      (state.teams || []).map((t) => [t.id, { ...(t.loadout || {}) }])
    ));
    setPropertyStaff(Object.fromEntries(
      (state.properties || []).map((p) => [p.id, new Set(p.staff_employee_ids || [])])
    ));
    draftsInitializedRef.current = true;
  }, [open, state]);

  const inventory = org.inventory || {};
  const storageUsed = Number(org.inventory_used || 0);
  const storageCap = Number(org.inventory_capacity || 0);
  const departments = org.departments || {};
  const territories = org.territories || {};
  const supplyEntries = Object.entries(orgCatalog.supplies || {});
  const ammoMap = orgCatalog.weapon_ammo || {};
  const upgradeCatalog = orgCatalog.weapon_upgrades || {};
  const doctrines = orgCatalog.team_doctrines || {};
  const teamPresets = orgCatalog.team_presets || {};
  const departmentCatalog = orgCatalog.departments || {};
  const territoryTiers = orgCatalog.territory_tiers || {};
  const propertyModules = orgCatalog.property_modules || {};
  const prestige = orgCatalog.prestige || {};
  const lifecycle = orgCatalog.vehicle_lifecycle || {};
  const tireSetPrice = Number(orgCatalog.supplies?.tire_set?.price || 0);
  const protectionCost = Number(intelligence?.quotes?.protection ?? org.protection_cost ?? org.governance?.last_cost ?? 0);
  const fleetIntel = Object.fromEntries((intelligence?.fleet || []).map((row) => [row.id, row]));
  const propertyIntel = Object.fromEntries((intelligence?.properties || []).map((row) => [row.id, row]));
  const territoryIntel = Object.fromEntries((intelligence?.territories || []).map((row) => [row.district, row]));
  const stockIntel = Object.fromEntries((intelligence?.stock || []).map((row) => [row.key, row]));

  const vehicleValue = (vehicle) =>
    Number(vehicle?.price || catalog.vehicle_models?.[vehicle?.model_key]?.price || 0);
  const serviceCostOf = (vehicle) => Math.max(
    120,
    Math.trunc(
      vehicleValue(vehicle) * Number(lifecycle.service_base_pct || 0.018)
      + Math.max(0, 100 - Number(vehicle?.condition || 0)) * 8
    )
  );
  const insuranceCostOf = (vehicle) => Math.max(
    80,
    Math.trunc(vehicleValue(vehicle) * Number(lifecycle.insurance_week_pct || 0.0012) * 4)
  );
  const moduleCostOf = (property, mod, level) => Math.trunc(
    Number(mod?.base_cost || 0)
    * (1 + Number(level || 0) * 0.75)
    * Number(property?.market_multiplier || 1)
  );
  const weaponUpgradeCostOf = (upgrade, rank) => Math.trunc(
    Number(upgrade?.cost || 0) * (1 + Number(rank || 0) * 0.65)
  );

  if (!state || !catalog) return null;

  const handleTeamPreset = async (teamId, presetKey) => {
    const result = await applyTeamPreset(teamId, presetKey);
    if (result?.ok && result.data) {
      setLoadouts((prev) => ({ ...prev, [teamId]: { ...(result.data.loadout || {}) } }));
      setAbortThreshold((prev) => ({
        ...prev,
        [teamId]: Number(result.data.policies?.abort_below_pct || 0),
      }));
    }
  };

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

  const patchPolicy = (patch) => {
    setPolicyDirty(true);
    setPolicyDraft((prev) => ({ ...(prev || intelligence?.policy || {}), ...patch }));
  };
  const patchAutomation = (key, value) => {
    setPolicyDirty(true);
    setPolicyDraft((prev) => ({
      ...(prev || intelligence?.policy || {}),
      automation: { ...(prev?.automation || intelligence?.policy?.automation || {}), [key]: value },
    }));
  };
  const patchStockTarget = (key, value) => {
    setPolicyDirty(true);
    setPolicyDraft((prev) => ({
      ...(prev || intelligence?.policy || {}),
      stock_targets: { ...(prev?.stock_targets || intelligence?.policy?.stock_targets || {}), [key]: Math.max(0, Number(value || 0)) },
    }));
  };
  const patchBudget = (key, value) => {
    setPolicyDirty(true);
    setPolicyDraft((prev) => ({
      ...(prev || intelligence?.policy || {}),
      weekly_budgets: { ...(prev?.weekly_budgets || intelligence?.policy?.weekly_budgets || {}), [key]: Math.max(0, Number(value || 0)) },
    }));
  };
  const savePolicy = async () => {
    if (!policyDraft) return;
    const result = await setOrganizationPolicy(policyDraft);
    if (result?.ok) setPolicyDirty(false);
  };
  const runAutomation = async () => {
    if (policyDirty && policyDraft) {
      const saved = await setOrganizationPolicy(policyDraft);
      if (!saved?.ok) return;
      setPolicyDirty(false);
    }
    const result = await runOrganizationAutomation();
    if (result?.ok) {
      const fresh = await fetchOrganizationIntelligence();
      if (fresh.ok) {
        setIntelligence(fresh.data);
        setPolicyDraft(fresh.data.policy);
      }
    }
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
          <TabsList className="flex h-auto w-full gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map(({ key, label, icon: Icon }) => (
              <TabsTrigger key={key} value={key} className="min-h-9 min-w-[78px] flex-1 gap-1 whitespace-nowrap px-2 font-mono text-[10px] font-bold uppercase tracking-wider">
                <Icon size={11} /> {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {tab === "centro" && (
          <div className="mt-3 space-y-4">
            <SummaryStrip cols={3}>
              <Kpi icon={Activity} label="Saúde" value={intelligence ? `${intelligence.health.score} · ${intelligence.health.grade}` : "—"} color={(intelligence?.health?.score || 0) >= 78 ? "#34D399" : "#F59E0B"} />
              <Kpi icon={Wallet} label="Runway" value={intelligence ? `${intelligence.finance.runway_weeks} sem.` : "—"} color={(intelligence?.finance?.runway_weeks || 0) >= 3 ? "#34D399" : "#EF4444"} />
              <Kpi icon={AlertTriangle} label="Urgentes" value={intelligence?.alert_counts?.critical || 0} color={(intelligence?.alert_counts?.critical || 0) ? "#EF4444" : "#34D399"} />
            </SummaryStrip>

            {intelligence && (
              <Card className="sub-card p-3">
                <SectionHeader
                  icon={Activity}
                  title="Inteligência operacional"
                  meta={`Org N${intelligence.organization.level || 1} · ${intelligence.organization.score} poder`}
                />
                {intelligence.organization.progression && (
                  <div className="mb-3">
                    <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-zinc-500">
                      <span>Progressão da organização</span>
                      <span>{intelligence.organization.progression.progress_pct}%</span>
                    </div>
                    <MiniBar value={intelligence.organization.progression.progress_pct} color="#22D3EE" />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ["Finanças", intelligence.health.finance],
                    ["Crew", intelligence.health.crew],
                    ["Frota", intelligence.health.fleet],
                    ["Logística", intelligence.health.logistics],
                    ["Imóveis", intelligence.health.properties],
                    ["Território", intelligence.health.territory],
                    ["Segurança", intelligence.health.security],
                    ["Gestão", intelligence.organization.dimensions.management],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-zinc-500">
                        <span>{label}</span><span>{Math.round(value)}%</span>
                      </div>
                      <MiniBar value={value} color={value >= 75 ? "#34D399" : value >= 55 ? "#F59E0B" : "#EF4444"} />
                    </div>
                  ))}
                </div>
                {(intelligence.recommendations || []).length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {(intelligence.recommendations || []).slice(0, 5).map((rec, index) => (
                      <button
                        type="button"
                        key={`${rec.title}-${index}`}
                        onClick={() => setTab(rec.tab || "centro")}
                        className="w-full rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-2 text-left"
                      >
                        <p className="text-[11px] font-semibold text-zinc-200">{rec.title}</p>
                        <p className="mt-0.5 text-[10px] leading-relaxed text-zinc-500">{rec.reason}</p>
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {(intelligence?.alerts || []).filter((item) => item.severity === "critical").slice(0, 3).map((alert) => (
              <button
                type="button"
                key={alert.code}
                onClick={() => setTab(alert.tab || "centro")}
                className="w-full rounded-lg border border-red-500/20 bg-red-500/[0.06] p-3 text-left"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-300" />
                  <div>
                    <p className="text-xs font-semibold text-red-100">{alert.title}</p>
                    <p className="mt-0.5 text-[10px] text-red-200/60">{alert.detail}</p>
                  </div>
                </div>
              </button>
            ))}

            {intelligence?.event && (
              <Card className="sub-card border-amber-500/20 bg-amber-500/[0.04] p-3">
                <SectionHeader
                  icon={AlertTriangle}
                  title={intelligence.event.title}
                  meta="decisão pendente"
                />
                <p className="text-[11px] leading-relaxed text-zinc-400">{intelligence.event.description}</p>
                <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {(intelligence.event.options || []).map((option) => (
                    <button
                      type="button"
                      key={option.key}
                      onClick={async () => {
                        const result = await resolveOrganizationEvent(intelligence.event.id, option.key);
                        if (result?.ok) {
                          const fresh = await fetchOrganizationIntelligence();
                          if (fresh.ok) setIntelligence(fresh.data);
                        }
                      }}
                      className="rounded-md border border-amber-400/15 bg-black/20 px-2.5 py-2 text-left transition hover:bg-amber-400/[0.06]"
                    >
                      <p className="text-[11px] font-semibold text-amber-100">{option.label}</p>
                      <p className="mt-0.5 text-[10px] text-amber-100/50">{option.hint}</p>
                    </button>
                  ))}
                </div>
              </Card>
            )}

            <Card className="sub-card p-3">
              <SectionHeader icon={Bot} title="Política e automação" meta="guard rails financeiros" />
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="font-mono text-[10px] uppercase text-zinc-500">Reserva mínima</span>
                  <Input
                    type="number"
                    min="0"
                    value={policyDraft?.reserve_cash ?? 0}
                    onChange={(e) => patchPolicy({ reserve_cash: Number(e.target.value || 0) })}
                    className="h-9 bg-black/50 text-xs"
                  />
                </label>
                <label className="space-y-1">
                  <span className="font-mono text-[10px] uppercase text-zinc-500">Máx. compra única</span>
                  <Input
                    type="number"
                    min="5"
                    max="100"
                    value={Math.round(Number(policyDraft?.max_single_spend_pct ?? 0.35) * 100)}
                    onChange={(e) => patchPolicy({ max_single_spend_pct: Math.max(0.05, Math.min(1, Number(e.target.value || 35) / 100)) })}
                    className="h-9 bg-black/50 text-xs"
                  />
                </label>
              </div>
              <div className="mt-3">
                <p className="mb-1.5 font-mono text-[10px] uppercase text-zinc-500">Orçamento semanal · 0 = sem limite</p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {[
                    ["supplies", "Stock"],
                    ["fleet", "Frota"],
                    ["infrastructure", "Infraestrutura"],
                    ["territory", "Território"],
                    ["people", "Pessoal"],
                  ].map(([key, label]) => {
                    const live = (intelligence?.finance?.budgets || []).find((row) => row.key === key);
                    return (
                      <label key={key} className="rounded border border-white/[0.08] p-2">
                        <span className="font-mono text-[10px] text-zinc-500">{label}</span>
                        <Input
                          type="number"
                          min="0"
                          value={policyDraft?.weekly_budgets?.[key] ?? 0}
                          onChange={(e) => patchBudget(key, e.target.value)}
                          className="mt-1 h-8 bg-black/50 text-[10px]"
                        />
                        {live && live.limit > 0 && (
                          <span className={`mt-1 block font-mono text-[10px] ${live.status === "over" ? "text-red-300" : live.status === "warning" ? "text-amber-300" : "text-zinc-600"}`}>
                            {fmtMoney(live.spent)} / {fmtMoney(live.limit)}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {[
                  ["enabled", "Automação ativa"],
                  ["auto_restock", "Auto-stock"],
                  ["renew_insurance", "Renovar seguros"],
                  ["preventive_service", "Manutenção preventiva"],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 rounded border border-white/[0.08] px-2 py-2 text-[10px] text-zinc-400">
                    <input
                      type="checkbox"
                      checked={!!policyDraft?.automation?.[key]}
                      onChange={(e) => patchAutomation(key, e.target.checked)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <SmallAction disabled={!policyDirty} onClick={savePolicy}>Guardar política</SmallAction>
                <SmallAction onClick={runAutomation}><Bot size={11} /> Executar agora</SmallAction>
              </div>
            </Card>

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
                  const cost = Number(intelligence?.quotes?.departments?.[key]?.next_cost ?? Math.round(d.base_cost * (1 + 0.75 * level)));
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

            {audit.length > 0 && (
              <Card className="sub-card p-3">
                <SectionHeader icon={History} title="Auditoria recente" meta={`${audit.length} eventos`} />
                <div className="space-y-1.5">
                  {audit.slice(0, 6).map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 border-b border-white/[0.05] py-1.5 last:border-0">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[10px] text-zinc-300">{String(item.action || "").replaceAll(".", " / ")}</p>
                        <p className="text-[10px] text-zinc-600">{item.ts ? new Date(item.ts).toLocaleString("pt-PT") : ""}</p>
                      </div>
                      {item.result?.cost != null && <span className="font-mono text-[10px] text-amber-300">{fmtMoney(item.result.cost)}</span>}
                    </div>
                  ))}
                </div>
              </Card>
            )}

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
                  {intelligence?.governance && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div>
                        <div className="mb-1 flex justify-between font-mono text-[10px] text-zinc-600"><span>Confiança</span><span>{Math.round(intelligence.governance.trust)}%</span></div>
                        <MiniBar value={intelligence.governance.trust} color="#34D399" />
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between font-mono text-[10px] text-zinc-600"><span>Exposição</span><span>{Math.round(intelligence.governance.exposure)}%</span></div>
                        <MiniBar value={intelligence.governance.exposure} color="#F59E0B" />
                      </div>
                    </div>
                  )}
                </div>
                <PurchaseButton
                  label={`${org.governance?.protection_until && Date.parse(org.governance.protection_until) > now ? "Renovar" : "Ativar"} · ${fmtMoney(protectionCost)}`}
                  can={state.player.level >= 5 && protectionCost > 0 && money >= protectionCost}
                  blockedReasons={[
                    state.player.level < 5 ? "Requer nível 5." : null,
                    protectionCost <= 0 ? "Preço indisponível." : null,
                    money < protectionCost ? `Faltam ${fmtMoney(protectionCost - money)}.` : null,
                  ].filter(Boolean)}
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
                const insight = stockIntel[key] || {};
                const unlocked = state.player.level >= item.min_level;
                const buySpace = Number(item.space || 0) * Number(item.pack || 0);
                const hasRoom = storageCap <= 0 || storageUsed + buySpace <= storageCap;
                const buyPrice = Number(insight.buy_price ?? item.price ?? 0);
                const resale = Number(insight.sell_value ?? Math.trunc(Number(item.price || 0) * 0.45));
                return (
                  <Card key={key} className="sub-card flex items-center gap-2.5 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-white">{item.name}</p>
                        <span className="font-mono text-[11px] font-bold text-zinc-200">×{qty}</span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-zinc-500">{item.desc}</p>
                      <p className="mt-1 font-mono text-[10px] uppercase text-zinc-600">
                        pack ×{item.pack} · {fmtMoney(buyPrice)} · espaço {item.space}
                        {insight.coverage_dispatches != null ? ` · ${insight.coverage_dispatches} despachos` : ""}
                      </p>
                      <label className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-zinc-600">
                        Alvo
                        <Input
                          type="number"
                          min="0"
                          value={policyDraft?.stock_targets?.[key] ?? 0}
                          onChange={(e) => patchStockTarget(key, e.target.value)}
                          className="h-7 w-20 bg-black/50 px-2 text-[10px]"
                        />
                        {insight.status && <span className={insight.status === "critical" ? "text-red-300" : insight.status === "low" ? "text-amber-300" : "text-emerald-400"}>{insight.status}</span>}
                      </label>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <SmallAction
                        disabled={!unlocked || money < buyPrice || !hasRoom}
                        title={!unlocked ? `Desbloqueia no nível ${item.min_level}` : !hasRoom ? "Armazenamento insuficiente" : money < buyPrice ? "Dinheiro insuficiente" : `Comprar pack ×${item.pack}`}
                        onClick={() => buySupply(key, 1)}
                      >
                        <Plus size={11} /> {fmtMoney(buyPrice)}
                      </SmallAction>
                      <SmallAction
                        disabled={qty < item.pack}
                        title={qty < item.pack ? `Precisas de ${item.pack} unidades` : `Recebes ${fmtMoney(resale)}`}
                        onClick={() => sellSupply(key, 1)}
                      >
                        <Minus size={11} /> +{fmtMoney(resale)}
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

                  <div>
                    <p className="mb-1.5 font-mono text-[10px] uppercase text-zinc-500">Preset operacional</p>
                    <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {Object.entries(teamPresets).map(([presetKey, preset]) => (
                        <button
                          type="button"
                          key={presetKey}
                          disabled={team.status !== "idle"}
                          title={preset.desc}
                          onClick={() => handleTeamPreset(team.id, presetKey)}
                          className="shrink-0 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 font-mono text-[10px] text-zinc-400 transition hover:border-sky-400/30 hover:text-sky-200 disabled:opacity-40"
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
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
                      <span className="block text-[10px] leading-relaxed text-zinc-600">
                        {doctrines[team.doctrine || "balanced"]?.desc}
                      </span>
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

                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                    {["protect_injured", "auto_use_medical", "auto_use_armor"].map((policyKey) => {
                      const cfg = orgCatalog.team_policies?.[policyKey];
                      if (!cfg) return null;
                      const enabled = team.policies?.[policyKey] ?? cfg.default ?? false;
                      return (
                        <label key={policyKey} className="flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-2 text-[10px] text-zinc-400">
                          <input
                            type="checkbox"
                            checked={!!enabled}
                            disabled={team.status !== "idle"}
                            onChange={(e) => setTeamPolicies(team.id, { ...(team.policies || {}), [policyKey]: e.target.checked })}
                          />
                          <span>{cfg.name}</span>
                        </label>
                      );
                    })}
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
              const assignedTeam = v.team_id ? state.teams.find((team) => team.id === v.team_id) : null;
              const occupied = assignedTeam && assignedTeam.status !== "idle";
              const serverCosts = fleetIntel[v.id]?.costs || {};
              const serviceCost = Number(serverCosts.service ?? serviceCostOf(v));
              const tiresCost = Number(serverCosts.tires ?? (Number(inventory.tire_set || 0) > 0 ? 0 : tireSetPrice));
              const insuranceCost = Number(serverCosts.insurance ?? insuranceCostOf(v));
              const inspectionCost = Number(serverCosts.inspection ?? lifecycle.inspection_base ?? 85);
              const inspectionReady = Number(v.condition || 0) >= 55 && Number(v.tires_pct ?? 100) >= 35;
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
                    <PurchaseButton
                      density="dense" icon={Wrench} label={`Revisão · ${fmtMoney(serviceCost)}`}
                      can={!seized && !occupied && money >= serviceCost}
                      blockedReasons={[
                        seized ? "Veículo apreendido." : null,
                        occupied ? "Veículo em operação." : null,
                        money < serviceCost ? "Dinheiro insuficiente." : null,
                      ].filter(Boolean)}
                      onConfirm={() => serviceVehicle(v.id)}
                    />
                    <PurchaseButton
                      density="dense" icon={Gauge} label={tiresCost ? `Pneus · ${fmtMoney(tiresCost)}` : "Pneus · stock"}
                      can={!seized && (tiresCost === 0 || money >= tiresCost)}
                      blockedReasons={[
                        seized ? "Veículo apreendido." : null,
                        tiresCost > 0 && money < tiresCost ? "Dinheiro insuficiente." : null,
                      ].filter(Boolean)}
                      onConfirm={() => replaceVehicleTires(v.id)}
                    />
                    <PurchaseButton
                      density="dense" icon={Shield} label={`Seguro · ${fmtMoney(insuranceCost)}`}
                      can={money >= insuranceCost}
                      blockedReasons={money < insuranceCost ? ["Dinheiro insuficiente."] : []}
                      onConfirm={() => insureVehicle(v.id)}
                    />
                    <PurchaseButton
                      density="dense" icon={ClipboardCheck} label={`IPO · ${fmtMoney(inspectionCost)}`}
                      can={!seized && inspectionReady && money >= inspectionCost}
                      blockedReasons={[
                        seized ? "Veículo apreendido." : null,
                        !inspectionReady ? "Requer condição ≥55% e pneus ≥35%." : null,
                        money < inspectionCost ? "Dinheiro insuficiente." : null,
                      ].filter(Boolean)}
                      onConfirm={() => inspectVehicle(v.id)}
                    />
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
              const selectedUpgrade = upgradeCatalog[selected] || null;
              const selectedRank = Number(upgradeCounts[selected] || 0);
              const upgradeCost = weaponUpgradeCostOf(selectedUpgrade, selectedRank);
              const upgradeUnlocked = !!selectedUpgrade && state.player.level >= Number(selectedUpgrade.min_level || 1);
              const upgradeMaxed = !!selectedUpgrade && selectedRank >= Number(selectedUpgrade.max_rank || 0);
              const ammoAvailable = ammoKey ? Number(inventory[ammoKey] || 0) : 0;
              return (
                <Card key={w.id} className="sub-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-white">{w.name}</p>
                      <p className="font-mono text-[10px] text-zinc-500">{ammoKey ? `${loaded}/${cap} munições · stock ${inventory[ammoKey] || 0}` : "sem munições"}</p>
                    </div>
                    <SmallAction
                      disabled={!ammoKey || loaded >= cap || ammoAvailable <= 0}
                      title={!ammoKey ? "Esta arma não usa munições." : loaded >= cap ? "Carregador cheio." : ammoAvailable <= 0 ? "Sem munições no stock." : `Usa até ${Math.max(0, cap - loaded)} unidades do stock.`}
                      onClick={() => reloadWeapon(w.id)}
                    >
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
                      {Object.entries(upgradeCatalog).map(([key, up]) => {
                        const rank = Number(upgradeCounts[key] || 0);
                        const price = weaponUpgradeCostOf(up, rank);
                        return <option key={key} value={key}>{up.name} · N{rank}/{up.max_rank} · {fmtMoney(price)}</option>;
                      })}
                    </select>
                    <PurchaseButton
                      density="dense" icon={Plus} label={upgradeMaxed ? "Máximo" : `Instalar · ${fmtMoney(upgradeCost)}`}
                      can={!!selected && upgradeUnlocked && !upgradeMaxed && money >= upgradeCost}
                      blockedReasons={[
                        !selected ? "Escolhe um upgrade." : null,
                        selectedUpgrade && !upgradeUnlocked ? `Requer nível ${selectedUpgrade.min_level}.` : null,
                        upgradeMaxed ? "Upgrade no nível máximo." : null,
                        upgradeCost > money ? "Dinheiro insuficiente." : null,
                      ].filter(Boolean)}
                      onConfirm={() => upgradeWeaponMod(w.id, selected)}
                    />
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
            {state.properties.length === 0 ? (
              <EmptyState icon={Warehouse} title="Sem imóveis" sub="Adquire uma base para gerir módulos e pessoal." />
            ) : state.properties.map((p) => {
              const selectedStaff = propertyStaff[p.id] || new Set();
              const eligiblePropertyStaff = (state.employees || []).filter((e) =>
                e.status === "idle"
                && !e.team_id
                && (!e.stationed_property_id || e.stationed_property_id === p.id)
              );
              return (
                <Card key={p.id} className="sub-card p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-white">{p.name}</p>
                      <p className="font-mono text-[10px] uppercase text-zinc-600">{p.district} · N{p.level}</p>
                    </div>
                    <div className="text-right">
                      <span className="block font-mono text-[10px] text-zinc-500">{selectedStaff.size}/4 destacados</span>
                      <span className="font-mono text-[10px] text-sky-300">eficiência {Math.round(Number(p.staff_effectiveness || propertyIntel[p.id]?.staff_score / 100 || 0) * 100)}%</span>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {Object.entries(propertyModules).map(([key, mod]) => {
                      const field = `${key}_level`;
                      const level = Number(p[field] || 0);
                      const maxed = level >= mod.max_level;
                      const cost = Number(propertyIntel[p.id]?.module_costs?.[key] ?? moduleCostOf(p, mod, level));
                      return (
                        <PurchaseButton
                          key={key}
                          density="dense"
                          label={maxed ? `${mod.name} · Máx.` : `${mod.name} · ${fmtMoney(cost)}`}
                          can={!maxed && money >= cost}
                          blockedReasons={[
                            maxed ? "Módulo no nível máximo." : null,
                            money < cost ? "Dinheiro insuficiente." : null,
                          ].filter(Boolean)}
                          availableTip={`${mod.desc} Nível ${level}/${mod.max_level}.`}
                          onConfirm={() => upgradePropertyModule(p.id, key)}
                        />
                      );
                    })}
                  </div>
                  <div className="mt-3">
                    <p className="mb-1.5 font-mono text-[10px] uppercase text-zinc-500">Operacionais destacados</p>
                    <div className="max-h-28 space-y-1 overflow-y-auto">
                      {eligiblePropertyStaff.map((e) => (
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
                    {eligiblePropertyStaff.length === 0 && selectedStaff.size === 0 && (
                      <p className="rounded border border-dashed border-white/10 px-2 py-2 text-[10px] text-zinc-600">
                        Sem operacionais livres para destacar.
                      </p>
                    )}
                    {(p.staff_roles && Object.keys(p.staff_roles).length > 0) && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {Object.entries(p.staff_roles).map(([employeeId, role]) => {
                          const employee = state.employees.find((e) => e.id === employeeId);
                          return (
                            <span key={employeeId} className="rounded bg-sky-500/10 px-1.5 py-1 font-mono text-[10px] text-sky-300">
                              {employee?.name || "Operacional"} · {role}
                            </span>
                          );
                        })}
                      </div>
                    )}
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
              const defendCost = Number(territoryIntel[district]?.costs?.defend ?? Math.max(500, Math.trunc(Number(tierCfg.defense_weekly || 0) * 1.5)));
              const consolidateCost = Number(territoryIntel[district]?.costs?.consolidate ?? next?.cost ?? 0);
              return (
                <Card key={district} className="sub-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-white">{district}</p>
                      <p className="font-mono text-[10px] uppercase text-zinc-600">{tierCfg.name || `Nível ${tier}`} · +{Math.round((tierCfg.reward_bonus || 0) * 100)}% recompensa local</p>
                      {territoryIntel[district]?.rival?.name && (
                        <p className="mt-0.5 font-mono text-[10px] text-red-300/70">
                          Rival: {territoryIntel[district].rival.name} · {territoryIntel[district].rival.style} · força {territoryIntel[district].rival.strength}
                        </p>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-emerald-300">{fmtMoney(tierCfg.income_h || 0)}/h</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div><p className="font-mono text-[10px] text-zinc-500">Defesa {Math.round(info.defense || 0)}%</p><MiniBar value={info.defense || 0} color="#22D3EE" /></div>
                    <div><p className="font-mono text-[10px] text-zinc-500">Pressão {Math.round(info.pressure || 0)}%</p><MiniBar value={info.pressure || 0} color="#EF4444" /></div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-1.5">
                    <PurchaseButton
                      density="dense" icon={ShieldCheck} label={`Reforçar · ${fmtMoney(defendCost)}`}
                      can={money >= defendCost}
                      blockedReasons={money < defendCost ? ["Dinheiro insuficiente."] : []}
                      onConfirm={() => defendTerritory(district)}
                    />
                    <PurchaseButton
                      density="dense" icon={TrendingUp} label={next ? `Consolidar · ${fmtMoney(consolidateCost)}` : "Máximo"}
                      can={!!next && money >= consolidateCost}
                      blockedReasons={[
                        !next ? "Território no nível máximo." : null,
                        next && money < consolidateCost ? "Dinheiro insuficiente." : null,
                      ].filter(Boolean)}
                      onConfirm={() => consolidateTerritory(district)}
                    />
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
                    <p className="font-mono text-[10px] text-zinc-600">Presença inicial · {fmtMoney(intelligence?.quotes?.territory_claim ?? territoryTiers[1]?.cost ?? 0)}</p>
                  </div>
                  <PurchaseButton
                    label="Tomar posição"
                    can={state.player.level >= 5 && money >= Number(intelligence?.quotes?.territory_claim ?? territoryTiers[1]?.cost ?? 0)}
                    blockedReasons={[
                      state.player.level < 5 ? "Requer nível 5." : null,
                      money < Number(intelligence?.quotes?.territory_claim ?? territoryTiers[1]?.cost ?? 0) ? "Dinheiro insuficiente." : null,
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
