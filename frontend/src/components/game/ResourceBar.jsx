import { useEffect, useRef } from "react";
import { useGame } from "../../context/GameContextV2";
import { fmtMoneyShort } from "../../lib/game";
import { Tip, AnimatedNumber, useFlash } from "./hud";
import { Banknote, Coins, Trophy, Shield } from "lucide-react";

export const ResourceBar = () => {
  const { state } = useGame();
  const prevCleanRef = useRef(null);
  const prevDirtyRef = useRef(null);
  const prevRespectRef = useRef(null);

  const moneyIn = state && prevCleanRef.current != null && state.player.clean_money > prevCleanRef.current;
  const dirtyIn = state && prevDirtyRef.current != null && state.player.dirty_money > prevDirtyRef.current;
  const respectIn = state && prevRespectRef.current != null && state.player.respect > prevRespectRef.current;

  const moneyFlash = useFlash(moneyIn ? state.player.clean_money : null);
  const dirtyFlash = useFlash(dirtyIn ? state.player.dirty_money : null);
  const respectFlash = useFlash(respectIn ? state.player.respect : null);

  useEffect(() => {
    if (!state) return;
    prevCleanRef.current = state.player.clean_money;
    prevDirtyRef.current = state.player.dirty_money;
    prevRespectRef.current = state.player.respect;
  }, [state]);

  if (!state) return null;

  const p = state.player;
  const nextRespect = p.next_level_respect;
  const respectTip = nextRespect
    ? `Nível ${p.level} · ${p.respect}/${nextRespect} de respeito. Faltam ${Math.max(0, nextRespect - p.respect)} para o nível ${p.level + 1}.`
    : `Nível ${p.level} · ${p.respect} de respeito · nível máximo.`;

  return (
    <div
      data-testid="resource-bar"
      className="pointer-events-auto absolute left-2 right-2 top-2 z-20 animate-slide-down"
    >
      <div className="sub-topbar sub-resource-grid mx-auto grid w-full max-w-[34rem] overflow-hidden rounded-xl sm:w-auto">
        <Stat
          testId="stat-level"
          icon={Shield}
          color="#F87171"
          label="Nível"
          value={p.level}
          tip={respectTip}
          className="sub-level-readout"
        />

        <Stat
          testId="stat-respect"
          icon={Trophy}
          color="#7DD3FC"
          label="Pontos"
          value={<AnimatedNumber value={p.respect} />}
          tip={respectTip}
          className={respectFlash ? "sub-flash-blue" : ""}
        />

        <Stat
          testId="stat-clean-money"
          icon={Banknote}
          color="#34D399"
          label="Dinheiro"
          value={<AnimatedNumber value={p.clean_money} format={fmtMoneyShort} />}
          tip="Dinheiro limpo disponível para compras, salários, reparações e subornos."
          className={moneyFlash ? "sub-flash" : ""}
        />

        <Stat
          testId="stat-dirty-money"
          icon={Coins}
          color="#FBBF24"
          label="Sujo"
          value={<AnimatedNumber value={p.dirty_money} format={fmtMoneyShort} />}
          tip="Dinheiro sujo. Lava-o no Império antes de o poderes gastar."
          className={dirtyFlash ? "sub-flash-amber" : ""}
        />
      </div>
    </div>
  );
};

const Stat = ({ icon: Icon, color, label, value, tip, testId, className = "" }) => (
  <Tip tip={tip} side="bottom" className="min-w-0">
    <div data-testid={testId} className={`sub-minimal-stat flex min-w-0 items-center gap-2 px-2.5 py-2 ${className}`}>
      <span className="sub-resource-icon flex h-6 w-6 shrink-0 items-center justify-center">
        <Icon size={14} style={{ color }} />
      </span>
      <span className="min-w-0">
        <span className="sub-resource-label block truncate text-[9px] font-semibold uppercase leading-none tracking-[0.11em] text-zinc-600">
          {label}
        </span>
        <span className="mt-1 block whitespace-nowrap font-mono text-[11px] font-bold leading-none tabular-nums text-zinc-100 sm:text-[13px]">
          {value}
        </span>
      </span>
    </div>
  </Tip>
);
