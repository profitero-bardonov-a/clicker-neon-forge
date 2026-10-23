/**
 * Score-threshold Berserk — start a chain each time score crosses 500, 1000, 1500…
 * Claimed thresholds persist in localStorage (silent-claim on syncScore like milestones).
 * Random scheduleWeight draws are separate; primary trigger is deterministic.
 */
import { EFFECTS_CONFIG } from "./effects-config.js";
import { trackEvent } from "./analytics.js";

export const BERSERK_SCORE_STORAGE_KEY = "neon-forge-berserk-score";

/**
 * @returns {number}
 */
export function berserkScoreEvery() {
  const def = EFFECTS_CONFIG.effects.berserk;
  const n =
    def && "scoreEvery" in def ? Math.floor(Number(def.scoreEvery)) : 500;
  return Number.isFinite(n) && n > 0 ? n : 500;
}

/**
 * @returns {Set<number>}
 */
function readClaimed() {
  try {
    const raw = localStorage.getItem(BERSERK_SCORE_STORAGE_KEY);
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
      BERSERK_SCORE_STORAGE_KEY,
      JSON.stringify([...claimed].sort((a, b) => a - b))
    );
  } catch {
    // private mode
  }
}

/**
 * Multiples of `step` crossed when score moves from prev → score (up only).
 * @param {number} prev
 * @param {number} score
 * @param {number} [step]
 * @returns {number[]}
 */
export function crossedBerserkThresholds(prev, score, step = berserkScoreEvery()) {
  const out = [];
  if (!(score > prev) || step <= 0) return out;
  const first = Math.floor(prev / step) + 1;
  const last = Math.floor(score / step);
  for (let k = first; k <= last; k++) {
    if (k >= 1) out.push(k * step);
  }
  return out;
}

/**
 * @param {{
 *   enabled?: boolean,
 *   beginBerserk: () => void,
 * }} opts
 */
export function initBerserkScore(opts) {
  const { enabled = true, beginBerserk } = opts;
  const step = berserkScoreEvery();

  /** @type {Set<number>} */
  let claimed = readClaimed();
  let lastScore = 0;
  /** Extra Berserk chains waiting after the current one (multi-threshold jumps). */
  let pending = 0;

  function fire() {
    trackEvent("berserk_score_trigger", { pending });
    beginBerserk();
  }

  /**
   * Call when a Berserk chain fully ends so queued threshold fires can run.
   */
  function onBerserkEnded() {
    if (!enabled || pending <= 0) return;
    pending -= 1;
    fire();
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
    const crossed = crossedBerserkThresholds(prev, score, step);
    if (!crossed.length) return;

    let fresh = 0;
    for (const th of crossed) {
      if (claimed.has(th)) continue;
      claimed.add(th);
      fresh += 1;
    }
    if (fresh > 0) writeClaimed(claimed);
    if (fresh <= 0) return;

    // Snappy UX: replace the current effect (or mid-chain) immediately.
    // Extra buckets in the same jump queue for after this chain ends.
    pending += fresh - 1;
    fire();
  }

  /**
   * Seed without firing (load / attachUser). Silently claim past thresholds.
   * @param {number} score
   */
  function syncScore(score) {
    lastScore = Math.floor(Number(score)) || 0;
    let dirty = false;
    const maxTh = Math.floor(lastScore / step) * step;
    for (let th = step; th <= maxTh; th += step) {
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
    onBerserkEnded,
    /** @returns {ReadonlySet<number>} */
    _claimed: () => claimed,
    _pending: () => pending,
  };
}
