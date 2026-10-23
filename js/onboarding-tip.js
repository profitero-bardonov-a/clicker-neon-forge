/**
 * One-screen first-session tip about timed effects.
 * Shown once after ~N canvas clicks; dismissible; never a full About dump.
 */
import { onLocaleChange, t } from "./i18n.js";
import { trackEvent } from "./analytics.js";

export const EFFECTS_TIP_AFTER_CLICKS = 10;
const STORAGE_KEY = "neon-forge-effects-tip-seen";

/**
 * @param {{
 *   root: HTMLElement,
 *   dismissBtn: HTMLButtonElement,
 *   backdrop: HTMLElement,
 *   onOpen?: () => void,
 *   onClose?: () => void,
 *   enabled?: boolean,
 * }} opts
 */
export function initEffectsTip(opts) {
  const { root, dismissBtn, backdrop, onOpen, onClose, enabled = true } = opts;
  let canvasClicks = 0;
  let open = false;
  let shownThisSession = false;

  function alreadySeen() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  }

  function remember() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // private mode
    }
  }

  function syncCopy() {
    const title = root.querySelector("[data-i18n='effectsTipTitle']");
    const body = root.querySelector("[data-i18n='effectsTipBody']");
    const gotIt = root.querySelector("[data-i18n='effectsTipGotIt']");
    if (title) title.textContent = t("effectsTipTitle");
    if (body) body.textContent = t("effectsTipBody");
    if (gotIt) gotIt.textContent = t("effectsTipGotIt");
    dismissBtn.setAttribute("aria-label", t("effectsTipGotIt"));
  }

  /**
   * @param {"got_it" | "backdrop" | "escape"} reason
   */
  function close(reason) {
    if (!open) return;
    open = false;
    root.hidden = true;
    document.body.classList.remove("is-tip-open");
    remember();
    trackEvent("effects_tip_dismiss", { reason });
    onClose?.();
  }

  function show() {
    if (!enabled || open || shownThisSession || alreadySeen()) return;
    if (document.body.classList.contains("is-about-open")) return;
    if (document.body.classList.contains("is-menu-open")) return;
    shownThisSession = true;
    open = true;
    syncCopy();
    root.hidden = false;
    document.body.classList.add("is-tip-open");
    trackEvent("effects_tip_shown", { after_clicks: canvasClicks });
    dismissBtn.focus();
    onOpen?.();
  }

  /** Call after each gameplay canvas pointerdown. */
  function noteCanvasClick() {
    if (!enabled || alreadySeen() || shownThisSession) return;
    canvasClicks += 1;
    if (canvasClicks >= EFFECTS_TIP_AFTER_CLICKS) show();
  }

  dismissBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    close("got_it");
  });
  backdrop.addEventListener("click", () => close("backdrop"));
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) close("escape");
  });
  onLocaleChange(() => {
    if (open) syncCopy();
  });

  return {
    noteCanvasClick,
    isOpen: () => open,
    /** @param {number} n force show sooner (tests / demo) */
    _forceAfter(n) {
      canvasClicks = Math.max(0, n - 1);
    },
  };
}
