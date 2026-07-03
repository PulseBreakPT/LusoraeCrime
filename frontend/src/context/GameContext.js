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
  const previewDispatch = useCallback(async (opportunityId, teamId) => {
    try {
      const { data } = await axios.post(
        `${API}/game/dispatch/preview`,
        { opportunity_id: opportunityId, team_id: teamId },
        { withCredentials: true }
      );
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: formatApiErrorDetail(e.response?.data?.detail) || e.message };
    }
  }, []);
  const createTeam = (spec) => action("teams/create", { spec }, "Equipa formada");
  const recruitEmployee = (candidateId) => action("employees/recruit", { candidate_id: candidateId }, "Recruta contratado");
  const refreshPool = () => action("recruitment/refresh", {}, "Contactos atualizados");
  const assignEmployee = (employeeId, teamId) =>
    action("employees/assign", { employee_id: employeeId, team_id: teamId }, teamId ? "Atribuído à equipa" : "Removido da equipa");
  const trainEmployee = (employeeId, courseKey) =>
    action("employees/train", { employee_id: employeeId, course_key: courseKey }, "Formação iniciada");
  const restEmployee = (employeeId) => action("employees/rest", { employee_id: employeeId }, "Foi descansar");
  const promoteEmployee = (employeeId) => action("employees/promote", { employee_id: employeeId }, "Promovido");
  const bonusEmployee = (employeeId) => action("employees/bonus", { employee_id: employeeId }, "Bónus pago");
  const healEmployee = (employeeId) => action("employees/heal", { employee_id: employeeId }, "Tratamento pago");
  const releaseEmployee = (employeeId) => action("employees/release", { employee_id: employeeId }, "Libertado");
  const fireEmployee = (employeeId) => action("employees/fire", { employee_id: employeeId }, "Despedido");
  const buyVehicle = (modelKey) => action("vehicles/buy", { model_key: modelKey }, "Veículo adquirido");
  const sellVehicle = (vehicleId) => action("vehicles/sell", { vehicle_id: vehicleId }, "Veículo abatido");
  const refuelVehicle = (vehicleId) => action("vehicles/refuel", { vehicle_id: vehicleId }, "Depósito cheio");
  const repairVehicle = (vehicleId) => action("vehicles/repair", { vehicle_id: vehicleId }, "Veículo reparado");
  const assignVehicle = (vehicleId, teamId) =>
    action("vehicles/assign", { vehicle_id: vehicleId, team_id: teamId }, teamId ? "Veículo atribuído" : "Veículo na garagem");
  const buyProperty = (typeKey) => action("properties/buy", { type_key: typeKey }, "Propriedade comprada");
  const sellProperty = (propertyId) => action("properties/sell", { property_id: propertyId }, "Propriedade vendida");
  const upgradeProperty = (propertyId) => action("properties/upgrade", { property_id: propertyId }, "Propriedade melhorada");
  const bribePolice = () => action("police/bribe", {}, "Suborno pago");
  const launder = (amount) => action("launder", { amount }, "Dinheiro lavado");
  const claimQuest = useCallback(async (questId) => {
    const res = await action("quests/claim", { quest_id: questId });
    if (res.ok && res.data?.rewards?.length) toast.success(res.data.rewards.join(" · "));
    if (res.ok && res.data?.unlocks) toast.info(res.data.unlocks);
    return res;
  }, [action]);
  const chooseQuest = useCallback(async (questId, option) => {
    const res = await action("quests/choose", { quest_id: questId, option });
    if (res.ok && res.data?.outcome) toast(res.data.outcome);
    return res;
  }, [action]);

  return (
    <GameContext.Provider
      value={{
        state, catalog, refresh, serverNow, dispatchTeam, previewDispatch, createTeam,
        recruitEmployee, refreshPool, assignEmployee, trainEmployee, restEmployee,
        promoteEmployee, bonusEmployee, healEmployee, releaseEmployee, fireEmployee,
        buyVehicle, sellVehicle, refuelVehicle, repairVehicle, assignVehicle,
        buyProperty, sellProperty, upgradeProperty, bribePolice, launder,
        claimQuest, chooseQuest,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export const useGame = () => useContext(GameContext);
