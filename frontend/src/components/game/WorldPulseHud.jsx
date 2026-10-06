import { CloudRain, CloudSun, Moon, RadioTower, ShieldAlert, Sun, Wifi, WifiOff } from "lucide-react";
import { Button } from "../ui/button";
import { Tip } from "./hud";

const signedPct = (value) => {
  const pct = Math.round(Number(value || 0) * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
};

const WeatherIcon = ({ keyName }) => {
  if (["chuva", "chuva_forte", "tempestade"].includes(keyName)) return <CloudRain size={15} aria-hidden="true" />;
  if (["noite"].includes(keyName)) return <Moon size={15} aria-hidden="true" />;
  if (["sol", "ceu_limpo"].includes(keyName)) return <Sun size={15} aria-hidden="true" />;
  return <CloudSun size={15} aria-hidden="true" />;
};

export const WorldPulseHud = ({ world, realtimeConnected, onOpen }) => {
  if (!world?.weather || !world?.event) return null;

  const modifiers = world.modifiers || {};
  const categorySignals = Object.entries(modifiers.chance || {})
    .filter(([, value]) => Math.abs(Number(value || 0)) >= 0.005)
    .sort((a, b) => Math.abs(Number(b[1])) - Math.abs(Number(a[1])))
    .slice(0, 2);

  const eventDanger = world.event?.severity === "high";
  const summary = [
    world.daypart?.name,
    world.weather?.name,
    world.event?.name,
  ].filter(Boolean).join(" · ");

  return (
    <Tip
      side="left"
      tip={`${summary}. Viagem ${signedPct((modifiers.travel_mult || 1) - 1)} · calor ${signedPct((modifiers.heat_mult || 1) - 1)} · recompensa ${signedPct((modifiers.reward_mult || 1) - 1)}.`}
    >
      <Button
        type="button"
        variant="bare"
        size="bare"
        data-testid="world-pulse-hud"
        aria-label={`Abrir Mundo — ${summary}`}
        onClick={onOpen}
        style={{ top: "calc(3.6rem + env(safe-area-inset-top, 0px))" }}
        className="sub-world-pulse-hud sub-optional-hud pointer-events-auto fixed right-2 z-[68] flex min-h-11 max-w-[min(19rem,calc(100vw-1rem))] items-center gap-2 rounded-xl border border-white/[0.08] bg-[#070709]/90 px-2.5 py-2 text-left shadow-[0_10px_28px_rgba(0,0,0,0.42)] backdrop-blur-sm transition-colors hover:bg-[#0d0d10]"
      >
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${eventDanger ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-cyan-500/20 bg-cyan-500/[0.07] text-cyan-300"}`}>
          {eventDanger ? <ShieldAlert size={15} aria-hidden="true" /> : <WeatherIcon keyName={world.weather?.key} />}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <RadioTower size={10} className="shrink-0 text-zinc-500" aria-hidden="true" />
            <span className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-300">
              {world.event?.name || "Mundo"}
            </span>
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 font-mono text-[9px] text-zinc-500">
            <span className="truncate">{world.daypart?.name} · {world.weather?.name}</span>
            {categorySignals.length > 0 && (
              <span className="hidden shrink-0 text-cyan-300 min-[430px]:inline">
                {categorySignals.map(([category, value]) => `${category.slice(0, 3).toUpperCase()} ${signedPct(value)}`).join(" · ")}
              </span>
            )}
          </span>
        </span>

        <span
          className={`inline-flex shrink-0 items-center gap-1 font-mono text-[9px] uppercase ${realtimeConnected ? "text-emerald-400" : "text-zinc-600"}`}
          aria-label={realtimeConnected ? "Atualização em tempo real ligada" : "Atualização periódica"}
        >
          {realtimeConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
          <span className="hidden min-[520px]:inline">{realtimeConnected ? "live" : "sync"}</span>
        </span>
      </Button>
    </Tip>
  );
};
