/**
 * Public leaderboard hygiene — keep the board about engaged play.
 * Rows with clicks <= 0 (idle drain / never engaged) stay out of the top list.
 * Mirrored in netlify/functions/leaderboard.mjs (SQL WHERE).
 */

/** Minimum clicks required to appear on the public board. */
export const MIN_PUBLIC_CLICKS = 1;

/**
 * @param {unknown} clicks
 * @returns {boolean}
 */
export function isPublicLeaderScore(clicks) {
  const n = Number(clicks);
  return Number.isFinite(n) && n >= MIN_PUBLIC_CLICKS;
}

/**
 * Drop ineligible rows and renumber rank 1…n in the surviving order.
 * @template {{ rank?: number, clicks?: number }} T
 * @param {T[]} rows
 * @returns {T[]}
 */
export function filterPublicLeaders(rows) {
  if (!Array.isArray(rows)) return [];
  const kept = rows.filter((row) => isPublicLeaderScore(row?.clicks));
  return kept.map((row, index) => ({ ...row, rank: index + 1 }));
}
