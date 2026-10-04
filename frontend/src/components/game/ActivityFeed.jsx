import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "../../context/GameContextV2";
import { ScrollArea } from "../ui/scroll-area";
import { Card } from "../ui/card";
import {
  Send, Users, Car, Crosshair, Building2, Banknote, Siren, CheckCircle2,
  Cpu, Radar, Target, ChevronDown, Maximize2, Minimize2, Bell,
} from "lucide-react";
import { parseActivityMessage, classifyEvent } from "../../lib/game";
import { useFlash } from "./hud";
import { LiveOpsPanel, phaseInfo } from "./LiveOpsDock";

/*
 * Atividade — uma só superfície de UI que junta a transmissão OPERAÇÕES
 * das operações (antigo dock central) e os REGISTOS de atividade num painel
 * com separadores. Quando uma equipa é despachada, a central muda sozinha
 * para OPERAÇÕES; sem operações, o separador mostra o estado vazio tático.
 */

const KIND_LABELS = {
  success: "Sucesso",
  failure: "Falha",
  police: "Polícia",
  dispatch: "Despacho",
  team: "Equipa",
  vehicle: "Veículo",
  weapon: "Arsenal",
  launder: "Lavagem",
  system: "Jogo",
  property: "Imóvel",
  intel: "Informação",
};

const PANEL_LABELS = {
  teams: "Equipas", fleet: "Frota", properties: "Imóveis", empire: "Império",
  employees: "Operacionais", quests: "Missões", intel: "Relatórios",
  weapons: "Arsenal", hq: "Quartel-General", shop: "Loja",
};

// ---------- Categorias de filtro (derivadas de kind + destino do classifyEvent) ----------
const CATEGORIES = [
  { key: "all", label: "Tudo" },
  { key: "ops", label: "Operações" },
  { key: "police", label: "Polícia" },
  { key: "hr", label: "RH" },
  { key: "assets", label: "Ativos" },
  { key: "money", label: "Finanças" },
  { key: "quests", label: "Missões" },
  { key: "intel", label: "Intel" },
];

const eventCategory = (e, dest) => {
  const msg = e.message || "";
  if (e.kind === "police") {
    // O kind "police" é usado no backend para vários golpes do sistema — separar
    // o que é dinheiro/salários (finanças) e traições (RH) da polícia a sério.
    if (/salári|dinheiro sujo|desperdiçad|suborno/i.test(msg)) return "money";
    if (/abandonou a organização|roubou|vendeu informação|sabotou|faltou/i.test(msg)) return "hr";
    return "police";
  }
  if (e.kind === "launder") return "money";
  if (e.kind === "dispatch") return "ops";
  switch (dest.panel) {
    case "teams": return "ops";
    case "employees": return "hr";
    case "fleet":
    case "weapons":
    case "properties": return "assets";
    case "empire": return "money";
    case "quests": return "quests";
    default: return "intel";
  }
};

// ---------- Severidade (derivada da cor semântica do classifyEvent) ----------
const SEVERITY_BY_COLOR = {
  "#EF4444": "crit", "#F43F5E": "crit",
  "#F97316": "warn", "#F59E0B": "warn",
  "#34D399": "pos", "#FBBF24": "gold",
};
const severityOf = (color) => SEVERITY_BY_COLOR[color] || "info";

// ---------- Ícone por tipo de evento ----------
const KIND_ICONS = {
  dispatch: Send, team: Users, vehicle: Car, weapon: Crosshair,
  property: Building2, launder: Banknote, police: Siren,
  success: CheckCircle2, system: Cpu, intel: Radar,
};
const iconFor = (e, dest) => (dest.panel === "quests" ? Target : (KIND_ICONS[e.kind] || Radar));

// ---------- Tempo ----------
const relTime = (ts, nowMs) => {
  const s = Math.max(0, (nowMs - Date.parse(ts)) / 1000);
  if (s < 15) return "agora";
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
};
const clockTime = (ts) => new Date(ts).toLocaleTimeString("pt-PT");
const shortDate = (ts) => new Date(ts).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
const fullTime = (ts) => new Date(ts).toLocaleString("pt-PT");

const timeGroup = (ts, nowMs) => {
  const s = Math.max(0, (nowMs - Date.parse(ts)) / 1000);
  if (s < 90) return "now";
  if (s < 600) return "10m";
  if (s < 3600) return "1h";
  if (s < 86400) return "24h";
  return "old";
};
const GROUP_LABELS = { now: "Agora", "10m": "Últimos 10 min", "1h": "Última hora", "24h": "Últimas 24 h", old: "Anterior" };

