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
import { Target, Search, Clock, TrendingUp, AlertTriangle, Star, CheckCircle2, MapPin } from "lucide-react";

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
  const { state, catalog, serverNow } = useGame();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("eta");
  const [catFilter, setCatFilter] = useState("all");
  const [forceFilter, setForceFilter] = useState("all");
  const [reachableOnly, setReachableOnly] = useState(false);
  const [favOnly, setFavOnly] = useState(false);
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
  const pulse = state?.retention?.world_pulse || null;
  const pulseEndsS = pulse?.ends_at
    ? Math.max(0, (Date.parse(pulse.ends_at) - serverNow()) / 1000)
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sub-panel">
        <SheetHeader>
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
            className="mt-3 border-cyan-500/15 bg-cyan-500/[0.035] p-3 shadow-none"
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
                <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">{pulse.description}</p>
                <p className="mt-1.5 font-mono text-[10px] text-cyan-300">
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

        <SummaryStrip cols={2} className="mt-3" testId="opportunities-summary">
          <Kpi icon={Target} label="No mapa" value={`${opps.length}`} color="#38BDF8" />
          <Kpi icon={CheckCircle2} label="Alcançáveis" value={`${reachableCount}`} color={reachableCount > 0 ? "#34D399" : "#EF4444"} />
        </SummaryStrip>

        {/* Procura + ordenação */}
        <div className="mt-3 space-y-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Pesquisar operações"
              placeholder="Procurar por nome, zona ou tipo…"
              className="h-8 border-white/10 bg-black/60 pl-7 font-mono text-xs text-white"
            />
          </div>
          <div className="grid grid-cols-1 gap-1.5 min-[430px]:grid-cols-3">
            <Select value={sortKey} onValueChange={setSortKey}>
              <SelectTrigger className="h-9 w-full gap-1 border-white/10 bg-black/60 font-mono text-[11px] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SORTS).map(([k, label]) => (
                  <SelectItem key={k} value={k} className="font-mono text-xs">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="h-9 w-full gap-1 border-white/10 bg-black/60 font-mono text-[11px] text-white">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="font-mono text-xs">Todas as categorias</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c} className="font-mono text-xs">{SPEC_LABELS[c] || c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={forceFilter} onValueChange={setForceFilter}>
              <SelectTrigger className="h-9 w-full gap-1 border-white/10 bg-black/60 font-mono text-[11px] text-white">
                <SelectValue placeholder="Força" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="font-mono text-xs">Toda a força</SelectItem>
                <SelectItem value="PSP" className="font-mono text-xs">PSP · urbana</SelectItem>
                <SelectItem value="GNR" className="font-mono text-xs">GNR · rural</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              variant="outline" size="sm"
              onClick={() => setReachableOnly((v) => !v)}
              className={`min-h-10 w-full gap-1 border-white/15 px-2 font-mono text-[10px] ${reachableOnly ? "bg-emerald-500/15 text-emerald-300" : "text-zinc-400"}`}
            >
              <CheckCircle2 size={11} /> Só alcançáveis
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => setFavOnly((v) => !v)}
              className={`min-h-10 w-full gap-1 border-white/15 px-2 font-mono text-[10px] ${favOnly ? "bg-amber-500/15 text-amber-300" : "text-zinc-400"}`}
            >
              <Star size={11} /> Favoritas
            </Button>
          </div>
        </div>

        {/* Lista */}
        <div className="mt-3 space-y-1.5 pb-4">
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
                className="sub-card flex cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-2 shadow-none transition-colors hover:bg-white/[0.07]"
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
