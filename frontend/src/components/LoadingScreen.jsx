import { useLoading } from "../context/LoadingContext";
import { AlertTriangle, CheckCircle2, Loader2, BarChart3 } from "lucide-react";

export function LoadingScreen() {
  const { loading, progress, currentStage, stages, error } = useLoading();

  if (!loading && !error) return null;

  const getStageIcon = (status) => {
    switch (status) {
      case "done":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "error":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case "in_progress":
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      default:
        return <div className="h-4 w-4 rounded-full border border-zinc-400" />;
    }
  };

  const getStageLabel = (key) => {
    const labels = {
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
    return labels[key] || key;
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50 backdrop-blur-sm">
      <div className="max-w-md w-full mx-4 space-y-6">
        {error ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-destructive flex-shrink-0" />
              <div>
                <p className="font-bold text-white">Falha na ligação à organização</p>
                <p className="text-xs text-zinc-400 mt-1">
                  {getStageLabel(error.stage)}
                </p>
              </div>
            </div>
            <div className="bg-red-950/30 border border-red-800/50 rounded p-3">
              <p className="text-xs text-red-200 font-mono break-words">
                {error.message}
              </p>
            </div>
            <p className="text-xs text-zinc-400 text-center">
              Tenta recarregar a página. Se o problema persistir, contacta o suporte.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <BarChart3 className="h-6 w-6 text-primary animate-pulse" />
              <div>
                <p className="font-bold text-white text-sm">A ligar à organização</p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {progress}% — {currentStage ? getStageLabel(currentStage.key) : "A preparar operações..."}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary via-cyan-400 to-emerald-400 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="space-y-1.5">
                {stages.map((stage) => (
                  <div
                    key={stage.key}
                    className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-black/40 border border-zinc-700/50"
                  >
                    {getStageIcon(stage.status)}
                    <span className="flex-1 text-zinc-300">
                      {getStageLabel(stage.key)}
                    </span>
                    {stage.status === "done" && (
                      <span className="text-emerald-400 font-mono text-[10px]">
                        OK
                      </span>
                    )}
                    {stage.status === "error" && (
                      <span className="text-destructive font-mono text-[10px]">
                        ERRO
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-zinc-500 text-center font-mono">
              {currentStage?.key ? `→ ${getStageLabel(currentStage.key)}` : ""}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