// ---------- Dados do feed: enriquecer + contar + filtrar + colapsar repetidos ----------
function useFeedData(events, filter, nowMs) {
  return useMemo(() => {
    // Ordena defensivamente do mais recente para o mais antigo — não assume a
    // ordem do backend (o agrupamento por tempo, o colapso de repetidos e o
    // "mais recente" dependem disto).
    const ordered = [...(events || [])].sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));
    const enriched = ordered.map((e) => {
      const dest = classifyEvent(e.kind, e.message);
      return { ...e, dest, cat: eventCategory(e, dest), sev: severityOf(dest.color) };
    });
    const counts = { all: enriched.length };
    enriched.forEach((e) => { counts[e.cat] = (counts[e.cat] || 0) + 1; });
    const filtered = filter === "all" ? enriched : enriched.filter((e) => e.cat === filter);
    // Colapsar eventos repetidos consecutivos (mesmo kind+mensagem) num só registo ×N.
    const rows = [];
    filtered.forEach((e) => {
      const last = rows[rows.length - 1];
      if (last && last.kind === e.kind && last.message === e.message) { last.count += 1; return; }
      rows.push({ ...e, count: 1, group: timeGroup(e.ts, nowMs) });
    });
    return { rows, counts };
  }, [events, filter, nowMs]);
}

// ---------- Não lidos: último ts visto guardado por jogador ----------
function useUnread(events, playerId) {
  const key = `sub-feed-seen:${playerId || "anon"}`;
  // ts mais recente (não assume events[0]) — o "marcar como visto" tem de gravar
  // o mais novo, senão eventos ficariam eternamente por ler.
  const firstTs = (events || []).reduce((m, e) => (e?.ts && (!m || e.ts > m) ? e.ts : m), "");
  const [seenTs, setSeenTs] = useState(() => {
    try { return localStorage.getItem(key) || ""; } catch { return ""; }
  });
  useEffect(() => {
    try { setSeenTs(localStorage.getItem(key) || ""); } catch { /* noop */ }
  }, [key]);
  const unread = useMemo(
    () => (events || []).reduce((n, e) => n + (!seenTs || e.ts > seenTs ? 1 : 0), 0),
    [events, seenTs]
  );
  const markSeen = useCallback(() => {
    if (!firstTs) return;
    try { localStorage.setItem(key, firstTs); } catch { /* noop */ }
    setSeenTs(firstTs);
  }, [firstTs, key]);
  return { unread, markSeen };
}

// ---------- Operações ativas + mudança automática para OPERAÇÕES ----------
function useLiveOps(state, onFresh) {
  const liveMissions = useMemo(
    () => (state?.missions || []).filter((m) => m.phase !== "done"),
    [state?.missions]
  );
  const liveIdsKey = liveMissions.map((m) => m.id).join(",");
  const prevRef = useRef("");
  const onFreshRef = useRef(onFresh);
  onFreshRef.current = onFresh;
  useEffect(() => {
    const prev = new Set(prevRef.current.split(",").filter(Boolean));
    const fresh = liveIdsKey.split(",").filter(Boolean).some((id) => !prev.has(id));
    prevRef.current = liveIdsKey;
    if (fresh && onFreshRef.current) onFreshRef.current();
  }, [liveIdsKey]);
  return liveMissions;
}

// ---------- Separadores da central (partilhados desktop/mobile) ----------
const ConsoleTabs = ({ tab, onTab, liveCount, unread, idPrefix = "console" }) => (
  <div className="sub-notify-tabs flex border-b border-white/[0.06]" role="tablist" aria-label="Notificações">
    <button
      type="button"
      role="tab"
      aria-selected={tab === "live"}
      data-testid={`${idPrefix}-tab-live`}
      onClick={() => onTab("live")}
      className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors ${
        tab === "live" ? "text-white" : "text-zinc-500 hover:text-zinc-300"
      }`}
    >
      <span className="sub-lo-rec" style={liveCount === 0 ? { animation: "none", opacity: 0.25, boxShadow: "none" } : undefined} />
      Operações
      {liveCount > 0 && (
        <span className="rounded-full border border-red-500/40 bg-red-500/10 px-1.5 font-mono text-[9px] font-bold text-red-300">
          {liveCount}
        </span>
      )}
    </button>
    <span className="w-px shrink-0 bg-white/[0.06]" />
    <button
      type="button"
      role="tab"
      aria-selected={tab === "log"}
      data-testid={`${idPrefix}-tab-log`}
      onClick={() => onTab("log")}
      className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors ${
        tab === "log" ? "text-white" : "text-zinc-500 hover:text-zinc-300"
      }`}
    >
      Registos
      {unread > 0 && (
        <span className="sub-feed-unread font-mono">{unread > 9 ? "9+" : unread}</span>
      )}
    </button>
  </div>
);

