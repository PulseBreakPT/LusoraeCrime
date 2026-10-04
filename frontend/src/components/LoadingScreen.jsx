import { useLoading } from "../context/LoadingContext";
import { AlertTriangle } from "lucide-react";
import {
  LoadingBackdrop,
  TacticalFrame,
  TacticalRadar,
  BootWordmark,
  UplinkProgress,
  TerminalLog,
  FlavorRotator,
} from "./loading/LoadingChrome";

const STAGE_LABELS = {
  auth: "Verificação de acesso",
  teams: "Equipas",
  employees: "Operacionais",
  vehicles: "Frota",
  properties: "Imóveis",
  opportunities: "Oportunidades",
  missions: "Operações em curso",
  events: "Registo de atividade",
  quests: "Missões",
  catalogo: "Catálogo",
  processamento: "Sincronização final",
};

const getStageLabel = (key) => STAGE_LABELS[key] || key;

const STATUS_MAP = { done: "done", error: "error", in_progress: "active" };

export function LoadingScreen() {
  const { loading, progress, currentStage, stages, error } = useLoading();

  if (!loading && !error) return null;

  if (error) {
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
                <p className="mt-1 font-mono text-xs text-zinc-400">{getStageLabel(error.stage)}</p>
              </div>
            </div>
            <div className="rounded border border-red-800/50 bg-red-950/30 p-3">
              <p className="break-words font-mono text-xs text-red-200">{error.message}</p>
            </div>
            <p className="text-center font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              Tenta recarregar a página. Se persistir, contacta o suporte.
            </p>
          </div>
        </TacticalFrame>
      </LoadingBackdrop>
    );
  }

  const rows = stages.map((s) => ({
    key: s.key,
    label: getStageLabel(s.key),
    status: STATUS_MAP[s.status] || "pending",
  }));
  const doneCount = stages.filter((s) => s.status === "done").length;

  return (
    <LoadingBackdrop>
      <TacticalFrame>
        <div className="space-y-5">
          <TacticalRadar />
          <BootWordmark
            statusText={currentStage ? getStageLabel(currentStage.key) : "A preparar operações…"}
          />
          <UplinkProgress
            progress={progress}
            label="A ligar à organização"
            meta={`${String(doneCount).padStart(2, "0")}/${String(stages.length).padStart(2, "0")} módulos`}
          />
          <TerminalLog rows={rows} />
          <FlavorRotator />
        </div>
      </TacticalFrame>
    </LoadingBackdrop>
  );
}
