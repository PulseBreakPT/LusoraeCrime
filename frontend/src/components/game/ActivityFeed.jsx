import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "../../context/GameContextV2";
import { ScrollArea } from "../ui/scroll-area";
import { Card } from "../ui/card";
import {
  Send, Users, Car, Crosshair, Building2, Banknote, Siren, CheckCircle2,
  Cpu, Radar, Target, ChevronDown, ChevronUp, Maximize2, Minimize2,
} from "lucide-react";
import { parseActivityMessage, classifyEvent } from "../../lib/game";
import { useFlash } from "./hud";

const KIND_LABELS = {
  success: "Sucesso",
  failure: "Falha",
  police: "Polícia",
  dispatch: "Despacho",
  team: "Equipa",
  vehicle: "Veículo",
  weapon: "Arsenal",
  launder: "Lavagem",
  system: "Sistema",
  property: "Imóvel",
  intel: "Informação",
};

const PANEL_LABELS = {
  teams: "Equipas", fleet: "Frota", properties: "Imóveis", empire: "Império",
  employees: "Operacionais", quests: "Missões", intel: "Central de Inteligência",
  weapons: "Arsenal", hq: "Quartel-General",
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
    const enriched = (events || []).map((e) => {
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
  const key = `lus-feed-seen:${playerId || "anon"}`;
  const firstTs = (events && events[0] && events[0].ts) || "";
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

// ---------- Chips de filtro (partilhados desktop/mobile) ----------
const FilterChips = ({ counts, filter, onFilter }) => (
  <div className="lus-feed-chiprow px-2 pt-1.5" role="tablist" aria-label="Filtrar registos">
    {CATEGORIES.filter((c) => c.key === "all" || counts[c.key]).map((c) => (
      <button
        key={c.key}
        type="button"
        role="tab"
        aria-selected={filter === c.key}
        data-testid={`feed-filter-${c.key}`}
        onClick={() => onFilter(c.key)}
        className={`lus-feed-chip font-mono ${filter === c.key ? "is-active" : ""}`}
      >
        {c.label}
        <span className="lus-feed-chip-n">{counts[c.key] || 0}</span>
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
      className={`lus-feed-row flex w-full items-start gap-2 px-1.5 py-1 text-left ${flash ? "lus-feed-new" : ""}`}
    >
      <span
        className="lus-feed-ico mt-0.5"
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
          {e.count > 1 && <span className="lus-feed-xn">×{e.count}</span>}
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
              <div className="lus-feed-sep font-mono">
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

export const ActivityFeed = ({ onNavigate }) => {
  const { state, serverNow } = useGame();
  const events = state?.events || [];
  const firstId = events[0]?.id;
  // Flash vermelho no registo mais recente quando chega um novo — o feed é a
  // "voz" da rede; a entrada tem de se sentir. (Hooks antes do early-return.)
  const newFlash = useFlash(firstId);
  const [filter, setFilter] = useState("all");
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("lus-feed-collapsed") === "1"; } catch { return false; }
  });
  const [expanded, setExpanded] = useState(false);
  const nowMs = serverNow();
  const { rows, counts } = useFeedData(events, filter, nowMs);
  const { unread, markSeen } = useUnread(events, state?.player?.id);

  // Painel aberto = registos "vistos" (com um pequeno atraso, para o badge
  // "novos" ainda se sentir quando chega qualquer coisa). Colapsado acumula.
  useEffect(() => {
    if (collapsed || !firstId) return;
    const id = setTimeout(markSeen, 1800);
    return () => clearTimeout(id);
  }, [collapsed, firstId, markSeen]);

  // Se o filtro ativo ficou sem registos (rotação dos 30 do estado), volta a Tudo.
  useEffect(() => {
    if (filter !== "all" && !counts[filter]) setFilter("all");
  }, [filter, counts]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem("lus-feed-collapsed", next ? "1" : "0"); } catch { /* noop */ }
      return next;
    });
  };

  if (!state) return null;

  return (
    <div
      data-testid="activity-feed"
      className="lus-panel lus-hud-solid pointer-events-auto absolute bottom-20 left-2 z-20 hidden w-[21.5rem] animate-slide-up overflow-hidden rounded-xl border shadow-2xl md:block"
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <button
          type="button"
          data-testid="feed-collapse-toggle"
          onClick={toggleCollapsed}
          title={collapsed ? "Abrir o registo da rede" : "Encolher o registo da rede"}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <span className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-destructive" />
          <span className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
            Atividade da rede
          </span>
          {unread > 0 && (
            <span data-testid="feed-unread-badge" className="lus-feed-unread font-mono">
              {unread > 9 ? "9+" : unread} {unread === 1 ? "novo" : "novos"}
            </span>
          )}
          <ChevronDown
            size={11}
            className={`shrink-0 text-zinc-500 transition-transform ${collapsed ? "rotate-180" : ""}`}
          />
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="font-mono text-[9px] text-zinc-600">{events.length} registos</span>
          {!collapsed && (
            <button
              type="button"
              data-testid="feed-expand-toggle"
              onClick={() => setExpanded((x) => !x)}
              title={expanded ? "Reduzir a altura do registo" : "Aumentar a altura do registo"}
              className="lus-feed-iconbtn"
            >
              {expanded ? <Minimize2 size={10} /> : <Maximize2 size={10} />}
            </button>
          )}
        </div>
      </div>
      {!collapsed && (
        <>
          <FilterChips counts={counts} filter={filter} onFilter={setFilter} />
          <ScrollArea className={`${expanded ? "h-80" : "h-44"} p-2`}>
            {rows.length === 0 ? (
              <p className="px-1 font-mono text-[11px] text-zinc-600">
                {filter === "all" ? "Silêncio na rede. Por agora." : "Sem registos nesta categoria."}
              </p>
            ) : (
              <FeedList rows={rows} nowMs={nowMs} onNavigate={onNavigate} firstId={firstId} newFlash={newFlash} />
            )}
          </ScrollArea>
        </>
      )}
    </div>
  );
};

export const ActivityFeedMobile = ({ onNavigate }) => {
  const { state, serverNow } = useGame();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const containerRef = useRef(null);
  const events = state?.events || [];
  const firstId = events[0]?.id;
  const newFlash = useFlash(firstId);
  const nowMs = serverNow();
  const { rows, counts } = useFeedData(events, filter, nowMs);
  const { unread, markSeen } = useUnread(events, state?.player?.id);

  // Clicar fora fecha a lista, tal como um popover/dropdown normal — e Escape
  // também, para consistência com o resto da interface (desktop).
  useEffect(() => {
    if (!open) return;
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

  // Abrir a lista marca tudo como visto (e mantém-se visto enquanto aberta).
  useEffect(() => { if (open) markSeen(); }, [open, markSeen]);

  useEffect(() => {
    if (filter !== "all" && !counts[filter]) setFilter("all");
  }, [filter, counts]);

  if (!state || events.length === 0) return null;
  const latest = events[0];
  const latestDest = classifyEvent(latest.kind, latest.message);
  const LatestIcon = iconFor(latest, latestDest);
  const visible = rows.slice(0, 14);

  return (
    <div ref={containerRef} data-testid="activity-feed-mobile" className="pointer-events-none absolute bottom-[4.2rem] left-2 right-2 z-20 md:hidden">
      {open && (
        <Card
          data-testid="activity-feed-mobile-list"
          className="lus-panel pointer-events-auto absolute inset-x-0 bottom-full mb-2 animate-slide-up overflow-hidden border-border bg-[#0a0a0c]/95 p-0 shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <p className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />
              Últimos registos
            </p>
            <span className="font-mono text-[9px] text-zinc-600">{events.length} registos</span>
          </div>
          <FilterChips counts={counts} filter={filter} onFilter={setFilter} />
          <div className="max-h-60 overflow-y-auto p-2">
            {visible.length === 0 ? (
              <p className="px-1 font-mono text-[10px] text-zinc-600">Sem registos nesta categoria.</p>
            ) : (
              <FeedList
                rows={visible}
                nowMs={nowMs}
                onNavigate={(panel, dest) => { setOpen(false); onNavigate && onNavigate(panel, dest); }}
                firstId={firstId}
                newFlash={false}
              />
            )}
          </div>
        </Card>
      )}
      <button
        data-testid="activity-feed-mobile-toggle"
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`pointer-events-auto flex w-full items-center gap-2 rounded-md border border-white/10 bg-[#0a0a0c]/95 px-2.5 py-1.5 text-left shadow-2xl ${newFlash && !open ? "lus-feed-new" : ""}`}
      >
        <span
          className="lus-feed-ico"
          style={{ color: latestDest.color, background: `${latestDest.color}14`, borderColor: `${latestDest.color}33` }}
        >
          <LatestIcon size={11} strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-zinc-400">
          {parseActivityMessage(latest.message)}
        </span>
        {unread > 0 && !open && (
          <span className="lus-feed-unread font-mono">{unread > 9 ? "9+" : unread}</span>
        )}
        <span className="shrink-0 font-mono text-[9px] text-zinc-600">{relTime(latest.ts, nowMs)}</span>
        <ChevronUp size={11} className={`shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
    </div>
  );
};
