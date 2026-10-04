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
  <Tip tip={tip} side="bottom" className="h-full w-full min-w-0">
    <div
      data-testid={testId}
      className={`sub-minimal-stat flex h-full w-full min-w-0 flex-col items-center justify-center gap-1 px-1.5 py-2 text-center ${className}`}
    >
      <span className="sub-resource-heading flex min-w-0 items-center justify-center gap-1">
        <span className="sub-resource-icon flex h-5 w-5 shrink-0 items-center justify-center">
          <Icon size={13} style={{ color }} />
        </span>
        <span className="sub-resource-label block whitespace-nowrap text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-zinc-600">
          {label}
        </span>
      </span>
      <span className="sub-resource-value block w-full min-w-0 whitespace-nowrap text-center font-mono text-[11px] font-bold leading-tight tabular-nums text-zinc-100 sm:text-[13px]">
        {value}
      </span>
    </div>
  </Tip>
);
