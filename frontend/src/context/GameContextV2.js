import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useAuth } from "./AuthContextV2";
import { useSettings } from "./SettingsContext";
import { formatApiErrorDetail, fmtMoney } from "../lib/game";
import { usePersistedState } from "../lib/persist";
import { haptics } from "../lib/haptics";
import { audio } from "../lib/audio";
import { isOnLand } from "../lib/land";

// Som temático por ação — o prefixo mais específico ganha. Ações fora desta
// lista ficam em silêncio (o toast e o toque de interface já dão feedback).
const ACTION_SOUNDS = [
  ["dispatch", "dispatch"],
  ["missions/recall", "recall"],
  ["launder", "cash"],
  ["police/bribe", "cash"],
  ["employees/recruit", "hire"],
  ["vehicles/repair", "repair"],
  ["vehicles/refuel", "refuel"],
  ["vehicles/buy", "cash"],
  ["vehicles/sell", "cash"],
  ["properties/buy", "cash"],
  ["properties/sell", "cash"],
  ["properties/upgrade", "repair"],
  ["teams/create", "success"],
  ["employees/promote", "levelup"],
  ["employees/bonus", "cash"],
  ["employees/heal", "notify"],
  ["employees/release", "notify"],
  ["quests/claim", "cash"],
  ["quests/choose", "notify"],
];

