const Haptic = {
  none: () => {},
  light: () => navigator.vibrate?.(10),
  medium: () => navigator.vibrate?.(30),
  heavy: () => navigator.vibrate?.(50),
  success: () => navigator.vibrate?.([30, 10, 30]),
  warning: () => navigator.vibrate?.([50, 30, 50]),
  error: () => navigator.vibrate?.([100, 50, 100]),
};

let enabled = true;

export const haptics = {
  setEnabled(value) {
    enabled = value;
  },
  light() {
    if (enabled) Haptic.light();
  },
  medium() {
    if (enabled) Haptic.medium();
  },
  heavy() {
    if (enabled) Haptic.heavy();
  },
  success() {
    if (enabled) Haptic.success();
  },
  warning() {
    if (enabled) Haptic.warning();
  },
  error() {
    if (enabled) Haptic.error();
  },
};
