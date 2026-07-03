import { useGame } from "../../context/GameContext";

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

export const ActivityFeed = () => {
  const { state, serverNow } = useGame();
  if (!state) return null;

  return (
    <div
      data-testid="activity-feed"
      className="pointer-events-auto absolute bottom-20 left-2 z-20 hidden w-80 animate-slide-up rounded-lg border border-white/10 bg-black/75 shadow-2xl backdrop-blur-xl md:block"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
          <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-600" />
          Atividade da rede
        </p>
        <span className="font-mono text-[9px] text-zinc-600">{state.events.length} registos</span>
      </div>
      <div className="max-h-44 space-y-1 overflow-y-auto p-2">
        {state.events.length === 0 && (
          <p className="px-1 font-mono text-[11px] text-zinc-600">Sem atividade registada.</p>
        )}
        {state.events.map((e) => (
          <p key={e.id} className="flex items-baseline gap-1.5 px-1 font-mono text-[11px] leading-snug text-zinc-400" title={KIND_LABELS[e.kind] || e.kind}>
            <span className="shrink-0" style={{ color: KIND_COLORS[e.kind] || "#8E8E93" }}>▸</span>
            <span className="min-w-0 flex-1">{e.message}</span>
            <span className="shrink-0 text-[9px] text-zinc-600">{relTime(e.ts, serverNow())}</span>
          </p>
        ))}
      </div>
    </div>
  );
};

export const ActivityFeedMobile = () => {
  const { state, serverNow } = useGame();
  if (!state || state.events.length === 0) return null;
  const latest = state.events[0];
  return (
    <div
      data-testid="activity-feed-mobile"
      className="pointer-events-none absolute bottom-[4.2rem] left-2 right-2 z-20 md:hidden"
    >
      <p className="truncate rounded-md border border-white/10 bg-black/75 px-3 py-1.5 font-mono text-[10px] text-zinc-400 backdrop-blur-xl">
        <span style={{ color: KIND_COLORS[latest.kind] || "#8E8E93" }}>▸</span> {latest.message}{" "}
        <span className="text-zinc-600">· {relTime(latest.ts, serverNow())}</span>
      </p>
    </div>
  );
};
