import { useLoading } from "../context/LoadingContext";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

export function LoadingScreen() {
  const { loading, progress, currentStage, stages, error } = useLoading();

  if (!loading && !error) return null;

  const getStageIcon = (status) => {
    switch (status) {
      case "done":
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
      case "error":
        return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
      case "in_progress":
        return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
      default:
        return <div className="h-3.5 w-3.5 rounded-full border border-zinc-700" />;
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
    <div className="lus-boot-bg fixed inset-0 z-50 flex items-center justify-center">
      <div className="mx-4 w-full max-w-md space-y-7 animate-slide-up">
        {error ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 flex-shrink-0 text-destructive" />
              <div>
                <p className="font-display font-bold uppercase tracking-wide text-white">Falha na ligação à organização</p>
                <p className="mt-1 text-xs text-zinc-400">
                  {getStageLabel(error.stage)}
                </p>
              </div>
            </div>
            <div className="rounded border border-red-800/50 bg-red-950/30 p-3">
              <p className="break-words font-mono text-xs text-red-200">
                {error.message}
              </p>
            </div>
            <p className="text-center text-xs text-zinc-400">
              Tenta recarregar a página. Se o problema persistir, contacta o suporte.
            </p>
          </div>
        ) : (
          <>
            <div className="text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.45em] text-primary/90">Lisboa · Rede Criminosa</p>
              <h1 className="lus-title lus-boot-logo mt-1 font-display text-6xl font-bold uppercase leading-none tracking-tight">Lusorae</h1>
              <p className="mt-3 font-mono text-xs text-zinc-400">
                {currentStage ? getStageLabel(currentStage.key) : "A preparar operações…"}
              </p>
            </div>

            <div>
              <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                <span>A ligar à organização</span>
                <span className="text-zinc-200">{progress}%</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full border border-white/10 bg-black/60">
                <div
                  className="lus-progress-fill h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="space-y-1 font-mono text-[11px]">
              {stages.map((stage) => (
                <div
                  key={stage.key}
                  className={`flex items-center gap-2 rounded border px-2.5 py-1 transition-colors ${
                    stage.status === "in_progress"
                      ? "border-red-500/30 bg-red-500/10 text-red-200"
                      : stage.status === "done"
                      ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300/80"
                      : stage.status === "error"
                      ? "border-red-800/50 bg-red-950/30 text-red-300"
                      : "border-transparent text-zinc-600"
                  }`}
                >
                  {getStageIcon(stage.status)}
                  <span className="flex-1 uppercase tracking-wider">
                    {getStageLabel(stage.key)}
                  </span>
                  {stage.status === "done" && (
                    <span className="font-mono text-[10px] text-emerald-400">OK</span>
                  )}
                  {stage.status === "error" && (
                    <span className="font-mono text-[10px] text-destructive">ERRO</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
