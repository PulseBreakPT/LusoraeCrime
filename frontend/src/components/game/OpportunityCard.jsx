import { useEffect, useState } from "react";
import { useGame } from "../../context/GameContext";
import { fmtMoney, fmtDuration, haversineM, CATEGORY_COLORS, TYPE_ICONS, SPEC_LABELS, effectiveSpeed, chanceColor, pctSigned } from "../../lib/game";
import { Tip, Chip } from "./hud";
import { Button } from "../ui/button";
import { X, Clock, TrendingUp, AlertTriangle, Siren, Fuel, Wrench, Car, IdCard, MapPin, Timer, Trophy, Flame, Lock, Users, Sparkles } from "lucide-react";

export const OpportunityCard = ({ opp, onClose, onNavigate }) => {
  const {
    state, dispatchTeam, previewDispatch, serverNow, refuelVehicle, repairVehicle, assignVehicle, recallTeam,
    recommendTeamForOpportunity,
  } = useGame();
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [recommendedTeamId, setRecommendedTeamId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const inProgress = opp.status === "taken";
  const activeMission = inProgress && state ? state.missions.find((m) => m.opportunity_id === opp.id) : null;

  useEffect(() => {
    const tick = () => {
      if (inProgress && activeMission) {
        const nextAt = activeMission.phase === "en_route"
          ? activeMission.arrive_at
          : activeMission.phase === "operating"
          ? activeMission.finish_at
          : activeMission.return_at;
        setTimeLeft((Date.parse(nextAt) - serverNow()) / 1000);
      } else {
        setTimeLeft((Date.parse(opp.expires_at) - serverNow()) / 1000);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [opp, serverNow, inProgress, activeMission]);

  useEffect(() => {
    setPreview(null);
    if (!selectedTeamId || inProgress) return;
    let cancelled = false;
    previewDispatch(opp.id, selectedTeamId).then((r) => {
      if (!cancelled && r.ok) setPreview(r.data);
    });
    return () => { cancelled = true; };
  }, [selectedTeamId, opp.id, previewDispatch, inProgress]);

  // Ao abrir uma oportunidade, pré-seleciona automaticamente a equipa com maior
  // probabilidade de sucesso que cumpra mesmo os requisitos — o utilizador pode
  // sempre escolher outra equipa manualmente clicando numa linha diferente.
  useEffect(() => {
    setSelectedTeamId(null);
    setRecommendedTeamId(null);
    if (inProgress) return;
    let cancelled = false;
    recommendTeamForOpportunity(opp.id).then((r) => {
      if (cancelled) return;
      if (r.ok && r.data?.team_id) {
        setRecommendedTeamId(r.data.team_id);
        setSelectedTeamId(r.data.team_id);
      }
    });
    return () => { cancelled = true; };
  }, [opp.id, inProgress, recommendTeamForOpportunity]);

  if (!state) return null;
  const hq = state.player.hq;
  const Icon = TYPE_ICONS[opp.type_key] || TYPE_ICONS.assalto;
  const color = CATEGORY_COLORS[opp.category] || "#fff";
  const lockedByLevel = state.player.level < opp.min_level;
  const policeAlert = state.player.heat >= 90;
  const distM = haversineM(hq.lat, hq.lng, opp.lat, opp.lng);

  const readiness = (t) => {
    if (t.status !== "idle") return { ok: false, reason: "Em operação" };
    if (t.available_at && Date.parse(t.available_at) > serverNow()) return { ok: false, reason: "A reorganizar-se" };
    const members = state.employees.filter((e) => e.team_id === t.id);
    if (members.length === 0) return { ok: false, reason: "Sem membros" };
    const ready = members.filter((e) => e.status === "idle" && e.fatigue < 90);
    if (ready.length === 0) return { ok: false, reason: "Membros indisponíveis" };
    if (ready.length < opp.min_members) return { ok: false, reason: `Mín. ${opp.min_members} membros` };
    const vehicle = state.vehicles.find((v) => v.id === t.vehicle_id);
    if (!vehicle) return { ok: false, reason: "Sem veículo" };
    if (vehicle.condition < 30) return { ok: false, reason: "Veículo avariado" };
    const fuelNeeded = ((2 * distM) / 1000) * (vehicle.cons / 100);
    if (vehicle.fuel_l < fuelNeeded) return { ok: false, reason: "Sem combustível" };
    return { ok: true, members: ready.length, eta: Math.max(20, distM / effectiveSpeed(vehicle)), vehicle };
  };

  const handleDispatch = async () => {
    if (!selectedTeamId) return;
    setBusy(true);
    const res = await dispatchTeam(opp.id, selectedTeamId);
    setBusy(false);
    if (res.ok) onClose();
  };

  const anyReady = state.teams.some((t) => readiness(t).ok);

  const fixFor = (t, r) => {
    const money = state.player.clean_money;
    const vehicle = state.vehicles.find((v) => v.id === t.vehicle_id);
    if (r.reason === "Sem combustível" && vehicle) {
      const cost = Math.ceil((vehicle.tank_l - vehicle.fuel_l) * state.fuel_prices[vehicle.fuel_type]);
      return { icon: Fuel, label: fmtMoney(cost), color: "text-amber-400", can: money >= cost, run: () => refuelVehicle(vehicle.id) };
    }
    if (r.reason === "Veículo avariado" && vehicle) {
      const cost = Math.max(50, Math.round((100 - vehicle.condition) * vehicle.price * 0.002));
      return { icon: Wrench, label: fmtMoney(cost), color: "text-emerald-400", can: money >= cost, run: () => repairVehicle(vehicle.id) };
    }
    if (r.reason === "Sem veículo") {
      const free = state.vehicles.filter((v) => !v.team_id);
      if (free.length) return { icon: Car, label: free[0].name, color: "text-cyan-400", can: true, run: () => assignVehicle(free[0].id, t.id) };
      return { icon: Car, label: "Frota", color: "text-cyan-400", can: true, run: () => { onClose(); onNavigate && onNavigate("fleet"); } };
    }
    if (r.reason === "Sem membros" || r.reason === "Membros indisponíveis" || r.reason.startsWith("Mín. ")) {
      return { icon: IdCard, label: "RH", color: "text-emerald-400", can: true, run: () => { onClose(); onNavigate && onNavigate("employees"); } };
    }
    return null;
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

      <div className="mt-2 flex flex-wrap gap-1">
        <Chip icon={MapPin} value={`${(distM / 1000).toFixed(1)} km`} color="#22D3EE"
          tip="Distância do QG ao alvo — determina o tempo de viagem e o combustível gasto (ida e volta)." />
        <Chip icon={Timer} value={fmtDuration(opp.duration_s)} color="#A78BFA"
          tip="Duração da operação no local, sem contar as viagens." />
        <Chip icon={Trophy} value={`+${opp.respect}`} color="#0A84FF"
          tip="Respeito ganho em caso de sucesso — acumula para subir o nível da organização." />
        <Chip icon={Flame} value={`+${Math.round(opp.heat)}`} color="#EF4444"
          tip="Calor policial gerado por esta operação — sobe mesmo com sucesso." />
        {opp.min_level > 1 && (
          <Chip icon={Lock} value={`N${opp.min_level}`} color={lockedByLevel ? "#EF4444" : "#71717A"}
            tip={`Nível mínimo da organização para esta operação: ${opp.min_level}.`} />
        )}
        {opp.min_members > 1 && (
          <Chip icon={Users} value={`Mín. ${opp.min_members}`} color="#71717A"
            tip={`Esta operação é de risco ${opp.risk}/5 e requer pelo menos ${opp.min_members} membros disponíveis na equipa para poder ser despachada.`} />
        )}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <Metric icon={TrendingUp} label={opp.pays === "clean" ? "€ Limpos" : "€ Sujos"} value={fmtMoney(opp.reward)} color="#10B981"
          tip={(opp.pays === "clean" ? "Pago em dinheiro limpo — pronto a gastar, sem lavagem." : "Pago em dinheiro sujo — terás de o lavar (taxa 25%) antes de gastar.") + " Só é creditado quando a equipa regressar ao QG (a polícia pode perseguir)."} />
        <Metric icon={AlertTriangle} label="Risco" value={"●".repeat(opp.risk) + "○".repeat(5 - opp.risk)} color="#DC2626"
          tip={`Risco ${opp.risk}/5 — reduz a probabilidade de sucesso e aumenta a chance de ferimentos, detenções e interceção policial.`} />
        <Metric
          icon={Clock}
          label={inProgress && activeMission ? (activeMission.phase === "en_route" ? "Chega em" : activeMission.phase === "operating" ? "Conclui" : "Regressa") : "Expira"}
          value={fmtDuration(timeLeft)}
          color="#F59E0B"
          tip={inProgress ? "Tempo até à próxima fase da missão em curso." : "Tempo até esta oportunidade desaparecer do mapa. Despacha uma equipa antes disso."}
        />
      </div>

      {inProgress && activeMission ? (
        <div data-testid="opportunity-in-progress" className={`mt-3 rounded-md border p-3 ${activeMission.chase_active ? "border-red-500/40 bg-red-500/[0.08]" : "border-cyan-500/30 bg-cyan-500/[0.06]"}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-white">{activeMission.team_name}</p>
              <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: activeMission.chase_active && activeMission.phase === "returning" ? "#EF4444" : "#22D3EE" }}>
                {activeMission.chase_active && activeMission.phase === "returning"
                  ? "PERSEGUIÇÃO POLICIAL"
                  : activeMission.phase === "en_route"
                  ? "A caminho do alvo"
                  : activeMission.phase === "operating"
                  ? "Em operação no alvo"
                  : "A regressar à base"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-wider text-zinc-500">
                {activeMission.chase_active && activeMission.phase === "returning" ? "Escape" : "Sucesso previsto"}
              </p>
              <p className="font-mono text-sm font-bold" style={{
                color: activeMission.chase_active && activeMission.phase === "returning"
                  ? "#EF4444"
                  : chanceColor(activeMission.success_chance || 0.5)
              }}>
                {activeMission.chase_active && activeMission.phase === "returning"
                  ? `${Math.round((activeMission.escape_chance || 0.5) * 100)}%`
                  : `${Math.round((activeMission.success_chance || 0) * 100)}%`}
              </p>
            </div>
          </div>
          {activeMission.outcome === "success" && Number(activeMission.pending_reward || 0) > 0 && (
            <div className="mt-2 flex items-center justify-between rounded border border-amber-500/20 bg-amber-500/[0.06] px-2 py-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-amber-300">Carga a transportar</span>
              <span className="font-mono text-xs font-bold text-amber-200">
                {fmtMoney(activeMission.pending_reward)} {activeMission.pending_pays === "clean" ? "limpos" : "sujos"}
              </span>
            </div>
          )}
          <p className="mt-2 font-mono text-[10px] leading-snug text-zinc-500">
            {activeMission.chase_active && activeMission.phase === "returning"
              ? "Um carro-patrulha segue a equipa. Se apanhados antes do QG, perdem toda a carga."
              : "A missão está em curso — a recompensa só cai na conta quando a equipa chegar ao QG."}
          </p>
          {activeMission.phase === "en_route" && (
            <Button
              data-testid="recall-team-button"
              onClick={async () => { setBusy(true); await recallTeam(activeMission.id); setBusy(false); onClose(); }}
              disabled={busy}
              className="mt-2 w-full bg-zinc-800 font-bold uppercase tracking-wider text-white hover:bg-zinc-700"
            >
              {busy ? "A chamar..." : "Chamar equipa de volta"}
            </Button>
          )}
        </div>
      ) : policeAlert ? (
        <p className="mt-3 flex items-center justify-center gap-1.5 rounded-md border border-red-600/40 bg-red-600/10 py-2 text-center font-mono text-xs text-red-500">
          <Siren size={13} /> Polícia em alerta máximo — reduz o calor
        </p>
      ) : lockedByLevel ? (
        <p className="mt-3 text-center font-mono text-xs text-red-500">Requer nível {opp.min_level}</p>
      ) : (
        <>
          <div className="mt-3 max-h-36 space-y-1 overflow-y-auto">
            {state.teams.map((t) => {
              const r = readiness(t);
              const match = t.spec === opp.category || opp.category === "especial";
              const fix = !r.ok ? fixFor(t, r) : null;
              return (
                <div
                  key={t.id}
                  data-testid={`select-team-${t.id}`}
                  onClick={() => r.ok && setSelectedTeamId(t.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors ${
                    selectedTeamId === t.id
                      ? "border-white/40 bg-white/10"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
                  } ${r.ok ? "cursor-pointer" : ""}`}
                >
                  <div className={r.ok ? "" : "opacity-50"}>
                    <p className="text-xs font-semibold text-white">
                      {t.name}
                      {t.id === recommendedTeamId && (
                        <Tip tip="Sugestão automática: a equipa com maior probabilidade de sucesso para esta operação. Podes escolher outra clicando nela.">
                          <span className="ml-1.5 inline-flex items-center gap-0.5 font-mono text-[9px] uppercase text-amber-400">
                            <Sparkles size={9} /> recomendada
                          </span>
                        </Tip>
                      )}
                      {match && (
                        <Tip tip="A especialização da equipa combina com a categoria da operação — bónus de probabilidade de sucesso.">
                          <span className="ml-1.5 font-mono text-[9px] uppercase text-emerald-400">match</span>
                        </Tip>
                      )}
                    </p>
                    <p className="font-mono text-[10px] text-zinc-500">
                      {r.ok ? `${r.members} membros · ${r.vehicle.name}` : SPEC_LABELS[t.spec]}
                    </p>
                  </div>
                  {r.ok ? (
                    <Tip tip={`Tempo estimado de viagem até ao alvo com o ${r.vehicle.name}.`} align="end">
                      <span className="font-mono text-[10px] text-cyan-400">ETA {fmtDuration(r.eta)}</span>
                    </Tip>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="font-mono text-[10px] text-red-400">{r.reason}</span>
                      {fix && (
                        <button
                          data-testid={`fix-team-${t.id}`}
                          onClick={(ev) => { ev.stopPropagation(); fix.run(); }}
                          disabled={!fix.can}
                          title={r.reason}
                          className={`flex items-center gap-1 rounded border border-white/15 px-1.5 py-1 font-mono text-[9px] font-bold ${fix.color} transition-colors hover:bg-white/10 disabled:opacity-40`}
                        >
                          <fix.icon size={10} /> {fix.label}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {!anyReady && (
            <p className="mt-2 text-center font-mono text-[10px] text-zinc-500">
              Nenhuma equipa operacional — verifica membros, combustível e condição
            </p>
          )}
          {preview && (
            <div data-testid="dispatch-preview" className="mt-2 animate-slide-up rounded-md border border-white/10 bg-white/[0.03] p-2.5">
              <div className="flex items-baseline justify-between">
                <p className="text-[9px] uppercase tracking-wider text-zinc-500">Probabilidade de sucesso</p>
                <p className="font-mono text-lg font-bold" style={{ color: chanceColor(preview.chance) }}>
                  {Math.round(preview.chance * 100)}%
                </p>
              </div>
              <div className="mt-1 grid grid-cols-5 gap-1">
                <PreviewFactor label="Risco" value={preview.breakdown.risco} tip="Penalização base do risco da operação." />
                <PreviewFactor label="Equipa" value={preview.breakdown.equipa} tip="Competência dos membros nos atributos relevantes." />
                <PreviewFactor label="Match" value={preview.breakdown.match} tip="Compatibilidade entre a especialização da equipa e a categoria da operação." />
                <PreviewFactor label="Calor" value={preview.breakdown.calor} tip="Pressão policial atual — quanto mais calor, pior." />
                <PreviewFactor
                  label="Coord."
                  value={preview.breakdown.coordenacao}
                  tip="Coordenação da equipa: penaliza sem líder (patente de chefe de equipa ou acima) ou com um único membro; premeia veterania (tempo desde a última alteração de membros) e homogeneidade de especialização."
                />
              </div>
              <p className="mt-1.5 font-mono text-[10px] text-zinc-400">
                <span className="text-emerald-400">{fmtMoney(preview.reward)}</span>
                {preview.reward_bonus_pct > 0 && <span className="text-cyan-400"> (+{preview.reward_bonus_pct}% imóveis)</span>}
                <span className="text-[#0A84FF]"> · +{opp.respect} resp.</span>
                {" · "}{preview.fuel_needed}L comb. · ETA {fmtDuration(preview.eta_s)} · op. {fmtDuration(preview.duration_s)}
              </p>
            </div>
          )}
          <Button
            data-testid="dispatch-team-button"
            onClick={handleDispatch}
            disabled={!selectedTeamId || busy}
            className="mt-3 w-full bg-green-600 font-bold uppercase tracking-wider text-white shadow-[0_0_15px_rgba(22,163,74,0.4)] transition-all duration-300 hover:bg-green-700"
          >
            {busy ? "A destacar..." : "Destacar equipa"}
          </Button>
        </>
      )}
    </div>
  );
};

const PreviewFactor = ({ label, value, tip }) => (
  <Tip tip={tip} block>
    <div className="rounded bg-black/40 px-1 py-0.5 text-center">
      <p className="text-[8px] uppercase tracking-wider text-zinc-600">{label}</p>
      <p className="font-mono text-[10px] font-bold" style={{ color: value >= 0 ? "#34D399" : "#EF4444" }}>
        {pctSigned(value)}
      </p>
    </div>
  </Tip>
);

const Metric = ({ icon: Icon, label, value, color, tip }) => (
  <Tip tip={tip} block>
    <div className="h-full rounded-md border border-white/10 bg-white/[0.03] p-2">
      <div className="flex items-center gap-1">
        <Icon size={10} style={{ color }} />
        <p className="text-[9px] uppercase tracking-wider text-zinc-500">{label}</p>
      </div>
      <p className="mt-0.5 font-mono text-xs font-bold text-white">{value}</p>
    </div>
  </Tip>
);
