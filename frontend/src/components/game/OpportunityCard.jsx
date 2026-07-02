import { useEffect, useState } from "react";
import { useGame } from "../../context/GameContext";
import { fmtMoney, fmtDuration, haversineM, CATEGORY_COLORS, TYPE_ICONS, SPEC_LABELS } from "../../lib/game";
import { Button } from "../ui/button";
import { X, Clock, TrendingUp, AlertTriangle, Siren } from "lucide-react";

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
  const hq = state.player.hq;
  const Icon = TYPE_ICONS[opp.type_key] || TYPE_ICONS.assalto;
  const color = CATEGORY_COLORS[opp.category] || "#fff";
  const lockedByLevel = state.player.level < opp.min_level;
  const policeAlert = state.player.heat >= 90;
  const distM = haversineM(hq.lat, hq.lng, opp.lat, opp.lng);

  const readiness = (t) => {
    if (t.status !== "idle") return { ok: false, reason: "Em operação" };
    const members = state.employees.filter((e) => e.team_id === t.id);
    if (members.length === 0) return { ok: false, reason: "Sem membros" };
    const ready = members.filter((e) => e.status === "idle" && e.fatigue < 90);
    if (ready.length === 0) return { ok: false, reason: "Membros indisponíveis" };
    const vehicle = state.vehicles.find((v) => v.id === t.vehicle_id);
    if (!vehicle) return { ok: false, reason: "Sem veículo" };
    if (vehicle.condition < 30) return { ok: false, reason: "Veículo avariado" };
    const fuelNeeded = ((2 * distM) / 1000) * (vehicle.cons / 100);
    if (vehicle.fuel_l < fuelNeeded) return { ok: false, reason: "Sem combustível" };
    return { ok: true, members: ready.length, eta: Math.max(20, distM / vehicle.speed), vehicle };
  };

  const handleDispatch = async () => {
    if (!selectedTeamId) return;
    setBusy(true);
    const res = await dispatchTeam(opp.id, selectedTeamId);
    setBusy(false);
    if (res.ok) onClose();
  };

  const anyReady = state.teams.some((t) => readiness(t).ok);

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

      {policeAlert ? (
        <p className="mt-3 flex items-center justify-center gap-1.5 rounded-md border border-red-600/40 bg-red-600/10 py-2 text-center font-mono text-xs text-red-500">
          <Siren size={13} /> Polícia em alerta máximo — reduz o calor
        </p>
      ) : lockedByLevel ? (
        <p className="mt-3 text-center font-mono text-xs text-red-500">Requer nível {opp.min_level}</p>
      ) : (
        <>
          <div className="mt-3 max-h-32 space-y-1 overflow-y-auto">
            {state.teams.map((t) => {
              const r = readiness(t);
              const match = t.spec === opp.category || opp.category === "especial";
              return (
                <button
                  key={t.id}
                  data-testid={`select-team-${t.id}`}
                  onClick={() => r.ok && setSelectedTeamId(t.id)}
                  disabled={!r.ok}
                  className={`flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-left transition-colors ${
                    selectedTeamId === t.id
                      ? "border-white/40 bg-white/10"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
                  } ${!r.ok ? "opacity-45" : ""}`}
                >
                  <div>
                    <p className="text-xs font-semibold text-white">
                      {t.name}
                      {match && <span className="ml-1.5 font-mono text-[9px] uppercase text-emerald-400">match</span>}
                    </p>
                    <p className="font-mono text-[10px] text-zinc-500">
                      {r.ok ? `${r.members} membros · ${r.vehicle.name}` : SPEC_LABELS[t.spec]}
                    </p>
                  </div>
                  {r.ok ? (
                    <span className="font-mono text-[10px] text-cyan-400">ETA {fmtDuration(r.eta)}</span>
                  ) : (
                    <span className="font-mono text-[10px] text-red-400">{r.reason}</span>
                  )}
                </button>
              );
            })}
          </div>
          {!anyReady && (
            <p className="mt-2 text-center font-mono text-[10px] text-zinc-500">
              Nenhuma equipa operacional — verifica membros, combustível e condição
            </p>
          )}
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
