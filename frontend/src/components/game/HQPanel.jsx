import { useEffect, useState } from "react";
import { useGame } from "../../context/GameContextV2";
import {
  fmtMoney, fmtDuration, hqBenefitsAt, hqBenefitDesc, hqAdvisorTips, hqPerformanceMetrics,
  CATEGORY_COLORS, SPEC_LABELS,
} from "../../lib/game";
import { Tip, Kpi, SummaryStrip, MiniBar, PurchaseButton, PanelWatermark, SectionHeader } from "./hud";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Alert, AlertDescription } from "../ui/alert";
import {
  Landmark, ArrowUpCircle, Clock, Lock, Users, Car, Lightbulb, ChevronRight,
  SlidersHorizontal, CheckCircle2, Wallet, UserCog, Truck, Fingerprint, Radio, History,
  Sparkles, AlertTriangle, MapPin,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  BarChart, Bar, Cell,
} from "recharts";

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
  { key: "desempenho", label: "Desempenho" },
];

const SEVERITY_COLOR = { danger: "#EF4444", warn: "#F59E0B", opportunity: "#34D399", info: "#22D3EE" };
const SEVERITY_ICON = { danger: AlertTriangle, warn: AlertTriangle, opportunity: Sparkles, info: Lightbulb };
const DEPARTMENT_ICONS = { financeiro: Wallet, rh: UserCog, logistica: Truck, investigacao: Fingerprint, comunicacoes: Radio };

const ChartTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-md border border-white/10 bg-black/95 px-2 py-1.5 font-mono text-[10px] text-zinc-200 shadow-2xl backdrop-blur-xl">
      {label != null && <p className="mb-0.5 text-zinc-500">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }}>{formatter ? formatter(p.value, p) : p.value}</p>
      ))}
    </div>
  );
};

