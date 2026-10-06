import { useEffect, useMemo, useState } from "react";
import { useGame } from "../../context/GameContextV2";
import {
  fmtMoney, fmtDuration, CATEGORY_COLORS, TYPE_ICONS, SPEC_LABELS,
  matchesSearch, opportunityReachable, teamReadiness, OPP_URGENT_SECONDS,
} from "../../lib/game";
import { Tip, Kpi, SummaryStrip, PanelWatermark } from "./hud";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "../ui/select";
import { Target, Search, Clock, TrendingUp, AlertTriangle, Star, CheckCircle2, MapPin, SlidersHorizontal, Scale, Loader2 } from "lucide-react";

// Força competente (do backend, opp.police_force). Escalável: mais uma força =
// mais uma entrada.
const FORCE_INFO = {
  PSP: { label: "PSP", color: "#3B82F6" },
  GNR: { label: "GNR", color: "#22C55E" },
};

const SORTS = {
  eta: "ETA (mais perto)",
  expira: "A expirar primeiro",
  reward: "Recompensa",
  risco: "Risco",
};

const useTick = (active) => {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setT((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
};

export const OpportunitiesPanel = ({ open, onOpenChange, onSelectOpp }) => {
  const { state, catalog, serverNow, recommendTeamForOpportunity, previewDispatch } = useGame();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("eta");
  const [catFilter, setCatFilter] = useState("all");
  const [forceFilter, setForceFilter] = useState("all");
  const [reachableOnly, setReachableOnly] = useState(false);
  const [favOnly, setFavOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareStrategy, setCompareStrategy] = useState("profit");
  const [compareRows, setCompareRows] = useState([]);
  const [compareBusy, setCompareBusy] = useState(false);
  useTick(open); // atualiza contagens de expiração enquanto o painel está aberto

  const level = state?.player?.level || 1;
  const opps = useMemo(
    () => (state?.opportunities || [])
      .filter((opp) => opp.status === "active" && Number(opp.min_level || 1) <= level)
      .slice(0, 5),
    [state?.opportunities, level]
  );
  const favTypes = state?.player?.favorite_types || [];

  // Categorias presentes (para o filtro) — sem hard-code da lista completa.
  const categories = useMemo(
    () => [...new Set(opps.map((o) => o.category))].filter(Boolean),
    [opps]
  );

  // ETA da melhor equipa pronta para uma operação (Infinity se nenhuma).
  const bestEta = (opp) => {
    let best = Infinity;
    for (const t of state?.teams || []) {
      const r = teamReadiness(state, catalog, t, { opp, now: serverNow() });
      if (r.ok && r.eta < best) best = r.eta;
    }
    return best;
  };

  const rows = useMemo(() => {
    const now = serverNow();
    let list = opps.map((opp) => ({
      opp,
      expiresS: Math.max(0, (Date.parse(opp.expires_at) - now) / 1000),
      eta: bestEta(opp),
      reachable: opportunityReachable(state, opp, now, catalog),
    }));
    if (search) list = list.filter((r) => matchesSearch(search, r.opp.name, r.opp.district, SPEC_LABELS[r.opp.category]));
    if (catFilter !== "all") list = list.filter((r) => r.opp.category === catFilter);
    if (forceFilter !== "all") list = list.filter((r) => (r.opp.police_force || "GNR") === forceFilter);
    if (favOnly) list = list.filter((r) => favTypes.includes(r.opp.type_key));
    if (reachableOnly) list = list.filter((r) => r.reachable);
    const cmp = {
      eta: (a, b) => a.eta - b.eta,
      expira: (a, b) => a.expiresS - b.expiresS,
      reward: (a, b) => b.opp.reward - a.opp.reward,
      risco: (a, b) => b.opp.risk - a.opp.risk,
    }[sortKey];
    return list.sort(cmp);
    // serverNow é estável; recomputa quando o estado/filtros mudam (+ tick de 1 Hz).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opps, state, catalog, search, sortKey, catFilter, forceFilter, reachableOnly, favOnly]);

  const reachableCount = rows.filter((r) => r.reachable).length;
  const activeFilterCount = Number(Boolean(search)) + Number(catFilter !== "all") + Number(forceFilter !== "all") + Number(reachableOnly) + Number(favOnly) + Number(sortKey !== "eta");

  const loadComparison = async (strategy = compareStrategy) => {
    if (compareBusy) return;
    setCompareBusy(true);
    try {
      const data = await Promise.all(opps.map(async (opp) => {
        const recommendation = await recommendTeamForOpportunity(opp.id, strategy);
        const teamId = recommendation.ok ? recommendation.data?.team_id : null;
        if (!teamId) return { opp, available:false, reason:recommendation.data?.reason || "Sem equipa elegível." };
        const preview = await previewDispatch(opp.id, teamId);
        if (!preview.ok) return { opp, available:false, reason:preview.error || "Não foi possível calcular." };
        const team = state.teams.find((item) => item.id === teamId);
        const vehicle = state.vehicles.find((item) => item.id === team?.vehicle_id);
        const fuelPrice = Number(state.fuel_prices?.[vehicle?.fuel_type] || catalog?.fuel_prices?.[vehicle?.fuel_type] || 1.8);
        const fuelCost = Number(preview.data.fuel_needed || 0) * fuelPrice;
        const totalDurationS = Math.max(1, Number(preview.data.eta_s || 0) * 2 + Number(preview.data.duration_s || 0));
        const expectedProfit = Number(preview.data.reward || 0) * Number(preview.data.chance || 0) - fuelCost;
        return {
          opp, available:true, teamId, teamName:team?.name || "Equipa",
          chance:Number(preview.data.chance || 0), reward:Number(preview.data.reward || 0),
          fuelCost, totalDurationS, expectedProfit,
          expectedProfitPerMin:expectedProfit / Math.max(.5, totalDurationS / 60),
          reason:recommendation.data?.reason || "",
        };
      }));
      data.sort((a,b) => {
        if (a.available !== b.available) return a.available ? -1 : 1;
        if (!a.available) return 0;
        if (strategy === "safe") return b.chance - a.chance;
        if (strategy === "fast") return a.totalDurationS - b.totalDurationS;
        return b.expectedProfitPerMin - a.expectedProfitPerMin;
      });
      setCompareRows(data);
    } finally {
      setCompareBusy(false);
    }
  };
  const pulse = state?.retention?.world_pulse || null;
  const pulseEndsS = pulse?.ends_at
    ? Math.max(0, (Date.parse(pulse.ends_at) - serverNow()) / 1000)
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sub-panel sub-operations-panel">
        <SheetHeader className="sub-operations-head">
          <PanelWatermark icon={Target} />
          <SheetTitle className="flex items-center gap-2 text-white">
            <Target size={18} className="text-primary" /> Operações disponíveis
          </SheetTitle>
          <SheetDescription className="text-zinc-500">
            Todas as oportunidades no mapa — ordena, filtra e despacha sem procurar pino a pino.
          </SheetDescription>
        </SheetHeader>

        {pulse && (
          <Card
            data-testid="world-pulse-card"
            className="sub-world-pulse mt-3 border-cyan-500/15 bg-cyan-500/[0.035] p-3 shadow-none"
          >
            <div className="flex items-start gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-cyan-500/20 bg-cyan-500/[0.08] text-cyan-300">
                <TrendingUp size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-xs font-bold text-white">{pulse.label}</p>
                  <span className="rounded-full border border-cyan-500/20 bg-cyan-500/[0.07] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-cyan-300">
                    {SPEC_LABELS[pulse.category] || pulse.category}
                  </span>
                  {pulseEndsS != null && (
                    <span className="ml-auto font-mono text-[10px] tabular-nums text-zinc-500">
                      {fmtDuration(pulseEndsS)}
                    </span>
                  )}
                </div>
                <p className="sub-world-pulse-description mt-1 text-[10px] leading-relaxed text-zinc-500">{pulse.description}</p>
                <p className="sub-world-pulse-effect mt-1.5 font-mono text-[10px] text-cyan-300">
                  +{pulse.reward_bonus_pct}% recompensa
                  {pulse.heat_delta_pct !== 0 && (
                    <> · {pulse.heat_delta_pct > 0 ? "+" : ""}{pulse.heat_delta_pct}% geração de calor</>
                  )}
                  {" "}nas operações desta categoria durante a janela.
                </p>
              </div>
            </div>
          </Card>
        )}

        <SummaryStrip cols={2} className="sub-operations-summary mt-3" testId="opportunities-summary">
          <Kpi icon={Target} label="No mapa" value={`${opps.length}`} color="#38BDF8" />
          <Kpi icon={CheckCircle2} label="Alcançáveis" value={`${reachableCount}`} color={reachableCount > 0 ? "#34D399" : "#EF4444"} />
        </SummaryStrip>

        {Number(state.player.stats?.ops_dispatched || 0) === 0 && (
          <Card data-testid="first-operation-guide" className="mt-2 border-emerald-500/20 bg-emerald-500/[0.04] p-2.5 shadow-none">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-300">Primeira operação · guia rápido</p>
            <div className="mt-1.5 grid gap-1 text-[10px] leading-relaxed text-zinc-400">
              <p><span className="font-bold text-zinc-200">1.</span> Escolhe uma operação ou usa <span className="text-cyan-300">Comparar</span> para veres retorno, tempo, combustível e risco.</p>
              <p><span className="font-bold text-zinc-200">2.</span> No despacho, escolhe recomendação Segura, Rentável ou Rápida e confirma a equipa.</p>
              <p><span className="font-bold text-zinc-200">3.</span> Acompanha a equipa no mapa. No regresso, <span className="text-zinc-200">Relatórios</span> abre o resultado, custos, fatores e próximo passo.</p>
            </div>
          </Card>
        )}

        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="compact"
            data-testid="operations-filter-toggle"
            onClick={() => setFiltersOpen((value) => !value)}
            className="gap-1.5 font-mono text-[10px] font-bold uppercase text-zinc-300"
          >
            <SlidersHorizontal size={12} /> Filtrar{activeFilterCount ? ` · ${activeFilterCount}` : ""}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="compact"
            data-testid="operations-compare-toggle"
            onClick={() => {
              const next=!compareOpen;
              setCompareOpen(next);
              if (next && compareRows.length === 0) loadComparison(compareStrategy);
            }}
            className="gap-1.5 font-mono text-[10px] font-bold uppercase text-cyan-300"
          >
            <Scale size={12} /> Comparar
          </Button>
        </div>

        {filtersOpen && (
          <div className="sub-operations-filters mt-2 space-y-2 rounded-md border border-white/[0.07] bg-black/20 p-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Pesquisar operações"
                placeholder="Procurar por nome, zona ou tipo…"
                size="compact" className="sub-operations-search pl-8 font-mono text-white"
              />
            </div>
            <div className="sub-operations-selects grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              <Select value={sortKey} onValueChange={setSortKey}>
                <SelectTrigger size="compact" className="gap-1 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(SORTS).map(([k,label])=><SelectItem key={k} value={k} className="font-mono text-xs">{label}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={catFilter} onValueChange={setCatFilter}>
                <SelectTrigger size="compact" className="gap-1 text-white"><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="font-mono text-xs">Todas as categorias</SelectItem>
                  {categories.map((item)=><SelectItem key={item} value={item} className="font-mono text-xs">{SPEC_LABELS[item] || item}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={forceFilter} onValueChange={setForceFilter}>
                <SelectTrigger size="compact" className="col-span-2 gap-1 text-white sm:col-span-1"><SelectValue placeholder="Força" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="font-mono text-xs">Toda a força</SelectItem>
                  <SelectItem value="PSP" className="font-mono text-xs">PSP · urbana</SelectItem>
                  <SelectItem value="GNR" className="font-mono text-xs">GNR · rural</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Button variant="filter" size="compact" aria-pressed={reachableOnly} onClick={()=>setReachableOnly((v)=>!v)} className={`sub-filter-chip w-full gap-1 font-mono ${reachableOnly?"is-active":""}`}><CheckCircle2 size={11}/> Só alcançáveis</Button>
              <Button variant="filter" size="compact" aria-pressed={favOnly} onClick={()=>setFavOnly((v)=>!v)} className={`sub-filter-chip w-full gap-1 font-mono ${favOnly?"is-active":""}`}><Star size={11}/> Favoritas</Button>
            </div>
          </div>
        )}

        {compareOpen && (
          <Card data-testid="operations-comparison" className="mt-2 border-cyan-500/15 bg-cyan-500/[0.025] p-2.5 shadow-none">
            <div className="flex items-center gap-2">
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-300">Comparador</p>
              <Select value={compareStrategy} onValueChange={(value)=>{setCompareStrategy(value);loadComparison(value);}}>
                <SelectTrigger size="compact" className="ml-auto w-[8.5rem] text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="profit" className="font-mono text-xs">Rentabilidade</SelectItem>
                  <SelectItem value="safe" className="font-mono text-xs">Segurança</SelectItem>
                  <SelectItem value="fast" className="font-mono text-xs">Rapidez</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {compareBusy ? (
              <p className="mt-3 flex items-center justify-center gap-2 py-4 font-mono text-[10px] text-zinc-500"><Loader2 size={12} className="animate-spin"/> A calcular rotas, risco e retorno...</p>
            ) : (
              <div className="mt-2 space-y-1.5">
                {compareRows.map((row)=>(
                  <Button variant="bare" size="bare" type="button" key={row.opp.id} disabled={!row.available} onClick={()=>row.available&&onSelectOpp(row.opp)} className="w-full rounded-md border border-white/[0.06] bg-black/25 p-2 text-left disabled:opacity-45">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-white">{row.opp.name}</span>
                      {row.available && <span className="shrink-0 font-mono text-[10px] font-bold text-emerald-300">{Math.round(row.expectedProfitPerMin)} €/min esp.</span>}
                    </div>
                    {row.available ? (
                      <>
                        <p className="mt-1 font-mono text-[10px] text-zinc-400">{row.teamName} · {Math.round(row.chance*100)}% · {fmtDuration(row.totalDurationS)} total · combustível {fmtMoney(row.fuelCost)}</p>
                        <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">{row.reason}</p>
                      </>
                    ) : <p className="mt-1 text-[10px] text-amber-400">{row.reason}</p>}
                  </Button>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Lista */}
        <div className="sub-operations-list mt-3 space-y-1.5 pb-4">
          {rows.length === 0 && (
            <p className="py-8 text-center font-mono text-xs text-zinc-500">
              Nenhuma operação corresponde aos filtros.
            </p>
          )}
          {rows.map(({ opp, expiresS, eta, reachable }) => {
            const Icon = TYPE_ICONS[opp.type_key] || TYPE_ICONS.assalto;
            const color = CATEGORY_COLORS[opp.category] || "#fff";
            const force = FORCE_INFO[opp.police_force] || FORCE_INFO.GNR;
            const urgent = expiresS > 0 && expiresS < OPP_URGENT_SECONDS;
            const isFav = favTypes.includes(opp.type_key);
            return (
              <Card
                key={opp.id}
                data-testid={`opp-row-${opp.id}`}
                onClick={() => onSelectOpp(opp)}
                className="sub-card sub-operation-row flex cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-2 shadow-none transition-colors hover:bg-white/[0.07]"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border"
                  style={{ background: `${color}1e`, color, borderColor: `${color}44` }}
                >
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-xs font-semibold text-white">
                    {isFav && <Star size={10} className="shrink-0 text-amber-400" fill="currentColor" />}
                    {opp.name}
                    {pulse?.category === opp.category && (
                      <span className="shrink-0 rounded bg-cyan-500/10 px-1 py-0.5 font-mono text-[10px] font-bold text-cyan-300">
                        +{pulse.reward_bonus_pct}%
                      </span>
                    )}
                  </p>
                  <p className="flex items-center gap-1 truncate font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    <MapPin size={8} /> {opp.district} · {SPEC_LABELS[opp.category]}
                    <span className="font-bold" style={{ color: force.color }}>· {force.label}</span>
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="font-mono text-[11px] font-bold" style={{ color: opp.pays === "clean" ? "#10B981" : "#F59E0B" }}>
                    {fmtMoney(opp.reward)}
                  </span>
                  <span className="flex items-center gap-1.5 font-mono text-[10px]">
                    <span className="text-red-400">{"●".repeat(opp.risk)}{"○".repeat(5 - opp.risk)}</span>
                    <Tip tip={reachable ? "Tempo estimado da melhor equipa pronta." : "Nenhuma equipa pronta para esta operação agora."}>
                      <span className={reachable ? "text-cyan-400" : "text-zinc-600"}>
                        {reachable && eta !== Infinity ? `ETA ${fmtDuration(eta)}` : "sem equipa"}
                      </span>
                    </Tip>
                  </span>
                  <span className={`flex items-center gap-0.5 font-mono text-[10px] ${urgent ? "text-amber-400" : "text-zinc-500"}`}>
                    <Clock size={8} /> {fmtDuration(expiresS)}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default OpportunitiesPanel;
