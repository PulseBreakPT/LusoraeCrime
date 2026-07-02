import { useGame } from "../../context/GameContext";
import { fmtMoney } from "../../lib/game";
import { Banknote, Coins, Flame, Trophy } from "lucide-react";

export const ResourceBar = () => {
  const { state } = useGame();
  if (!state) return null;
  const p = state.player;
  const nextRespect = p.next_level_respect;

  return (
    <div data-testid="resource-bar" className="pointer-events-auto absolute left-2 right-2 top-2 z-20 animate-slide-down">
      <div className="mx-auto flex max-w-3xl items-center gap-2 overflow-x-auto rounded-lg border border-white/10 bg-black/75 px-3 py-2 shadow-2xl backdrop-blur-xl">
        <div className="flex shrink-0 items-center gap-2 border-r border-white/10 pr-3">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-red-600/20 font-mono text-xs font-bold text-red-500">
            {p.level}
          </span>
          <div className="hidden sm:block">
            <p className="max-w-[120px] truncate text-xs font-semibold text-white">{p.org_name}</p>
            <p className="font-mono text-[10px] text-zinc-500">
              {nextRespect ? `${p.respect}/${nextRespect} resp.` : "nível máx."}
            </p>
          </div>
        </div>

        <Stat testId="stat-clean-money" icon={Banknote} color="#10B981" label="Limpo" value={fmtMoney(p.clean_money)} />
        <Stat testId="stat-dirty-money" icon={Coins} color="#F59E0B" label="Sujo" value={fmtMoney(p.dirty_money)} />
        <Stat testId="stat-respect" icon={Trophy} color="#0A84FF" label="Respeito" value={p.respect} />
        <Stat testId="stat-heat" icon={Flame} color="#DC2626" label="Calor" value={`${Math.round(p.heat)}%`} />
      </div>
    </div>
  );
};

const Stat = ({ icon: Icon, color, label, value, testId }) => (
  <div data-testid={testId} className="flex shrink-0 items-center gap-1.5 px-1">
    <Icon size={14} style={{ color }} />
    <div>
      <p className="hidden text-[9px] uppercase tracking-wider text-zinc-500 md:block">{label}</p>
      <p className="font-mono text-xs font-bold text-white">{value}</p>
    </div>
  </div>
);
