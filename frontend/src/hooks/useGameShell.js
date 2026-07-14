import { useEffect, useRef, useState } from "react";
import { parseActivityMessage } from "../lib/game";

export const GAME_PANELS = [
  "operations", "quests", "empire", "teams", "employees",
  "fleet", "properties", "weapons", "shop", "hq", "intel", "settings",
];

const PANEL_SET = new Set(GAME_PANELS);
const PANEL_SHORTCUTS = {
  "1": "operations",
  "2": "quests",
  "3": "empire",
  "4": "teams",
  "5": "employees",
  "6": "fleet",
  "7": "properties",
  "8": "weapons",
  "9": "shop",
};
const LAST_PANEL_KEY = "lusorae.last-panel";

export function initialGamePanel() {
  if (typeof window === "undefined") return null;
  const fromUrl = new URLSearchParams(window.location.search).get("panel");
  if (PANEL_SET.has(fromUrl)) return fromUrl;
  try {
    const saved = window.localStorage.getItem(LAST_PANEL_KEY);
    return PANEL_SET.has(saved) ? saved : null;
  } catch {
    return null;
  }
}

const isTypingTarget = (target) => {
  if (!target) return false;
  const tag = target.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
};

export function useGameShell({
  state,
  alerts,
  openPanel,
  setOpenPanel,
  selectedOpp,
  setSelectedOpp,
  refresh,
  lastSyncAt,
  commandOpen,
  setCommandOpen,
  settings,
}) {
  const [online, setOnline] = useState(() => (
    typeof navigator === "undefined" ? true : navigator.onLine
  ));
  const [clock, setClock] = useState(Date.now());
  const previousEventTs = useRef("");

  useEffect(() => {
    const id = window.setInterval(() => setClock(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const stale = Boolean(online && lastSyncAt && clock - lastSyncAt > 15000);

  // Mantém o painel atual partilhável por URL e memoriza o último painel real.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (openPanel && PANEL_SET.has(openPanel)) {
      url.searchParams.set("panel", openPanel);
      try { window.localStorage.setItem(LAST_PANEL_KEY, openPanel); } catch { /* noop */ }
    } else {
      url.searchParams.delete("panel");
    }
    window.history.replaceState(window.history.state, "", url);
  }, [openPanel]);

  // Back/forward também restaura o painel indicado na URL.
  useEffect(() => {
    const onPopState = () => {
      const panel = new URLSearchParams(window.location.search).get("panel");
      setOpenPanel(PANEL_SET.has(panel) ? panel : null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [setOpenPanel]);

  useEffect(() => {
    const root = document.documentElement;
    const classes = {
      "lus-reduced-motion": settings.reducedMotion,
      "lus-high-contrast": settings.highContrast,
      "lus-compact-hud": settings.compactHud,
      "lus-focus-mode": settings.focusMode,
    };
    Object.entries(classes).forEach(([name, active]) => root.classList.toggle(name, Boolean(active)));
    return () => Object.keys(classes).forEach((name) => root.classList.remove(name));
  }, [settings.reducedMotion, settings.highContrast, settings.compactHud, settings.focusMode]);

  // Atalhos globais: pesquisa, painéis 1–9, sincronização e fecho consistente.
  useEffect(() => {
    const onKeyDown = (event) => {
      const typing = isTypingTarget(event.target);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((value) => !value);
        return;
      }
      if (!typing && event.key === "/") {
        event.preventDefault();
        setCommandOpen(true);
        return;
      }
      if (typing) return;
      const panel = PANEL_SHORTCUTS[event.key];
      if (panel && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        setOpenPanel(panel);
        return;
      }
      if (!event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        refresh();
        return;
      }
      if (event.key === "Escape") {
        if (commandOpen) setCommandOpen(false);
        else if (selectedOpp) setSelectedOpp(null);
        else if (openPanel) setOpenPanel(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    commandOpen, openPanel, refresh, selectedOpp,
    setCommandOpen, setOpenPanel, setSelectedOpp,
  ]);

  // O separador mostra a urgência mesmo quando o jogo está em segundo plano.
  useEffect(() => {
    const total = alerts?.total || 0;
    document.title = total > 0 ? `(${total}) Lusorae` : "Lusorae";
    return () => { document.title = "Lusorae"; };
  }, [alerts?.total]);

  // Notificação de sistema para o evento mais recente quando o separador está oculto.
  useEffect(() => {
    const events = state?.events || [];
    const latest = events.reduce((best, event) => (
      !best || Date.parse(event.ts) > Date.parse(best.ts) ? event : best
    ), null);
    if (!latest?.ts) return;
    if (!previousEventTs.current) {
      previousEventTs.current = latest.ts;
      return;
    }
    if (
      latest.ts > previousEventTs.current &&
      settings.desktopNotifications &&
      document.visibilityState === "hidden" &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      new Notification("Lusorae", {
        body: parseActivityMessage(latest.message),
        tag: `lusorae-${latest.kind || "event"}`,
      });
    }
    if (latest.ts > previousEventTs.current) previousEventTs.current = latest.ts;
  }, [state?.events, settings.desktopNotifications]);

  return { online, stale };
}
