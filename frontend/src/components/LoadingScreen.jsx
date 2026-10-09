import { useLoading } from "../context/LoadingContext";
import { AlertTriangle, Loader2 } from "lucide-react";

/**
 * No cinematic gateway: progress is a small, non-blocking status indicator.
 * GamePage and the authenticated shell can render immediately.
 */
export function LoadingScreen() {
  const { loading, currentStage, error } = useLoading();
  if (!loading && !error) return null;
  return (
    <div className={`noir-inline-loading ${error ? "is-error" : ""}`}
      role="status" aria-live="polite" data-testid="inline-loading-status">
      {error ? <AlertTriangle size={16} /> : <Loader2 size={16} className="animate-spin" />}
      <span>{error ? (error.message || "Erro ao carregar dados do jogo") : (
        currentStage?.label || "A sincronizar a organização"
      )}</span>
    </div>
  );
}
