import { useEffect, useState } from "react";
import { useGame } from "../../context/GameContext";
import { fmtMoney, fmtDuration, haversineM, CATEGORY_COLORS, TYPE_ICONS, SPEC_LABELS } from "../../lib/game";
import { Button } from "../ui/button";
import { X, Clock, TrendingUp, AlertTriangle } from "lucide-react";

export const OpportunityCard = ({ opp, onClose }) => {
  const { state, dispatchTeam, serverNow } = useGame();
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const tick = () => setTimeLeft((Date.parse(opp.expires_at) - serverNow()) / 1000);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [opp, serverNow]);

  if (!state) return null;
  const idleTeams = state.teams.filter((t) => t.status === "idle");
  const hq = state.player.hq;
  const Icon = TYPE_ICONS[opp.type_key] || TYPE_ICONS.assalto;
  const color = CATEGORY_COLORS[opp.category] || "#fff";
  const lockedByLevel = state.player.level < opp.min_level;

  const etaFor = (team) => {
    const dist = haversineM(hq.lat, hq.lng, opp.lat, opp.lng);
    return Math.max(20, dist / team.vehicle.speed);
  };

  const handleDispatch = async () => {
    if (!selectedTeamId) return;
    setBusy(true);
    const res = await dispatchTeam(opp.id, selectedTeamId);
    setBusy(false);
    if (res.ok) onClose();
  };

  return (
    <div
      data-testid="opportunity-card"
      className="pointer-events-auto absolute bottom-20 left-2 right-2 z-30 mx-auto max-w-sm animate-slide-up rounded-lg border border-white/10 bg-black/80 p-4 shadow-2xl backdrop-blur-xl"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md" style={{ background: `${color}22`, color }}>
            <Icon size={18} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-white">{opp.name}</h3>
            <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              {opp.district} · {SPEC_LABELS[opp.category]}
            </p>
          </div>
        </div>
        <button data-testid="opportunity-card-close" onClick={onClose} className="rounded p-1 text-zinc-500 transition-colors hover:text-white">
          <X size={16} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Metric icon={TrendingUp} label={opp.pays === "clean" ? "€ Limpos" : "€ Sujos"} value={fmtMoney(opp.reward)} color="#10B981" />
        <Metric icon={AlertTriangle} label="Risco" value={"●".repeat(opp.risk) + "○".repeat(5 - opp.risk)} color="#DC2626" />
        <Metric icon={Clock} label="Expira" value={fmtDuration(timeLeft)} color="#F59E0B" />
      </div>

      {lockedByLevel ? (
        <p className="mt-3 text-center font-mono text-xs text-red-500">Requer nível {opp.min_level}</p>
      ) : idleTeams.length === 0 ? (
        <p className="mt-3 text-center font-mono text-xs text-zinc-500">Nenhuma equipa disponível na base</p>
      ) : (
        <>
          <div className="mt-3 max-h-28 space-y-1 overflow-y-auto">
            {idleTeams.map((t) => {
              const match = t.spec === opp.category || opp.category === "especial";
              return (
                <button
                  key={t.id}
                  data-testid={`select-team-${t.id}`}
                  onClick={() => setSelectedTeamId(t.id)}
                  className={`flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-left transition-colors ${
                    selectedTeamId === t.id ? "border-white/40 bg-white/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
                  }`}
                >
                  <div>
                    <p className="text-xs font-semibold text-white">
                      {t.name}
                      {match && <span className="ml-1.5 font-mono text-[9px] uppercase text-emerald-400">match</span>}
                    </p>
                    <p className="font-mono text-[10px] text-zinc-500">
                      {SPEC_LABELS[t.spec]} · {t.vehicle.name}
                    </p>
                  </div>
                  <span className="font-mono text-[10px] text-cyan-400">ETA {fmtDuration(etaFor(t))}</span>
                </button>
              );
            })}
          </div>
          <Button
            data-testid="dispatch-team-button"
            onClick={handleDispatch}
            disabled={!selectedTeamId || busy}
            className="mt-3 w-full bg-red-600 font-bold uppercase tracking-wider text-white shadow-[0_0_15px_rgba(220,38,38,0.4)] transition-all duration-300 hover:bg-red-700"
          >
            {busy ? "A destacar..." : "Destacar equipa"}
          </Button>
        </>
      )}
    </div>
  );
};

const Metric = ({ icon: Icon, label, value, color }) => (
  <div className="rounded-md border border-white/10 bg-white/[0.03] p-2">
    <div className="flex items-center gap-1">
      <Icon size={10} style={{ color }} />
      <p className="text-[9px] uppercase tracking-wider text-zinc-500">{label}</p>
    </div>
    <p className="mt-0.5 font-mono text-xs font-bold text-white">{value}</p>
  </div>
);
