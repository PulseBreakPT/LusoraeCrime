import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const TOKEN_KEY = "lusorae_access_token";
const REFRESH_KEY = "lusorae_refresh_token";

// Timeout evita que um pedido preso (CORS mal configurado, backend
// bloqueado) deixe o ecrã em "a carregar" para sempre — ao fim de 15s
// rejeita e cai no catch de quem chamou.
export const api = axios.create({ baseURL: API, timeout: 15000 });

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

export { API };
