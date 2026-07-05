import { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";

const BootContext = createContext(null);

// Estados do boot
const BOOT_STATES = {
  IDLE: "idle",
  VALIDATING: "validating",
  LOADING_PROFILE: "loading_profile",
  LOADING_ORG: "loading_org",
  LOADING_RESOURCES: "loading_resources",
  LOADING_TEAMS: "loading_teams",
  LOADING_MISSIONS: "loading_missions",
  PREPARING_UI: "preparing_ui",
  READY: "ready",
  ERROR: "error",
};

// Fases do boot com range de progresso
const PHASES = {
  VALIDATING: { min: 0, max: 15, label: "A validar sessão…" },
  LOADING_PROFILE: { min: 15, max: 30, label: "A carregar perfil…" },
  LOADING_ORG: { min: 30, max: 45, label: "A carregar organização…" },
  LOADING_RESOURCES: { min: 45, max: 60, label: "A carregar recursos…" },
  LOADING_TEAMS: { min: 60, max: 75, label: "A carregar equipas e frota…" },
  LOADING_MISSIONS: { min: 75, max: 90, label: "A carregar operações…" },
  PREPARING_UI: { min: 90, max: 100, label: "A preparar interface…" },
};

export function BootProvider({ children }) {
  const [state, setState] = useState(BOOT_STATES.IDLE);
  const [progress, setProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState(null);
  const [error, setError] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const abortControllerRef = useRef(null);
  const bootTimeoutRef = useRef(null);
  const phaseTimeoutRef = useRef(null);
  const logsRef = useRef([]);

  // Log helper
  const log = useCallback((phase, type, message, details = {}) => {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, phase, type, message, details };
    logsRef.current.push(logEntry);
    console.log(`[${phase}] ${type.toUpperCase()}: ${message}`, details);
  }, []);

  // Advance progress
  const advanceProgress = useCallback((phase, percentage = null) => {
    if (!phase || !PHASES[phase]) return;
    const phaseConfig = PHASES[phase];
    const targetProgress = percentage !== null ? percentage : phaseConfig.max;
    setProgress((prev) => Math.max(prev, Math.min(targetProgress, 100)));
  }, []);

  // Start boot sequence
  const startBoot = useCallback(async (bootFn) => {
    // Cancel any previous boot
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Clear previous state
    setProgress(0);
    setError(null);
    setState(BOOT_STATES.VALIDATING);
    setCurrentPhase("VALIDATING");
    setStartTime(Date.now());
    logsRef.current = [];

    log("BOOT", "info", "Boot iniciado");

    // Global boot timeout — máximo 30 segundos
    bootTimeoutRef.current = setTimeout(() => {
      const err = new Error("Boot timeout — operação demorou demasiado tempo (>30s)");
      failBoot(err);
    }, 30000);

    try {
      const result = await bootFn({
        signal: abortControllerRef.current.signal,
        setPhase: (phase) => {
          if (!PHASES[phase]) return;
          setCurrentPhase(phase);
          const phaseConfig = PHASES[phase];
          setProgress(phaseConfig.min);
          log("BOOT", "info", `Fase iniciada: ${phaseConfig.label}`);
        },
        advanceProgress,
        log,
      });

      clearTimeout(bootTimeoutRef.current);
      setProgress(100);
      setState(BOOT_STATES.READY);
      setCurrentPhase(null);
      log("BOOT", "success", "Boot completo", { duration: Date.now() - startTime });
      return result;
    } catch (err) {
      clearTimeout(bootTimeoutRef.current);
      failBoot(err);
      throw err;
    }
  }, [log, advanceProgress]);

  // Fail boot
  const failBoot = useCallback((err) => {
    abortControllerRef.current?.abort();
    clearTimeout(bootTimeoutRef.current);
    clearTimeout(phaseTimeoutRef.current);

    const errorMessage = err?.message || "Erro desconhecido";
    const errorDetails = {
      name: err?.name,
      message: err?.message,
      stack: err?.stack,
      phase: currentPhase,
      progress,
      timestamp: new Date().toISOString(),
      logs: logsRef.current,
    };

    setError(errorDetails);
    setState(BOOT_STATES.ERROR);
    log("BOOT", "error", `Boot falhou: ${errorMessage}`, errorDetails);

    // Log everything to console for debugging
    console.error("=== BOOT ERROR DETAILS ===");
    console.error(errorDetails);
    console.error("=== BOOT LOGS ===");
    console.table(logsRef.current);
  }, [currentPhase, progress, log]);

  // Reset boot
  const resetBoot = useCallback(() => {
    abortControllerRef.current?.abort();
    clearTimeout(bootTimeoutRef.current);
    clearTimeout(phaseTimeoutRef.current);
    setState(BOOT_STATES.IDLE);
    setProgress(0);
    setError(null);
    setCurrentPhase(null);
    setStartTime(null);
    setElapsedTime(0);
    logsRef.current = [];
  }, []);

  // Update elapsed time every 100ms
  useEffect(() => {
    if (state !== BOOT_STATES.READY && state !== BOOT_STATES.ERROR && state !== BOOT_STATES.IDLE) {
      const interval = setInterval(() => {
        if (startTime) {
          setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [state, startTime]);

  return (
    <BootContext.Provider
      value={{
        state,
        progress,
        currentPhase,
        error,
        elapsedTime,
        startBoot,
        failBoot,
        resetBoot,
        isBootReady: state === BOOT_STATES.READY,
        isBootLoading:
          state !== BOOT_STATES.IDLE &&
          state !== BOOT_STATES.READY &&
          state !== BOOT_STATES.ERROR,
        isBootError: state === BOOT_STATES.ERROR,
      }}
    >
      {children}
    </BootContext.Provider>
  );
}

export const useBoot = () => {
  const context = useContext(BootContext);
  if (!context) {
    throw new Error("useBoot deve ser usado dentro de BootProvider");
  }
  return context;
};
