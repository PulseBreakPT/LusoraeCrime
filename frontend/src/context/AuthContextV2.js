import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { api } from "../lib/api";
import { formatApiErrorDetail } from "../lib/game";
import { useBoot } from "./BootContext";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const { startBoot, resetBoot } = useBoot();
  const bootRef = useRef(false);

  // Timeout helpers
  const fetchWithTimeout = useCallback(async (url, options = {}, timeoutMs = 8000) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === "AbortError") {
        throw new Error(`Timeout após ${timeoutMs}ms`);
      }
      throw err;
    }
  }, []);

  // Boot sequence — carregamento pós-login
  const performBoot = useCallback(
    async ({ signal, setPhase, advanceProgress, log }) => {
      // VALIDAR SESSÃO (0-15%)
      setPhase("VALIDATING");
      try {
        const meResponse = await api.get("/auth/me", { timeout: 5000, signal });
        setUser(meResponse.data);
        advanceProgress("VALIDATING", 15);
        log("AUTH", "success", "Sessão validada", { userId: meResponse.data.id });
      } catch (err) {
        log("AUTH", "error", "Falha ao validar sessão", { error: err.message });
        throw new Error(`Validação de sessão falhou: ${err.message}`);
      }

      // CARREGAR PERFIL (15-30%)
      setPhase("LOADING_PROFILE");
      advanceProgress("LOADING_PROFILE", 20);
      // Perfil já está em /auth/me, só avançamos progresso
      await new Promise((r) => setTimeout(r, 200));
      advanceProgress("LOADING_PROFILE", 30);
      log("AUTH", "success", "Perfil carregado");

      // CARREGAR ORGANIZAÇÃO (30-45%)
      setPhase("LOADING_ORG");
      advanceProgress("LOADING_ORG", 35);
      try {
        const stateResponse = await api.get("/game/state", {
          timeout: 8000,
          params: { skip_advance: true },
          signal,
        });
        setGameState(stateResponse.data);
        advanceProgress("LOADING_ORG", 45);
        log("AUTH", "success", "Organização carregada");
      } catch (err) {
        log("AUTH", "error", "Falha ao carregar organização", { error: err.message });
        throw new Error(`Carregamento de organização falhou: ${err.message}`);
      }

      // CARREGAR RECURSOS (45-60%)
      setPhase("LOADING_RESOURCES");
      advanceProgress("LOADING_RESOURCES", 50);
      try {
        const catalogResponse = await api.get("/game/catalog", {
          timeout: 5000,
          signal,
        });
        setCatalog(catalogResponse.data);
        advanceProgress("LOADING_RESOURCES", 60);
        log("AUTH", "success", "Catálogo carregado");
      } catch (err) {
        // Catálogo é não-crítico, continuamos
        log("AUTH", "warn", "Falha ao carregar catálogo (não-crítico)", { error: err.message });
        advanceProgress("LOADING_RESOURCES", 60);
      }

      // CARREGAR EQUIPAS E FROTA (60-75%)
      setPhase("LOADING_TEAMS");
      advanceProgress("LOADING_TEAMS", 65);
      // Dados já estão em gameState
      await new Promise((r) => setTimeout(r, 100));
      advanceProgress("LOADING_TEAMS", 75);
      log("AUTH", "success", "Equipas e frota carregadas");

      // CARREGAR MISSÕES (75-90%)
      setPhase("LOADING_MISSIONS");
      advanceProgress("LOADING_MISSIONS", 80);
      // Dados já estão em gameState
      await new Promise((r) => setTimeout(r, 100));
      advanceProgress("LOADING_MISSIONS", 90);
      log("AUTH", "success", "Operações carregadas");

      // PREPARAR INTERFACE (90-100%)
      setPhase("PREPARING_UI");
      advanceProgress("PREPARING_UI", 95);
      await new Promise((r) => setTimeout(r, 100));
      advanceProgress("PREPARING_UI", 100);
      log("AUTH", "success", "Interface pronta");

      return { user: meResponse.data, gameState: stateResponse.data, catalog: catalogResponse.data };
    },
    []
  );

  // Login
  const login = useCallback(
    async (email, password) => {
      try {
        const res = await api.post("/auth/login", { email, password }, { timeout: 8000 });
        if (res.data.access_token) {
          localStorage.setItem("lusorae_access_token", res.data.access_token);
          localStorage.setItem("lusorae_refresh_token", res.data.refresh_token || "");
        }

        // Start boot sequence
        await startBoot(performBoot);
        return { ok: true };
      } catch (err) {
        const errorMsg = formatApiErrorDetail(err.response?.data?.detail) || err.message;
        return { ok: false, error: errorMsg };
      }
    },
    [startBoot, performBoot]
  );

  // Register
  const register = useCallback(
    async (orgName, email, password) => {
      try {
        const res = await api.post(
          "/auth/register",
          { org_name: orgName, email, password },
          { timeout: 10000 }
        );
        if (res.data.access_token) {
          localStorage.setItem("lusorae_access_token", res.data.access_token);
          localStorage.setItem("lusorae_refresh_token", res.data.refresh_token || "");
        }

        // Start boot sequence
        await startBoot(performBoot);
        return { ok: true };
      } catch (err) {
        const errorMsg = formatApiErrorDetail(err.response?.data?.detail) || err.message;
        return { ok: false, error: errorMsg };
      }
    },
    [startBoot, performBoot]
  );

  // Logout
  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout", {}, { timeout: 5000 });
    } catch (_err) {
      // Ignora erro de logout, apenas limpa local
    }
    localStorage.removeItem("lusorae_access_token");
    localStorage.removeItem("lusorae_refresh_token");
    setUser(null);
    setGameState(null);
    setCatalog(null);
    resetBoot();
  }, [resetBoot]);

  // Initialize auth on mount
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;

    const token = localStorage.getItem("lusorae_access_token");
    if (!token) {
      setUser(false);
      return;
    }

    // Validate existing token
    api
      .get("/auth/me", { timeout: 5000 })
      .then((r) => {
        setUser(r.data);
        // Load game state asynchronously
        startBoot(performBoot).catch((_err) => {
          // Boot errors are handled by BootContext
        });
      })
      .catch((_err) => {
        // Invalid token
        localStorage.removeItem("lusorae_access_token");
        localStorage.removeItem("lusorae_refresh_token");
        setUser(false);
      });
  }, [startBoot, performBoot]);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    try {
      await api.post(
        "/auth/change-password",
        { current_password: currentPassword, new_password: newPassword },
        { timeout: 5000 }
      );
      return { ok: true };
    } catch (err) {
      return { ok: false, error: formatApiErrorDetail(err.response?.data?.detail) || err.message };
    }
  }, []);

  const deleteAccount = useCallback(async (password) => {
    try {
      await api.post("/auth/delete-account", { password }, { timeout: 5000 });
      logout();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: formatApiErrorDetail(err.response?.data?.detail) || err.message };
    }
  }, [logout]);

  const claimAdmin = useCallback(async () => {
    try {
      const res = await api.post("/auth/claim-admin", {}, { timeout: 5000 });
      setUser((u) => (u ? { ...u, role: res.data.role } : u));
      return { ok: true, message: res.data.message };
    } catch (err) {
      return { ok: false, error: formatApiErrorDetail(err.response?.data?.detail) || err.message };
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        gameState,
        catalog,
        login,
        register,
        logout,
        changePassword,
        deleteAccount,
        claimAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
};
