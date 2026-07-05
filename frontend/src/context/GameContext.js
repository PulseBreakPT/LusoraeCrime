import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useAuth } from "./AuthContext";
import { useSettings } from "./SettingsContext";
import { formatApiErrorDetail } from "../lib/game";
import { usePersistedState } from "../lib/persist";
import { haptics } from "../lib/haptics";

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const { user } = useAuth();
  const { autoOpenReport, notifications } = useSettings();
  const [state, setState] = useState(null);
  const [stateError, setStateError] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const offsetRef = useRef(0);
  const fetchingRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const consecutiveFailuresRef = useRef(0);
  const connectionLostWarnedRef = useRef(false);
  const initialLoadAttemptsRef = useRef(0);
  const abortControllerRef = useRef(new AbortController());
  const prevTeamsRef = useRef(null);
  const prevEmployeesRef = useRef(null);
  const prevVehiclesRef = useRef(null);
  const prevPropertiesRef = useRef(null);
  const prevOppIdsRef = useRef(null);
  const payrollWarnedRef = useRef(false);
  const [justReturnedTeamIds, setJustReturnedTeamIds] = useState([]);
  const [autoOpenReportSignal, setAutoOpenReportSignal] = useState(0);
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
    const startTime = Date.now();
    try {
      const { data } = await api.get("/game/state", { timeout: 8000 });
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
          haptics.success();
          if (notifications?.teamAvailable !== false) {
            returned.forEach((t) => toast.info(`${t.name} regressou e está pronta`));
          }
          if (notifications?.missionCompleted !== false) {
            returned.forEach((t) => toast.success(`${t.name} concluiu a operação — vê o relatório em Intel.`));
          }
          setJustReturnedTeamIds((prev) => [...new Set([...prev, ...returned.map((t) => t.id)])]);
          setTimeout(() => {
            const ids = returned.map((t) => t.id);
            setJustReturnedTeamIds((prev) => prev.filter((id) => !ids.includes(id)));
          }, 8000);
          if (autoOpenReport) setAutoOpenReportSignal((n) => n + 1);
        }
      }
      prevTeamsRef.current = Object.fromEntries(data.teams.map((t) => [t.id, t.status]));

      // Restantes notificações: cada uma deteta a sua própria transição de
      // estado (comparando com o poll anterior) em vez de partilhar um único
      // evento genérico — para os interruptores de Definições > Notificações
      // corresponderem mesmo à coisa que dizem.
      if (prevEmployeesRef.current) {
        if (notifications?.employeeExhausted !== false) {
          data.employees.forEach((e) => {
            const prevFatigue = prevEmployeesRef.current[e.id];
            if (prevFatigue != null && prevFatigue < 90 && e.fatigue >= 90) {
              haptics.warning();
              toast.warning(`${e.name} está exausto — precisa de descansar`);
            }
          });
        }
      }
      prevEmployeesRef.current = Object.fromEntries(data.employees.map((e) => [e.id, e.fatigue]));

      if (prevVehiclesRef.current) {
        data.vehicles.forEach((v) => {
          const prev = prevVehiclesRef.current[v.id];
          if (!prev) return;
          if (notifications?.vehicleBroken !== false && prev.condition >= 20 && v.condition < 20) {
            haptics.warning();
            toast.warning(`${v.name} está avariado — repara antes de despachar`);
          }
          if (notifications?.repairCompleted !== false && prev.condition < 99 && v.condition >= 99.5) {
            haptics.success();
            toast.success(`${v.name} foi reparado — condição a 100%`);
          }
        });
      }
      prevVehiclesRef.current = Object.fromEntries(data.vehicles.map((v) => [v.id, { condition: v.condition }]));

      if (prevPropertiesRef.current && notifications?.constructionCompleted !== false) {
        data.properties.forEach((p) => {
          const wasUpgrading = prevPropertiesRef.current[p.id];
          if (wasUpgrading && !p.upgrading_until) {
            haptics.success();
            toast.success(`${p.name} concluiu a melhoria — agora no nível ${p.level}`);
          }
        });
      }
      prevPropertiesRef.current = Object.fromEntries(data.properties.map((p) => [p.id, !!p.upgrading_until]));

      if (prevOppIdsRef.current && notifications?.rareMissions !== false) {
        const newRare = data.opportunities.filter((o) => o.rare && !prevOppIdsRef.current.has(o.id));
        newRare.forEach((o) => {
          haptics.heavy();
          toast.success(`Missão rara disponível: ${o.name} em ${o.district}`);
        });
      }
      prevOppIdsRef.current = new Set(data.opportunities.map((o) => o.id));

      if (notifications?.payrollDue !== false && data.player.next_payroll_at) {
        const dueInS = (Date.parse(data.player.next_payroll_at) - Date.parse(data.server_time)) / 1000;
        if (dueInS <= 300 && (data.salary_total || 0) > 0) {
          if (!payrollWarnedRef.current) {
            haptics.warning();
            toast.warning("Salários por pagar em breve — garante que há dinheiro limpo suficiente");
            payrollWarnedRef.current = true;
          }
        } else {
          payrollWarnedRef.current = false;
        }
      }

      setState(data);
      setStateError(null);
      hasLoadedRef.current = true;
      if (consecutiveFailuresRef.current > 0 && connectionLostWarnedRef.current) {
        toast.success("Ligação ao jogo restabelecida");
      }
      consecutiveFailuresRef.current = 0;
      connectionLostWarnedRef.current = false;
    } catch (e) {
      // Uma falha de poll isolada depois de já termos carregado com sucesso
      // fica silenciosa (rede oscila, o próximo poll de 4s resolve sozinho) —
      // mas se isto acontece na primeira carga, o ecrã ficaria preso em "A
      // ligar à rede..." para sempre sem qualquer pista do porquê. Torna-se
      // visível e dá para tentar de novo manualmente.
      console.error("Falha ao carregar /game/state:", e);
      if (!hasLoadedRef.current) {
        setStateError(formatApiErrorDetail(e.response?.data?.detail) || e.message || "Falha de rede");
      } else {
        // Já estávamos a jogar: falhas isoladas não interrompem a sessão,
        // mas falhas repetidas (3+ seguidas, ~12s) deixavam o jogo "parado"
        // sem qualquer aviso — agora avisa uma vez, sem bloquear o ecrã.
        consecutiveFailuresRef.current += 1;
        if (consecutiveFailuresRef.current >= 3 && !connectionLostWarnedRef.current) {
          toast.error("A ligação ao jogo está a falhar — a tentar restabelecer...");
          connectionLostWarnedRef.current = true;
        }
      }
    } finally {
      fetchingRef.current = false;
    }
  }, [notifications, autoOpenReport]);

  useEffect(() => {
    if (!user) return;
    let pollTimeout = null;
    let isRunning = true;

    const schedulePoll = async () => {
      if (!isRunning) return;
      const startTime = Date.now();
      await refresh();
      const elapsed = Date.now() - startTime;
      const delay = Math.max(2000, 4000 - elapsed);
      pollTimeout = setTimeout(schedulePoll, delay);
    };

    const scheduleInitialLoad = async () => {
      if (!isRunning || hasLoadedRef.current) return;
      const startTime = Date.now();
      try {
        const { data } = await api.get("/game/state", { timeout: 8000, params: { skip_advance: true } });
        offsetRef.current = Date.parse(data.server_time) - Date.now();
        setState(data);
        setStateError(null);
        hasLoadedRef.current = true;
        initialLoadAttemptsRef.current = 0;
        if (isRunning) {
          pollTimeout = setTimeout(schedulePoll, 4000);
        }
      } catch (e) {
        console.error("Falha ao carregar estado inicial:", e);
        setStateError("Falha ao ligar ao servidor — a tentar de novo...");
        if (!isRunning) return;
        initialLoadAttemptsRef.current += 1;
        const backoffDelay = Math.min(8000, 500 * Math.pow(1.5, initialLoadAttemptsRef.current - 1));
        pollTimeout = setTimeout(scheduleInitialLoad, backoffDelay);
      }
    };

    api.get("/game/catalog").then((r) => setCatalog(r.data)).catch(() => {});
    scheduleInitialLoad();

    return () => {
      isRunning = false;
      if (pollTimeout) clearTimeout(pollTimeout);
    };
  }, [user, refresh]);

  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

  const action = useCallback(
    async (path, payload, successMsg) => {
      try {
        const { data } = await api.post(`/game/${path}`, payload);
        if (successMsg) {
          toast.success(successMsg);
          haptics.success();
        } else {
          haptics.light();
        }
        // Não esperamos pelo refresh completo do estado para responder ao
        // utilizador — isso fazia os botões parecerem lentos (dois pedidos
        // de rede em série). O polling de 4s e este refresh em segundo plano
        // já mantêm o estado atualizado a seguir.
        refresh();
        return { ok: true, data };
      } catch (e) {
        toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
        haptics.error();
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
  const updateAutomationSettings = (patch) => action("settings", patch);
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
        state, stateError, catalog, refresh, serverNow, dispatchTeam, previewDispatch, createTeam,
        recallTeam, recommendOpportunityForTeam, recommendTeamForOpportunity, recommendRepeatForTeam,
        toggleFavoriteType, justReturnedTeamIds, autoOpenReportSignal, fetchTransactions,
        favoriteTeamIds, toggleFavoriteTeam, favoriteEmployeeIds, toggleFavoriteEmployee,
        favoriteVehicleIds, toggleFavoriteVehicle,
        recruitEmployee, refreshPool, assignEmployee, trainEmployee, restEmployee,
        promoteEmployee, bonusEmployee, healEmployee, releaseEmployee, fireEmployee, renameEmployee,
        buyVehicle, sellVehicle, refuelVehicle, repairVehicle, assignVehicle, renameVehicle,
        buyProperty, sellProperty, upgradeProperty, renameProperty, bribePolice, launder,
        claimQuest, chooseQuest, updateAutomationSettings,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export const useGame = () => useContext(GameContext);
