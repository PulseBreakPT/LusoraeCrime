// ============================================================================
// /dev/operation — Pré-visualização da Câmara da Operação (QA visual)
// ============================================================================
// Monta o OperationView com uma missão fictícia gerada localmente, sem tocar
// no backend. Query params:
//   ?type=roubo_joalharia   tipo de missão (define o arquétipo do edifício)
//   ?n=4                    nº de operacionais (1-6)
//   ?dur=120                duração da operação em segundos
//   ?seed=abc               varia a planta procedural
//   ?phase=en_route|operating|returning

import { useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import OperationView from "../components/game/OperationView";

const ROSTER = [
  { name: "Rui Falcão", role_key: "assaltante", spec: "assalto", rank: "chefe_equipa" },
  { name: "Marta Leitão", role_key: "motorista", spec: "logistica", rank: "membro" },
  { name: "Nuno Sá", role_key: "hacker", spec: "tecnica", rank: "especialista" },
  { name: "Sofia Prata", role_key: "espiao", spec: "tecnica", rank: "veterano" },
  { name: "Tiago Mota", role_key: "contrabandista", spec: "logistica", rank: "membro" },
  { name: "Ana Reis", role_key: "seguranca", spec: "assalto", rank: "recruta" },
];

const TYPES = [
  "roubo_joalharia", "ciberataque_bancario", "roubo_carga", "infiltracao",
  "assalto", "invasao_servidor", "assalto_casino", "assalto_museu", "cobranca",
];
const CATS = {
  roubo_joalharia: "assalto", ciberataque_bancario: "tecnica", roubo_carga: "logistica",
  infiltracao: "especial", assalto: "assalto", invasao_servidor: "tecnica",
  assalto_casino: "assalto", assalto_museu: "assalto", cobranca: "influencia",
};

export default function DevOperationPreview() {
  const [params, setParams] = useSearchParams();
  const type = params.get("type") || "roubo_joalharia";
  const n = Math.max(1, Math.min(6, parseInt(params.get("n") || "4", 10)));
  const dur = Math.max(20, Math.min(300, parseInt(params.get("dur") || "120", 10)));
  const seed = params.get("seed") || "0";
  const phase = params.get("phase") || "operating";
  const [closedAt, setClosedAt] = useState(null);

  const mission = useMemo(() => {
    const now = Date.now();
    const arrive = phase === "en_route" ? now + 45000 : now - 3000;
    const finish = arrive + dur * 1000;
    return {
      id: `dev-${type}-${seed}`,
      team_name: "Crew Alfa",
      member_ids: ROSTER.slice(0, n).map((_, i) => "m" + i),
      opportunity: { type_key: type, category: CATS[type] || "assalto", name: "Alvo de teste", district: "Baixa", risk: 3 },
      phase: phase === "returning" ? "returning" : phase === "en_route" ? "en_route" : "operating",
      outcome: phase === "returning" ? "success" : null,
      success_chance: 0.72,
      live_chance_delta: 0,
      live_log: [],
      depart_at: new Date(now - 60000).toISOString(),
      arrive_at: new Date(arrive).toISOString(),
      finish_at: new Date(finish).toISOString(),
      return_at: new Date(finish + 60000).toISOString(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, n, dur, seed, phase, closedAt]);

  const set = (k, v) => {
    const next = new URLSearchParams(params);
    next.set(k, v);
    setParams(next, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#05070a]">
      <OperationView
        mission={mission}
        roster={ROSTER.slice(0, n)}
        serverNow={() => Date.now()}
        onClose={() => setClosedAt(Date.now())}
      />
      {/* barra de QA por cima da câmara */}
      <div className="fixed bottom-16 left-1/2 z-[90] flex max-w-[95vw] -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-xl border border-white/10 bg-black/80 px-2 py-1.5 backdrop-blur">
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => set("type", t)}
            className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase ${t === type ? "bg-red-500/20 text-red-300" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            {t.replace(/_/g, " ")}
          </button>
        ))}
        <span className="mx-1 h-3 w-px bg-white/10" />
        {[1, 3, 4, 6].map((k) => (
          <button key={k} onClick={() => set("n", String(k))} className={`rounded px-1.5 py-0.5 font-mono text-[9px] ${k === n ? "bg-cyan-500/20 text-cyan-300" : "text-zinc-500 hover:text-zinc-300"}`}>
            n{k}
          </button>
        ))}
        <span className="mx-1 h-3 w-px bg-white/10" />
        <button onClick={() => set("seed", String(Math.floor(Math.random() * 9999)))} className="rounded px-1.5 py-0.5 font-mono text-[9px] text-amber-300 hover:text-amber-200">
          nova planta
        </button>
        <button onClick={() => set("phase", phase === "operating" ? "en_route" : phase === "en_route" ? "returning" : "operating")} className="rounded px-1.5 py-0.5 font-mono text-[9px] text-emerald-300 hover:text-emerald-200">
          fase: {phase}
        </button>
        <Link to="/" className="rounded px-1.5 py-0.5 font-mono text-[9px] text-zinc-500 hover:text-zinc-300">sair</Link>
      </div>
    </div>
  );
}
