import { useEffect, useState } from "react";
import { useGame } from "../../context/GameContextV2";
import {
  fmtMoney, fmtDuration, hqBenefitsAt, hqBenefitDesc, hqAdvisorTips, hqPerformanceMetrics,
  CATEGORY_COLORS, SPEC_LABELS,
} from "../../lib/game";
import { Tip, Kpi, SummaryStrip, MiniBar } from "./hud";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Alert, AlertDescription } from "../ui/alert";
import {
  Landmark, ArrowUpCircle, Clock, Lock, Users, Car, Lightbulb, ChevronRight,
  SlidersHorizontal, CheckCircle2, Wallet, UserCog, Truck, Fingerprint, Radio, History,
  Sparkles, AlertTriangle,
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
  { key: "desempenho", label: "Desempenho" },
  { key: "prioridades", label: "Prioridades" },
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
  const { state, catalog, serverNow, upgradeHQ, setOrgPriority, fetchTransactions } = useGame();
  const [tab, setTab] = useState("geral");
  const [transactions, setTransactions] = useState([]);
  useTick(open);

  useEffect(() => {
    if (!open || tab !== "desempenho") return;
    fetchTransactions().then((r) => { if (r.ok) setTransactions(r.data); });
  }, [open, tab, fetchTransactions]);

  if (!state || !catalog) return null;

  const hq = state.player.hq;
  const maxLevel = catalog.hq_max_level || 8;
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

  const tips = hqAdvisorTips(state, catalog);
  const perf = hqPerformanceMetrics(state);
  const priority = state.player.priorities?.active || catalog.hq_default_priority || "equilibrio";

  const nav = (panel) => {
    onNavigate && onNavigate(panel);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-sm overflow-y-auto border-border bg-background/95 backdrop-blur-xl sm:max-w-sm" data-testid="hq-panel">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white">
            <Landmark size={18} className="text-primary" /> Quartel-General
            <span className="ml-auto font-mono text-xs text-zinc-500" data-testid="hq-level">Nível {hq.level}/{maxLevel}</span>
          </SheetTitle>
          <SheetDescription className="text-zinc-500">
            {currentTier?.name} — {currentTier?.desc}
          </SheetDescription>
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-3">
          <TabsList className="grid w-full grid-cols-4 bg-black/40">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.key}
                data-testid={`hq-tab-${t.key}`}
                value={t.key}
                className="px-1 font-mono text-[10px] font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {tab === "geral" && (
          <div className="mt-3 space-y-3" data-testid="hq-tab-geral-content">
            <SummaryStrip cols={2}>
              <Kpi
                icon={Users} label="Cap. Operacionais" value={`+${currentTier?.cap_employees || 0}`} color="#34D399"
                tip="Bónus de capacidade de operacionais concedido pelo nível atual do Quartel-General (soma-se à base e às propriedades)."
              />
              <Kpi
                icon={Car} label="Cap. Veículos" value={`+${currentTier?.cap_vehicles || 0}`} color="#F59E0B"
                tip="Bónus de capacidade de veículos concedido pelo nível atual do Quartel-General (soma-se à base e às propriedades)."
              />
            </SummaryStrip>
            <p className="font-mono text-[10px] text-emerald-400">{hqBenefitDesc(currentTier)}</p>

            <div>
              <h3 className="mb-2 flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">
                <Lightbulb size={12} className="text-amber-400" /> Recomendações do consultor
              </h3>
              {tips.length === 0 ? (
                <Alert className="border-emerald-500/20 bg-emerald-500/5 py-2">
                  <AlertDescription className="font-mono text-[11px] text-emerald-400">
                    Tudo sob controlo. Nenhuma ação urgente de momento.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-1.5" data-testid="hq-advisor-tips">
                  {tips.map((t) => {
                    const color = SEVERITY_COLOR[t.severity] || "#71717A";
                    const Icon = SEVERITY_ICON[t.severity] || Lightbulb;
                    return (
                      <Card key={t.id} data-testid={`hq-tip-${t.id}`} className="flex items-center justify-between gap-2 border-white/10 bg-white/[0.03] px-3 py-2 shadow-none">
                        <p className="flex min-w-0 items-center gap-1.5 text-[11px] leading-snug text-zinc-300">
                          <Icon size={11} className="shrink-0" style={{ color }} />
                          <span className="min-w-0 truncate">{t.label}</span>
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
          </div>
        )}

        {tab === "melhorias" && (
          <div className="mt-3 space-y-3" data-testid="hq-tab-melhorias-content">
            <Card className="border-white/10 bg-white/[0.03] p-3 shadow-none">
              <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                Nível {hq.level} — {"●".repeat(hq.level)}{"○".repeat(Math.max(0, maxLevel - hq.level))}
              </p>
              <p className="mt-1 text-sm font-semibold text-white">{currentTier?.name}</p>
              <p className="mt-0.5 text-[10px] text-zinc-500">{currentTier?.desc}</p>

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
                  <Tip
                    tip={
                      !meetsOrgLevel
                        ? `Requer nível de organização ${nextTier.min_org_level}.`
                        : !canAffordNext
                        ? "Dinheiro limpo insuficiente."
                        : `Melhorar para o nível ${hq.level + 1} por ${fmtMoney(nextTier.upgrade_cost)} — demora ${fmtDuration(nextTier.upgrade_duration_s)}.`
                    }
                    block
                  >
                    <Button
                      data-testid="hq-upgrade-button"
                      variant="outline"
                      onClick={() => upgradeHQ()}
                      disabled={!canAffordNext || !meetsOrgLevel}
                      className={`mt-2 h-auto w-full gap-1 px-2 py-1.5 font-mono text-[10px] ${
                        !canAffordNext || !meetsOrgLevel
                          ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                          : "border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                      }`}
                    >
                      <ArrowUpCircle size={11} /> Melhorar — {fmtMoney(nextTier.upgrade_cost)}
                    </Button>
                  </Tip>
                </>
              )}
            </Card>

            <div>
              <h3 className="mb-2 flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">
                <History size={12} /> Histórico de melhorias
              </h3>
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
              <h3 className="mb-2 flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">
                <SlidersHorizontal size={12} /> Prioridade global da organização
              </h3>
              <div className="grid grid-cols-2 gap-1.5" data-testid="hq-priority-options">
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
              <p className="mt-1.5 font-mono text-[9px] text-zinc-600">
                Influencia as recomendações do consultor e o desempate das sugestões automáticas de equipa/oportunidade.
              </p>
            </div>

            <div>
              <h3 className="mb-2 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">Departamentos</h3>
              <div className="space-y-2" data-testid="hq-departments">
                {Object.entries(catalog.hq_departments || {}).map(([key, dept]) => {
                  const unlockTier = (catalog.hq_level_benefits || []).find((t) => (t.unlocks || []).includes(key));
                  const unlockLevel = unlockTier?.level || 1;
                  const unlocked = hq.level >= unlockLevel;
                  const Icon = DEPARTMENT_ICONS[key] || Lock;
                  return (
                    <Card key={key} data-testid={`hq-dept-${key}`} className="flex items-center gap-2 border-white/10 bg-white/[0.03] p-2.5 shadow-none">
                      <Icon size={16} className={unlocked ? "text-cyan-400" : "text-zinc-600"} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-[12px] font-semibold ${unlocked ? "text-white" : "text-zinc-500"}`}>{dept.name}</p>
                        <p className="text-[10px] text-zinc-600">{dept.desc}</p>
                      </div>
                      <span className={`shrink-0 font-mono text-[9px] uppercase ${unlocked ? "text-emerald-400" : "text-zinc-600"}`}>
                        {unlocked ? "Em breve" : `Nível ${unlockLevel}`}
                      </span>
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
