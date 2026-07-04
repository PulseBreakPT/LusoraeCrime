import { createContext, useContext, useEffect, useState } from "react";
import { api, setTokens, clearTokens, getToken } from "../lib/api";
import { formatApiErrorDetail } from "../lib/game";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!getToken()) {
      setUser(false);
      return;
    }
    api
      .get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => {
        clearTokens();
        setUser(false);
      });
  }, []);

  const login = async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      if (data.access_token) setTokens(data.access_token, data.refresh_token);
      setUser({ id: data.id, email: data.email, name: data.name });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: formatApiErrorDetail(e.response?.data?.detail) || e.message };
    }
  };

  const register = async (orgName, email, password) => {
    try {
      const { data } = await api.post("/auth/register", { org_name: orgName, email, password });
      if (data.access_token) setTokens(data.access_token, data.refresh_token);
      setUser({ id: data.id, email: data.email, name: data.name });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: formatApiErrorDetail(e.response?.data?.detail) || e.message };
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout", {});
    } finally {
      clearTokens();
      setUser(false);
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      await api.post("/auth/change-password", { current_password: currentPassword, new_password: newPassword });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: formatApiErrorDetail(e.response?.data?.detail) || e.message };
    }
  };

  const deleteAccount = async (password) => {
    try {
      await api.post("/auth/delete-account", { password });
      clearTokens();
      setUser(false);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: formatApiErrorDetail(e.response?.data?.detail) || e.message };
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, changePassword, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
