import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "./AuthContext";
import { formatApiErrorDetail } from "../lib/game";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const GameContext = createContext(null);

export function GameProvider({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const offsetRef = useRef(0);
  const fetchingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const { data } = await axios.get(`${API}/game/state`, { withCredentials: true });
      offsetRef.current = Date.parse(data.server_time) - Date.now();
      setState(data);
    } catch (e) {
      // silent poll failure
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    refresh();
    axios.get(`${API}/game/catalog`, { withCredentials: true }).then((r) => setCatalog(r.data)).catch(() => {});
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [user, refresh]);

  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

  const action = useCallback(
    async (path, payload, successMsg) => {
      try {
        const { data } = await axios.post(`${API}/game/${path}`, payload, { withCredentials: true });
        if (successMsg) toast.success(successMsg);
        await refresh();
        return { ok: true, data };
      } catch (e) {
        toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
        return { ok: false };
      }
    },
    [refresh]
  );

  const dispatchTeam = (opportunityId, teamId) =>
    action("dispatch", { opportunity_id: opportunityId, team_id: teamId }, "Equipa destacada");
  const recruitTeam = (typeKey) => action("recruit", { type_key: typeKey }, "Equipa recrutada");
  const buyVehicle = (teamId, vehicleKey) => action("vehicle", { team_id: teamId, vehicle_key: vehicleKey }, "Veículo adquirido");
  const launder = (amount) => action("launder", { amount }, "Dinheiro lavado");

  return (
    <GameContext.Provider value={{ state, catalog, refresh, serverNow, dispatchTeam, recruitTeam, buyVehicle, launder }}>
      {children}
    </GameContext.Provider>
  );
}

export const useGame = () => useContext(GameContext);
