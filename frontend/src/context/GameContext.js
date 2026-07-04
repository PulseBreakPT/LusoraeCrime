import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useAuth } from "./AuthContext";
import { formatApiErrorDetail } from "../lib/game";
import { usePersistedState } from "../lib/persist";

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const offsetRef = useRef(0);
  const fetchingRef = useRef(false);
  const prevTeamsRef = useRef(null);
  const [justReturnedTeamIds, setJustReturnedTeamIds] = useState([]);
  const [favoriteTeamIds, setFavoriteTeamIds] = usePersistedState("favTeams", []);
  const [favoriteEmployeeIds, setFavoriteEmployeeIds] = usePersistedState("favEmployees", []);
  const [favoriteVehicleIds, setFavoriteVehicleIds] = usePersistedState("favVehicles", []);

  const toggleInList = (setter) => (id) =>
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleFavoriteTeam = toggleInList(setFavoriteTeamIds);
  const toggleFavoriteEmployee = toggleInList(setFavoriteEmployeeIds);
  const toggleFavoriteVehicle = toggleInList(setFavoriteVehicleIds);

  const refresh = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const { data } = await api.get("/game/state");
      offsetRef.current = Date.parse(data.server_time) - Date.now();
      // Deteta equipas que acabaram de regressar (transição de "em operação" para
      // "na base") para dar um destaque temporário e avisar o jogador — ignora o
      // primeiro carregamento (sem estado anterior) para não disparar à toa.
      if (prevTeamsRef.current) {
        const returned = data.teams.filter((t) => {
          const prevStatus = prevTeamsRef.current[t.id];
          return prevStatus && prevStatus !== "idle" && t.status === "idle";
        });
        if (returned.length > 0) {
          returned.forEach((t) => toast.info(`${t.name} regressou e está pronta`));
          setJustReturnedTeamIds((prev) => [...new Set([...prev, ...returned.map((t) => t.id)])]);
          setTimeout(() => {
            const ids = returned.map((t) => t.id);
            setJustReturnedTeamIds((prev) => prev.filter((id) => !ids.includes(id)));
          }, 8000);
        }
      }
      prevTeamsRef.current = Object.fromEntries(data.teams.map((t) => [t.id, t.status]));
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
    api.get("/game/catalog").then((r) => setCatalog(r.data)).catch(() => {});
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [user, refresh]);

  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

  const action = useCallback(
    async (path, payload, successMsg) => {
      try {
        const { data } = await api.post(`/game/${path}`, payload);
        if (successMsg) toast.success(successMsg);
        // Não esperamos pelo refresh completo do estado para responder ao
        // utilizador — isso fazia os botões parecerem lentos (dois pedidos
        // de rede em série). O polling de 4s e este refresh em segundo plano
        // já mantêm o estado atualizado a seguir.
        refresh();
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
  const recallTeam = (missionId) => action("missions/recall", { mission_id: missionId }, "Equipa chamada de volta");
  const previewDispatch = useCallback(async (opportunityId, teamId) => {
    try {
      const { data } = await api.post("/game/dispatch/preview", { opportunity_id: opportunityId, team_id: teamId });
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: formatApiErrorDetail(e.response?.data?.detail) || e.message };
    }
  }, []);
  const recommendOpportunityForTeam = useCallback(async (teamId) => {
    try {
      const { data } = await api.post("/game/dispatch/recommend_opportunity", { team_id: teamId });
      return { ok: true, data };
    } catch (e) {
      return { ok: false };
    }
  }, []);
  const recommendTeamForOpportunity = useCallback(async (opportunityId) => {
    try {
      const { data } = await api.post("/game/dispatch/recommend_team", { opportunity_id: opportunityId });
      return { ok: true, data };
    } catch (e) {
      return { ok: false };
    }
  }, []);
  const recommendRepeatForTeam = useCallback(async (teamId) => {
    try {
      const { data } = await api.post("/game/dispatch/recommend_repeat", { team_id: teamId });
      return { ok: true, data };
    } catch (e) {
      return { ok: false };
    }
  }, []);
  const toggleFavoriteType = (typeKey) => action("opportunities/favorite", { type_key: typeKey });
  const fetchTransactions = useCallback(async () => {
    try {
      const { data } = await api.get("/game/transactions");
      return { ok: true, data: data.transactions };
    } catch (e) {
      return { ok: false };
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
  const renameEmployee = (employeeId, name) => action("employees/rename", { employee_id: employeeId, name }, "Renomeado");
  const buyVehicle = (modelKey) => action("vehicles/buy", { model_key: modelKey }, "Veículo adquirido");
  const sellVehicle = (vehicleId) => action("vehicles/sell", { vehicle_id: vehicleId }, "Veículo abatido");
  const refuelVehicle = (vehicleId) => action("vehicles/refuel", { vehicle_id: vehicleId }, "Depósito cheio");
  const repairVehicle = (vehicleId) => action("vehicles/repair", { vehicle_id: vehicleId }, "Veículo reparado");
  const assignVehicle = (vehicleId, teamId) =>
    action("vehicles/assign", { vehicle_id: vehicleId, team_id: teamId }, teamId ? "Veículo atribuído" : "Veículo na garagem");
  const renameVehicle = (vehicleId, name) => action("vehicles/rename", { vehicle_id: vehicleId, name }, "Veículo renomeado");
  const buyProperty = (typeKey) => action("properties/buy", { type_key: typeKey }, "Propriedade comprada");
  const sellProperty = (propertyId) => action("properties/sell", { property_id: propertyId }, "Propriedade vendida");
  const upgradeProperty = (propertyId) => action("properties/upgrade", { property_id: propertyId }, "Melhoria iniciada");
  const renameProperty = (propertyId, name) => action("properties/rename", { property_id: propertyId, name }, "Propriedade renomeada");
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
        recallTeam, recommendOpportunityForTeam, recommendTeamForOpportunity, recommendRepeatForTeam,
        toggleFavoriteType, justReturnedTeamIds, fetchTransactions,
        favoriteTeamIds, toggleFavoriteTeam, favoriteEmployeeIds, toggleFavoriteEmployee,
        favoriteVehicleIds, toggleFavoriteVehicle,
        recruitEmployee, refreshPool, assignEmployee, trainEmployee, restEmployee,
        promoteEmployee, bonusEmployee, healEmployee, releaseEmployee, fireEmployee, renameEmployee,
        buyVehicle, sellVehicle, refuelVehicle, repairVehicle, assignVehicle, renameVehicle,
        buyProperty, sellProperty, upgradeProperty, renameProperty, bribePolice, launder,
        claimQuest, chooseQuest,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export const useGame = () => useContext(GameContext);
