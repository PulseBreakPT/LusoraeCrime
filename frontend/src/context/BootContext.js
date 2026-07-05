import { createContext, useContext, useState, useRef, useEffect } from "react";

const BootContext = createContext(null);

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
  const logsRef = useRef([]);
  const stateRef = useRef(BOOT_STATES.IDLE);

  // Boot execution
  useEffect(() => {
    if (state !== BOOT_STATES.IDLE && state !== BOOT_STATES.READY && state !== BOOT_STATES.ERROR) {
      // Update elapsed time every second during boot
      const interval = setInterval(() => {
        if (startTime) {
          setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [state, startTime]);

  // Internal log function
  const logEntry = (phase, type, message, details = {}) => {
    const timestamp = new Date().toISOString();
    const entry = { timestamp, phase, type, message, details };
    logsRef.current.push(entry);
    if (type === "error") console.error(`[${phase}] ${message}`, details);
    else console.log(`[${phase}] ${message}`, details);
  };

  // Set boot ready
  const setBootReady = () => {
    clearTimeout(bootTimeoutRef.current);
    setProgress(100);
    setState(BOOT_STATES.READY);
    setCurrentPhase(null);
    stateRef.current = BOOT_STATES.READY;
    logEntry("BOOT", "success", "Boot completo");
  };

  // Set boot error
  const setBootError = (err) => {
    clearTimeout(bootTimeoutRef.current);
    const errorDetails = {
      name: err?.name,
      message: err?.message,
      phase: currentPhase,
      progress,
      timestamp: new Date().toISOString(),
      logs: logsRef.current,
    };
    setError(errorDetails);
    setState(BOOT_STATES.ERROR);
    stateRef.current = BOOT_STATES.ERROR;
    logEntry("BOOT", "error", `Boot falhou: ${err?.message}`);
    console.error("=== BOOT ERROR ===", errorDetails);
    console.table(logsRef.current);
  };

  const startBoot = async (bootFn) => {
    if (stateRef.current !== BOOT_STATES.IDLE) {
      console.warn("Boot já está em progresso");
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setProgress(0);
    setError(null);
    setState(BOOT_STATES.VALIDATING);
    setCurrentPhase("VALIDATING");
    setStartTime(Date.now());
    stateRef.current = BOOT_STATES.VALIDATING;
    logsRef.current = [];

    logEntry("BOOT", "info", "Boot iniciado");

    // Global boot timeout — máximo 30 segundos
    bootTimeoutRef.current = setTimeout(() => {
      setBootError(new Error("Boot timeout após 30 segundos"));
    }, 30000);

    try {
      const result = await bootFn({
        signal: abortControllerRef.current.signal,
        setPhase: (phase) => {
          if (!PHASES[phase]) return;
          setCurrentPhase(phase);
          setProgress(PHASES[phase].min);
          logEntry("BOOT", "info", `Fase: ${PHASES[phase].label}`);
        },
        advanceProgress: (phase, percentage = null) => {
          if (!phase || !PHASES[phase]) return;
          const target = percentage !== null ? percentage : PHASES[phase].max;
          setProgress((prev) => Math.max(prev, Math.min(target, 100)));
        },
        log: logEntry,
      });

      setBootReady();
      return result;
    } catch (err) {
      setBootError(err);
      throw err;
    }
  };

  const resetBoot = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    clearTimeout(bootTimeoutRef.current);
    setState(BOOT_STATES.IDLE);
    setProgress(0);
    setError(null);
    setCurrentPhase(null);
    setStartTime(null);
    setElapsedTime(0);
    stateRef.current = BOOT_STATES.IDLE;
    logsRef.current = [];
  };

  return (
    <BootContext.Provider
      value={{
        state,
        progress,
        currentPhase,
        error,
        elapsedTime,
        startBoot,
        resetBoot,
        isBootReady: state === BOOT_STATES.READY,
        isBootLoading: state !== BOOT_STATES.IDLE && state !== BOOT_STATES.READY && state !== BOOT_STATES.ERROR,
        isBootError: state === BOOT_STATES.ERROR,
      }}
    >
      {children}
    </BootContext.Provider>
  );
}

export const useBoot = () => {
  const context = useContext(BootContext);
  if (!context) throw new Error("useBoot deve ser usado dentro de BootProvider");
  return context;
};
