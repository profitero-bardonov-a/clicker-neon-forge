/**
 * Milestone gifts v0 — short HUD toasts at click thresholds.
 * Claimed set in localStorage; no economy / Identity / DB.
 */
import { onLocaleChange, t } from "./i18n.js";
import { trackEvent } from "./analytics.js";

export const MILESTONE_THRESHOLDS = Object.freeze([10, 50, 100, 500, 1000]);
export const MILESTONE_STORAGE_KEY = "neon-forge-milestones";
const EFFECTS_TIP_SEEN_KEY = "neon-forge-effects-tip-seen";
const TOAST_MS = 2800;

/**
 * @returns {Set<number>}
 */
function readClaimed() {
  try {
    const raw = localStorage.getItem(MILESTONE_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.map((n) => Math.floor(Number(n))).filter((n) => Number.isFinite(n) && n > 0)
    );
  } catch {
    return new Set();
  }
}

/**
 * @param {Set<number>} claimed
 */
function writeClaimed(claimed) {
  try {
    localStorage.setItem(MILESTONE_STORAGE_KEY, JSON.stringify([...claimed].sort((a, b) => a - b)));
  } catch {
    // private mode
  }
}

/**
 * @returns {boolean}
 */
function effectsTipSeen() {
  try {
    return localStorage.getItem(EFFECTS_TIP_SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

/**
 * @param {{
 *   root: HTMLElement,
 *   textEl: HTMLElement,
 *   enabled?: boolean,
 *   tipIsOpen?: () => boolean,
 *   onCelebrate?: (threshold: number) => void,
 * }} opts
 */
export function initMilestones(opts) {
  const { root, textEl, enabled = true, tipIsOpen = () => false, onCelebrate } = opts;
  /** @type {Set<number>} */
  let claimed = readClaimed();
  /** @type {number[]} */
  const queue = [];
  let showing = false;
  let hideTimer = 0;
  let lastScore = 0;

  function syncCopy(threshold) {
    textEl.textContent = t("milestoneToast", { n: threshold });
  }

  function hideToast() {
    if (hideTimer) {
      window.clearTimeout(hideTimer);
      hideTimer = 0;
    }
    showing = false;
    root.hidden = true;
    root.removeAttribute("data-threshold");
    flushQueue();
  }

  /**
   * @param {number} threshold
   */
  function showToast(threshold) {
    showing = true;
    syncCopy(threshold);
    root.hidden = false;
    root.setAttribute("data-threshold", String(threshold));
    trackEvent("milestone_reached", { value: threshold });
    onCelebrate?.(threshold);
    if (hideTimer) window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      hideTimer = 0;
      trackEvent("milestone_dismiss", { value: threshold, reason: "timeout" });
      hideToast();
    }, TOAST_MS);
  }

  function flushQueue() {
    if (!enabled || showing || tipIsOpen()) return;
    while (queue.length) {
      const next = queue.shift();
      if (next == null) continue;
      // Tip at ~10 clicks wins; milestone 10 waits until tip dismissed/seen.
      if (next === 10 && !effectsTipSeen()) {
        queue.unshift(next);
        return;
      }
      showToast(next);
      return;
    }
  }

  /**
   * @param {number} threshold
   */
  function enqueue(threshold) {
    if (queue.includes(threshold)) return;
    queue.push(threshold);
    queue.sort((a, b) => a - b);
    flushQueue();
  }

  /**
   * Call after score changes. Only first crossing of each threshold toasts.
   * @param {number} score
   */
  function noteScore(score) {
    if (!enabled) {
      lastScore = score;
      return;
    }
    const prev = lastScore;
    lastScore = score;
    for (const threshold of MILESTONE_THRESHOLDS) {
      if (prev < threshold && score >= threshold && !claimed.has(threshold)) {
        claimed.add(threshold);
        writeClaimed(claimed);
        enqueue(threshold);
      }
    }
  }

  /** Seed lastScore without toasting (call once after load / attachUser). */
  function syncScore(score) {
    lastScore = Math.floor(Number(score)) || 0;
    // Returning players past a threshold: mark claimed so a later jump cannot spam.
    let dirty = false;
    for (const threshold of MILESTONE_THRESHOLDS) {
      if (lastScore >= threshold && !claimed.has(threshold)) {
        claimed.add(threshold);
        dirty = true;
      }
    }
    if (dirty) writeClaimed(claimed);
  }

  /** Tip dismissed — may unblock threshold 10. */
  function onTipClosed() {
    flushQueue();
  }

  root.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!showing) return;
    const value = Number(root.getAttribute("data-threshold") || 0);
    trackEvent("milestone_dismiss", { value, reason: "tap" });
    hideToast();
  });

  onLocaleChange(() => {
    if (!showing) return;
    const value = Number(root.getAttribute("data-threshold") || 0);
    if (value) syncCopy(value);
  });

  return {
    noteScore,
    syncScore,
    onTipClosed,
    flushQueue,
    isShowing: () => showing,
    /** @returns {ReadonlySet<number>} */
    _claimed: () => claimed,
  };
}
