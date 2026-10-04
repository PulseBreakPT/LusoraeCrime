import { useEffect } from "react";

const selectorForTestId = (testId) =>
  `[data-testid="${String(testId).replace(/"/g, '\\"')}"]`;

// Opens a panel on the exact object that triggered a notification/report,
// scrolls it into view and gives it a short visual pulse. Retries briefly
// because Radix sheets/tabs may need a frame or two before the target mounts.
export function usePanelFocus(open, focusTarget) {
  useEffect(() => {
    if (!open || !focusTarget?.testId) return undefined;

    let cancelled = false;
    let removeTimer = null;
    const retryTimers = [];
    const selector = selectorForTestId(focusTarget.testId);

    const focus = (attempt = 0) => {
      if (cancelled) return;
      const element = document.querySelector(selector);
      if (!element) {
        if (attempt < 7) {
          const id = setTimeout(() => focus(attempt + 1), 90 + attempt * 35);
          retryTimers.push(id);
        }
        return;
      }

      element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      element.classList.remove("sub-nav-focus-flash");
      // Restart the animation when the same item is selected twice in a row.
      void element.offsetWidth;
      element.classList.add("sub-nav-focus-flash");
      removeTimer = setTimeout(() => element.classList.remove("sub-nav-focus-flash"), 2600);
    };

    const first = setTimeout(() => focus(0), 120);
    retryTimers.push(first);

    return () => {
      cancelled = true;
      retryTimers.forEach(clearTimeout);
      if (removeTimer) clearTimeout(removeTimer);
    };
  }, [open, focusTarget?.testId, focusTarget?.token]);
}
