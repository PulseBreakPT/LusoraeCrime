import { useEffect, useRef } from "react";
import { useGame } from "../../context/GameContextV2";
import { fmtMoneyShort, heatStatus } from "../../lib/game";
import { Tip, AnimatedNumber, useFlash } from "./hud";
import { Banknote, Coins, Flame, Trophy } from "lucide-react";

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
  const hs = heatStatus(p.heat);
  const nextRespect = p.next_level_respect;
  const respectTip = nextRespect
    ? `Nível ${p.level} · ${p.respect}/${nextRespect} de respeito. Faltam ${Math.max(0, nextRespect - p.respect)} para o nível ${p.level + 1}.`
    : `Nível ${p.level} · ${p.respect} de respeito · nível máximo.`;

  return (
    <div
      data-testid="resource-bar"
      className="pointer-events-auto absolute left-2 right-2 top-2 z-20 animate-slide-down"
    >
      <div className="lus-topbar mx-auto flex w-fit max-w-full items-center gap-2 px-1 py-1 sm:gap-3">
        <Tip tip={respectTip} side="bottom" align="start">
          <div className={`lus-minimal-stat lus-level-readout flex shrink-0 items-center gap-1.5 px-1 ${respectFlash ? "lus-flash-blue" : ""}`}>
            <span className="font-mono text-[13px] font-black leading-none text-red-400 sm:text-sm">
              LV {p.level}
            </span>
            <span className="flex items-center gap-1 font-mono text-[11px] font-bold text-zinc-300">
              <Trophy size={12} className="text-sky-400" />
              {p.respect}
            </span>
          </div>
        </Tip>

        <Stat
          testId="stat-clean-money"
          icon={Banknote}
          color="#10B981"
          value={<AnimatedNumber value={p.clean_money} format={fmtMoneyShort} />}
          tip="Dinheiro limpo disponível para compras, salários, reparações e subornos."
          className={moneyFlash ? "lus-flash" : ""}
        />

        <Stat
          testId="stat-dirty-money"
          icon={Coins}
          color="#F59E0B"
          value={<AnimatedNumber value={p.dirty_money} format={fmtMoneyShort} />}
          tip="Dinheiro sujo. Lava-o no Império antes de o poderes gastar."
          className={dirtyFlash ? "lus-flash-amber" : ""}
        />

        <Tip tip={`Calor policial: ${hs.label}. ${hs.desc}`} side="bottom" align="end">
          <div data-testid="stat-heat" className="lus-minimal-stat flex shrink-0 items-center gap-1.5 px-1">
            <Flame size={15} className="shrink-0" style={{ color: hs.color }} />
            <span className="font-mono text-[13px] font-bold leading-none text-white sm:text-sm">
              {Math.round(p.heat)}%
            </span>
          </div>
        </Tip>
      </div>
    </div>
  );
};

const Stat = ({ icon: Icon, color, value, tip, testId, className = "" }) => (
  <Tip tip={tip} side="bottom" className="min-w-0">
    <div data-testid={testId} className={`lus-minimal-stat flex min-w-0 items-center gap-1.5 px-1 ${className}`}>
      <Icon size={15} className="shrink-0" style={{ color }} />
      <span className="truncate font-mono text-[13px] font-bold leading-none text-white sm:text-sm">
        {value}
      </span>
    </div>
  </Tip>
);
