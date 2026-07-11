import { useEffect, useMemo, useRef, useState } from "react";
import { fmtMoney, chanceColor, CATEGORY_COLORS } from "../../lib/game";
import { Radio, Crosshair, Siren, X, Video } from "lucide-react";

/*
 * Operação em Direto — painel embutível com a "transmissão" das operações.
 * Revela o guião da missão (live_log do backend) linha a linha, seguindo o
 * relógio do servidor: rádio da equipa, marcos da operação e COMPLICAÇÕES com
 * efeito real na chance (o pct de cada complicação soma à "chance ao vivo",
 * que é exatamente o valor usado pelo servidor no desfecho).
 *
 * Este painel já não se posiciona sozinho sobre o mapa: vive dentro da
 * "Central da rede" (ActivityFeed), no separador EM DIRETO — uma só superfície
 * de UI em vez de dois widgets sobrepostos.
 */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const KIND_META = {
  net: { color: "#22D3EE" },
  radio: { color: "#D4D4D8" },
  milestone: { color: "#67E8F9" },
  comp_bad: { color: "#F43F5E" },
  comp_good: { color: "#34D399" },
  good: { color: "#34D399" },
  bad: { color: "#F43F5E" },
  police: { color: "#F59E0B" },
};

const OUTCOME_META = {
  success: { label: "ÊXITO", color: "#34D399" },
  partial: { label: "SUCESSO PARCIAL", color: "#F59E0B" },
  failure: { label: "FALHA", color: "#F43F5E" },
  police: { label: "INTERCETADA", color: "#EF4444" },
  recalled: { label: "REGRESSO ANTECIPADO", color: "#A1A1AA" },
};

export function phaseInfo(m, now) {
  const arr = Date.parse(m.arrive_at);
  const fin = Date.parse(m.finish_at);
  const ret = Date.parse(m.return_at);
  if (now < arr) return { key: "en_route", label: "Em rota para o alvo", until: arr, color: "#22D3EE" };
  if (now < fin) return { key: "operating", label: "Operação em curso", until: fin, color: "#F43F5E" };
  return {
    key: "returning",
    label: m.chase_active ? "Fuga — perseguição policial" : "Regresso à base",
    until: ret,
    color: m.chase_active ? "#F59E0B" : "#34D399",
  };
}

export const fmtMMSS = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

