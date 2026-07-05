import { useBoot } from "../context/BootContext";
import { AlertTriangle, RotateCcw, LogOut } from "lucide-react";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";

export function BootScreen() {
  const { isBootLoading, isBootError, error, progress, currentPhase, elapsedTime } = useBoot();
  const navigate = useNavigate();

  const phaseLabels = {
    VALIDATING: "A validar sessão…",
    LOADING_PROFILE: "A carregar perfil…",
    LOADING_ORG: "A carregar organização…",
    LOADING_RESOURCES: "A carregar recursos…",
    LOADING_TEAMS: "A carregar equipas e frota…",
    LOADING_MISSIONS: "A carregar operações…",
    PREPARING_UI: "A preparar interface…",
  };

  if (!isBootLoading && !isBootError) return null;

  if (isBootError) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/95 z-50 backdrop-blur-sm">
        <div className="max-w-md w-full mx-4 space-y-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-10 w-10 text-destructive flex-shrink-0" />
            <div>
              <p className="font-bold text-white text-lg">Erro ao Carregar Jogo</p>
              <p className="text-xs text-zinc-400 mt-1">
                {error?.phase ? `Falha em: ${error.phase.replace(/_/g, " ").toLowerCase()}` : "Erro desconhecido"}
              </p>
            </div>
          </div>

          <div className="bg-red-950/30 border border-red-800/50 rounded p-4 space-y-2">
            <p className="text-xs text-red-200 font-mono">{error?.message || "Erro desconhecido"}</p>
            {error?.details && (
              <p className="text-[10px] text-zinc-400 font-mono opacity-75">
                {error.details.name}: {error.details.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Button onClick={() => window.location.reload()} className="w-full" size="sm">
              <RotateCcw className="h-4 w-4 mr-2" />
              Tentar Novamente
            </Button>
            <Button
              onClick={() => navigate("/auth")}
              variant="outline"
              className="w-full"
              size="sm"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Voltar ao Login
            </Button>
          </div>

          <details className="text-[10px] text-zinc-500">
            <summary className="cursor-pointer hover:text-zinc-400">Detalhes Técnicos</summary>
            <pre className="mt-2 bg-black/50 p-2 rounded overflow-auto max-h-40 font-mono text-[8px] whitespace-pre-wrap break-words">
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
    <div className="fixed inset-0 flex items-center justify-center bg-black/95 z-50 backdrop-blur-sm">
      <div className="max-w-md w-full mx-4 space-y-6">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <p className="font-bold text-white text-base">A Carregar Lusorae</p>
            <p className="text-xs text-zinc-500 font-mono">{progress}%</p>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            {phaseLabels[currentPhase] || "Inicializando…"}
            {currentPhase && <span className="ml-2 text-[10px] text-zinc-600">({currentPhase})</span>}
          </p>
          <p className="text-[10px] text-zinc-600 mt-1">Tempo: {elapsedTime}s</p>
        </div>

        <div className="space-y-3">
          <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="text-xs text-zinc-500 text-center font-mono">
            {elapsedTime}s decorridos
          </div>
        </div>

        <div className="space-y-1 text-[11px]">
          {Object.entries({
            VALIDATING: "Validar sessão",
            LOADING_PROFILE: "Carregar perfil",
            LOADING_ORG: "Carregar organização",
            LOADING_RESOURCES: "Carregar recursos",
            LOADING_TEAMS: "Carregar equipas",
            LOADING_MISSIONS: "Carregar operações",
            PREPARING_UI: "Preparar interface",
          }).map(([key, label]) => {
            const isActive = key === currentPhase;
            const isComplete = progress >= 100;
            return (
              <div
                key={key}
                className={`flex items-center gap-2 px-2 py-1 rounded transition-colors ${
                  isActive
                    ? "bg-blue-500/20 text-blue-300"
                    : isComplete
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-zinc-900/50 text-zinc-500"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" />
                <span>{label}</span>
              </div>
            );
          })}
        </div>

        {showSkip && (
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="w-full text-xs"
            size="sm"
          >
            ⚠️ Carregamento lento - Recarregar
          </Button>
        )}
      </div>
    </div>
  );
}
