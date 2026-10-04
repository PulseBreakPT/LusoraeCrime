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
import { fetchRoute } from "../lib/routing";
import { isLocalGuestMode } from "../game/localGuestEngine";

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
  ["mastermind/heists/launch", "dispatch"],
  ["mastermind/heists/claim", "cash"],
  ["mastermind/heists/prep", "notify"],
  ["mastermind/heists/intel", "notify"],
  ["mastermind/market/trade", "cash"],
  ["mastermind/bounty", "notify"],
  ["mastermind/cache/scan", "success"],
  ["org/inventory", "cash"],
  ["org/vehicles", "repair"],
  ["org/weapons", "repair"],
  ["org/properties", "repair"],
  ["org/departments", "success"],
  ["org/territories", "success"],
  ["org/prestige", "cash"],
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
  const placementValidationRef = useRef(0);

  const offsetRef = useRef(0);
  const fetchingRef = useRef(false);
  const pendingRefreshRef = useRef(false);  // um refresh pedido durante um fetch em curso
  const refreshWaitersRef = useRef([]);     // ações que aguardam o refresh pendente terminar
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
  const returnedTimersRef = useRef(new Set());  // timeouts pendentes de justReturnedTeamIds
  const pendingActionsRef = useRef(new Set());   // dedupe de duplo toque enquanto a mutação está em curso

  // Cancela quaisquer timeouts pendentes ao desmontar (evita setState-após-unmount).
  useEffect(() => () => {
    for (const id of returnedTimersRef.current) clearTimeout(id);
    returnedTimersRef.current.clear();
  }, []);

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
    if (fetchingRef.current) {
      pendingRefreshRef.current = true;
      return new Promise((resolve) => refreshWaitersRef.current.push(resolve));
    }

    fetchingRef.current = true;
    try {
      const { data } = await api.get("/game/state", { timeout: 8000 });
      hasLoadedRef.current = true;

      if (!data.hq_pending) {
        try {
          const { data: mastermind } = await api.get("/game/mastermind/state", { timeout: 8000 });
          data.mastermind = mastermind;
          if (mastermind?.balances && data.player) {
            data.player.clean_money = mastermind.balances.clean_money;
            data.player.dirty_money = mastermind.balances.dirty_money;
            data.player.heat = mastermind.balances.heat;
          }
        } catch (mastermindError) {
          console.error("Falha ao carregar /game/mastermind/state:", mastermindError);
        }
      }

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
          const clearId = setTimeout(() => {
            returnedTimersRef.current.delete(clearId);
            const ids = returned.map((t) => t.id);
            setJustReturnedTeamIds((prev) => prev.filter((id) => !ids.includes(id)));
          }, 8000);
          returnedTimersRef.current.add(clearId);
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
      } else if (refreshWaitersRef.current.length) {
        const waiters = refreshWaitersRef.current.splice(0);
        waiters.forEach((resolve) => resolve());
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
      const actionKey = `${path}:${JSON.stringify(payload || {})}`;
      if (pendingActionsRef.current.has(actionKey)) return { ok: false, duplicate: true };
      pendingActionsRef.current.add(actionKey);
      try {
        const requestId = typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const body = payload && typeof payload === "object"
          ? { ...payload, request_id: requestId }
          : { request_id: requestId };
        const { data } = await api.post(`/game/${path}`, body);
        if (successMsg) {
          toast.success(successMsg);
          haptics.success();
        } else {
          haptics.light();
        }
        const sound = soundForAction(path);
        if (sound) audio.sfx[sound]();
        // Só termina a ação quando o /state autoritativo já refletiu a mutação.
        // Se um poll estava em curso, refresh() aguarda também o refresh pendente seguinte.
        await refresh();
        return { ok: true, data };
      } catch (e) {
        toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
        haptics.error();
        audio.sfx.error();
        return { ok: false };
      } finally {
        pendingActionsRef.current.delete(actionKey);
      }
    },
    [refresh]
  );

  // Fila comum para ações em lote. Executa em sequência para cada pedido ler o
  // saldo/estado mais recente, mostra um único progresso e faz um só refresh.
  const runBatchActions = useCallback(async (label, requests, emptyMessage) => {
    if (!requests.length) {
      toast.info(emptyMessage || "Nada elegível para esta ação.");
      return { ok: true, completed: 0, failed: 0 };
    }
    const toastId = toast.loading(`${label} · 0/${requests.length}`);
    let completed = 0;
    const errors = [];
    for (const request of requests) {
      try {
        await api.post(`/game/${request.path}`, request.payload || {});
        completed += 1;
      } catch (error) {
        errors.push(formatApiErrorDetail(error.response?.data?.detail) || error.message);
      }
      toast.loading(`${label} · ${completed}/${requests.length}`, { id: toastId });
    }
    await refresh();
    if (completed > 0) {
      toast.success(
        errors.length
          ? `${completed} concluída(s) · ${errors.length} ignorada(s)`
          : `${completed} ação(ões) concluída(s)`,
        { id: toastId }
      );
      haptics.success();
    } else {
      toast.error(errors[0] || "Não foi possível concluir a ação em lote.", { id: toastId });
      haptics.error();
    }
    return { ok: errors.length === 0, completed, failed: errors.length, errors };
  }, [refresh]);

  // All game actions
  const dispatchTeam = async (opportunityId, teamId) => {
    const payload = { opportunity_id: opportunityId, team_id: teamId };

    // Produção: routing/economia são autoritativos no backend. O modo convidado
    // é offline, por isso precisa de obter a geometria no browser.
    if (isLocalGuestMode()) {
      const opp = state?.opportunities?.find((item) => item.id === opportunityId);
      const team = state?.teams?.find((item) => item.id === teamId);
      const vehicle = state?.vehicles?.find((item) => item.id === team?.vehicle_id);
      const property = vehicle?.property_id
        ? state?.properties?.find((item) => item.id === vehicle.property_id)
        : null;
      const originSource = property || state?.player?.hq;
      const origin = originSource ? { lat: Number(originSource.lat), lng: Number(originSource.lng) } : null;
      const target = opp ? { lat: Number(opp.lat), lng: Number(opp.lng) } : null;
      if (origin && target && [origin.lat, origin.lng, target.lat, target.lng].every(Number.isFinite)) {
        const [roadOutward, roadInward] = await Promise.all([
          fetchRoute(origin, target), fetchRoute(target, origin),
        ]);
        if (roadOutward?.unavailable || roadInward?.unavailable) {
          const reason = roadOutward?.reason || roadInward?.reason;
          toast.error(reason
            ? `Percurso indisponível: ${reason}. A equipa não foi despachada.`
            : "Não foi possível calcular um percurso rodoviário válido. A equipa não foi despachada.");
          haptics.error();
          return { ok: false };
        }
        payload.route_outward = roadOutward;
        payload.route_inward = roadInward;
      }
    }
    return action("dispatch", payload, "Equipa destacada");
  };
  const recallTeam = (missionId) =>
    action("missions/recall", { mission_id: missionId }, "Equipa chamada de volta");
  const resolveMissionDecision = (missionId, optionId) =>
    action("missions/decision", { mission_id: missionId, option_id: optionId });
  const previewDispatch = useCallback(async (opportunityId, teamId) => {
    try {
      const payload = { opportunity_id: opportunityId, team_id: teamId };
      if (isLocalGuestMode()) {
        const opp = state?.opportunities?.find((item) => item.id === opportunityId);
        const team = state?.teams?.find((item) => item.id === teamId);
        const vehicle = state?.vehicles?.find((item) => item.id === team?.vehicle_id);
        const property = vehicle?.property_id
          ? state?.properties?.find((item) => item.id === vehicle.property_id)
          : null;
        const source = property || state?.player?.hq;
        const origin = source ? { lat: Number(source.lat), lng: Number(source.lng) } : null;
        const target = opp ? { lat: Number(opp.lat), lng: Number(opp.lng) } : null;
        if (origin && target && [origin.lat, origin.lng, target.lat, target.lng].every(Number.isFinite)) {
          const [roadOutward, roadInward] = await Promise.all([
            fetchRoute(origin, target), fetchRoute(target, origin),
          ]);
          if (!roadOutward?.unavailable && !roadInward?.unavailable) {
            payload.route_outward = roadOutward;
            payload.route_inward = roadInward;
          }
        }
      }
      const { data } = await api.post("/game/dispatch/preview", payload);
      return { ok: true, data };
    } catch (e) {
      return {
        ok: false,
        error: formatApiErrorDetail(e.response?.data?.detail) || e.message,
      };
    }
  }, [state]);
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
  const createTeam = (spec, employeeIds = [], vehicleId = null) =>
    action("teams/create", {
      spec,
      employee_ids: employeeIds,
      vehicle_id: vehicleId || null,
    }, "Equipa formada");
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

  // ---- Loja (dinheiro do jogo) ----
  const speedup = (kind, id) => action("shop/speedup", { kind, id }, "Acelerado");
  const buySlot = (kind) => action("shop/buy_slot", { kind }, "Slot extra adquirido");
  const buyVip = (planKey) => action("shop/vip", { plan_key: planKey }, "VIP ativado");
  const buyCosmetic = (category, key) => action("shop/cosmetic", { category, key }, "Cosmético adquirido");
  const equipPaint = (vehicleId, paintKey) =>
    action("vehicles/equip_paint", { vehicle_id: vehicleId, paint_key: paintKey });
  const equipEmblem = (teamId, emblemKey) =>
    action("teams/equip_emblem", { team_id: teamId, emblem_key: emblemKey });
  const equipHqSkin = (skinKey) => action("hq/equip_skin", { skin_key: skinKey });

  const restAllEligible = () => runBatchActions(
    "A enviar operacionais para descanso",
    (state?.employees || [])
      .filter((employee) => employee.status === "idle" && employee.fatigue >= 15)
      .map((employee) => ({
        path: "employees/rest",
        payload: { employee_id: employee.id },
      })),
    "Nenhum operacional disponível precisa de descansar."
  );

  const vehicleIsFree = (vehicle) => {
    if (vehicle.transfer || (vehicle.refueling_until && Date.parse(vehicle.refueling_until) > serverNow())) return false;
    if (!vehicle.team_id) return true;
    const team = (state?.teams || []).find((item) => item.id === vehicle.team_id);
    return !team || team.status === "idle";
  };

  const refuelAllEligible = () => runBatchActions(
    "A abastecer a frota",
    (state?.vehicles || [])
      .filter((vehicle) => vehicleIsFree(vehicle) && vehicle.tank_l - vehicle.fuel_l > 0.1)
      .map((vehicle) => ({
        path: "vehicles/refuel",
        payload: { vehicle_id: vehicle.id },
      })),
    "Todos os veículos elegíveis já têm o depósito cheio."
  );

  const repairFleetAll = () => runBatchActions(
    "A reparar a frota",
    (state?.vehicles || [])
      .filter((vehicle) => vehicleIsFree(vehicle) && vehicle.condition < 99)
      .map((vehicle) => ({
        path: "vehicles/repair",
        payload: { vehicle_id: vehicle.id },
      })),
    "Nenhum veículo elegível precisa de reparação."
  );

  const repairWeaponsAll = () => runBatchActions(
    "A reparar o armamento",
    (state?.weapons || [])
      .filter((weapon) => {
        if (weapon.condition >= 99) return false;
        if (!weapon.employee_id) return true;
        const employee = (state?.employees || []).find((item) => item.id === weapon.employee_id);
        return !employee || employee.status === "idle";
      })
      .map((weapon) => ({
        path: "weapons/repair",
        payload: { weapon_id: weapon.id },
      })),
    "Nenhuma arma elegível precisa de reparação."
  );

  const optimizeOrganization = () => runBatchActions(
    "A otimizar a organização",
    [
      { path: "employees/optimize", payload: {} },
      { path: "vehicles/optimize", payload: {} },
      { path: "properties/optimize", payload: {} },
      { path: "weapons/optimize", payload: {} },
    ],
    "Não existem recursos para otimizar."
  );

  // Organização integrada — logística, ciclo de ativos e late game.
  const buySupply = (itemKey, packs = 1) =>
    action("org/inventory/buy", { item_key: itemKey, packs }, "Stock recebido");
  const sellSupply = (itemKey, packs = 1) =>
    action("org/inventory/sell", { item_key: itemKey, packs }, "Stock vendido");
  const renameTeam = (teamId, name) =>
    action("org/teams/rename", { team_id: teamId, name }, "Equipa renomeada");
  const setTeamDoctrine = (teamId, doctrine) =>
    action("org/teams/doctrine", { team_id: teamId, doctrine }, "Doutrina atualizada");
  const setTeamPolicies = (teamId, policies) =>
    action("org/teams/policies", { team_id: teamId, policies }, "Políticas atualizadas");
  const setTeamLoadout = (teamId, loadout) =>
    action("org/teams/loadout", { team_id: teamId, loadout }, "Loadout guardado");
  const dissolveTeam = (teamId) =>
    action("org/teams/dissolve", { id: teamId }, "Equipa dissolvida");
  const reloadWeapon = (weaponId) =>
    action("org/weapons/reload", { id: weaponId }, "Arma recarregada");
  const upgradeWeaponMod = (weaponId, upgradeKey) =>
    action("org/weapons/upgrade", { weapon_id: weaponId, upgrade_key: upgradeKey }, "Upgrade instalado");
  const serviceVehicle = (vehicleId) =>
    action("org/vehicles/service", { id: vehicleId }, "Revisão concluída");
  const replaceVehicleTires = (vehicleId) =>
    action("org/vehicles/tires", { id: vehicleId }, "Pneus substituídos");
  const insureVehicle = (vehicleId) =>
    action("org/vehicles/insurance", { id: vehicleId }, "Seguro renovado");
  const inspectVehicle = (vehicleId) =>
    action("org/vehicles/inspection", { id: vehicleId }, "Inspeção concluída");
  const upgradePropertyModule = (propertyId, moduleKey) =>
    action("org/properties/module", { property_id: propertyId, module_key: moduleKey }, "Módulo melhorado");
  const assignPropertyStaff = (propertyId, employeeIds) =>
    action("org/properties/staff", { property_id: propertyId, employee_ids: employeeIds }, "Equipa da base atualizada");
  const upgradeDepartment = (departmentKey) =>
    action("org/departments/upgrade", { department_key: departmentKey }, "Departamento melhorado");
  const claimTerritory = (district) =>
    action("org/territories/claim", { district }, "Presença territorial criada");
  const consolidateTerritory = (district) =>
    action("org/territories/consolidate", { district }, "Território consolidado");
  const defendTerritory = (district) =>
    action("org/territories/defend", { district }, "Defesa territorial reforçada");
  const buyPrestige = (itemKey) =>
    action("org/prestige/buy", { item_key: itemKey }, "Investimento adquirido");
  const buyProtection = () =>
    action("org/governance/protection", {}, "Rede de proteção renovada");
  const fetchFinanceSummary = useCallback(async () => {
    try {
      const { data } = await api.get("/game/org/finance/summary");
      return { ok: true, data };
    } catch (_e) {
      return { ok: false };
    }
  }, []);
  const fetchOrganizationIntelligence = useCallback(async () => {
    try {
      const { data } = await api.get("/game/org/intelligence");
      return { ok: true, data };
    } catch (_e) {
      return { ok: false };
    }
  }, []);
  const fetchOrganizationAudit = useCallback(async (limit = 50) => {
    try {
      const { data } = await api.get(`/game/org/audit?limit=${limit}`);
      return { ok: true, data };
    } catch (_e) {
      return { ok: false };
    }
  }, []);
  const quoteOrganizationAction = useCallback(async (organizationAction, payload = {}) => {
    try {
      const { data } = await api.post("/game/org/quote", { action: organizationAction, payload });
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: formatApiErrorDetail(e.response?.data?.detail) || e.message };
    }
  }, []);
  const setOrganizationPolicy = (policy) =>
    action("org/policy", policy, "Política da organização atualizada");
  const runOrganizationAutomation = () =>
    action("org/automation/run", {}, "Automação da organização executada");
  const resolveOrganizationEvent = (eventId, choice) =>
    action("org/events/resolve", { event_id: eventId, choice }, "Decisão da organização aplicada");

  // Mastermind — grandes golpes, mercado negro, caçadores rivais e caches.
  const scoutMastermindTarget = (payload) => action("mastermind/heists/intel", payload, "Dossiê atualizado");
  const createMastermindHeist = (payload) => action("mastermind/heists/create", payload, "Plano criado");
  const startHeistPrep = (payload) => action("mastermind/heists/prep/start", payload, "Preparação iniciada");
  const claimHeistPrep = (payload) => action("mastermind/heists/prep/claim", payload, "Relatório recolhido");
  const launchMastermindHeist = (payload) => action("mastermind/heists/launch", payload, "Grande golpe lançado");
  const claimMastermindHeist = (payload) => action("mastermind/heists/claim", payload, "Resultado recolhido");
  const abortMastermindHeist = (payload) => action("mastermind/heists/abort", payload, "Plano cancelado");
  const tradeBlackMarket = (payload) => action("mastermind/market/trade", payload, "Ordem executada");
  const resolveBounty = (payload) => action("mastermind/bounty", payload, "Resposta aos caçadores concluída");
  const scanSignalCache = (payload) => action("mastermind/cache/scan", payload, "Varredura concluída");

  // Modo de colocação manual — o dinheiro só é debitado em confirmPlacement,
  // que é o único momento em que /properties/buy é chamado; cancelar nunca
  // chega a fazer essa chamada, por isso não precisa de rollback.
  const startPlacement = (typeKey) => {
    placementValidationRef.current += 1;
    setPlacement({ typeKey, point: null, valid: false, checking: false, reason: null });
  };
  const updatePlacementPoint = useCallback(async (lat, lng) => {
    const point = { lat: Number(lat), lng: Number(lng) };
    if (![point.lat, point.lng].every(Number.isFinite)) return;

    const validationId = ++placementValidationRef.current;

    if (isLocalGuestMode()) {
      const valid = isOnLand(point.lat, point.lng);
      setPlacement((p) => (p ? {
        ...p, point, valid, checking: false,
        reason: valid ? null : "Escolhe um ponto em terra firme em Portugal.",
      } : p));
      return;
    }

    // A geometria oficial de Portugal vive no backend. Enquanto valida, o pin
    // continua visível e pode ser movido novamente sem bloquear o mapa.
    setPlacement((p) => (p ? { ...p, point, valid: null, checking: true, reason: null } : p));
    try {
      const { data } = await api.post("/game/properties/validate-location", point, { timeout: 8000 });
      if (validationId !== placementValidationRef.current) return;
      setPlacement((p) => (p ? {
        ...p,
        point,
        valid: !!data?.valid,
        checking: false,
        reason: data?.reason || null,
        district: data?.district || null,
      } : p));
    } catch (_error) {
      if (validationId !== placementValidationRef.current) return;
      // Compatibilidade com um backend ainda sem o endpoint novo: usa a
      // validação local Portugal-wide; /properties/buy continua autoritativo.
      const fallbackValid = isOnLand(point.lat, point.lng);
      setPlacement((p) => (p ? {
        ...p,
        point,
        valid: fallbackValid,
        checking: false,
        reason: fallbackValid ? null : "Escolhe um ponto em terra firme em Portugal.",
      } : p));
    }
  }, []);
  const cancelPlacement = () => {
    placementValidationRef.current += 1;
    setPlacement(null);
  };
  const confirmPlacement = async () => {
    if (!placement?.point || placement.checking || !placement.valid) return { ok: false };
    const r = await buyProperty(placement.typeKey, placement.point.lat, placement.point.lng);
    if (r.ok) {
      placementValidationRef.current += 1;
      setPlacement(null);
    }
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
        resolveMissionDecision,
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
        speedup,
        buySlot,
        buyVip,
        buyCosmetic,
        equipPaint,
        equipEmblem,
        equipHqSkin,
        restAllEligible,
        refuelAllEligible,
        repairFleetAll,
        repairWeaponsAll,
        optimizeOrganization,
        buySupply,
        sellSupply,
        renameTeam,
        setTeamDoctrine,
        setTeamPolicies,
        setTeamLoadout,
        dissolveTeam,
        reloadWeapon,
        upgradeWeaponMod,
        serviceVehicle,
        replaceVehicleTires,
        insureVehicle,
        inspectVehicle,
        upgradePropertyModule,
        assignPropertyStaff,
        upgradeDepartment,
        claimTerritory,
        consolidateTerritory,
        defendTerritory,
        buyPrestige,
        buyProtection,
        fetchFinanceSummary,
        fetchOrganizationIntelligence,
        fetchOrganizationAudit,
        quoteOrganizationAction,
        setOrganizationPolicy,
        runOrganizationAutomation,
        resolveOrganizationEvent,
        scoutMastermindTarget,
        createMastermindHeist,
        startHeistPrep,
        claimHeistPrep,
        launchMastermindHeist,
        claimMastermindHeist,
        abortMastermindHeist,
        tradeBlackMarket,
        resolveBounty,
        scanSignalCache,
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