function soundForAction(path) {
  let best = null;
  for (const [prefix, sound] of ACTION_SOUNDS) {
    if (path.startsWith(prefix) && (!best || prefix.length > best[0].length)) best = [prefix, sound];
  }
  return best ? best[1] : null;
}

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const { user, gameState: initialGameState, catalog } = useAuth();
  const { autoOpenReport, notifications } = useSettings();

  const [state, setState] = useState(initialGameState || null);
  const [stateError, setStateError] = useState(null);
  // Modo de colocação manual de propriedades: null quando inativo. `point`
  // fica null até o jogador tocar/clicar pela primeira vez no mapa.
  const [placement, setPlacement] = useState(null);

  const offsetRef = useRef(0);
  const fetchingRef = useRef(false);
  const pendingRefreshRef = useRef(false);  // um refresh pedido durante um fetch em curso
  const refreshRef = useRef(null);          // referência estável à última `refresh`
  const hasLoadedRef = useRef(!!initialGameState);
  const consecutiveFailuresRef = useRef(0);
  const connectionLostWarnedRef = useRef(false);
  const [lastSyncAt, setLastSyncAt] = useState(0);  // ms da última sincronização com sucesso

  const prevTeamsRef = useRef(null);
  const prevEmployeesRef = useRef(null);
  const prevVehiclesRef = useRef(null);
  const prevPropertiesRef = useRef(null);
  const prevOppIdsRef = useRef(null);
  const payrollWarnedRef = useRef(false);
  const prevLevelRef = useRef(null);
  const prevChaseIdsRef = useRef(new Set());

  const [justReturnedTeamIds, setJustReturnedTeamIds] = useState([]);
  const [autoOpenReportSignal, setAutoOpenReportSignal] = useState(0);
  const [favoriteTeamIds, setFavoriteTeamIds] = usePersistedState("favTeams", []);
  const [favoriteEmployeeIds, setFavoriteEmployeeIds] = usePersistedState("favEmployees", []);
  const [favoriteVehicleIds, setFavoriteVehicleIds] = usePersistedState("favVehicles", []);

  // Update state when initial game state arrives (may arrive after mount)
  useEffect(() => {
    if (initialGameState) {
      setState((prev) => prev || initialGameState);
      hasLoadedRef.current = true;
      if (initialGameState.server_time) {
        offsetRef.current = Date.parse(initialGameState.server_time) - Date.now();
      }
    }
  }, [initialGameState]);

  const toggleInList = (setter) => (id) =>
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleFavoriteTeam = toggleInList(setFavoriteTeamIds);
  const toggleFavoriteEmployee = toggleInList(setFavoriteEmployeeIds);
  const toggleFavoriteVehicle = toggleInList(setFavoriteVehicleIds);

  const refresh = useCallback(async () => {
    if (!user) return;
    // Corrida action↔poll: se já há um fetch em curso, NÃO descartar o pedido —
    // marca-o como pendente para correr logo a seguir (a mutação reflete-se sem
    // esperar um ciclo inteiro de poll).
    if (fetchingRef.current) { pendingRefreshRef.current = true; return; }

    fetchingRef.current = true;
    try {
      const { data } = await api.get("/game/state", { timeout: 8000 });
      hasLoadedRef.current = true;

      if (data.server_time) {
        offsetRef.current = Date.parse(data.server_time) - Date.now();
      }

      // Onboarding: conta ainda sem QG — o /state vem mínimo (hq_pending),
      // sem teams/employees/vehicles/etc. Guarda o estado tal como está e
      // salta todo o diffing de notificações (que rebentaria em undefined).
      if (data.hq_pending) {
        setState(data);
        setStateError(null);
        setLastSyncAt(Date.now());
        consecutiveFailuresRef.current = 0;
        connectionLostWarnedRef.current = false;
        return;
      }

      // Team return notifications
      if (prevTeamsRef.current) {
        const returned = data.teams.filter((t) => {
          const prevStatus = prevTeamsRef.current[t.id];
          return prevStatus && prevStatus !== "idle" && t.status === "idle";
        });
        if (returned.length > 0) {
          haptics.success();
          returned.forEach((t) => {
            // Toast consciente do resultado: diz o que aconteceu (e quanto
            // rendeu), em vez do genérico "concluiu a operação". O histórico
            // vem ordenado do mais recente, por isso o primeiro registo da
            // equipa é a missão que acabou de terminar.
            const rec = notifications?.missionCompleted !== false
              ? (data.history || []).find((h) => h.team_id === t.id)
              : null;
            if (rec) {
              const oppName = rec.opportunity?.name || "a operação";
              if (rec.outcome === "success" && rec.chase_outcome === "caught") {
                toast.error(`${t.name}: a polícia apanhou a equipa no regresso — carga de ${oppName} perdida.`);
                audio.sfx.police();
              } else if (rec.outcome === "success") {
                const credited = Number(rec.pending_reward || 0);
                toast.success(
                  credited > 0
                    ? `${t.name}: sucesso em ${oppName} — +${fmtMoney(credited)} ${rec.pending_pays === "clean" ? "limpos" : "sujos"}.`
                    : `${t.name}: sucesso em ${oppName}.`
                );
                if (credited > 0) audio.sfx.cash();
                else audio.sfx.success();
              } else if (rec.outcome === "police") {
                toast.error(`${t.name}: intercetada pela polícia em ${oppName}.`);
                audio.sfx.police();
              } else if (rec.outcome === "recalled") {
                toast.info(`${t.name} regressou sem completar ${oppName}.`);
                audio.sfx.notify();
              } else {
                toast.warning(`${t.name}: falhou ${oppName} — sem recompensa.`);
                audio.sfx.failure();
              }
            } else if (notifications?.teamAvailable !== false) {
              toast.info(`${t.name} regressou e está pronta`);
              audio.sfx.notify();
            }
          });
          setJustReturnedTeamIds((prev) => [
            ...new Set([...prev, ...returned.map((t) => t.id)]),
          ]);
          setTimeout(() => {
            const ids = returned.map((t) => t.id);
            setJustReturnedTeamIds((prev) => prev.filter((id) => !ids.includes(id)));
          }, 8000);
          if (autoOpenReport) setAutoOpenReportSignal((n) => n + 1);
        }
      }
      prevTeamsRef.current = Object.fromEntries(data.teams.map((t) => [t.id, t.status]));

      // Employee fatigue notifications
      if (prevEmployeesRef.current) {
        if (notifications?.employeeExhausted !== false) {
          data.employees.forEach((e) => {
            const prevFatigue = prevEmployeesRef.current[e.id];
            if (prevFatigue != null && prevFatigue < 90 && e.fatigue >= 90) {
              haptics.warning();
              audio.sfx.warning();
              toast.warning(`${e.name} está exausto — precisa de descansar`);
            }
          });
        }
      }
      prevEmployeesRef.current = Object.fromEntries(
        data.employees.map((e) => [e.id, e.fatigue])
      );

      // Vehicle condition notifications
      if (prevVehiclesRef.current) {
        data.vehicles.forEach((v) => {
          const prev = prevVehiclesRef.current[v.id];
          if (!prev) return;
          if (notifications?.vehicleBroken !== false && prev.condition >= 20 && v.condition < 20) {
            haptics.warning();
            audio.sfx.warning();
            toast.warning(`${v.name} está avariado — repara antes de despachar`);
          }
          if (
            notifications?.repairCompleted !== false &&
            prev.condition < 99 &&
            v.condition >= 99.5
          ) {
            haptics.success();
            audio.sfx.repair();
            toast.success(`${v.name} foi reparado — condição a 100%`);
          }
        });
      }
      prevVehiclesRef.current = Object.fromEntries(
        data.vehicles.map((v) => [v.id, { condition: v.condition }])
      );

      // Property upgrade notifications
      if (prevPropertiesRef.current && notifications?.constructionCompleted !== false) {
        data.properties.forEach((p) => {
          const wasUpgrading = prevPropertiesRef.current[p.id];
          if (wasUpgrading && !p.upgrading_until) {
            haptics.success();
            audio.sfx.success();
            toast.success(`${p.name} concluiu a melhoria — agora no nível ${p.level}`);
          }
        });
      }
      prevPropertiesRef.current = Object.fromEntries(
        data.properties.map((p) => [p.id, !!p.upgrading_until])
      );

      // Rare opportunity notifications
      if (prevOppIdsRef.current && notifications?.rareMissions !== false) {
        const newRare = data.opportunities.filter(
          (o) => o.rare && !prevOppIdsRef.current.has(o.id)
        );
        newRare.forEach((o) => {
          haptics.heavy();
          audio.sfx.notify();
          toast.success(`Missão rara disponível: ${o.name} em ${o.district}`);
        });
      }
      prevOppIdsRef.current = new Set(data.opportunities.map((o) => o.id));

      // Payroll notifications
      if (notifications?.payrollDue !== false && data.player.next_payroll_at) {
        const dueInS =
          (Date.parse(data.player.next_payroll_at) - Date.parse(data.server_time)) / 1000;
        if (dueInS <= 300 && (data.salary_total || 0) > 0) {
          if (!payrollWarnedRef.current) {
            haptics.warning();
            audio.sfx.warning();
            toast.warning("Salários por pagar em breve — garante que há dinheiro limpo suficiente");
            payrollWarnedRef.current = true;
          }
        } else {
          payrollWarnedRef.current = false;
        }
      }

      // Sirene de perseguição: toca em contínuo (baixinho) enquanto alguma
      // equipa estiver a ser perseguida pela polícia no regresso, com um
      // alerta forte no momento em que a perseguição começa.
      const chaseIds = new Set(
        data.missions.filter((m) => m.chase_active && m.phase === "returning").map((m) => m.id)
      );
      const newChase = [...chaseIds].some((id) => !prevChaseIdsRef.current.has(id));
      if (newChase) {
        haptics.error();
        audio.sfx.police();
        const chased = data.missions.find((m) => m.chase_active && m.phase === "returning" && !prevChaseIdsRef.current.has(m.id));
        if (chased) toast.error(`PERSEGUIÇÃO: um carro-patrulha segue ${chased.team_name} — se apanhados, perdem a carga!`);
      }
      if (chaseIds.size > 0) audio.sirenStart();
      else audio.sirenStop();
      prevChaseIdsRef.current = chaseIds;

      // Subida de nível da organização — momento de glória com fanfarra.
      if (prevLevelRef.current != null && data.player.level > prevLevelRef.current) {
        haptics.heavy();
        audio.sfx.levelup();
        toast.success(`A organização subiu para o nível ${data.player.level} — novo conteúdo desbloqueado!`);
      }
      prevLevelRef.current = data.player.level;

      setState(data);
      setStateError(null);
      setLastSyncAt(Date.now());
      consecutiveFailuresRef.current = 0;
      connectionLostWarnedRef.current = false;
    } catch (e) {
      console.error("Falha ao carregar /game/state:", e);
      consecutiveFailuresRef.current += 1;
      // Sem estado inicial e a falhar repetidamente → mostra erro com retry
      // em vez de spinner infinito no GamePage
      if (!hasLoadedRef.current && consecutiveFailuresRef.current >= 2) {
        setStateError(formatApiErrorDetail(e.response?.data?.detail) || e.message || "Falha ao ligar à rede");
      }
      if (consecutiveFailuresRef.current >= 3 && !connectionLostWarnedRef.current) {
        toast.error("A ligação ao jogo está a falhar — a tentar restabelecer...");
        connectionLostWarnedRef.current = true;
      }
    } finally {
      fetchingRef.current = false;
      // Se chegou um pedido de refresh enquanto este fetch corria, honra-o agora
      // (sem recursão direta — via ref, no próximo tick).
      if (pendingRefreshRef.current) {
        pendingRefreshRef.current = false;
        setTimeout(() => refreshRef.current && refreshRef.current(), 0);
      }
    }
  }, [user, notifications, autoOpenReport]);

  // Referência estável à última `refresh` (usada pelo re-run pendente acima e
  // pelo listener de visibilidade, sem re-subscrever efeitos).
  refreshRef.current = refresh;

  // Polling — arranca sempre que há utilizador. Se o boot não entregou
  // estado inicial (fallback/timeout), o primeiro fetch é imediato para
  // nunca deixar o GamePage preso em "A ligar à rede...".
  useEffect(() => {
    if (!user) return;

    let pollTimeout = null;
    let isRunning = true;

    const schedulePoll = async () => {
      // Pausa total com o separador escondido — não martela o backend nem
      // repete diffs/toasts/áudio em segundo plano. Retoma no `onVisible`.
      if (!isRunning || document.visibilityState === "hidden") return;
      const startTime = Date.now();
      await refresh();
      const elapsed = Date.now() - startTime;
      const fails = consecutiveFailuresRef.current;
      // Backoff exponencial quando o backend está em baixo (até 30s); cadência
      // normal ~4s caso contrário.
      const delay = fails > 0
        ? Math.min(30000, 4000 * 2 ** fails)
        : Math.max(2000, 4000 - elapsed);
      if (isRunning && document.visibilityState === "visible") {
        pollTimeout = setTimeout(schedulePoll, delay);
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible" && isRunning) {
        if (pollTimeout) clearTimeout(pollTimeout);
        schedulePoll(); // refresh imediato ao voltar a ficar visível
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    pollTimeout = setTimeout(schedulePoll, hasLoadedRef.current ? 4000 : 0);

    return () => {
      isRunning = false;
      if (pollTimeout) clearTimeout(pollTimeout);
      document.removeEventListener("visibilitychange", onVisible);
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
        const sound = soundForAction(path);
        if (sound) audio.sfx[sound]();
        // Refresh in background
        refresh();
        return { ok: true, data };
      } catch (e) {
        toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
        haptics.error();
        audio.sfx.error();
        return { ok: false };
      }
    },
    [refresh]
  );

  // All game actions
  const dispatchTeam = (opportunityId, teamId) =>
    action("dispatch", { opportunity_id: opportunityId, team_id: teamId }, "Equipa destacada");
  const recallTeam = (missionId) =>
    action("missions/recall", { mission_id: missionId }, "Equipa chamada de volta");
  const previewDispatch = useCallback(async (opportunityId, teamId) => {
    try {
      const { data } = await api.post("/game/dispatch/preview", {
        opportunity_id: opportunityId,
        team_id: teamId,
      });
      return { ok: true, data };
    } catch (e) {
      return {
        ok: false,
        error: formatApiErrorDetail(e.response?.data?.detail) || e.message,
      };
    }
  }, []);
  const recommendOpportunityForTeam = useCallback(async (teamId) => {
    try {
      const { data } = await api.post("/game/dispatch/recommend_opportunity", { team_id: teamId });
      return { ok: true, data };
    } catch (_e) {
      return { ok: false };
    }
  }, []);
  const recommendTeamForOpportunity = useCallback(async (opportunityId) => {
    try {
      const { data } = await api.post("/game/dispatch/recommend_team", {
        opportunity_id: opportunityId,
      });
      return { ok: true, data };
    } catch (_e) {
      return { ok: false };
    }
  }, []);
  const recommendRepeatForTeam = useCallback(async (teamId) => {
    try {
      const { data } = await api.post("/game/dispatch/recommend_repeat", { team_id: teamId });
      return { ok: true, data };
    } catch (_e) {
      return { ok: false };
    }
  }, []);
  const toggleFavoriteType = (typeKey) =>
    action("opportunities/favorite", { type_key: typeKey });
  const fetchTransactions = useCallback(async () => {
    try {
      const { data } = await api.get("/game/transactions");
      return { ok: true, data: data.transactions };
    } catch (_e) {
      return { ok: false };
    }
  }, []);
  const createTeam = (spec) => action("teams/create", { spec }, "Equipa formada");
  const recruitEmployee = (candidateId) =>
    action("employees/recruit", { candidate_id: candidateId }, "Operacional recrutado");
  const refreshPool = () => action("recruitment/refresh", {}, "Novos contactos disponíveis");
  const assignEmployee = (employeeId, teamId) =>
    action(
      "employees/assign",
      { employee_id: employeeId, team_id: teamId },
      teamId ? "Atribuído à equipa" : "Removido da equipa"
    );
  const trainEmployee = (employeeId, courseKey) =>
    action("employees/train", { employee_id: employeeId, course_key: courseKey }, "Formação iniciada");
  const restEmployee = (employeeId) =>
    action("employees/rest", { employee_id: employeeId }, "Foi descansar");
  const promoteEmployee = (employeeId) =>
    action("employees/promote", { employee_id: employeeId }, "Promovido");
  const bonusEmployee = (employeeId) =>
    action("employees/bonus", { employee_id: employeeId }, "Bónus pago");
  const healEmployee = (employeeId) =>
    action("employees/heal", { employee_id: employeeId }, "Tratamento pago");
  const releaseEmployee = (employeeId) =>
    action("employees/release", { employee_id: employeeId }, "Libertado");
  const fireEmployee = (employeeId) =>
    action("employees/fire", { employee_id: employeeId }, "Despedido");
  const renameEmployee = (employeeId, name) =>
    action("employees/rename", { employee_id: employeeId, name }, "Renomeado");
  const buyVehicle = (modelKey) =>
    action("vehicles/buy", { model_key: modelKey }, "Veículo adquirido");
  const sellVehicle = (vehicleId) =>
    action("vehicles/sell", { vehicle_id: vehicleId }, "Veículo abatido");
  const refuelVehicle = (vehicleId) =>
    action("vehicles/refuel", { vehicle_id: vehicleId }, "Depósito cheio");
  const repairVehicle = (vehicleId) =>
    action("vehicles/repair", { vehicle_id: vehicleId }, "Veículo reparado");
  const assignVehicle = (vehicleId, teamId) =>
    action(
      "vehicles/assign",
      { vehicle_id: vehicleId, team_id: teamId },
      teamId ? "Veículo atribuído" : "Veículo na garagem"
    );
  const renameVehicle = (vehicleId, name) =>
    action("vehicles/rename", { vehicle_id: vehicleId, name }, "Veículo renomeado");
  const buyWeapon = (modelKey) =>
    action("weapons/buy", { model_key: modelKey }, "Arma adquirida");
  const sellWeapon = (weaponId) =>
    action("weapons/sell", { weapon_id: weaponId }, "Arma vendida");
  const repairWeapon = (weaponId) =>
    action("weapons/repair", { weapon_id: weaponId }, "Arma reparada");
  const assignWeapon = (weaponId, employeeId) =>
    action("weapons/assign", { weapon_id: weaponId, employee_id: employeeId }, "Arma atribuída");
  const unassignWeapon = (employeeId) =>
    action("weapons/unassign", { employee_id: employeeId }, "Arma desatribuída");
  const autoAssignWeapon = (weaponId) =>
    action("weapons/auto_assign", { weapon_id: weaponId }, "Arma atribuída automaticamente");
  const optimizeWeapons = () =>
    action("weapons/optimize", {}, "Arsenal redistribuído pela melhor combinação");
  // Otimizações SSS v6 — o backend devolve a mensagem certa para cada caso
  // (redistribuído / já ótimo / reserva salarial), por isso o toast usa-a.
  const optimizeVehicles = useCallback(async () => {
    const res = await action("vehicles/optimize", {});
    if (res.ok && res.data?.message) toast.success(res.data.message);
    return res;
  }, [action]);
  const optimizeEmployees = useCallback(async () => {
    const res = await action("employees/optimize", {});
    if (res.ok && res.data?.message) toast.success(res.data.message);
    return res;
  }, [action]);
  const optimizeProperties = useCallback(async () => {
    const res = await action("properties/optimize", {});
    if (res.ok && res.data?.message) toast.success(res.data.message);
    return res;
  }, [action]);
  const claimAllQuests = useCallback(async () => {
    const res = await action("quests/claim_all", {});
    if (res.ok && res.data?.rewards?.length) {
      const shown = res.data.rewards.slice(0, 3).join(" · ");
      toast.success(`${res.data.claimed} contrato(s) — ${shown}${res.data.rewards.length > 3 ? " …" : ""}`);
    }
    return res;
  }, [action]);
  const buyProperty = (typeKey, lat, lng) =>
    action("properties/buy", { type_key: typeKey, lat, lng }, "Propriedade comprada");
  const sellProperty = (propertyId) =>
    action("properties/sell", { property_id: propertyId }, "Propriedade vendida");
  const transferVehicle = (vehicleId, toPropertyId) =>
    action("vehicles/transfer", { vehicle_id: vehicleId, to_property_id: toPropertyId }, "Veículo em trânsito");

  // Modo de colocação manual — o dinheiro só é debitado em confirmPlacement,
  // que é o único momento em que /properties/buy é chamado; cancelar nunca
  // chega a fazer essa chamada, por isso não precisa de rollback.
  const startPlacement = (typeKey) => setPlacement({ typeKey, point: null, valid: false });
  const updatePlacementPoint = (lat, lng) =>
    setPlacement((p) => (p ? { ...p, point: { lat, lng }, valid: isOnLand(lat, lng) } : p));
  const cancelPlacement = () => setPlacement(null);
  const confirmPlacement = async () => {
    if (!placement?.point || !placement.valid) return { ok: false };
    const r = await buyProperty(placement.typeKey, placement.point.lat, placement.point.lng);
    if (r.ok) setPlacement(null);
    return r;
  };
  const upgradeProperty = (propertyId) =>
    action("properties/upgrade", { property_id: propertyId }, "Melhoria iniciada");
  const renameProperty = (propertyId, name) =>
    action("properties/rename", { property_id: propertyId, name }, "Propriedade renomeada");
  const upgradeHQ = () => action("hq/upgrade", {}, "Melhoria do Quartel-General iniciada");
  const setOrgPriority = (priority) => action("hq/priority", { priority }, "Prioridade atualizada");
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
        state,
        stateError,
        lastSyncAt,
        catalog,
        refresh,
        serverNow,
        dispatchTeam,
        previewDispatch,
        createTeam,
        recallTeam,
        recommendOpportunityForTeam,
        recommendTeamForOpportunity,
        recommendRepeatForTeam,
        toggleFavoriteType,
        justReturnedTeamIds,
        autoOpenReportSignal,
        fetchTransactions,
        favoriteTeamIds,
        toggleFavoriteTeam,
        favoriteEmployeeIds,
        toggleFavoriteEmployee,
        favoriteVehicleIds,
        toggleFavoriteVehicle,
        recruitEmployee,
        refreshPool,
        assignEmployee,
        trainEmployee,
        restEmployee,
        promoteEmployee,
        bonusEmployee,
        healEmployee,
        releaseEmployee,
        fireEmployee,
        renameEmployee,
        buyVehicle,
        sellVehicle,
        refuelVehicle,
        repairVehicle,
        assignVehicle,
        transferVehicle,
        renameVehicle,
        buyWeapon,
        sellWeapon,
        repairWeapon,
        assignWeapon,
        unassignWeapon,
        autoAssignWeapon,
        optimizeWeapons,
        optimizeVehicles,
        optimizeEmployees,
        optimizeProperties,
        claimAllQuests,
        buyProperty,
        sellProperty,
        upgradeProperty,
        renameProperty,
        placement,
        startPlacement,
        updatePlacementPoint,
        cancelPlacement,
        confirmPlacement,
        upgradeHQ,
        setOrgPriority,
        bribePolice,
        launder,
        claimQuest,
        chooseQuest,
        updateAutomationSettings,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export const useGame = () => useContext(GameContext);
