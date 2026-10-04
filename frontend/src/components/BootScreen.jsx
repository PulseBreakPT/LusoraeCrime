import { useBoot } from "../context/BootContext";
import { AlertTriangle, RotateCcw, LogOut } from "lucide-react";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";
import {
  LoadingBackdrop,
  TacticalFrame,
  TacticalRadar,
  BootWordmark,
  UplinkProgress,
  TerminalLog,
  FlavorRotator,
} from "./loading/LoadingChrome";

const PHASES = [
  ["VALIDATING", "Verificar credenciais", "A verificar credenciais…"],
  ["LOADING_PROFILE", "Carregar perfil", "A carregar perfil…"],
  ["LOADING_ORG", "Carregar organização", "A carregar organização…"],
  ["LOADING_RESOURCES", "Carregar património", "A carregar património…"],
  ["LOADING_TEAMS", "Carregar equipas", "A carregar equipas e frota…"],
  ["LOADING_MISSIONS", "Carregar operações", "A carregar operações…"],
  ["PREPARING_UI", "Preparar interface", "A preparar interface…"],
];

export function BootScreen() {
  const { isBootLoading, isBootError, error, progress, currentPhase, elapsedTime } = useBoot();
  const navigate = useNavigate();

  if (!isBootLoading && !isBootError) return null;

  if (isBootError) {
    return (
      <LoadingBackdrop>
        <TacticalFrame header="Erro de ligação" status="Interrompido" tone="error">
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <span className="sub-alert-icon">
                <AlertTriangle className="h-9 w-9 flex-shrink-0 text-destructive" />
              </span>
              <div>
                <p className="font-display text-lg font-bold uppercase tracking-wide text-white">Não foi possível carregar o jogo</p>
                <p className="mt-1 font-mono text-xs text-zinc-400">
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
              <Button onClick={() => navigate("/auth")} variant="outline" className="w-full" size="sm">
                <LogOut className="mr-2 h-4 w-4" />
                Voltar ao Login
              </Button>
            </div>

            <details className="text-[10px] text-zinc-500">
              <summary className="cursor-pointer font-mono uppercase tracking-widest hover:text-zinc-400">Detalhes Técnicos</summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-black/50 p-2 font-mono text-[9px]">
                {JSON.stringify(error, null, 2)}
              </pre>
            </details>
          </div>
        </TacticalFrame>
      </LoadingBackdrop>
    );
  }

  // Show skip button if loading takes too long (>8 seconds)
  const showSkip = elapsedTime > 8;
  const isComplete = progress >= 100;
  const currentIdx = PHASES.findIndex(([key]) => key === currentPhase);
  const activePhase = currentIdx >= 0 ? PHASES[currentIdx] : null;

  const rows = PHASES.map(([key, label], i) => ({
    key,
    label,
    status:
      isComplete || (currentIdx >= 0 && i < currentIdx)
        ? "done"
        : i === currentIdx
        ? "active"
        : "pending",
  }));
  const doneCount = rows.filter((r) => r.status === "done").length;

  return (
    <LoadingBackdrop>
      <TacticalFrame>
        <div className="space-y-5">
          <TacticalRadar />
          <BootWordmark statusText={activePhase ? activePhase[2] : "A inicializar…"} />
          <UplinkProgress
            progress={progress}
            label="A carregar"
            meta={`${String(doneCount).padStart(2, "0")}/${String(rows.length).padStart(2, "0")} fases`}
          />
          <TerminalLog title="Progresso" rows={rows} />
          <FlavorRotator />

          <p className="text-center font-mono text-[10px] uppercase tracking-widest text-zinc-700">
            {elapsedTime}s decorridos
          </p>

          {showSkip && (
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="w-full text-xs"
              size="sm"
            >
              Está a demorar — recarregar
            </Button>
          )}
        </div>
      </TacticalFrame>
    </LoadingBackdrop>
  );
}
