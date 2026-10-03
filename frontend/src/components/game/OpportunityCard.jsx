import { useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "../../context/GameContextV2";
import { useSettings } from "../../context/SettingsContext";
import {
  fmtMoney, fmtDuration, haversineM, CATEGORY_COLORS, TYPE_ICONS, SPEC_LABELS, effectiveSpeed,
  chanceColor, chanceQualityLabel, pctSigned, MODIFIER_CATEGORY_LABELS, teamReadiness,
} from "../../lib/game";
import { Tip, Chip } from "./hud";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription } from "../ui/alert";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "../ui/select";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../ui/accordion";
import { X, Clock, TrendingUp, AlertTriangle, Siren, Fuel, Wrench, Car, IdCard, MapPin, Timer, Trophy, Flame, Lock, Users, Sparkles, Star, ChevronDown } from "lucide-react";
import { audio } from "../../lib/audio";

// Força de segurança competente pela zona (do backend, opp.police_force) — diz
// ao jogador quem responde ali e como isso mexe no risco real. Escalável: mais
// uma força = mais uma entrada.
const safeRiskLevel = (value) => Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
const safeRiskDots = (value) => {
  const risk = safeRiskLevel(value);
  return "●".repeat(risk) + "○".repeat(5 - risk);
};

const POLICE_FORCE_INFO = {
  PSP: { label: "PSP · urbana", color: "#3B82F6",
    tip: "Zona urbana sob competência da PSP — malha policial densa e resposta rápida: operar aqui é mais arriscado e a fuga é mais difícil." },
  GNR: { label: "GNR · rural", color: "#22C55E",
    tip: "Zona rural/estrada sob competência da GNR — patrulhas dispersas por muito terreno: menos vigilância e fuga mais fácil." },
};

