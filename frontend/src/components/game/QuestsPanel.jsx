import { useEffect, useState } from "react";
import { useGame } from "../../context/GameContextV2";
import {
  fmtMoney, fmtDuration, QUEST_STATUS_LABELS, QUEST_STATUS_COLORS,
  DIFFICULTY_LABELS, DIFFICULTY_COLORS, CHAPTER_LABELS, QUEST_TYPE_LABELS,
  QUEST_TIER_LABELS, QUEST_TIER_COLORS, questMultBreakdown,
} from "../../lib/game";
import { usePreferenceState } from "../../lib/persist";
import { useSettings } from "../../context/SettingsContext";
import { MiniBar, PanelKicker, PanelWatermark, SectionHeader, SummaryStrip, Kpi, Tip } from "./hud";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { Target, Lock, Clock, Gift, MapPin, Star, Sparkles, Flame, Gauge, Zap } from "lucide-react";

const useTick = (active) => {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setT((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
};

const rewardChips = (rw, catalog) => {
  const parts = [];
  if (rw.dirty) parts.push(`+${fmtMoney(rw.dirty)} sujos`);
  if (rw.clean) parts.push(`+${fmtMoney(rw.clean)} limpos`);
  if (rw.respect) parts.push(`+${rw.respect} respeito`);
  if (rw.heat) parts.push(`${rw.heat} calor`);
  if (rw.vehicle) parts.push(catalog?.vehicle_models?.[rw.vehicle]?.name || "veículo");
  if (rw.employee) parts.push(`recruta ${rw.employee.rarity}`);
  if (rw.temp_bonus) parts.push(`+${Math.round(rw.temp_bonus.pct * 100)}% recompensas`);
  return parts;
};

const ProgressBar = ({ q }) => {
  const lte = q.direction === "lte";
  const pct = lte
    ? (q.progress <= q.target ? 100 : Math.max(5, (q.target / Math.max(1, q.progress)) * 100))
    : Math.min(100, (q.progress / Math.max(1, q.target)) * 100);
  const label = lte
    ? `${Math.round(q.progress)} → ≤ ${q.target}`
    : `${Math.min(Math.round(q.progress), q.target)}/${q.target}`;
  return (
    <div className="mt-2" data-testid={`quest-progress-${q.id || q.quest_key}`}>
      <div className="flex justify-between font-mono text-[9px] uppercase text-zinc-500">
        <span>{q.objective_label}</span>
        <span>{label}</span>
      </div>
      <MiniBar value={pct} color={q.status === "completed" ? "#34D399" : "#22D3EE"} className="mt-0.5" />
    </div>
  );
};

const NAV_BY_CATEGORY = {
  funcionarios: ["employees", "Abrir Operacionais"],
  frota: ["fleet", "Abrir Frota"],
  economia: ["empire", "Abrir Império"],
};

const QuestCard = ({ q, featured, onClose, onNavigate }) => {
  const { state, catalog, serverNow, claimQuest, chooseQuest } = useGame();
  const dim = q.status === "claimed" || q.status === "expired";
  const locked = q.status === "locked";
  const remaining = q.expires_at && q.status === "active"
    ? Math.max(0, (Date.parse(q.expires_at) - serverNow()) / 1000)
    : null;
  const chips = rewardChips(q.rewards || {}, catalog);

  return (
    <Card
      data-testid={`quest-card-${q.id || q.quest_key}`}
      className={`sub-quest-card relative overflow-hidden p-3 shadow-none ${
        featured ? "sub-quest-featured" : "sub-card"
      } ${q.status === "completed" ? "sub-quest-completed" : ""} ${locked ? "sub-quest-locked" : ""} ${dim || locked ? "opacity-50" : ""}`}
      style={{ "--mk": q.status === "completed" ? "#10B981" : DIFFICULTY_COLORS[q.difficulty] || "#71717a" }}
    >
      {featured && (
        <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-red-400">
          <Star size={9} fill="currentColor" /> Contrato em destaque
        </p>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-wide text-white">
            {locked && <Lock size={12} className="shrink-0 text-zinc-500" />}
            <span className="truncate">{q.name}</span>
          </p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            {QUEST_TYPE_LABELS[q.type]}{q.chapter ? ` · Cap. ${q.chapter}` : ""} ·{" "}
            <span style={{ color: DIFFICULTY_COLORS[q.difficulty] }}>{DIFFICULTY_LABELS[q.difficulty]}</span>
          </p>
        </div>
        <Badge
          variant="outline"
          className="shrink-0 rounded-full border-transparent px-2 py-0.5 font-mono text-[9px] font-bold uppercase"
          style={{ color: QUEST_STATUS_COLORS[q.status], background: `${QUEST_STATUS_COLORS[q.status]}1a` }}
        >
          {QUEST_STATUS_LABELS[q.status]}
        </Badge>
      </div>

      <p className="mt-1.5 text-[11px] leading-snug text-zinc-400">{q.desc}</p>

      {!locked && q.type !== "decisao" && q.status !== "claimed" && <ProgressBar q={q} />}

      {remaining !== null && (
        <p className="mt-1.5 flex items-center gap-1 font-mono text-[10px] text-amber-400">
          <Clock size={10} /> {fmtDuration(remaining)} restantes
        </p>
      )}

      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {q.reward_mult > 1.01 && (() => {
            const bd = questMultBreakdown(state?.player, q, catalog?.quest_meta);
            const parts = [
              `nível ×${bd.level.toFixed(2)}`,
              `dificuldade ×${bd.difficulty.toFixed(2)}`,
              bd.tierN > 0 ? `tier ${QUEST_TIER_LABELS[bd.tierN]} ×${bd.tier.toFixed(2)}` : null,
              bd.streak > 1 ? `série ${bd.streakCount}d ×${bd.streak.toFixed(2)}` : null,
            ].filter(Boolean).join(" · ");
            return (
              <Tip tip={`Recompensa dinâmica ×${q.reward_mult.toFixed(2)} — decomposição do motor: ${parts}. Concluir na 1.ª metade do prazo dá +${Math.round(bd.speedBonus * 100)}% extra (teto global ×${bd.cap}).`}>
                <Badge
                  variant="outline"
                  data-testid={`quest-mult-${q.id || q.quest_key}`}
                  className="gap-0.5 border-transparent bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-300"
                >
                  <Zap size={9} /> ×{q.reward_mult.toFixed(2)}
                </Badge>
              </Tip>
            );
          })()}
          {chips.map((c, i) => (
            <Badge key={i} variant="outline" className="gap-0.5 border-transparent bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] font-normal text-emerald-300">
              <Gift size={9} /> {c}
            </Badge>
          ))}
        </div>
      )}

      {q.unlocks_text && !dim && (
        <p className="mt-1.5 flex items-center gap-1 font-mono text-[10px] text-purple-300">
          <Sparkles size={10} /> {q.unlocks_text}
        </p>
      )}

      {q.status === "claimed" && q.outcome && (
        <p className="mt-1.5 font-mono text-[10px] italic text-zinc-500">{q.outcome}</p>
      )}

      {q.type === "decisao" && q.status === "active" && q.options && (
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {Object.entries(q.options).map(([key, o]) => {
            const unaffordable = (o.cost_clean || 0) > (state?.player?.clean_money || 0);
            return (
              <Button
                key={key}
                variant="outline"
                data-testid={`quest-choice-${q.id}-${key}`}
                onClick={() => chooseQuest(q.id, key)}
                disabled={unaffordable}
                title={unaffordable ? `Precisas de ${fmtMoney(o.cost_clean)} limpos para esta opção.` : undefined}
                className={`h-auto px-2 py-1.5 font-mono text-[10px] ${
                  unaffordable
                    ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                    : "border-white/10 text-cyan-300 hover:bg-white/5"
                }`}
              >
                {o.label}
              </Button>
            );
          })}
        </div>
      )}

      <div className="mt-2 flex gap-1.5">
        {q.status === "completed" && (
          <Button
            data-testid={`quest-claim-${q.id}`}
            variant="success"
            onClick={() => claimQuest(q.id)}
            className="h-auto flex-1 px-3 py-1.5 font-mono text-[10px] font-bold uppercase"
          >
            Reclamar recompensa
          </Button>
        )}
        {q.status === "active" && q.category === "operacao" && q.type !== "decisao" && (
          <Button
            data-testid={`quest-map-${q.id || q.quest_key}`}
            variant="outline"
            onClick={onClose}
            className="h-auto gap-1 border-white/10 px-3 py-1.5 font-mono text-[10px] text-zinc-300 hover:bg-white/5"
          >
            <MapPin size={10} /> Ver no mapa
          </Button>
        )}
      </div>
    </Card>
  );
};

const TABS = [
  { key: "historia", label: "História" },
  { key: "diarias", label: "Diárias" },
  { key: "semanais", label: "Semanais" },
  { key: "alertas", label: "Alertas" },
];

export const QuestsPanel = ({ open, onOpenChange, onNavigate, focusTab, onFocusTabConsumed }) => {
  const { state, serverNow, claimAllQuests } = useGame();
  const { rememberSort } = useSettings();
  const [tab, setTab] = usePreferenceState("questsTab", "historia", rememberSort);
  useTick(open);
  // Ao chegar de um registo de atividade que aponta para uma aba específica
  // (ex.: uma decisão pendente), abre já nessa aba em vez da última usada.
  useEffect(() => {
    if (open && focusTab) {
      setTab(focusTab);
      onFocusTabConsumed && onFocusTabConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, focusTab]);
  if (!state) return null;

  const quests = state.quests || [];
  const close = () => onOpenChange(false);
  // Uma única chamada ao motor (/quests/claim_all) — aplica multiplicadores,
  // série e momentum de uma vez, em vez de reclamar contrato a contrato.
  const claimAll = () => claimAllQuests();

  const principals = quests.filter((q) => q.type === "principal").sort((a, b) => a.order - b.order);
  const featured = principals.find((q) => q.status === "completed") || principals.find((q) => q.status === "active");
  const dailies = quests.filter((q) => q.type === "diaria").sort((a, b) => (a.status === "active" || a.status === "completed" ? -1 : 1));
  const weeklies = quests.filter((q) => q.type === "semanal").sort((a, b) => (a.status === "active" || a.status === "completed" ? -1 : 1));
  const alerts = quests
    .filter((q) => ["dinamica", "evento", "decisao"].includes(q.type))
    .sort((a, b) => (Date.parse(b.activated_at || 0) - Date.parse(a.activated_at || 0)))
    .sort((a, b) => {
      const rank = (s) => (s === "completed" ? 0 : s === "active" ? 1 : 2);
      return rank(a.status) - rank(b.status);
    });
  const claimable = quests.filter((q) => q.status === "completed").length;
  const alertsBadge = alerts.filter((q) => q.status === "active" || q.status === "completed").length;
  const tabCounts = {
    historia: principals.filter((q) => q.status === "active" || q.status === "completed").length,
    diarias: dailies.filter((q) => q.status === "active" || q.status === "completed").length,
    semanais: weeklies.filter((q) => q.status === "active" || q.status === "completed").length,
    alertas: alertsBadge,
  };

  const dailyMs = state.player.quests_daily_at ? Date.parse(state.player.quests_daily_at) - serverNow() : null;
  const weeklyMs = state.player.quests_weekly_at ? Date.parse(state.player.quests_weekly_at) - serverNow() : null;

  // SSS v3 — desempenho do jogador no sistema de contratos
  const streak = state.player.quest_streak || {};
  const perf = state.player.quest_perf || {};
  const tier = perf.tier || 0;
  const momentum = Math.round(perf.momentum || 0);
  const streakBonusPct = Math.min(40, 4 * (streak.count || 0));
  const activeMults = quests
    .filter((q) => q.status === "active" || q.status === "completed")
    .map((q) => q.reward_mult || 1);
  const bestMult = activeMults.length ? Math.max(...activeMults) : 1;

  const chapters = {};
  principals.forEach((q) => {
    (chapters[q.chapter] = chapters[q.chapter] || []).push(q);
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto sub-panel" data-testid="quests-panel">
        <SheetHeader>
          <PanelWatermark icon={Target} />
          <PanelKicker>Contratos · Objetivos</PanelKicker>
          <SheetTitle className="flex items-center gap-2 text-white">
            <Target size={18} className="text-primary" /> Missões
            {claimable > 0 && (
              <span className="ml-auto flex items-center gap-1.5">
                <Badge variant="outline" className="border-transparent bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300" data-testid="claimable-count">
                  {claimable} por reclamar
                </Badge>
                <Button
                  data-testid="quests-claim-all"
                  variant="success"
                  size="sm"
                  onClick={claimAll}
                  className="h-auto gap-1 px-2 py-0.5 font-mono text-[10px] font-bold uppercase"
                >
                  <Gift size={10} /> Tudo
                </Button>
              </span>
            )}
          </SheetTitle>
          <SheetDescription className="text-zinc-500">
            Lisboa paga bem a quem cumpre — reclama o que é teu.
          </SheetDescription>
        </SheetHeader>

        <SummaryStrip cols={3} testId="quests-summary" className="mt-3">
          <Kpi
            icon={Flame}
            label="Série diária"
            value={`${streak.count || 0} ${(streak.count || 0) === 1 ? "dia" : "dias"}`}
            sub={`melhor ${streak.best || 0}d · +${streakBonusPct}%`}
            color={(streak.count || 0) > 0 ? "#F59E0B" : "#A1A1AA"}
            tip="Reclama pelo menos uma diária por dia para manter a série. Cada dia soma +4% às recompensas de diárias e semanais (máx. +40%). Falhar um dia reinicia a série."
          />
          <Kpi
            icon={Gauge}
            label="Tier de contratos"
            value={QUEST_TIER_LABELS[tier]}
            sub={`momentum ${momentum}/100`}
            color={QUEST_TIER_COLORS[tier]}
            bar={momentum}
            barColor={QUEST_TIER_COLORS[tier]}
            tip="O momentum sobe ao reclamar contratos e desce quando expiram. Tiers altos pagam +8% por tier, trazem contratos mais exigentes, desbloqueiam uma 4.ª diária (Veterano) e uma 3.ª semanal (Lenda)."
          />
          <Kpi
            icon={Zap}
            label="Multiplicador"
            value={`até ×${bestMult.toFixed(2)}`}
            sub={`nível ×${(1 + 0.15 * Math.max(0, (state.player.level || 1) - 1)).toFixed(2)} base`}
            color={bestMult > 1.01 ? "#F59E0B" : "#A1A1AA"}
            tip="Cada contrato mostra o multiplicador real aplicado às recompensas: nível × dificuldade × tier × série × execução rápida (concluir na 1.ª metade do prazo dá +10%). Máximo ×4."
          />
        </SummaryStrip>

        {featured && (
          <div className="mt-3" data-testid="quest-featured">
            <QuestCard q={featured} featured onClose={close} onNavigate={onNavigate} />
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab} className="mt-3">
          <TabsList className="grid w-full grid-cols-4 bg-black/40">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.key}
                data-testid={`quest-tab-${t.key}`}
                value={t.key}
                className="relative px-1 font-mono text-[10px] font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {t.label}
                {tabCounts[t.key] > 0 && (
                  <Badge variant="outline" className="ml-1 border-transparent bg-white/10 px-1 py-0 font-mono text-[8px] font-bold text-zinc-300">
                    {tabCounts[t.key]}
                  </Badge>
                )}
                {t.key === "alertas" && alertsBadge > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500" />
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {tab === "historia" && (
          <div className="mt-3 space-y-4" data-testid="quests-historia">
            {Object.entries(chapters).map(([ch, qs]) => (
              <div key={ch}>
                <SectionHeader title={CHAPTER_LABELS[ch] || `Capítulo ${ch}`} meta={`${qs.length}`} />
                <div className="space-y-2">
                  {qs.map((q) => (
                    <QuestCard key={q.id || q.quest_key} q={q} onClose={close} onNavigate={onNavigate} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "diarias" && (
          <div className="mt-3" data-testid="quests-diarias">
            <p className="mb-2 font-mono text-[10px] text-zinc-500">
              Novas diárias em <span className="text-white">{dailyMs !== null ? fmtDuration(Math.max(0, dailyMs / 1000)) : "—"}</span>
            </p>
            <div className="space-y-2">
              {dailies.length === 0 && (
                <div className="sub-empty flex flex-col items-center gap-2 rounded-lg border border-dashed border-white/10 py-8 text-center">
                  <Clock size={20} className="sub-empty-icon text-zinc-600" />
                  <p className="font-mono text-[11px] text-zinc-500">Contratos diários esgotados — novos ao nascer do dia.</p>
                </div>
              )}
              {dailies.map((q) => (
                <QuestCard key={q.id} q={q} onClose={close} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        )}

        {tab === "semanais" && (
          <div className="mt-3" data-testid="quests-semanais">
            <p className="mb-2 font-mono text-[10px] text-zinc-500">
              Novas semanais em <span className="text-white">{weeklyMs !== null ? fmtDuration(Math.max(0, weeklyMs / 1000)) : "—"}</span>
            </p>
            <div className="space-y-2">
              {weeklies.length === 0 && (
                <div className="sub-empty flex flex-col items-center gap-2 rounded-lg border border-dashed border-white/10 py-8 text-center">
                  <Clock size={20} className="sub-empty-icon text-zinc-600" />
                  <p className="font-mono text-[11px] text-zinc-500">Contratos semanais fechados — a próxima leva chega com a semana.</p>
                </div>
              )}
              {weeklies.map((q) => (
                <QuestCard key={q.id} q={q} onClose={close} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        )}

        {tab === "alertas" && (
          <div className="mt-3 space-y-2" data-testid="quests-alertas">
            {alerts.length === 0 && (
              <div className="sub-empty flex flex-col items-center gap-2 rounded-lg border border-dashed border-white/10 py-8 text-center">
                <Target size={20} className="sub-empty-icon text-zinc-600" />
                <p className="max-w-[240px] font-mono text-[11px] text-zinc-500">
                  Silêncio nos alertas. Missões sugeridas, eventos e decisões aparecem aqui quando o império mexer.
                </p>
              </div>
            )}
            {alerts.map((q) => (
              <QuestCard key={q.id} q={q} onClose={close} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
