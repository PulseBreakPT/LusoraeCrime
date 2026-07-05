import { createContext, useContext, useState, useCallback } from "react";

const LoadingContext = createContext(null);

export function LoadingProvider({ children }) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stages, setStages] = useState([]);
  const [currentStage, setCurrentStage] = useState(null);
  const [error, setError] = useState(null);

  const startLoading = useCallback((stagesConfig) => {
    setLoading(true);
    setProgress(0);
    setStages(stagesConfig);
    setCurrentStage(null);
    setError(null);
  }, []);

  const updateStage = useCallback((stageKey, status = "in_progress") => {
    setCurrentStage({ key: stageKey, status });
    setStages((prev) =>
      prev.map((s) => (s.key === stageKey ? { ...s, status } : s))
    );
    // Calcula progresso baseado em etapas completadas
    setProgress((prev) => {
      const completed = stages.filter((s) => s.status === "done").length + 1;
      const total = stages.length;
      return Math.min(95, Math.round((completed / total) * 100));
    });
  }, [stages]);

  const completeStage = useCallback((stageKey) => {
    updateStage(stageKey, "done");
  }, [updateStage]);

  const failStage = useCallback((stageKey, errorMsg) => {
    setError({ stage: stageKey, message: errorMsg });
    setLoading(false);
    updateStage(stageKey, "error");
  }, [updateStage]);

  const finishLoading = useCallback(() => {
    setLoading(false);
    setProgress(100);
    setCurrentStage(null);
  }, []);

  const resetLoading = useCallback(() => {
    setLoading(false);
    setProgress(0);
    setStages([]);
    setCurrentStage(null);
    setError(null);
  }, []);

  return (
    <LoadingContext.Provider
      value={{
        loading,
        progress,
        stages,
        currentStage,
        error,
        startLoading,
        updateStage,
        completeStage,
        failStage,
        finishLoading,
        resetLoading,
      }}
    >
      {children}
    </LoadingContext.Provider>
  );
}

export const useLoading = () => useContext(LoadingContext);
