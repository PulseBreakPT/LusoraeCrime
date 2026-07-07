import { useBoot } from "../context/BootContext";
import { AlertTriangle, RotateCcw, LogOut } from "lucide-react";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";

export function BootScreen() {
  const { isBootLoading, isBootError, error, progress, currentPhase, elapsedTime } = useBoot();
  const navigate = useNavigate();

  const phaseLabels = {
    VALIDATING: "A verificar credenciais…",
    LOADING_PROFILE: "A carregar dossiê…",
    LOADING_ORG: "A carregar organização…",
    LOADING_RESOURCES: "A carregar património…",
    LOADING_TEAMS: "A carregar equipas e frota…",
    LOADING_MISSIONS: "A carregar operações…",
    PREPARING_UI: "A preparar posto de comando…",
  };

  if (!isBootLoading && !isBootError) return null;

  if (isBootError) {
    return (
      <div className="lus-boot-bg fixed inset-0 z-50 flex items-center justify-center">
        <div className="mx-4 w-full max-w-md space-y-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-10 w-10 flex-shrink-0 text-destructive" />
            <div>
              <p className="font-display text-lg font-bold uppercase tracking-wide text-white">Falha na ligação à organização</p>
              <p className="mt-1 text-xs text-zinc-400">
                {error?.phase ? `Falha em: ${error.phase.replace(/_/g, " ").toLowerCase()}` : "Erro desconhecido"}
              </p>
            </div>
          </div>

          <div className="space-y-2 rounded border border-red-800/50 bg-red-950/30 p-4">
            <p className="font-mono text-xs text-red-200">{error?.message || "Erro desconhecido"}</p>
            {error?.details && (
              <p className="font-mono text-[10px] text-zinc-400 opacity-75">
                {error.details.name}: {error.details.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Button onClick={() => window.location.reload()} className="w-full" size="sm">
              <RotateCcw className="mr-2 h-4 w-4" />
              Tentar Novamente
            </Button>
            <Button
              onClick={() => navigate("/auth")}
              variant="outline"
              className="w-full"
              size="sm"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Voltar ao Login
            </Button>
          </div>

          <details className="text-[10px] text-zinc-500">
            <summary className="cursor-pointer hover:text-zinc-400">Detalhes Técnicos</summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-black/50 p-2 font-mono text-[8px]">
              {JSON.stringify(error, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    );
  }

  // Show skip button if loading takes too long (>8 seconds)
  const showSkip = elapsedTime > 8;

  return (
    <div className="lus-boot-bg fixed inset-0 z-50 flex items-center justify-center">
      <div className="mx-4 w-full max-w-md space-y-8 animate-slide-up">
        <div className="text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.45em] text-primary/90">Lisboa · Rede Criminosa</p>
          <h1 className="lus-title lus-boot-logo mt-1 font-display text-6xl font-bold uppercase leading-none tracking-tight">Lusorae</h1>
          <p className="mt-3 font-mono text-xs text-zinc-400">{phaseLabels[currentPhase] || "A inicializar…"}</p>
        </div>

        <div>
          <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            <span>Ligação segura</span>
            <span className="text-zinc-200">{progress}%</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full border border-white/10 bg-black/60">
            <div className="lus-progress-fill h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="space-y-1 font-mono text-[11px]">
          {Object.entries({
            VALIDATING: "Verificar credenciais",
            LOADING_PROFILE: "Carregar dossiê",
            LOADING_ORG: "Carregar organização",
            LOADING_RESOURCES: "Carregar património",
            LOADING_TEAMS: "Carregar equipas",
            LOADING_MISSIONS: "Carregar operações",
            PREPARING_UI: "Preparar posto de comando",
          }).map(([key, label]) => {
            const isActive = key === currentPhase;
            const isComplete = progress >= 100;
            return (
              <div
                key={key}
                className={`flex items-center gap-2 rounded border px-2.5 py-1 transition-colors ${
                  isActive
                    ? "border-red-500/30 bg-red-500/10 text-red-200"
                    : isComplete
                    ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300/80"
                    : "border-transparent text-zinc-600"
                }`}
              >
                <span className={isActive ? "text-primary" : ""}>▸</span>
                <span className="uppercase tracking-wider">{label}</span>
                {isActive && <span className="ml-auto animate-pulse text-primary">●</span>}
              </div>
            );
          })}
        </div>

        <p className="text-center font-mono text-[10px] uppercase tracking-widest text-zinc-600">{elapsedTime}s decorridos</p>

        {showSkip && (
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="w-full text-xs"
            size="sm"
          >
            Ligação lenta — recarregar
          </Button>
        )}
      </div>
    </div>
  );
}
