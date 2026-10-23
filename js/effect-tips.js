/**
 * One-time tip when a new effect type first activates for this browser profile.
 * Soft-pauses like the first-session effects tip; skips menu/about overlays.
 */
import { onLocaleChange, t } from "./i18n.js";
import { trackEvent } from "./analytics.js";
import { EFFECTS_CONFIG } from "./effects-config.js";

export const EFFECT_TIPS_STORAGE_KEY = "neon-forge-effect-tips-seen";

/**
 * @returns {Set<string>}
 */
function readSeen() {
  try {
    const raw = localStorage.getItem(EFFECT_TIPS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((x) => String(x)).filter(Boolean));
  } catch {
    return new Set();
  }
}

/**
 * @param {Set<string>} seen
 */
function writeSeen(seen) {
  try {
    localStorage.setItem(EFFECT_TIPS_STORAGE_KEY, JSON.stringify([...seen].sort()));
  } catch {
    // private mode
  }
}

/**
 * @param {string} id
 */
export function tipKeysForEffect(id) {
  const def = EFFECTS_CONFIG.effects[/** @type {keyof typeof EFFECTS_CONFIG.effects} */ (id)];
  const nameKey = def && "tipNameKey" in def ? def.tipNameKey : null;
  const bodyKey = def && "tipBodyKey" in def ? def.tipBodyKey : null;
  return {
    nameKey: typeof nameKey === "string" ? nameKey : null,
    bodyKey: typeof bodyKey === "string" ? bodyKey : null,
  };
}

/**
 * @param {{
 *   root: HTMLElement,
 *   titleEl: HTMLElement,
 *   bodyEl: HTMLElement,
 *   dismissBtn: HTMLButtonElement,
 *   backdrop: HTMLElement,
 *   enabled?: boolean,
 *   onOpen?: () => void,
 *   onClose?: () => void,
 *   isBlocked?: () => boolean,
 * }} opts
 */
export function initEffectTips(opts) {
  const {
    root,
    titleEl,
    bodyEl,
    dismissBtn,
    backdrop,
    enabled = true,
    onOpen,
    onClose,
    isBlocked = () => false,
  } = opts;

  /** @type {Set<string>} */
  let seen = readSeen();
  /** @type {string[]} */
  const pending = [];
  let open = false;
  /** @type {string | null} */
  let currentId = null;

  function syncCopy(id) {
    const { nameKey, bodyKey } = tipKeysForEffect(id);
    titleEl.textContent = nameKey ? t(nameKey) : id;
    bodyEl.textContent = bodyKey ? t(bodyKey) : "";
    dismissBtn.textContent = t("effectsTipGotIt");
    dismissBtn.setAttribute("aria-label", t("effectsTipGotIt"));
  }

  /**
   * @param {"got_it" | "backdrop" | "escape"} reason
   */
  function close(reason) {
    if (!open || !currentId) return;
    const id = currentId;
    open = false;
    root.hidden = true;
    document.body.classList.remove("is-tip-open", "is-effect-tip-open");
    seen.add(id);
    writeSeen(seen);
    trackEvent("effect_tip_dismiss", { effect_id: id, reason });
    currentId = null;
    onClose?.();
    flushPending();
  }

  function show(id) {
    if (!enabled || open || seen.has(id)) return false;
    if (document.body.classList.contains("is-about-open")) return false;
    if (document.body.classList.contains("is-menu-open")) return false;
    if (document.body.classList.contains("is-shop-open")) return false;
    if (isBlocked()) return false;
    const { nameKey, bodyKey } = tipKeysForEffect(id);
    if (!nameKey || !bodyKey) {
      seen.add(id);
      writeSeen(seen);
      return false;
    }
    open = true;
    currentId = id;
    syncCopy(id);
    root.hidden = false;
    document.body.classList.add("is-tip-open", "is-effect-tip-open");
    trackEvent("effect_tip_shown", { effect_id: id });
    dismissBtn.focus();
    onOpen?.();
    return true;
  }

  function flushPending() {
    if (!enabled || open) return;
    while (pending.length) {
      const next = pending.shift();
      if (!next || seen.has(next)) continue;
      if (show(next)) return;
      // Still blocked — put back and wait.
      pending.unshift(next);
      return;
    }
  }

  /**
   * Call when an effect type becomes active.
   * @param {string} id
   */
  function noteEffect(id) {
    if (!enabled || !id || seen.has(id)) return;
    if (pending.includes(id)) return;
    if (open || isBlocked() || document.body.classList.contains("is-menu-open") ||
        document.body.classList.contains("is-about-open") ||
        document.body.classList.contains("is-shop-open")) {
      pending.push(id);
      return;
    }
    if (!show(id)) {
      // No copy yet — already marked seen inside show, or transient block.
      if (!seen.has(id) && !pending.includes(id)) pending.push(id);
    }
  }

  /** Retry after menu/about/session tip closes. */
  function resume() {
    flushPending();
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
    if (open && currentId) syncCopy(currentId);
  });

  return {
    noteEffect,
    resume,
    isOpen: () => open,
    /** @returns {ReadonlySet<string>} */
    _seen: () => seen,
  };
}
