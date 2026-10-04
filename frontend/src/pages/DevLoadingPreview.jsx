import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import {
  LoadingBackdrop,
  TacticalFrame,
  TacticalRadar,
  BootWordmark,
  UplinkProgress,
  TerminalLog,
  FlavorRotator,
} from "../components/loading/LoadingChrome";

/**
 * Pré-visualização de desenvolvimento do ecrã de loading SSS.
 * Rota: /dev/loading (estado normal) e /dev/loading?state=error (falha).
 * Simula a progressão das etapas em loop — não toca em contextos reais.
 */

const STAGES = [
  { key: "auth", label: "Verificação de acesso" },
  { key: "teams", label: "Equipas" },
  { key: "employees", label: "Operacionais" },
  { key: "vehicles", label: "Frota" },
  { key: "properties", label: "Imóveis" },
  { key: "opportunities", label: "Oportunidades" },
  { key: "missions", label: "Operações em curso" },
  { key: "processamento", label: "Sincronização final" },
];

export default function DevLoadingPreview() {
  const [params] = useSearchParams();
  const isError = params.get("state") === "error";
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (isError) return undefined;
    const t = setInterval(() => setIdx((i) => (i + 1) % (STAGES.length + 2)), 1400);
    return () => clearInterval(t);
  }, [isError]);

  if (isError) {
    return (
      <LoadingBackdrop>
        <TacticalFrame header="Falha de uplink" status="Interrompido" tone="error">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="sub-alert-icon">
                <AlertTriangle className="h-8 w-8 flex-shrink-0 text-destructive" />
              </span>
              <div>
                <p className="font-display font-bold uppercase tracking-wide text-white">Falha na ligação à organização</p>
                <p className="mt-1 font-mono text-xs text-zinc-400">Oportunidades</p>
              </div>
            </div>
            <div className="rounded border border-red-800/50 bg-red-950/30 p-3">
              <p className="break-words font-mono text-xs text-red-200">Network error: failed to fetch /api/opportunities</p>
            </div>
            <p className="text-center font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              Tenta recarregar a página. Se persistir, contacta o suporte.
            </p>
          </div>
        </TacticalFrame>
      </LoadingBackdrop>
    );
  }

  const rows = STAGES.map((s, i) => ({
    key: s.key,
    label: s.label,
    status: i < idx ? "done" : i === idx ? "active" : "pending",
  }));
  const doneCount = rows.filter((r) => r.status === "done").length;
  const progress = Math.min(100, Math.round((doneCount / STAGES.length) * 100));
  const active = STAGES[Math.min(idx, STAGES.length - 1)];

  return (
    <LoadingBackdrop>
      <TacticalFrame>
        <div className="space-y-5">
          <TacticalRadar />
          <BootWordmark statusText={idx < STAGES.length ? active.label : "A preparar operações…"} />
          <UplinkProgress
            progress={progress}
            label="A ligar à organização"
            meta={`${String(doneCount).padStart(2, "0")}/${String(STAGES.length).padStart(2, "0")} módulos`}
          />
          <TerminalLog rows={rows} />
          <FlavorRotator />
        </div>
      </TacticalFrame>
    </LoadingBackdrop>
  );
}