const BalanceChart = ({ transactions }) => {
  const points = (transactions || [])
    .filter((t) => t.currency === "clean")
    .slice()
    .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))
    .map((t) => ({
      ts: t.ts,
      label: new Date(t.ts).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" }),
      balance: t.balance_after,
    }));

  if (points.length < 2) {
    return (
      <p className="rounded-lg border border-dashed border-white/10 p-4 text-center font-mono text-[10px] text-zinc-600">
        Ainda não há histórico suficiente de transações.
      </p>
    );
  }

  return (
    <div className="h-36 w-full" data-testid="hq-balance-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="hqBalanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34D399" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#34D399" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#71717A", fontSize: 9 }} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis hide domain={["auto", "auto"]} />
          <RTooltip content={<ChartTooltip formatter={(v) => fmtMoney(v)} />} />
          <Area type="monotone" dataKey="balance" stroke="#34D399" strokeWidth={2} fill="url(#hqBalanceFill)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

const CategoryChart = ({ data }) => (
  <div className="h-36 w-full" data-testid="hq-category-chart">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis
          dataKey="category" tickFormatter={(c) => SPEC_LABELS[c] || c}
          tick={{ fill: "#71717A", fontSize: 9 }} axisLine={false} tickLine={false}
        />
        <YAxis hide domain={[0, 1]} />
        <RTooltip
          content={
            <ChartTooltip formatter={(v, p) => `${SPEC_LABELS[p.payload.category] || p.payload.category}: ${Math.round(v * 100)}%`} />
          }
        />
        <Bar dataKey="rate" radius={[4, 4, 0, 0]} maxBarSize={28}>
          {data.map((d) => (
            <Cell key={d.category} fill={CATEGORY_COLORS[d.category] || "#71717A"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
);

export const HQPanel = ({ open, onOpenChange, onNavigate }) => {
  const { state, catalog, serverNow, upgradeHQ, setOrgPriority, fetchTransactions, startHqRelocation } = useGame();
  const [tab, setTab] = useState("geral");
  const [transactions, setTransactions] = useState([]);
  useTick(open);

  useEffect(() => {
    if (!open || tab !== "desempenho") return;
    fetchTransactions().then((r) => { if (r.ok) setTransactions(r.data); });
  }, [open, tab, fetchTransactions]);

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

  const rawTips = hqAdvisorTips(state, catalog);
  // Uma ação por destino: o consultor pode detetar vários problemas que se
  // resolvem no mesmo painel (ex.: fadiga + salários -> Operacionais).
  const severityRank = { danger: 3, warn: 2, opportunity: 1, info: 0 };
  const tips = Array.from(rawTips.reduce((groups, tip) => {
    const key = tip.navigate || tip.id;
    const current = groups.get(key);
    if (!current) {
      groups.set(key, { ...tip });
      return groups;
    }
    current.label = `${current.label} · ${tip.label}`;
    if ((severityRank[tip.severity] ?? 0) > (severityRank[current.severity] ?? 0)) {
      current.severity = tip.severity;
    }
    current.score = Math.max(Number(current.score) || 0, Number(tip.score) || 0);
    return groups;
  }, new Map()).values());
  const perf = hqPerformanceMetrics(state);
  const priority = state.player.priorities?.active || catalog.hq_default_priority || "equilibrio";
  const tutorialRelocatable = Number(state.player.stats?.ops_dispatched || 0) === 0;

  const nav = (panel) => {
    onNavigate && onNavigate(panel);
    onOpenChange(false);
  };

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
            <div>
              <SectionHeader icon={Lightbulb} title="Recomendações do consultor" />
              {tips.length === 0 ? (
                <Alert className="border-emerald-500/20 bg-emerald-500/5 py-2">
                  <AlertDescription className="font-mono text-[11px] text-emerald-400">
                    Tudo sob controlo. A rede está estável — aproveita enquanto dura.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-1.5" data-testid="hq-advisor-tips">
                  {tips.map((t) => {
                    const color = SEVERITY_COLOR[t.severity] || "#71717A";
                    const Icon = SEVERITY_ICON[t.severity] || Lightbulb;
                    return (
                      <Card key={t.id} data-testid={`hq-tip-${t.id}`} className="flex flex-col items-stretch gap-2 sub-card px-3 py-2 shadow-none sm:flex-row sm:items-center sm:justify-between">
                        <p className="flex min-w-0 items-center gap-1.5 text-[11px] leading-snug text-zinc-300">
                          <Icon size={11} className="shrink-0" style={{ color }} />
                          <span className="min-w-0 break-words">{t.label}</span>
                        </p>
                        {t.navigate && (
                          <Button
                            data-testid={`hq-tip-action-${t.id}`}
                            variant="outline" size="sm"
                            onClick={() => nav(t.navigate)}
                            className="h-auto shrink-0 gap-1 border-white/15 px-2 py-1 font-mono text-[10px] font-bold"
                            style={{ color }}
                          >
                            Ver <ChevronRight size={10} />
                          </Button>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            <p className="rounded-md border border-emerald-500/15 bg-emerald-500/[0.04] px-2.5 py-2 font-mono text-[10px] text-emerald-400">
              {hqBenefitDesc(currentTier)}
            </p>

            {state.player.level >= 10 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => nav("management")}
                className="w-full justify-between border-white/10 bg-black/20 text-xs text-zinc-300"
              >
                Gestão avançada
                <ChevronRight size={12} />
              </Button>
            )}

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

        {tab === "desempenho" && (
          <div className="mt-3 space-y-3" data-testid="hq-tab-desempenho-content">
            <SummaryStrip cols={2}>
              <Kpi
                icon={CheckCircle2} label="Taxa de sucesso"
                value={perf.successRate != null ? `${Math.round(perf.successRate * 100)}%` : "—"} color="#34D399"
                tip="Percentagem de missões concluídas com sucesso (contador acumulado desde sempre)."
              />
              <Kpi
                icon={Wallet} label="Lucro líquido" value={fmtMoney(perf.netProfit)} color="#22D3EE"
                tip="Dinheiro limpo ganho diretamente + 90% do dinheiro sujo lavado, menos multas pagas."
              />
              <Kpi
                icon={Car} label="Utilização da frota"
                value={perf.fleetUtilization != null ? `${Math.round(perf.fleetUtilization * 100)}%` : "—"} color="#F59E0B"
                tip="Percentagem de veículos atualmente atribuídos a uma equipa."
              />
              <Kpi
                icon={Clock} label="Duração média"
                value={perf.avgDurationS != null ? fmtDuration(perf.avgDurationS) : "—"} color="#A78BFA"
                tip="Tempo médio de ida e volta das últimas operações concluídas."
              />
            </SummaryStrip>

            <div>
              <h3 className="mb-1 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">Saldo limpo ao longo do tempo</h3>
              <BalanceChart transactions={transactions} />
            </div>

            {perf.categoryBreakdown.length > 0 && (
              <div>
                <h3 className="mb-1 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">Taxa de sucesso por categoria</h3>
                <CategoryChart data={perf.categoryBreakdown} />
              </div>
            )}
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
                Influencia as recomendações do consultor e o desempate das sugestões automáticas de equipa/oportunidade.
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
                        <Button variant="bare" size="bare"
                          type="button"
                          onClick={() => onNavigate && onNavigate("organization")}
                          className="shrink-0 rounded border border-emerald-500/20 bg-emerald-500/[0.06] px-2 py-1 font-mono text-[10px] uppercase text-emerald-400"
                        >
                          N{deptLevel}/{maxLevel}
                        </Button>
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
