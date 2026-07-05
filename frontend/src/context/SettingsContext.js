import { createContext, useContext, useEffect } from "react";
import { usePersistedState } from "../lib/persist";
import { setDisplayPrefs } from "../lib/game";
import { haptics } from "../lib/haptics";

// Definições puramente do dispositivo (Interface, Jogabilidade, Notificações) —
// não passam pelo servidor. As Automatizações (reparar/abastecer/descansar/
// reclamar automaticamente) vivem em GameContext porque têm de correr no
// servidor mesmo sem o jogador ter a app aberta.
const SettingsContext = createContext(null);

export const NOTIFICATION_KEYS = [
  { key: "missionCompleted", label: "Missão concluída" },
  { key: "teamAvailable", label: "Equipa disponível" },
  { key: "employeeExhausted", label: "Funcionário exausto" },
  { key: "vehicleBroken", label: "Veículo avariado" },
  { key: "repairCompleted", label: "Reparação concluída" },
  { key: "constructionCompleted", label: "Construção concluída" },
  { key: "payrollDue", label: "Salários por pagar" },
  { key: "rareMissions", label: "Missões raras disponíveis" },
];

const DEFAULT_NOTIFICATIONS = Object.fromEntries(NOTIFICATION_KEYS.map((n) => [n.key, true]));

export function SettingsProvider({ children }) {
  const [showSeconds, setShowSeconds] = usePersistedState("set.showSeconds", true);
  const [compactNumbers, setCompactNumbers] = usePersistedState("set.compactNumbers", false);
  const [showTooltips, setShowTooltips] = usePersistedState("set.showTooltips", true);
  const [hapticFeedback, setHapticFeedback] = usePersistedState("set.hapticFeedback", true);
  const [rememberFilters, setRememberFilters] = usePersistedState("set.rememberFilters", true);
  const [rememberSort, setRememberSort] = usePersistedState("set.rememberSort", true);
  const [confirmIrreversible, setConfirmIrreversible] = usePersistedState("set.confirmIrreversible", true);

  const [autoSelectBestTeam, setAutoSelectBestTeam] = usePersistedState("set.autoSelectBestTeam", true);
  const [autoSelectBestVehicle, setAutoSelectBestVehicle] = usePersistedState("set.autoSelectBestVehicle", true);
  const [hideImpossibleMissions, setHideImpossibleMissions] = usePersistedState("set.hideImpossibleMissions", false);
  const [repeatLastConfig, setRepeatLastConfig] = usePersistedState("set.repeatLastConfig", false);
  const [autoOpenReport, setAutoOpenReport] = usePersistedState("set.autoOpenReport", false);
  const [lowSuccessThreshold, setLowSuccessThreshold] = usePersistedState("set.lowSuccessThreshold", 0.70);

  const [notifications, setNotifications] = usePersistedState("set.notifications", DEFAULT_NOTIFICATIONS);
  const setNotification = (key, value) => setNotifications((prev) => ({ ...prev, [key]: value }));

  // fmtMoney/fmtDuration em lib/game.js são funções puras chamadas em dezenas de
  // sítios — em vez de as tornar dependentes de contexto (grande refactor de
  // props), espelha aqui as preferências relevantes num estado global simples.
  useEffect(() => {
    setDisplayPrefs({ showSeconds, compactNumbers, showTooltips, confirmIrreversible });
  }, [showSeconds, compactNumbers, showTooltips, confirmIrreversible]);

  useEffect(() => {
    haptics.setEnabled(hapticFeedback);
  }, [hapticFeedback]);

  return (
    <SettingsContext.Provider
      value={{
        showSeconds, setShowSeconds, compactNumbers, setCompactNumbers,
        showTooltips, setShowTooltips, hapticFeedback, setHapticFeedback,
        rememberFilters, setRememberFilters, rememberSort, setRememberSort,
        confirmIrreversible, setConfirmIrreversible,
        autoSelectBestTeam, setAutoSelectBestTeam, autoSelectBestVehicle, setAutoSelectBestVehicle,
        hideImpossibleMissions, setHideImpossibleMissions, repeatLastConfig, setRepeatLastConfig,
        autoOpenReport, setAutoOpenReport, lowSuccessThreshold, setLowSuccessThreshold,
        notifications, setNotification,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