// ---------- Chips de filtro (partilhados desktop/mobile) ----------
const FilterChips = ({ counts, filter, onFilter }) => (
  <div className="sub-feed-chiprow sub-notify-filters px-2.5 pt-2" role="tablist" aria-label="Filtrar notificações">
    {CATEGORIES.filter((c) => c.key === "all" || counts[c.key]).map((c) => (
      <button
        key={c.key}
        type="button"
        role="tab"
        aria-selected={filter === c.key}
        data-testid={`feed-filter-${c.key}`}
        onClick={() => onFilter(c.key)}
        className={`sub-feed-chip ${filter === c.key ? "is-active" : ""}`}
      >
        {c.label}
        <span className="sub-feed-chip-n">{counts[c.key] || 0}</span>
      </button>
    ))}
  </div>
);

// ---------- Um registo ----------
const FeedRow = ({ e, nowMs, onNavigate, flash }) => {
  const Icon = iconFor(e, e.dest);
  return (
    <button
      type="button"
      data-testid="feed-row"
      data-sev={e.sev}
      onClick={() => onNavigate && onNavigate(e.dest.panel, e.dest)}
      title={`${KIND_LABELS[e.kind] || e.kind} — abrir ${PANEL_LABELS[e.dest.panel] || e.dest.panel} · ${fullTime(e.ts)}`}
      className={`sub-feed-row flex w-full items-start gap-2.5 px-2.5 py-2.5 text-left ${flash ? "sub-feed-new" : ""}`}
    >
      <span
        className="sub-feed-ico mt-0.5"
        style={{ color: e.dest.color, background: `${e.dest.color}14`, borderColor: `${e.dest.color}33` }}
      >
        <Icon size={11} strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11px] leading-snug text-zinc-300">{parseActivityMessage(e.message)}</p>
        <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[9px] text-zinc-600">
          <span className="uppercase tracking-wider" style={{ color: `${e.dest.color}B3` }}>
            {KIND_LABELS[e.kind] || e.kind}
          </span>
          <span>·</span>
          <span>{e.group === "old" ? `${shortDate(e.ts)} ${clockTime(e.ts)}` : clockTime(e.ts)}</span>
          {e.count > 1 && <span className="sub-feed-xn">×{e.count}</span>}
        </p>
      </div>
      <span className="shrink-0 pt-0.5 font-mono text-[9px] text-zinc-600">{relTime(e.ts, nowMs)}</span>
    </button>
  );
};

// ---------- Lista com separadores temporais ----------
const FeedList = ({ rows, nowMs, onNavigate, firstId, newFlash }) => {
  let lastGroup = null;
  return (
    <div className="space-y-0.5">
      {rows.map((e) => {
        const showSep = e.group !== lastGroup;
        lastGroup = e.group;
        return (
          <Fragment key={e.id}>
            {showSep && (
              <div className="sub-feed-sep font-mono">
                <span>{GROUP_LABELS[e.group]}</span>
              </div>
            )}
            <FeedRow e={e} nowMs={nowMs} onNavigate={onNavigate} flash={e.id === firstId && newFlash} />
          </Fragment>
        );
      })}
    </div>
  );
};