export const OpportunityCard = ({ opp, onClose, onNavigate }) => {
  const {
    state, catalog, dispatchTeam, previewDispatch, serverNow, refuelVehicle, repairVehicle, assignVehicle, recallTeam,
    recommendTeamForOpportunity, toggleFavoriteType,
  } = useGame();
  const { autoSelectBestTeam, lowSuccessThreshold } = useSettings();
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [recommendedTeamId, setRecommendedTeamId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [confirmLowChance, setConfirmLowChance] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showAdvancedSetup, setShowAdvancedSetup] = useState(false);
  const [chances, setChances] = useState({}); // teamId -> chance de sucesso (preview)
  const previewRef = useRef(null);
  const inProgress = opp.status === "taken";
  const activeMission = inProgress && state ? state.missions.find((m) => m.opportunity_id === opp.id) : null;
  // Nunca devolve vazio — QG é sempre o fallback quando a missão não tem propriedade de origem.
  const baseNameOf = (propertyId) => {
    if (!propertyId) return "Quartel-General";
    return state?.properties?.find((p) => p.id === propertyId)?.name || "Quartel-General";
  };

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
    setConfirmLowChance(false);
    setShowDetails(false);
    setShowAdvancedSetup(false);
    if (!selectedTeamId || inProgress) return;
    let cancelled = false;
    previewDispatch(opp.id, selectedTeamId).then((r) => {
      if (!cancelled && r.ok) setPreview(r.data);
    });
    return () => { cancelled = true; };
  }, [selectedTeamId, opp.id, previewDispatch, inProgress]);

  useEffect(() => {
    if (!confirmLowChance) return;
    const id = setTimeout(() => setConfirmLowChance(false), 4000);
    return () => clearTimeout(id);
  }, [confirmLowChance]);

  // O corpo do cartão é rolável em ecrãs baixos — quando o preview de
  // probabilidade chega (ou os detalhes expandem), garante que fica visível
  // sem o jogador ter de perceber que há scroll.
  useEffect(() => {
    if ((preview || showDetails) && previewRef.current) {
      previewRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [preview, showDetails]);

  // Ao abrir uma oportunidade, pré-seleciona automaticamente a equipa com maior
  // probabilidade de sucesso que cumpra mesmo os requisitos — o utilizador pode
  // sempre escolher outra equipa manualmente clicando numa linha diferente.
  // Toque de abertura ao selecionar uma operação no mapa — os marcadores do
  // Leaflet não são <button>, por isso o som global de interface não os cobre.
  useEffect(() => {
    audio.sfx.notify();
  }, [opp.id]);

  // Veredicto de prontidão via helper unificado (mesma definição do TeamsPanel e
  // de opportunityReachable) — memoizado para não recalcular O(equipas×funcionários)
  // a cada segundo (o cartão re-renderiza no timer da contagem).
  const readyMap = useMemo(() => {
    const m = new Map();
    for (const t of state?.teams || []) {
      m.set(t.id, teamReadiness(state, catalog, t, { opp, now: serverNow() }));
    }
    return m;
    // serverNow é estável (useCallback); recalcula quando o estado/opp/catálogo mudam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, catalog, opp]);

  // Chave estável do conjunto de equipas prontas — só refaz os previews quando
  // esse conjunto muda (evita martelar o servidor a cada poll).
  const readyIdsKey = (state?.teams || [])
    .filter((t) => readyMap.get(t.id)?.ok).map((t) => t.id).sort().join(",");

  useEffect(() => {
    setSelectedTeamId(null);
    setRecommendedTeamId(null);
    if (inProgress) return;
    let cancelled = false;
    recommendTeamForOpportunity(opp.id).then((r) => {
      if (cancelled) return;
      let best = r.ok && r.data?.team_id ? r.data.team_id : null;
      // Fallback local quando o servidor não recomenda: melhor equipa pronta por
      // ETA (proxy antes de as chances chegarem).
      if (!best) {
        const ready = (state?.teams || [])
          .map((t) => ({ t, rr: readyMap.get(t.id) }))
          .filter((x) => x.rr?.ok)
          .sort((a, b) => (a.rr.eta || 0) - (b.rr.eta || 0));
        best = ready[0]?.t.id || null;
      }
      if (best) {
        setRecommendedTeamId(best);
        if (autoSelectBestTeam) setSelectedTeamId(best);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opp.id, inProgress, recommendTeamForOpportunity, autoSelectBestTeam]);

  // Chances de sucesso por equipa pronta (comparação lado-a-lado sem clicar cada
  // uma). Limitado a ~6 previews em paralelo; refaz-se só quando muda o conjunto.
  useEffect(() => {
    if (inProgress) { setChances({}); return; }
    const targets = (state?.teams || []).filter((t) => readyMap.get(t.id)?.ok).slice(0, 6);
    if (!targets.length) { setChances({}); return; }
    let cancelled = false;
    Promise.all(targets.map((t) =>
      previewDispatch(opp.id, t.id)
        .then((r) => [t.id, r.ok ? r.data.chance : null])
        .catch(() => [t.id, null])
    )).then((pairs) => {
      if (cancelled) return;
      const map = {};
      for (const [id, c] of pairs) if (c != null) map[id] = c;
      setChances(map);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opp.id, inProgress, readyIdsKey, previewDispatch]);

  // Oportunidade expirou com o cartão aberto → fecha automaticamente (o despacho
  // já fica bloqueado abaixo; isto evita a janela entre polls em que se podia
  // despachar para algo já expirado).
  const expired = !inProgress && timeLeft <= 0;
  useEffect(() => {
    if (!expired) return;
    const id = setTimeout(() => onClose(), 1500);
    return () => clearTimeout(id);
  }, [expired, onClose]);

  if (!state) return null;
  const hq = state.player.hq;
  const Icon = TYPE_ICONS[opp.type_key] || TYPE_ICONS.assalto;
  const color = CATEGORY_COLORS[opp.category] || "#fff";
  const lockedByLevel = state.player.level < opp.min_level;
  const policeAlert = state.player.heat >= 90;
  const distM = haversineM(hq.lat, hq.lng, opp.lat, opp.lng);
  const isFavorite = (state.player.favorite_types || []).includes(opp.type_key);

  // Veredicto de prontidão via helper unificado (readyMap memoizado acima).
  const readiness = (t) => readyMap.get(t.id) || teamReadiness(state, catalog, t, { opp, now: serverNow() });

  const lowChanceThreshold = catalog?.low_chance_confirm_threshold;
  const isLowChance = preview && lowChanceThreshold != null && preview.chance < lowChanceThreshold;

  const handleDispatch = async () => {
    if (!selectedTeamId || expired) return;
    if (isLowChance && !confirmLowChance) {
      setConfirmLowChance(true);
      return;
    }
    setConfirmLowChance(false);
    setBusy(true);
    const res = await dispatchTeam(opp.id, selectedTeamId);
    setBusy(false);
    if (res.ok) {
      const teamName = state.teams.find((t) => t.id === selectedTeamId)?.name;
      window.dispatchEvent(new CustomEvent("lus:dispatch-stamp", { detail: { team: teamName } }));
      onClose();
    }
  };

  const anyReady = state.teams.some((t) => readiness(t).ok);
  const selectedTeam = state.teams.find((t) => t.id === selectedTeamId) || null;
  const selectedTeamReadiness = selectedTeam ? readiness(selectedTeam) : null;

  const fixFor = (t, r) => {
    const money = state.player.clean_money;
    const vehicle = state.vehicles.find((v) => v.id === t.vehicle_id);
    if (r.reason === "Sem combustível" && vehicle) {
      const cost = Math.ceil((vehicle.tank_l - vehicle.fuel_l) * state.fuel_prices[vehicle.fuel_type]);
      const can = money >= cost;
      return { icon: Fuel, label: fmtMoney(cost), color: can ? "text-amber-400" : "text-red-400", can, run: () => refuelVehicle(vehicle.id) };
    }
    if (r.reason === "Veículo avariado" && vehicle) {
      const cost = Math.max(50, Math.round((100 - vehicle.condition) * vehicle.price * 0.002));
      const can = money >= cost;
      return { icon: Wrench, label: fmtMoney(cost), color: can ? "text-emerald-400" : "text-red-400", can, run: () => repairVehicle(vehicle.id) };
    }
    if (r.reason === "Sem veículo") {
      // Melhor veículo livre (maior condição) — não o primeiro arbitrário.
      const free = state.vehicles
        .filter((v) => !v.team_id && !v.transfer)
        .sort((a, b) => (b.condition || 0) - (a.condition || 0));
      if (free.length) return { icon: Car, label: free[0].name, color: "text-cyan-400", can: true, run: () => assignVehicle(free[0].id, t.id) };
      return { icon: Car, label: "Frota", color: "text-cyan-400", can: true, run: () => { onClose(); onNavigate && onNavigate("fleet"); } };
    }
    if (r.reason.startsWith("Poucos lugares")) {
      // Sugere um veículo livre com lugares suficientes para os membros prontos.
      const ready = state.employees.filter((e) => e.team_id === t.id && e.status === "idle" && e.fatigue < 90).length;
      const fit = state.vehicles.find(
        (v) => !v.team_id && !v.transfer && v.condition >= 30 && (catalog?.vehicle_models?.[v.model_key]?.seats ?? 99) >= ready
      );
      if (fit) return { icon: Car, label: fit.name, color: "text-cyan-400", can: true, run: () => assignVehicle(fit.id, t.id) };
      return { icon: Car, label: "Frota", color: "text-cyan-400", can: true, run: () => { onClose(); onNavigate && onNavigate("fleet"); } };
    }
    if (r.reason === "Veículo não adequado") {
      // Esta operação exige modelos específicos — sugere um da garagem se houver.
      const fit = state.vehicles.find(
        (v) => !v.team_id && !v.transfer && v.condition >= 30 && opp.required_models?.includes(v.model_key)
      );
      if (fit) return { icon: Car, label: fit.name, color: "text-cyan-400", can: true, run: () => assignVehicle(fit.id, t.id) };
      return { icon: Car, label: "Frota", color: "text-cyan-400", can: true, run: () => { onClose(); onNavigate && onNavigate("fleet"); } };
    }
    if (r.reason === "Sem membros" || r.reason === "Membros indisponíveis" || r.reason.startsWith("Mín. ")) {
      return { icon: IdCard, label: "Operacionais", color: "text-emerald-400", can: true, run: () => { onClose(); onNavigate && onNavigate("employees"); } };
    }
    return null;
  };

  return (
    <Card
      data-testid="opportunity-card"
      style={{
        "--mk": color,
        bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))",
        maxHeight: "min(calc(100dvh - 10rem), 40rem)",
      }}
      className="lus-opp-card pointer-events-auto absolute left-2 right-2 z-30 mx-auto flex max-w-sm animate-slide-up flex-col lus-panel p-4 shadow-2xl"
    >
      <div className="flex shrink-0 items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-md border"
            style={{ background: `${color}1e`, color, borderColor: `${color}44`, boxShadow: `0 0 16px ${color}2e, inset 0 1px 0 rgba(255,255,255,0.08)` }}
          >
            <Icon size={18} />
          </span>
          <div>
            <h3 className="font-display text-base font-bold uppercase leading-tight tracking-wide text-white">{opp.name}</h3>
            <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              {opp.district} · {SPEC_LABELS[opp.category]}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Tip tip={isFavorite ? "Remover dos favoritos." : "Marcar como favorita — este tipo de operação passa a aparecer destacado."}>
            <Button
              data-testid="opportunity-card-favorite"
              variant="ghost" size="icon"
              onClick={() => toggleFavoriteType(opp.type_key)}
              className={`h-7 w-7 ${isFavorite ? "text-amber-400 hover:text-amber-300" : "text-zinc-500 hover:text-white"}`}
            >
              <Star size={16} fill={isFavorite ? "currentColor" : "none"} />
            </Button>
          </Tip>
          <Button data-testid="opportunity-card-close" variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 text-zinc-500 hover:text-white">
            <X size={16} />
          </Button>
        </div>
      </div>

      {/* Corpo rolável único — em ecrãs baixos (preview + detalhes expandidos)
          tudo continua acessível; o cabeçalho e o botão de despacho ficam
          sempre fixos e visíveis. */}
      <div className="-mr-2 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2">
      <div className="mt-2 flex flex-wrap gap-1">
        <Chip icon={MapPin} value={`${(distM / 1000).toFixed(1)} km`} color="#22D3EE"
          tip="Distância do QG ao alvo — determina o tempo de viagem e o combustível gasto (ida e volta)." />
        <Chip icon={Timer} value={fmtDuration(opp.duration_s)} color="#A78BFA"
          tip="Duração da operação no local, sem contar as viagens." />
        <Chip icon={Trophy} value={`+${opp.respect}`} color="#0A84FF"
          tip="Respeito ganho em caso de sucesso — acumula para subir o nível da organização." />
        <Chip icon={Flame} value={`+${Math.round(opp.heat)}`} color="#EF4444"
          tip="Calor policial gerado por esta operação — sobe mesmo com sucesso." />
        {opp.hot && (
          <Chip icon={TrendingUp} value="Em alta +20%" color="#F59E0B"
            tip="Mercado dinâmico: esta categoria está em alta neste momento e a recompensa mostrada já inclui +20%. A categoria em alta roda a cada 6 horas." />
        )}
        {opp.police_force && POLICE_FORCE_INFO[opp.police_force] && (
          <Chip icon={Siren} value={POLICE_FORCE_INFO[opp.police_force].label}
            color={POLICE_FORCE_INFO[opp.police_force].color}
            tip={POLICE_FORCE_INFO[opp.police_force].tip} />
        )}
        {opp.min_level > 1 && (
          <Chip icon={Lock} value={`N${opp.min_level}`} color={lockedByLevel ? "#EF4444" : "#71717A"}
            tip={`Nível mínimo da organização para esta operação: ${opp.min_level}.`} />
        )}
        {opp.min_members > 1 && (
          <Chip icon={Users} value={`Mín. ${opp.min_members}`} color="#71717A"
            tip={`Esta operação é de risco ${safeRiskLevel(opp.risk)}/5 e requer pelo menos ${opp.min_members} membros disponíveis na equipa para poder ser despachada.`} />
        )}
        {opp.required_models?.length > 0 && (
          <Chip
            icon={Car}
            value={opp.required_models.map((m) => catalog?.vehicle_models?.[m]?.name || m).join(" ou ")}
            color="#71717A"
            tip="Esta operação exige obrigatoriamente um destes veículos — a equipa não pode ser despachada com outro."
          />
        )}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <Metric icon={TrendingUp} label={opp.pays === "clean" ? "€ Limpos" : "€ Sujos"} value={fmtMoney(opp.reward)} color="#10B981"
          tip={(opp.pays === "clean" ? "Pago em dinheiro limpo — pronto a gastar, sem lavagem." : "Pago em dinheiro sujo — terás de o lavar (taxa 25%) antes de gastar.") + " Só é creditado quando a equipa regressar ao QG (a polícia pode perseguir)."} />
        <Metric icon={AlertTriangle} label="Risco" value={safeRiskDots(opp.risk)} color="#DC2626"
          tip={`Risco ${safeRiskLevel(opp.risk)}/5 — reduz a probabilidade de sucesso e aumenta a chance de ferimentos, detenções e interceção policial.`} />
        <Metric
          icon={Clock}
          label={inProgress && activeMission ? (activeMission.phase === "en_route" ? "Chega em" : activeMission.phase === "operating" ? "Conclui" : "Regressa") : expired ? "Estado" : "Expira"}
          value={inProgress ? fmtDuration(timeLeft) : expired ? "Expirada" : fmtDuration(Math.max(0, timeLeft))}
          color={expired ? "#EF4444" : "#F59E0B"}
          tip={inProgress ? "Tempo até à próxima fase da operação em curso." : "Tempo até esta oportunidade desaparecer do mapa. Despacha uma equipa antes disso."}
        />
      </div>

      {inProgress && activeMission ? (
        <Card data-testid="opportunity-in-progress" className={`mt-3 border p-3 shadow-none ${activeMission.chase_active ? "border-red-500/40 bg-red-500/[0.08]" : "border-cyan-500/30 bg-cyan-500/[0.06]"}`}>
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
              <p className="mt-0.5 font-mono text-[9px] text-zinc-500">
                Partida: {baseNameOf(activeMission.origin_property_id)} · Regresso: {baseNameOf(activeMission.origin_property_id)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-wider text-zinc-500">
                {activeMission.chase_active && activeMission.phase === "returning" ? "Escape" : "Sucesso previsto"}
              </p>
              <p className="font-mono text-sm font-bold" style={{
                color: activeMission.chase_active && activeMission.phase === "returning"
                  ? "#EF4444"
                  : chanceColor(activeMission.success_chance ?? 0.5)
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
          {activeMission.bonus_loot && (
            <p className="mt-1 flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-amber-400">
              <Sparkles size={10} /> Saque adicional! A equipa encontrou mais do que esperava.
            </p>
          )}
          <p className="mt-2 font-mono text-[10px] leading-snug text-zinc-500">
            {activeMission.chase_active && activeMission.phase === "returning"
              ? "Um carro-patrulha segue a equipa. Se apanhados antes do QG, perdem toda a carga."
              : "A operação está em curso — a recompensa só cai na conta quando a equipa chegar ao QG."}
          </p>
          {activeMission.phase === "en_route" && (
            <Button
              data-testid="recall-team-button"
              variant="secondary"
              onClick={async () => { setBusy(true); await recallTeam(activeMission.id); setBusy(false); onClose(); }}
              disabled={busy}
              className="mt-2 w-full font-bold uppercase tracking-wider"
            >
              {busy ? "A chamar..." : "Chamar equipa de volta"}
            </Button>
          )}
        </Card>
      ) : policeAlert ? (
        <Alert variant="destructive" className="mt-3 border-red-600/40 bg-red-600/10 py-2 text-center">
          <AlertDescription className="flex items-center justify-center gap-1.5 font-mono text-xs text-red-500">
            <Siren size={13} /> Polícia em alerta máximo — reduz o calor
          </AlertDescription>
        </Alert>
      ) : lockedByLevel ? (
        <p className="mt-3 text-center font-mono text-xs text-red-500">Requer nível {opp.min_level}</p>
      ) : (
        <>
          <Card data-testid="dispatch-quick-setup" className="mt-3 border-white/10 bg-black/20 p-2.5 shadow-none">
            {selectedTeam && selectedTeamReadiness?.ok ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-white">
                    {selectedTeam.name}
                    {selectedTeam.id === recommendedTeamId && (
                      <Badge variant="outline" className="gap-0.5 border-emerald-500/20 bg-emerald-500/10 px-1 py-0 font-mono text-[8px] font-normal uppercase text-emerald-300">
                        <Sparkles size={8} /> automático
                      </Badge>
                    )}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[9px] text-zinc-500">
                    {selectedTeamReadiness.members} membros · {selectedTeamReadiness.vehicle?.name || "sem veículo"}
                    {chances[selectedTeam.id] != null ? ` · ${Math.round(chances[selectedTeam.id] * 100)}% sucesso` : ""}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[9px] font-bold uppercase tracking-wider text-emerald-400">Pronta</span>
              </div>
            ) : (
              <div>
                <p className="text-xs font-semibold text-white">{anyReady ? "Escolhe uma equipa" : "Nenhuma equipa pronta"}</p>
                <p className="mt-0.5 font-mono text-[9px] text-zinc-500">
                  {anyReady ? "A recomendação automática está disponível na configuração avançada." : "Corrige membros, veículo, combustível ou condição para poder despachar."}
                </p>
              </div>
            )}
            <Button
              data-testid="dispatch-advanced-toggle"
              type="button"
              variant="ghost"
              onClick={() => setShowAdvancedSetup((value) => !value)}
              className="mt-2 h-7 w-full justify-center gap-1 font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white"
            >
              {showAdvancedSetup ? "Ocultar configuração" : "Configuração avançada"}
              <ChevronDown size={11} className={`transition-transform ${showAdvancedSetup ? "rotate-180" : ""}`} />
            </Button>
          </Card>

          <div className={`mt-2 max-h-36 overflow-y-auto overscroll-contain ${showAdvancedSetup ? "" : "hidden"}`}>
            <div className="space-y-1 pr-1.5">
              {/* Equipas prontas primeiro (a recomendada sempre à cabeça) — o
                  jogador não precisa de percorrer bloqueadas para achar a boa. */}
              {[...state.teams]
                .sort((a, b) => {
                  if (a.id === recommendedTeamId) return -1;
                  if (b.id === recommendedTeamId) return 1;
                  const ra = readiness(a), rb = readiness(b);
                  if (ra.ok !== rb.ok) return ra.ok ? -1 : 1;   // prontas primeiro
                  if (!ra.ok) return 0;
                  // Entre prontas: maior probabilidade primeiro; ETA como desempate
                  // (ou enquanto as chances ainda não chegaram).
                  const ca = chances[a.id], cb = chances[b.id];
                  if (ca != null && cb != null && ca !== cb) return cb - ca;
                  if (ca != null && cb == null) return -1;
                  if (cb != null && ca == null) return 1;
                  return (ra.eta || 0) - (rb.eta || 0);
                })
                .map((t) => {
                const r = readiness(t);
                const match = t.spec === opp.category || opp.category === "especial";
                const fix = !r.ok ? fixFor(t, r) : null;
                return (
                  <Card
                    key={t.id}
                    data-testid={`select-team-${t.id}`}
                    onClick={() => r.ok && setSelectedTeamId(t.id)}
                    className={`flex w-full flex-col gap-1 rounded-md border px-2.5 py-1.5 text-left shadow-none transition-colors ${
                      selectedTeamId === t.id
                        ? "border-primary/50 bg-primary/10"
                        : "lus-card hover:bg-white/[0.07]"
                    } ${r.ok ? "cursor-pointer" : ""}`}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <div className={r.ok ? "" : "opacity-50"}>
                        <p className="text-xs font-semibold text-white">
                          {t.name}
                          {t.id === recommendedTeamId && (
                            <Tip tip="Sugestão automática: a equipa com maior probabilidade de sucesso para esta operação. Podes escolher outra clicando nela.">
                              <Badge variant="outline" className="ml-1.5 gap-0.5 border-amber-500/30 bg-amber-500/10 px-1 py-0 font-mono text-[9px] font-normal uppercase text-amber-400">
                                <Sparkles size={9} /> recomendada
                              </Badge>
                            </Tip>
                          )}
                          {match && (
                            <Badge variant="outline" className="ml-1.5 border-emerald-500/30 bg-emerald-500/10 px-1 py-0 font-mono text-[9px] font-normal uppercase text-emerald-400">match</Badge>
                          )}
                        </p>
                        <p className="font-mono text-[10px] text-zinc-500">
                          {r.ok ? `${r.members} membros · ${r.vehicle.name}` : SPEC_LABELS[t.spec]}
                        </p>
                      </div>
                      {r.ok ? (
                        <div className="flex shrink-0 items-center gap-2">
                          {chances[t.id] != null && (
                            <Tip tip="Probabilidade de sucesso estimada para esta equipa nesta operação." align="end">
                              <span className="font-mono text-[10px] font-bold" style={{ color: chanceColor(chances[t.id]) }}>
                                {Math.round(chances[t.id] * 100)}%
                              </span>
                            </Tip>
                          )}
                          <Tip tip={`Tempo estimado de viagem até ao alvo com o ${r.vehicle.name}.`} align="end">
                            <span className="font-mono text-[10px] text-cyan-400">ETA {fmtDuration(r.eta)}</span>
                          </Tip>
                        </div>
                      ) : (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="font-mono text-[10px] text-red-400">{r.reason}</span>
                          {fix && (
                            <Button
                              data-testid={`fix-team-${t.id}`}
                              variant="outline" size="sm"
                              onClick={(ev) => { ev.stopPropagation(); fix.run(); }}
                              disabled={!fix.can}
                              title={r.reason}
                              className={`h-auto gap-1 border-white/15 px-1.5 py-1 font-mono text-[9px] font-bold ${fix.color} hover:bg-white/10`}
                            >
                              <fix.icon size={10} /> {fix.label}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    {selectedTeamId === t.id && r.ok && (
                      <div
                        className="mt-1.5 flex w-full items-center gap-1.5 border-t border-white/10 pt-1.5"
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        <Car size={11} className="shrink-0 text-cyan-400" />
                        <Select value={r.vehicle.id} onValueChange={(vid) => vid !== r.vehicle.id && assignVehicle(vid, t.id)}>
                          <SelectTrigger data-testid={`opp-vehicle-select-${t.id}`} className="h-6 flex-1 border-white/10 bg-black/60 font-mono text-[10px] text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={r.vehicle.id} className="font-mono text-xs">{r.vehicle.name} (atual)</SelectItem>
                            {state.vehicles
                              .filter((v) => !v.team_id && !v.transfer && v.id !== r.vehicle.id)
                              .map((v) => (
                                <SelectItem key={v.id} value={v.id} className="font-mono text-xs">{v.name}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
          {!anyReady && (
            <p className="mt-2 text-center font-mono text-[10px] text-zinc-500">
              Nenhuma equipa operacional — verifica membros, combustível e condição
            </p>
          )}
          {preview && (() => {
            const quality = chanceQualityLabel(preview.chance);
            const modifiers = preview.breakdown.filter((item) => item.key !== "base");
            const topModifiers = [...modifiers].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 3);
            const byCategory = {};
            for (const item of modifiers) {
              (byCategory[item.category || "outros"] = byCategory[item.category || "outros"] || []).push(item);
            }
            const categoryOrder = Object.keys(MODIFIER_CATEGORY_LABELS).filter((cat) => byCategory[cat]?.length);
            return (
              <Card ref={previewRef} data-testid="dispatch-preview" className="mt-2 animate-slide-up lus-card p-2.5 shadow-none">
                <div className="flex items-baseline justify-between">
                  <p className="text-[9px] uppercase tracking-wider text-zinc-500">Probabilidade de sucesso</p>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className="rounded border-transparent px-1.5 py-0 font-mono text-[8px] font-bold uppercase tracking-wider"
                      style={{ color: quality.color, background: `${quality.color}1a` }}
                    >
                      {quality.label}
                    </Badge>
                    <p className="font-mono text-lg font-bold" style={{ color: chanceColor(preview.chance) }}>
                      {Math.round(preview.chance * 100)}%
                    </p>
                  </div>
                </div>
                {preview.chance < lowSuccessThreshold && (
                  <p data-testid="low-success-warning" className="mt-1 flex items-center gap-1 font-mono text-[10px] font-bold text-amber-400">
                    <AlertTriangle size={11} /> Probabilidade abaixo do limite definido ({Math.round(lowSuccessThreshold * 100)}%)
                  </p>
                )}

                {topModifiers.length > 0 && (
                  <div className="mt-1.5 space-y-0.5 border-t border-white/5 pt-1.5" data-testid="dispatch-preview-top-factors">
                    {topModifiers.map((item) => (
                      <Tip key={item.key} tip={item.tip} side="left" block>
                        <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
                          <span className="truncate text-zinc-400">{item.label}</span>
                          <span className="shrink-0 font-bold" style={{ color: item.pct >= 0 ? "#34D399" : "#EF4444" }}>
                            {pctSigned(item.pct)}
                          </span>
                        </div>
                      </Tip>
                    ))}
                  </div>
                )}

                <p className="mt-1.5 font-mono text-[10px] text-zinc-400">
                  <span className="text-emerald-400">{fmtMoney(preview.reward)}</span>
                  {preview.reward_bonus_pct > 0 && <span className="text-cyan-400"> (+{preview.reward_bonus_pct}% imóveis)</span>}
                  {preview.age_decay_pct < 0 && (
                    <Tip tip="Esta oportunidade está disponível há algum tempo — a recompensa vai encolhendo quanto mais tempo ficar por reclamar.">
                      <span className="text-amber-400"> ({preview.age_decay_pct}% tempo)</span>
                    </Tip>
                  )}
                  {preview.split_penalty_pct < 0 && (
                    <Tip tip="Levar mais membros do que o mínimo exigido divide o saque — cada membro extra reduz ligeiramente a recompensa.">
                      <span className="text-amber-400"> ({preview.split_penalty_pct}% saque dividido)</span>
                    </Tip>
                  )}
                  <span className="text-[#0A84FF]"> · +{opp.respect} resp.</span>
                  {" · "}{preview.fuel_needed}L comb. · ETA {fmtDuration(preview.eta_s)} · op. {fmtDuration(preview.duration_s)}
                </p>

                {modifiers.length > 0 && (
                  <button
                    data-testid="dispatch-preview-toggle-details"
                    onClick={() => setShowDetails((v) => !v)}
                    className="mt-1.5 flex w-full items-center justify-center gap-1 border-t border-white/5 pt-1.5 font-mono text-[9px] uppercase tracking-wider text-zinc-500 transition-colors hover:text-white"
                  >
                    {showDetails ? "Ocultar detalhes" : "Ver detalhes"}
                    <ChevronDown size={11} className={`transition-transform ${showDetails ? "rotate-180" : ""}`} />
                  </button>
                )}

                {showDetails && (
                  <div className="mt-1.5 animate-slide-up" data-testid="dispatch-preview-details">
                    <div className="flex items-center justify-between rounded bg-black/40 px-1.5 py-1 font-mono text-[10px]">
                      <span className="text-zinc-400">Base da missão</span>
                      <span className="font-bold text-zinc-300">{Math.round(preview.breakdown[0].pct * 100)}%</span>
                    </div>
                    <Accordion type="multiple" className="mt-1">
                      {categoryOrder.map((cat) => (
                        <AccordionItem key={cat} value={cat} className="border-white/5">
                          <AccordionTrigger className="py-1.5 font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-400 hover:no-underline">
                            {MODIFIER_CATEGORY_LABELS[cat]}
                            <span className="ml-auto mr-1.5 font-normal normal-case text-zinc-600">{byCategory[cat].length}</span>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-1 pb-2 pt-0">
                            {byCategory[cat].map((item) => (
                              <Tip key={item.key} tip={item.tip} side="left" block>
                                <div className="flex items-center justify-between gap-2 rounded bg-black/30 px-1.5 py-1 font-mono text-[10px]">
                                  <span className="truncate text-zinc-400">{item.label}</span>
                                  <span
                                    className="shrink-0 font-bold"
                                    style={{ color: Math.abs(item.pct) < 0.001 ? "#A1A1AA" : item.pct > 0 ? "#34D399" : "#EF4444" }}
                                  >
                                    {pctSigned(item.pct)}
                                  </span>
                                </div>
                              </Tip>
                            ))}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                    <div className="mt-1 flex items-center justify-between rounded bg-black/40 px-1.5 py-1 font-mono text-[10px]">
                      <span className="font-bold uppercase tracking-wider text-zinc-300">Probabilidade final</span>
                      <span className="font-bold" style={{ color: chanceColor(preview.chance) }}>{Math.round(preview.chance * 100)}%</span>
                    </div>
                  </div>
                )}
              </Card>
            );
          })()}
        </>
      )}
      </div>
      {/* Botão de despacho ancorado fora do corpo rolável — a ação principal
          nunca sai do ecrã, independentemente do tamanho do conteúdo. */}
      {!(inProgress && activeMission) && !policeAlert && !lockedByLevel && (
          <Tip tip={confirmLowChance ? "Probabilidade muito baixa — clica outra vez para confirmar mesmo assim." : null} block>
            <Button
              data-testid="dispatch-team-button"
              onClick={handleDispatch}
              disabled={!selectedTeamId || busy || expired}
              variant={!selectedTeamId || busy || expired || confirmLowChance ? "outline" : "success"}
              className={`mt-3 w-full shrink-0 font-bold uppercase tracking-wider ${
                !selectedTeamId || busy || expired
                  ? "border-red-500/30 bg-red-500/10 from-transparent to-transparent text-red-400 shadow-none hover:bg-red-500/20"
                  : confirmLowChance
                  ? "border-amber-500/50 bg-gradient-to-b from-amber-500/30 to-amber-600/20 text-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.25)] hover:border-amber-400/70 hover:from-amber-500/40 hover:to-amber-600/30 hover:text-amber-200"
                  : ""
              }`}
            >
              {expired ? "Operação expirada" : busy ? "A despachar..." : confirmLowChance ? "Confirmar mesmo assim?" : "Despachar"}
            </Button>
          </Tip>
      )}
    </Card>
  );
};

const Metric = ({ icon: Icon, label, value, color, tip }) => (
  <Tip tip={tip} block>
    <Card className="h-full lus-card p-2 shadow-none">
      <div className="flex items-center gap-1">
        <Icon size={10} style={{ color }} />
        <p className="text-[9px] uppercase tracking-wider text-zinc-500">{label}</p>
      </div>
      <p className="mt-0.5 font-mono text-xs font-bold text-white">{value}</p>
    </Card>
  </Tip>
);
