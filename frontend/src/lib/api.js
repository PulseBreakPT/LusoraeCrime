import axios from "axios";
import { isLocalGuestMode, localGuestRequest } from "../game/localGuestEngine";

const configuredBackend = String(process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");
const legacyPreviewFallback = "https://lusora-patrols.preview.emergentagent.com";
const onGithubPages = typeof window !== "undefined" && window.location.hostname.endsWith("github.io");
// O Pages público nunca deve ligar silenciosamente ao backend de preview legado.
// Sem backend público explícito, a chamada remota cai em /api e o utilizador pode
// entrar no motor local/convidado sem misturar dados de ambientes.
const safeBackend = onGithubPages && configuredBackend === legacyPreviewFallback ? "" : configuredBackend;
const API = `${safeBackend}/api`;
const TOKEN_KEY = "submundo_access_token";
const REFRESH_KEY = "submundo_refresh_token";

// Timeout evita que um pedido preso (CORS mal configurado, backend
// bloqueado) deixe o ecrã em "a carregar" para sempre — ao fim de 15s
// rejeita e cai no catch de quem chamou.
export const api = axios.create({ baseURL: API, timeout: 15000 });

const remoteGet = api.get.bind(api);
const remotePost = api.post.bind(api);

api.get = (url, config = {}) => (
  isLocalGuestMode()
    ? localGuestRequest("get", url, null, config)
    : remoteGet(url, config)
);

api.post = (url, data = {}, config = {}) => (
  isLocalGuestMode()
    ? localGuestRequest("post", url, data, config)
    : remotePost(url, data, config)
);

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);

export const setTokens = (access, refresh) => {
  if (access) localStorage.setItem(TOKEN_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
};

export const clearTokens = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
};

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ---------------------------------------------------------------------------
// Recuperação automática de sessão expirada: em respostas 401 (fora dos
// endpoints de autenticação) tenta renovar o access token uma única vez com
// o refresh token e repete o pedido original. Se a renovação falhar, limpa a
// sessão local e emite um evento global para a app redirecionar para o login
// com aviso de "sessão expirada" — nunca fica em loading infinito.
// ---------------------------------------------------------------------------
const AUTH_ENDPOINTS = ["/auth/login", "/auth/register", "/auth/google", "/auth/refresh", "/auth/logout"];
let refreshPromise = null;

const expireSession = () => {
  clearTokens();
  try {
    sessionStorage.setItem("sub_session_expired", "1");
  } catch (_e) {
    // sessionStorage indisponível — o evento continua a ser emitido
  }
  window.dispatchEvent(new CustomEvent("sub:session-expired"));
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    const url = config?.url || "";
    const isAuthEndpoint = AUTH_ENDPOINTS.some((e) => url.includes(e));

    if (response?.status === 401 && !isAuthEndpoint && !config._retried) {
      config._retried = true;
      try {
        if (!refreshPromise) {
          const refresh = getRefreshToken();
          refreshPromise = axios
            .post(
              `${API}/auth/refresh`,
              {},
              {
                timeout: 8000,
                headers: refresh ? { Authorization: `Bearer ${refresh}` } : {},
              }
            )
            .finally(() => {
              refreshPromise = null;
            });
        }
        const res = await refreshPromise;
        if (res.data?.access_token) setTokens(res.data.access_token, null);
        return api(config);
      } catch (_refreshErr) {
        expireSession();
      }
    }
    return Promise.reject(error);
  }
);

export { API };