export const ActivityFeed = ({ onNavigate, suppressed }) => {
  const { state, serverNow } = useGame();
  const events = state?.events || [];
  const firstId = events[0]?.id;
  // Flash vermelho no registo mais recente quando chega um novo — o feed é a
  // a entrada mais recente deve ser percetível. (Hooks antes do early-return.)
  const newFlash = useFlash(firstId);
  const [filter, setFilter] = useState("all");
  const [tab, setTab] = useState("log");
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sub-feed-collapsed") === "1"; } catch { return false; }
  });
  const [expanded, setExpanded] = useState(false);
  const nowMs = serverNow();
  const { rows, counts } = useFeedData(events, filter, nowMs);
  const { unread, markSeen } = useUnread(events, state?.player?.id);
  // Nova operação no terreno → a central muda sozinha para OPERAÇÕES e abre-se.
  const liveMissions = useLiveOps(state, () => { setTab("live"); setCollapsed(false); });
  const liveCount = liveMissions.length;

  // Separador Registos à vista = registos "vistos" (com um pequeno atraso, para
  // o badge "novos" ainda se sentir quando chega qualquer coisa).
  useEffect(() => {
    if (collapsed || tab !== "log" || !firstId) return;
    const id = setTimeout(markSeen, 1800);
    return () => clearTimeout(id);
  }, [collapsed, tab, firstId, markSeen]);

  // Se o filtro ativo ficou sem registos (rotação dos 30 do estado), volta a Tudo.
  useEffect(() => {
    if (filter !== "all" && !counts[filter]) setFilter("all");
  }, [filter, counts]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem("sub-feed-collapsed", next ? "1" : "0"); } catch { /* noop */ }
      return next;
    });
  };

  if (!state) return null;

  return (
    <div
      data-testid="activity-feed"
      className={`sub-panel sub-hud-solid sub-notification-panel pointer-events-auto absolute bottom-20 left-2 z-20 w-[25rem] animate-slide-up overflow-hidden rounded-2xl border shadow-2xl ${
        suppressed ? "hidden xl:block" : "hidden md:block"
      }`}
    >
      <div className="sub-notify-head flex items-center justify-between gap-3 border-b border-white/[0.07] px-3.5 py-3">
        <button
          type="button"
          data-testid="feed-collapse-toggle"
          onClick={toggleCollapsed}
          title={collapsed ? "Abrir notificações" : "Encolher notificações"}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.035] text-zinc-300">
            <Bell size={14} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-200">
              Notificações
            </span>
            <span className="block text-[9px] text-zinc-600">{events.length} recentes</span>
          </span>
          {collapsed && liveCount > 0 && (
            <span className="rounded-full border border-red-500/40 bg-red-500/10 px-1.5 font-mono text-[9px] font-bold uppercase text-red-300">
              Operações · {liveCount}
            </span>
          )}
          {unread > 0 && (
            <span data-testid="feed-unread-badge" className="sub-feed-unread font-mono">
              {unread > 9 ? "9+" : unread} {unread === 1 ? "novo" : "novos"}
            </span>
          )}
          <ChevronDown
            size={11}
            className={`shrink-0 text-zinc-500 transition-transform ${collapsed ? "rotate-180" : ""}`}
          />
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-[9px] tabular-nums text-zinc-600">{events.length}</span>
          {!collapsed && (
            <button
              type="button"
              data-testid="feed-expand-toggle"
              onClick={() => setExpanded((x) => !x)}
              title={expanded ? "Reduzir a altura do painel" : "Aumentar a altura do painel"}
              className="sub-feed-iconbtn"
            >
              {expanded ? <Minimize2 size={10} /> : <Maximize2 size={10} />}
            </button>
          )}
        </div>
      </div>
      {!collapsed && (
        <>
          <ConsoleTabs tab={tab} onTab={setTab} liveCount={liveCount} unread={unread} />
          {tab === "live" ? (
            <div className="overflow-y-auto" style={{ maxHeight: expanded ? "26rem" : "19rem" }}>
              <LiveOpsPanel state={state} serverNow={serverNow} />
            </div>
          ) : (
            <>
              <FilterChips counts={counts} filter={filter} onFilter={setFilter} />
              <ScrollArea className={`${expanded ? "h-80" : "h-44"} p-2`}>
                {rows.length === 0 ? (
                  <p className="px-1 font-mono text-[11px] text-zinc-600">
                    {filter === "all" ? "Sem atividade recente." : "Sem registos nesta categoria."}
                  </p>
                ) : (
                  <FeedList rows={rows} nowMs={nowMs} onNavigate={onNavigate} firstId={firstId} newFlash={newFlash} />
                )}
              </ScrollArea>
            </>
          )}
        </>
      )}
    </div>
  );
};

