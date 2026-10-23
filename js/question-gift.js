/**
 * Flying «?» catch gift — once per 1000-click threshold crossing.
 * Catch awards +500 via ScoreStore; miss/timeout awards nothing.
 */
import { trackEvent } from "./analytics.js";

export const QUESTION_GIFT_STEP = 1000;
export const QUESTION_GIFT_REWARD = 500;
export const QUESTION_GIFT_STORAGE_KEY = "neon-forge-question-gifts";
/** Screen-cross lifetime; shorter = faster. Was 6500 (~1×); 2000 ≈ 3.25×. */
export const QUESTION_GIFT_LIFE_MS = 2000;
const LIFE_MS = QUESTION_GIFT_LIFE_MS;
const SIZE = 56;

/**
 * @returns {Set<number>}
 */
function readClaimed() {
  try {
    const raw = localStorage.getItem(QUESTION_GIFT_STORAGE_KEY);
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
    localStorage.setItem(
      QUESTION_GIFT_STORAGE_KEY,
      JSON.stringify([...claimed].sort((a, b) => a - b))
    );
  } catch {
    // private mode
  }
}

/**
 * @param {number} score
 * @returns {number[]} crossed multiples of 1000
 */
export function crossedQuestionThresholds(prev, score) {
  const out = [];
  if (!(score > prev)) return out;
  const first = Math.floor(prev / QUESTION_GIFT_STEP) + 1;
  const last = Math.floor(score / QUESTION_GIFT_STEP);
  for (let k = first; k <= last; k++) {
    if (k >= 1) out.push(k * QUESTION_GIFT_STEP);
  }
  return out;
}

/**
 * @param {{
 *   layer: HTMLElement,
 *   enabled?: boolean,
 *   isBlocked?: () => boolean,
 *   onCatch?: (reward: number, threshold: number) => void,
 *   onMiss?: (threshold: number, reason: "timeout" | "dismiss") => void,
 * }} opts
 */
export function initQuestionGift(opts) {
  const {
    layer,
    enabled = true,
    isBlocked = () => false,
    onCatch,
    onMiss,
  } = opts;

  /** @type {Set<number>} */
  let claimed = readClaimed();
  let lastScore = 0;
  /** @type {number | null} */
  let activeThreshold = null;
  /** @type {HTMLButtonElement | null} */
  let el = null;
  let hideTimer = 0;
  let raf = 0;
  let startAt = 0;
  let x0 = 0;
  let y0 = 0;
  let x1 = 0;
  let y1 = 0;

  function clearActive(reason) {
    if (hideTimer) {
      window.clearTimeout(hideTimer);
      hideTimer = 0;
    }
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    const th = activeThreshold;
    if (el) {
      el.remove();
      el = null;
    }
    activeThreshold = null;
    layer.hidden = true;
    if (th != null && reason) onMiss?.(th, reason);
  }

  function tick(now) {
    if (!el || activeThreshold == null) return;
    const u = Math.min(1, (now - startAt) / LIFE_MS);
    const x = x0 + (x1 - x0) * u;
    const y = y0 + (y1 - y0) * u + Math.sin(u * Math.PI * 2) * 28;
    el.style.transform = `translate(${x}px, ${y}px) scale(${1 + Math.sin(u * Math.PI) * 0.12})`;
    if (u < 1) {
      raf = requestAnimationFrame(tick);
    }
  }

  /**
   * @param {number} threshold
   */
  function spawn(threshold) {
    if (!enabled || activeThreshold != null) return;
    if (isBlocked()) return;

    const w = window.innerWidth || 400;
    const h = window.innerHeight || 700;
    const fromLeft = Math.random() < 0.5;
    x0 = fromLeft ? -SIZE : w + SIZE;
    y0 = h * (0.28 + Math.random() * 0.35);
    x1 = fromLeft ? w + SIZE : -SIZE;
    y1 = h * (0.28 + Math.random() * 0.35);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "question-gift";
    btn.textContent = "?";
    btn.setAttribute("aria-label", "+500");
    btn.style.transform = `translate(${x0}px, ${y0}px)`;

    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (activeThreshold == null) return;
      const th = activeThreshold;
      trackEvent("question_gift_catch", { value: th, reward: QUESTION_GIFT_REWARD });
      clearActive(null);
      onCatch?.(QUESTION_GIFT_REWARD, th);
    });

    layer.hidden = false;
    layer.appendChild(btn);
    el = btn;
    activeThreshold = threshold;
    startAt = performance.now();
    trackEvent("question_gift_spawn", { value: threshold });
    raf = requestAnimationFrame(tick);
    hideTimer = window.setTimeout(() => {
      hideTimer = 0;
      if (activeThreshold == null) return;
      trackEvent("question_gift_miss", { value: threshold, reason: "timeout" });
      clearActive("timeout");
    }, LIFE_MS);
  }

  /**
   * @param {number} score
   */
  function noteScore(score) {
    if (!enabled) {
      lastScore = score;
      return;
    }
    const prev = lastScore;
    lastScore = score;
    for (const th of crossedQuestionThresholds(prev, score)) {
      if (claimed.has(th)) continue;
      claimed.add(th);
      writeClaimed(claimed);
      spawn(th);
    }
  }

  /**
   * Seed without spawning (load / attachUser).
   * @param {number} score
   */
  function syncScore(score) {
    lastScore = Math.floor(Number(score)) || 0;
    let dirty = false;
    const maxTh = Math.floor(lastScore / QUESTION_GIFT_STEP) * QUESTION_GIFT_STEP;
    for (let th = QUESTION_GIFT_STEP; th <= maxTh; th += QUESTION_GIFT_STEP) {
      if (!claimed.has(th)) {
        claimed.add(th);
        dirty = true;
      }
    }
    if (dirty) writeClaimed(claimed);
  }

  return {
    noteScore,
    syncScore,
    isActive: () => activeThreshold != null,
    /** @returns {ReadonlySet<number>} */
    _claimed: () => claimed,
  };
}
