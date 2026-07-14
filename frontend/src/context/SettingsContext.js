import { createContext, useContext, useEffect } from "react";
import { usePersistedState } from "../lib/persist";
import { setDisplayPrefs } from "../lib/game";
import { haptics } from "../lib/haptics";
import { audio } from "../lib/audio";

// Definições puramente do dispositivo (Interface, Jogabilidade, Notificações) —
// não passam pelo servidor. As Automatizações (reparar/abastecer/descansar/
// reclamar automaticamente) vivem em GameContext porque têm de correr no
// servidor mesmo sem o jogador ter a app aberta.
const SettingsContext = createContext(null);

const notificationPermission = () => (
  typeof Notification === "undefined" ? "unsupported" : Notification.permission
);

const useStateNotificationPermission = () => {
  const [permission, setPermission] = usePersistedState("set.desktopNotificationPermission", notificationPermission());
  useEffect(() => {
    setPermission(notificationPermission());
  }, [setPermission]);
  return [permission, setPermission];
};

export const NOTIFICATION_KEYS = [
  { key: "missionCompleted", label: "Operação concluída" },
  { key: "teamAvailable", label: "Equipa disponível" },
  { key: "employeeExhausted", label: "Operacional exausto" },
  { key: "vehicleBroken", label: "Veículo avariado" },
  { key: "repairCompleted", label: "Reparação concluída" },
  { key: "constructionCompleted", label: "Construção concluída" },
  { key: "payrollDue", label: "Salários por pagar" },
  { key: "rareMissions", label: "Operações raras disponíveis" },
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
  const [showFps, setShowFps] = usePersistedState("set.showFps", false);
  const [reducedMotion, setReducedMotion] = usePersistedState("set.reducedMotion", false);
  const [highContrast, setHighContrast] = usePersistedState("set.highContrast", false);
  const [compactHud, setCompactHud] = usePersistedState("set.compactHud", false);
  const [focusMode, setFocusMode] = usePersistedState("set.focusMode", false);
  const [desktopNotifications, setDesktopNotifications] = usePersistedState("set.desktopNotifications", false);
  const [desktopNotificationPermission, setDesktopNotificationPermission] = useStateNotificationPermission();

  const [autoSelectBestTeam, setAutoSelectBestTeam] = usePersistedState("set.autoSelectBestTeam", true);
  const [autoSelectBestVehicle, setAutoSelectBestVehicle] = usePersistedState("set.autoSelectBestVehicle", true);
  const [hideImpossibleMissions, setHideImpossibleMissions] = usePersistedState("set.hideImpossibleMissions", false);
  const [repeatLastConfig, setRepeatLastConfig] = usePersistedState("set.repeatLastConfig", false);
  const [autoOpenReport, setAutoOpenReport] = usePersistedState("set.autoOpenReport", false);
  const [lowSuccessThreshold, setLowSuccessThreshold] = usePersistedState("set.lowSuccessThreshold", 0.70);

  const [notifications, setNotifications] = usePersistedState("set.notifications", DEFAULT_NOTIFICATIONS);
  const setNotification = (key, value) => setNotifications((prev) => ({ ...prev, [key]: value }));
  const desktopNotificationsSupported = typeof Notification !== "undefined";
  const requestDesktopNotifications = async (enabled) => {
    if (!enabled) {
      setDesktopNotifications(false);
      return true;
    }
    if (!desktopNotificationsSupported) return false;
    const permission = await Notification.requestPermission();
    setDesktopNotificationPermission(permission);
    const granted = permission === "granted";
    setDesktopNotifications(granted);
    return granted;
  };

  const [soundEnabled, setSoundEnabled] = usePersistedState("set.soundEnabled", true);
  const [musicEnabled, setMusicEnabled] = usePersistedState("set.musicEnabled", true);
  const [sfxEnabled, setSfxEnabled] = usePersistedState("set.sfxEnabled", true);
  const [musicVolume, setMusicVolume] = usePersistedState("set.musicVolume", 0.25);
  const [sfxVolume, setSfxVolume] = usePersistedState("set.sfxVolume", 0.5);

  // O motor de áudio vive fora do React (Web Audio API) — espelha aqui as
  // preferências e gere o arranque/paragem com o ciclo de vida do jogo.
  useEffect(() => {
    audio.init();
    return () => audio.shutdown();
  }, []);
  useEffect(() => {
    audio.configure({
      enabled: soundEnabled, music: musicEnabled, sfx: sfxEnabled,
      musicVolume, sfxVolume,
    });
  }, [soundEnabled, musicEnabled, sfxEnabled, musicVolume, sfxVolume]);

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
        showFps, setShowFps,
        reducedMotion, setReducedMotion, highContrast, setHighContrast,
        compactHud, setCompactHud, focusMode, setFocusMode,
        desktopNotifications, requestDesktopNotifications,
        desktopNotificationsSupported, desktopNotificationPermission,
        autoSelectBestTeam, setAutoSelectBestTeam, autoSelectBestVehicle, setAutoSelectBestVehicle,
        hideImpossibleMissions, setHideImpossibleMissions, repeatLastConfig, setRepeatLastConfig,
        autoOpenReport, setAutoOpenReport, lowSuccessThreshold, setLowSuccessThreshold,
        notifications, setNotification,
        soundEnabled, setSoundEnabled, musicEnabled, setMusicEnabled,
        sfxEnabled, setSfxEnabled, musicVolume, setMusicVolume, sfxVolume, setSfxVolume,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
