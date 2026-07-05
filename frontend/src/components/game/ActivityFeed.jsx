import { useState } from "react";
import { useGame } from "../../context/GameContext";
import { ScrollArea } from "../ui/scroll-area";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { parseActivityMessage } from "../../lib/game";

const KIND_COLORS = {
  success: "#10B981",
  failure: "#F59E0B",
  police: "#DC2626",
  dispatch: "#22D3EE",
  team: "#8E8E93",
  vehicle: "#22D3EE",
  launder: "#34D399",
  system: "#FFFFFF",
};

const KIND_LABELS = {
  success: "Sucesso",
  failure: "Falha",
  police: "Polícia",
  dispatch: "Despacho",
  team: "Equipa",
  vehicle: "Veículo",
  launder: "Lavagem",
  system: "Sistema",
};

const relTime = (ts, nowMs) => {
  const s = Math.max(0, (nowMs - Date.parse(ts)) / 1000);
  if (s < 15) return "agora";
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
};

// Data e hora completas, no mesmo estilo usado no extrato financeiro do Império.
const absTime = (ts) => new Date(ts).toLocaleString("pt-PT");

export const ActivityFeed = ({ onNavigate }) => {
  const { state, serverNow } = useGame();
  if (!state) return null;

  return (
    <div
      data-testid="activity-feed"
      className="pointer-events-auto absolute bottom-20 left-2 z-20 hidden w-80 animate-slide-up rounded-lg border border-border bg-card/90 shadow-2xl backdrop-blur-xl md:block"
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />
          Atividade da rede
        </p>
        <Badge variant="outline" className="border-white/10 bg-transparent px-1.5 py-0 font-mono text-[9px] font-normal text-zinc-600">
          {state.events.length} registos
        </Badge>
      </div>
      <ScrollArea className="h-44 p-2">
        <div className="space-y-1.5">
          {state.events.length === 0 && (
            <p className="px-1 font-mono text-[11px] text-zinc-600">Sem atividade registada.</p>
          )}
          {state.events.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onNavigate && onNavigate("intel")}
              title={`${KIND_LABELS[e.kind] || e.kind} — clica para veres ações recomendadas`}
              className="flex w-full items-start gap-1.5 rounded px-1 text-left transition-colors hover:bg-white/5"
            >
              <span className="shrink-0 pt-0.5" style={{ color: KIND_COLORS[e.kind] || "#8E8E93" }}>▸</span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[11px] leading-snug text-zinc-400">{parseActivityMessage(e.message)}</p>
                <p className="font-mono text-[9px] text-zinc-600">{absTime(e.ts)}</p>
              </div>
              <span className="shrink-0 pt-0.5 font-mono text-[9px] text-zinc-600">{relTime(e.ts, serverNow())}</span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export const ActivityFeedMobile = ({ onNavigate }) => {
  const { state, serverNow } = useGame();
  const [open, setOpen] = useState(false);
  if (!state || state.events.length === 0) return null;
  const latest = state.events[0];
  const recent = state.events.slice(0, 5);

  return (
    <div data-testid="activity-feed-mobile" className="pointer-events-none absolute bottom-[4.2rem] left-2 right-2 z-20 md:hidden">
      {open && (
        <Card
          data-testid="activity-feed-mobile-list"
          className="pointer-events-auto absolute inset-x-0 bottom-full mb-2 max-h-64 animate-slide-up overflow-y-auto border-border bg-card/95 p-2 shadow-2xl backdrop-blur-xl"
        >
          <p className="mb-1.5 px-1 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Últimos registos</p>
          <div className="space-y-1.5">
            {recent.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => { setOpen(false); onNavigate && onNavigate("intel"); }}
                title={`${KIND_LABELS[e.kind] || e.kind} — toca para veres ações recomendadas`}
                className="flex w-full items-start gap-1.5 rounded px-1 text-left transition-colors hover:bg-white/5"
              >
                <span className="shrink-0 pt-0.5" style={{ color: KIND_COLORS[e.kind] || "#8E8E93" }}>▸</span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] leading-snug text-zinc-300">{parseActivityMessage(e.message)}</p>
                  <p className="font-mono text-[9px] text-zinc-600">{absTime(e.ts)}</p>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}
      <button
        data-testid="activity-feed-mobile-toggle"
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="pointer-events-auto flex w-full items-center gap-1.5 rounded-md border border-border bg-card/90 px-3 py-1.5 text-left backdrop-blur-xl"
      >
        <span className="shrink-0" style={{ color: KIND_COLORS[latest.kind] || "#8E8E93" }}>▸</span>
        <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-zinc-400">{parseActivityMessage(latest.message)}</span>
        <span className="shrink-0 font-mono text-[9px] text-zinc-600">{relTime(latest.ts, serverNow())}</span>
      </button>
    </div>
  );
};