export const ActivityFeedMobile = ({ onNavigate, suppressed }) => {
  const { state, serverNow } = useGame();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("log");
  const [filter, setFilter] = useState("all");
  const [tickerVisible, setTickerVisible] = useState(false);
  const containerRef = useRef(null);
  const events = state?.events || [];
  const firstId = events[0]?.id;
  const nowMs = serverNow();
  const { rows, counts } = useFeedData(events, filter, nowMs);
  const { unread, markSeen } = useUnread(events, state?.player?.id);
  const liveMissions = useLiveOps(state, () => setTab("live"));
  const liveCount = liveMissions.length;

  // O mapa fica limpo: cada novo evento surge como uma linha transitória e
  // desaparece sozinho. O histórico completo vive atrás do sino.
  useEffect(() => {
    if (!firstId || open) return undefined;
    setTickerVisible(true);
    const id = setTimeout(() => setTickerVisible(false), 5000);
    return () => clearTimeout(id);
  }, [firstId, open]);

  useEffect(() => {
    if (!open) return undefined;
    setTickerVisible(false);
    const onPointerDown = (ev) => {
      if (containerRef.current && !containerRef.current.contains(ev.target)) setOpen(false);
    };
    const onKeyDown = (ev) => { if (ev.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open && tab === "log") markSeen();
  }, [open, tab, markSeen]);

  useEffect(() => {
    if (filter !== "all" && !counts[filter]) setFilter("all");
  }, [filter, counts]);

  if (!state || suppressed || (events.length === 0 && liveCount === 0)) return null;

  const latest = events[0];
  const latestDest = latest ? classifyEvent(latest.kind, latest.message) : null;
  const LatestIcon = latest ? iconFor(latest, latestDest) : Radar;
  const visible = rows.slice(0, 14);

  return (
    <div
      ref={containerRef}
      data-testid="activity-feed-mobile"
      className="pointer-events-none absolute bottom-[4.5rem] left-2 right-2 z-30 md:left-4 md:right-auto md:w-[24rem]"
    >
      {open && (
        <Card
          data-testid="activity-feed-mobile-list"
          className="sub-panel sub-notification-panel pointer-events-auto absolute inset-x-0 bottom-full mb-2 animate-slide-up overflow-hidden rounded-2xl border-border bg-[#0a0a0c]/95 p-0 shadow-2xl"
        >
          <div className="sub-notify-head flex items-center justify-between border-b border-white/[0.07] px-3.5 py-3">
            <p className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-200">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.035] text-zinc-300">
                <Bell size={14} />
              </span>
              Notificações
            </p>
            <span className="text-[9px] tabular-nums text-zinc-600">{events.length}</span>
          </div>
          <ConsoleTabs tab={tab} onTab={setTab} liveCount={liveCount} unread={unread} idPrefix="console-m" />
          {tab === "live" ? (
            <div className="max-h-72 overflow-y-auto">
              <LiveOpsPanel state={state} serverNow={serverNow} />
            </div>
          ) : (
            <>
              <FilterChips counts={counts} filter={filter} onFilter={setFilter} />
              <div className="max-h-60 overflow-y-auto p-2">
                {visible.length === 0 ? (
                  <p className="px-1 font-mono text-[10px] text-zinc-600">Sem registos nesta categoria.</p>
                ) : (
                  <FeedList
                    rows={visible}
                    nowMs={nowMs}
                    onNavigate={(panel, dest) => {
                      setOpen(false);
                      onNavigate && onNavigate(panel, dest);
                    }}
                    firstId={firstId}
                    newFlash={false}
                  />
                )}
              </div>
            </>
          )}
        </Card>
      )}

      <div className="flex items-end justify-end gap-2">
        {tickerVisible && !open && latest && latestDest && (
          <button
            type="button"
            data-testid="activity-feed-ticker"
            onClick={() => {
              setTickerVisible(false);
              onNavigate && onNavigate(latestDest.panel, latestDest);
            }}
            className="sub-activity-ticker pointer-events-auto flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <span className="sub-feed-ico shrink-0" style={{ color: latestDest.color }}>
              <LatestIcon size={11} strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-zinc-300">
              {parseActivityMessage(latest.message)}
            </span>
            <span className="shrink-0 font-mono text-[9px] text-zinc-600">{relTime(latest.ts, nowMs)}</span>
          </button>
        )}

        <button
          data-testid="activity-feed-mobile-toggle"
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="sub-hud-btn sub-notification-trigger pointer-events-auto relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-zinc-300"
          aria-label={open ? "Fechar notificações" : "Abrir notificações"}
          title="Notificações"
        >
          <Bell size={17} />
          {(unread > 0 || liveCount > 0) && !open && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[9px] font-bold text-white"
              style={{ background: liveCount > 0 ? "#EF4444" : "#F59E0B" }}
            >
              {liveCount > 0 ? liveCount : unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
