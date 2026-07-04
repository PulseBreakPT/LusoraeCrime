import { useEffect, useState } from "react";
import { useGame } from "../../context/GameContext";
import {
  fmtMoney, fmtDuration, QUEST_STATUS_LABELS, QUEST_STATUS_COLORS,
  DIFFICULTY_LABELS, DIFFICULTY_COLORS, CHAPTER_LABELS, QUEST_TYPE_LABELS,
} from "../../lib/game";
import { usePreferenceState } from "../../lib/persist";
import { useSettings } from "../../context/SettingsContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Target, Lock, Clock, Gift, MapPin, Star, Sparkles, ArrowRight } from "lucide-react";

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
      <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${pct}%`, background: q.status === "completed" ? "#34D399" : "#22D3EE" }}
        />
      </div>
    </div>
  );
};

const NAV_BY_CATEGORY = {
  funcionarios: ["employees", "Abrir RH"],
  frota: ["fleet", "Abrir Frota"],
  economia: ["empire", "Abrir Império"],
};

const QuestCard = ({ q, featured, onClose, onNavigate }) => {
  const { catalog, serverNow, claimQuest, chooseQuest } = useGame();
  const dim = q.status === "claimed" || q.status === "expired";
  const locked = q.status === "locked";
  const remaining = q.expires_at && q.status === "active"
    ? Math.max(0, (Date.parse(q.expires_at) - serverNow()) / 1000)
    : null;
  const chips = rewardChips(q.rewards || {}, catalog);

  return (
    <div
      data-testid={`quest-card-${q.id || q.quest_key}`}
      className={`rounded-lg border p-3 ${
        featured
          ? "border-red-500/40 bg-red-500/[0.06]"
          : "border-white/10 bg-white/[0.03]"
      } ${dim || locked ? "opacity-50" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-bold text-white">
            {locked && <Lock size={12} className="shrink-0 text-zinc-500" />}
            {featured && <Star size={12} className="shrink-0 text-red-400" />}
            <span className="truncate">{q.name}</span>
          </p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            {QUEST_TYPE_LABELS[q.type]}{q.chapter ? ` · Cap. ${q.chapter}` : ""} ·{" "}
            <span style={{ color: DIFFICULTY_COLORS[q.difficulty] }}>{DIFFICULTY_LABELS[q.difficulty]}</span>
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase"
          style={{ color: QUEST_STATUS_COLORS[q.status], background: `${QUEST_STATUS_COLORS[q.status]}1a` }}
        >
          {QUEST_STATUS_LABELS[q.status]}
        </span>
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
          {chips.map((c, i) => (
            <span key={i} className="flex items-center gap-0.5 rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] text-emerald-300">
              <Gift size={9} /> {c}
            </span>
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
          {Object.entries(q.options).map(([key, o]) => (
            <button
              key={key}
              data-testid={`quest-choice-${q.id}-${key}`}
              onClick={() => chooseQuest(q.id, key)}
              className="rounded border border-white/10 px-2 py-1.5 font-mono text-[10px] text-cyan-300 transition-colors hover:bg-white/5"
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex gap-1.5">
        {q.status === "completed" && (
          <button
            data-testid={`quest-claim-${q.id}`}
            onClick={() => claimQuest(q.id)}
            className="flex-1 rounded bg-emerald-500 px-3 py-1.5 font-mono text-[10px] font-bold uppercase text-black transition-colors hover:bg-emerald-400"
          >
            Reclamar recompensa
          </button>
        )}
        {q.status === "active" && q.category === "operacao" && q.type !== "decisao" && (
          <button
            data-testid={`quest-map-${q.id || q.quest_key}`}
            onClick={onClose}
            className="flex items-center justify-center gap-1 rounded border border-white/10 px-3 py-1.5 font-mono text-[10px] text-zinc-300 transition-colors hover:bg-white/5"
          >
            <MapPin size={10} /> Ver no mapa
          </button>
        )}
      </div>
    </div>
  );
};

const TABS = [
  { key: "historia", label: "História" },
  { key: "diarias", label: "Diárias" },
  { key: "semanais", label: "Semanais" },
  { key: "alertas", label: "Alertas" },
];

export const QuestsPanel = ({ open, onOpenChange, onNavigate }) => {
  const { state, serverNow, claimQuest } = useGame();
  const { rememberSort } = useSettings();
  const [tab, setTab] = usePreferenceState("questsTab", "historia", rememberSort);
  useTick(open);
  if (!state) return null;

  const quests = state.quests || [];
  const close = () => onOpenChange(false);
  const claimAll = () => quests.filter((q) => q.status === "completed").forEach((q) => claimQuest(q.id));

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

  const chapters = {};
  principals.forEach((q) => {
    (chapters[q.chapter] = chapters[q.chapter] || []).push(q);
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-sm overflow-y-auto border-white/10 bg-[#0a0a0a]/95 backdrop-blur-xl sm:max-w-md" data-testid="quests-panel">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white">
            <Target size={18} className="text-red-500" /> Missões
            {claimable > 0 && (
              <span className="ml-auto flex items-center gap-1.5">
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300" data-testid="claimable-count">
                  {claimable} por reclamar
                </span>
                <button
                  data-testid="quests-claim-all"
                  onClick={claimAll}
                  className="flex items-center gap-1 rounded bg-emerald-500 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-black transition-colors hover:bg-emerald-400"
                >
                  <Gift size={10} /> Tudo
                </button>
              </span>
            )}
          </SheetTitle>
          <SheetDescription className="text-zinc-500">
            Há sempre algo importante para fazer em Lisboa.
          </SheetDescription>
        </SheetHeader>

        {featured && (
          <div className="mt-3" data-testid="quest-featured">
            <QuestCard q={featured} featured onClose={close} onNavigate={onNavigate} />
          </div>
        )}

        <div className="mt-3 grid grid-cols-4 gap-1 rounded-lg border border-white/10 bg-black/40 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              data-testid={`quest-tab-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`relative rounded px-1 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors ${
                tab === t.key ? "bg-white text-black" : "text-zinc-400 hover:text-white"
              }`}
            >
              {t.label}
              {tabCounts[t.key] > 0 && (
                <span className={`ml-1 rounded-full px-1 font-mono text-[8px] font-bold ${tab === t.key ? "bg-black/15 text-black" : "bg-white/10 text-zinc-300"}`}>
                  {tabCounts[t.key]}
                </span>
              )}
              {t.key === "alertas" && alertsBadge > 0 && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500" />
              )}
            </button>
          ))}
        </div>

        {tab === "historia" && (
          <div className="mt-3 space-y-4" data-testid="quests-historia">
            {Object.entries(chapters).map(([ch, qs]) => (
              <div key={ch}>
                <h3 className="mb-2 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">
                  {CHAPTER_LABELS[ch] || `Capítulo ${ch}`}
                </h3>
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
              {dailies.length === 0 && <p className="font-mono text-[11px] text-zinc-600">Sem missões diárias de momento.</p>}
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
              {weeklies.length === 0 && <p className="font-mono text-[11px] text-zinc-600">Sem missões semanais de momento.</p>}
              {weeklies.map((q) => (
                <QuestCard key={q.id} q={q} onClose={close} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        )}

        {tab === "alertas" && (
          <div className="mt-3 space-y-2" data-testid="quests-alertas">
            {alerts.length === 0 && (
              <p className="font-mono text-[11px] text-zinc-600">
                Sem alertas ativos. Missões sugeridas, eventos e decisões aparecem aqui conforme o estado do teu império.
              </p>
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
