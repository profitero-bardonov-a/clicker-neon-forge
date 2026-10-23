import { t } from "./i18n.js";

/**
 * @returns {boolean}
 */
function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    /** @type {{ standalone?: boolean }} */ (window.navigator).standalone === true
  );
}

/**
 * Wire PWA install button + register service worker.
 * @param {{
 *   button: HTMLButtonElement,
 *   section?: HTMLElement | null,
 * }} ui
 */
export function initPwa(ui) {
  const { button, section } = ui;
  /** @type {BeforeInstallPromptEvent | null} */
  let deferred = null;

  function setVisible(visible) {
    if (section) section.hidden = !visible;
    else button.hidden = !visible;
  }

  function refreshVisibility() {
    setVisible(!isStandalone());
  }

  refreshVisibility();

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = /** @type {BeforeInstallPromptEvent} */ (event);
    refreshVisibility();
  });

  window.addEventListener("appinstalled", () => {
    deferred = null;
    setVisible(false);
  });

  button.addEventListener("click", async () => {
    if (deferred) {
      deferred.prompt();
      try {
        await deferred.userChoice;
      } catch {
        // ignore
      }
      deferred = null;
      refreshVisibility();
      return;
    }

    window.alert(t("installHowto"));
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // ignore registration failures (file://, etc.)
      });
    });
  }
}

/**
 * @typedef {Event & {
 *   prompt: () => Promise<void>,
 *   userChoice: Promise<{ outcome: "accepted" | "dismissed" }>,
 * }} BeforeInstallPromptEvent
 */