const fmtHMS = (iso) =>
  new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function LiveOpsPanel({ state, serverNow }) {
  const missions = useMemo(
    () => (state.missions || []).filter((m) => m.phase !== "done"),
    [state.missions]
  );
  const [selectedId, setSelectedId] = useState(null);
  const [now, setNow] = useState(() => serverNow());
  const [finished, setFinished] = useState(null); // snapshot da última operação concluída
  const prevIdsRef = useRef(new Set());
  const snapshotsRef = useRef(new Map());
  const feedRef = useRef(null);

  // Relógio local sincronizado com o servidor — anima countdowns e revela linhas.
  const active = missions.length > 0 || !!finished;
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(serverNow()), 450);
    return () => clearInterval(id);
  }, [active, serverNow]);

  // Guarda snapshots (para o estado "concluída") e deteta operações novas/terminadas.
  useEffect(() => {
    const ids = new Set(missions.map((m) => m.id));
    missions.forEach((m) => snapshotsRef.current.set(m.id, m));
    const fresh = missions.find((m) => !prevIdsRef.current.has(m.id));
    if (fresh && prevIdsRef.current.size >= 0) {
      setSelectedId(fresh.id);
      setFinished(null);
    }
    // Operação selecionada desapareceu da lista → concluída (chegou à base).
    if (selectedId && !ids.has(selectedId)) {
      const snap = snapshotsRef.current.get(selectedId);
      if (snap) setFinished({ mission: snap, at: Date.now() });
      snapshotsRef.current.delete(selectedId);
      setSelectedId(missions.length ? missions[missions.length - 1].id : null);
    }
    prevIdsRef.current = ids;
  }, [missions, selectedId]);

  // O cartão de conclusão dissolve-se sozinho ao fim de 8s.
  useEffect(() => {
    if (!finished) return undefined;
    const id = setTimeout(() => setFinished(null), 8000);
    return () => clearTimeout(id);
  }, [finished]);

  const sel = missions.find((m) => m.id === selectedId) || missions[missions.length - 1] || null;

  const log = sel?.live_log || [];
  const revealed = useMemo(() => log.filter((e) => Date.parse(e.at) <= now), [log, now]);

  // Auto-scroll do feed para a linha mais recente.
  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [revealed.length, selectedId]);

  // ---- Sem transmissão: estado vazio tático ----
  if (!sel && !finished) {
    return (
      <div className="px-3 py-6 text-center" data-testid="liveops-empty">
        <Radio size={15} className="mx-auto mb-2 text-zinc-600" />
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
          Sem operações no terreno
        </p>
        <p className="mt-1 font-mono text-[10px] leading-relaxed text-zinc-600">
          Despacha uma equipa para veres a transmissão em direto — rádio, fases e chance ao vivo.
        </p>
      </div>
    );
  }

  // ---- Cartão de conclusão (a equipa chegou à base) ----
  if (!sel && finished) {
    const fm = finished.mission;
    const om = OUTCOME_META[fm.outcome] || OUTCOME_META.recalled;
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-3" data-testid="liveops-finished">
        <div className="flex min-w-0 items-center gap-2">
          <span className="lus-lo-rec" style={{ background: om.color, boxShadow: `0 0 8px ${om.color}` }} />
          <div className="min-w-0">
            <p className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: om.color }}>
              Operação concluída — {om.label}
            </p>
            <p className="truncate font-mono text-[10px] text-zinc-500">
              {fm.team_name} · {fm.opportunity?.name} · relatório nos registos
            </p>
          </div>
        </div>
        <button
          type="button"
          data-testid="liveops-finished-close"
          onClick={() => setFinished(null)}
          className="rounded-full border border-white/10 p-1 text-zinc-500 transition-colors hover:text-white"
          aria-label="Fechar"
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  const ph = phaseInfo(sel, now);
  const compDelta = revealed.reduce((s, e) => s + (e.pct || 0), 0);
  const liveChance = clamp((sel.success_chance ?? 0.5) + compDelta, 0.02, 0.98);
  const chanceCol = chanceColor(liveChance);
  const recentComp = revealed.some((e) => e.pct != null && now - Date.parse(e.at) < 5000);
  const om = sel.outcome ? OUTCOME_META[sel.outcome] : null;
  const catColor = CATEGORY_COLORS[sel.opportunity?.category] || "#F43F5E";

  const dep = Date.parse(sel.depart_at);
  const arr = Date.parse(sel.arrive_at);
  const fin = Date.parse(sel.finish_at);
  const ret = Date.parse(sel.return_at);
  const segs = [
    { label: "Ida", f: clamp((now - dep) / Math.max(1, arr - dep), 0, 1), col: "#22D3EE" },
    { label: "Ação", f: clamp((now - arr) / Math.max(1, fin - arr), 0, 1), col: "#F43F5E" },
    { label: "Volta", f: clamp((now - fin) / Math.max(1, ret - fin), 0, 1), col: sel.chase_active ? "#F59E0B" : "#34D399" },
  ];

  return (
    <div data-testid="liveops-panel">
      {/* Cabeçalho — alvo + seguir câmara */}
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="lus-lo-rec" />
          <p className="truncate font-mono text-[10px] font-bold uppercase tracking-wider text-white">
            {sel.opportunity?.name}
            <span className="ml-1.5 font-normal text-zinc-500">· {sel.opportunity?.district}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            data-testid="liveops-camera"
            title="Abrir a câmara da operação — acompanhar a equipa no interior do alvo"
            onClick={() => window.dispatchEvent(new CustomEvent("lus:open-operation", { detail: { id: sel.id } }))}
            className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-red-300 transition-colors hover:border-red-400/60 hover:text-red-200"
          >
            <Video size={11} /> Câmara
          </button>
          <button
            type="button"
            data-testid="liveops-follow"
            title="Seguir esta unidade no mapa"
            onClick={() => window.dispatchEvent(new CustomEvent("lus:follow-mission", { detail: { id: sel.id } }))}
            className="rounded-full border border-white/10 p-1 text-zinc-400 transition-colors hover:border-cyan-400/40 hover:text-cyan-300"
          >
            <Crosshair size={11} />
          </button>
        </div>
      </div>

      {/* Tabs quando há várias operações em simultâneo */}
      {missions.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b border-white/[0.06] px-2 py-1">
          {missions.map((m, i) => {
            const isSel = m.id === sel.id;
            const alert = m.chase_active || m.outcome === "police";
            return (
              <button
                key={m.id}
                type="button"
                data-testid={`liveops-tab-${i}`}
                onClick={() => setSelectedId(m.id)}
                className={`relative shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider transition-colors ${
                  isSel ? "border-red-500/50 bg-red-500/10 text-white" : "border-white/10 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {m.team_name}
                {alert && <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Estado + timeline de fases + chance ao vivo */}
      <div className="flex items-center gap-3 px-3 pb-1 pt-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: ph.color }} data-testid="liveops-phase">
              {sel.chase_active && ph.key === "returning" && <Siren size={11} className="animate-pulse" />}
              <span className="truncate">{ph.label}</span>
            </p>
            <p className="font-mono text-[10px] tabular-nums text-zinc-400">
              {sel.team_name} · <span className="text-zinc-300">{fmtMMSS(ph.until - now)}</span>
            </p>
          </div>
          <div className="mt-1 flex items-center gap-1">
            {segs.map((sg, i) => (
              <div key={i} className="flex-1">
                <div className="lus-lo-seg">
                  <div className="lus-lo-seg-fill" style={{ width: `${sg.f * 100}%`, background: sg.col }} />
                </div>
                <p className={`mt-0.5 text-center font-mono text-[8px] uppercase tracking-[0.2em] ${sg.f > 0 && sg.f < 1 ? "text-zinc-300" : "text-zinc-600"}`}>
                  {sg.label}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="w-16 shrink-0 text-right" title="Chance ao vivo — a base do plano mais as complicações reveladas. É este o valor que decide o desfecho.">
          <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-zinc-500">Chance</p>
          <p
            className={`font-mono text-lg font-bold leading-none tabular-nums ${recentComp ? "lus-lo-chance-pulse" : ""}`}
            style={{ color: chanceCol }}
            data-testid="liveops-chance"
          >
            {Math.round(liveChance * 100)}%
          </p>
          {compDelta !== 0 && (
            <p className="font-mono text-[9px] font-bold tabular-nums" style={{ color: compDelta > 0 ? "#34D399" : "#F43F5E" }} data-testid="liveops-chance-delta">
              {compDelta > 0 ? "+" : ""}
              {Math.round(compDelta * 100)}% campo
            </p>
          )}
        </div>
      </div>

      {/* Faixa de desfecho / perseguição */}
      {om && (
        <div
          className="mx-3 mb-1 flex items-center justify-between gap-2 rounded-md border px-2 py-1"
          style={{ borderColor: `${om.color}44`, background: `${om.color}12` }}
          data-testid="liveops-outcome"
        >
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: om.color }}>
            {om.label}
            {sel.chase_active && (
              <span className="ml-2 animate-pulse text-amber-400">
                perseguição — escape ≈ {Math.round((sel.escape_chance || 0.5) * 100)}%
              </span>
            )}
          </p>
          {(sel.pending_reward || 0) > 0 && (
            <p className="font-mono text-[10px] font-bold text-emerald-300">{fmtMoney(sel.pending_reward)} a bordo</p>
          )}
        </div>
      )}

      {/* Feed rádio — linhas reveladas pelo relógio do servidor */}
      <div ref={feedRef} className="lus-lo-feed max-h-36 overflow-y-auto px-3 pb-2 pt-1 md:max-h-44" data-testid="liveops-feed">
        {revealed.length === 0 && (
          <p className="py-2 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600">
            <Radio size={11} className="mr-1.5 inline-block" />
            A estabelecer ligação rádio...
          </p>
        )}
        {revealed.map((e, i) => {
          const meta = KIND_META[e.kind] || KIND_META.radio;
          const isLast = i === revealed.length - 1;
          const fresh = isLast && now - Date.parse(e.at) < 2600;
          return (
            <div key={`${e.at}-${i}`} className="lus-lo-line flex items-baseline gap-1.5 py-[3px]" data-testid="liveops-line">
              <span className="shrink-0 font-mono text-[8.5px] tabular-nums text-zinc-600">{fmtHMS(e.at)}</span>
              <span className="shrink-0 font-mono text-[9px] font-bold uppercase tracking-wider" style={{ color: e.pct != null ? meta.color : catColor }}>
                {e.speaker}
              </span>
              <span className="min-w-0 font-mono text-[10.5px] leading-snug" style={{ color: meta.color }}>
                {e.text}
                {e.pct != null && (
                  <span
                    className="ml-1.5 rounded-sm border px-1 font-bold tabular-nums"
                    style={{ borderColor: `${meta.color}55`, color: meta.color }}
                    data-testid="liveops-comp-pct"
                  >
                    {e.pct > 0 ? "+" : ""}
                    {Math.round(e.pct * 100)}% chance
                  </span>
                )}
                {fresh && <span className="lus-lo-caret" aria-hidden="true" />}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LiveOpsPanel;
