/**
 * Mock leaders for local UI / demo reel (no Netlify functions).
 * Shown count = stubs length; total is inflated for UI (e.g. 100/23457).
 */

/** Fake global player pool shown as the denominator in LEADERS N/TOTAL. */
export const LEADERBOARD_STUBS_TOTAL = 23457;

const SEED_NAMES = [
  "Neon Ace",
  "Forge Kid",
  "Cyan Fox",
  "Amber Owl",
  "Steel Ray",
  "Volt Mira",
  "Spark Duo",
  "Pulse Nova",
  "Grid Hawk",
  "Chrome Bit",
  "Aqua Drift",
  "Ion Blade",
  "Pixel Wolf",
  "Byte Falcon",
  "Nova Drift",
  "Echo Flux",
  "Prism Kid",
  "Laser Moth",
  "Quark Bee",
  "Static Owl",
];

/**
 * @param {number} i 0-based
 */
function stubName(i) {
  if (i < SEED_NAMES.length) return SEED_NAMES[i];
  const a = SEED_NAMES[i % SEED_NAMES.length].split(" ")[0];
  const b = SEED_NAMES[(i * 7) % SEED_NAMES.length].split(" ").at(-1) || "Forge";
  return `${a} ${b}${i > 40 ? ` ${i}` : ""}`;
}

/**
 * @param {number} rank 1-based
 */
function stubClicks(rank) {
  if (rank === 1) return 12840;
  const top = 12840;
  const decay = Math.pow(rank - 1, 1.15);
  return Math.max(12, Math.floor(top - decay * 95 - rank * 37));
}

/** Deliberate junk rows — filtered out by leaderboard hygiene (local DEV only). */
const HYGIENE_JUNK = Object.freeze([
  { rank: 101, name: "Idle Drain", avatarUrl: null, clicks: 0, online: false },
  { rank: 102, name: "Angry Turnip", avatarUrl: null, clicks: -703, online: false },
]);

/** @type {ReadonlyArray<{ rank: number, name: string, avatarUrl: string | null, clicks: number, online: boolean }>} */
export const LEADERBOARD_STUBS = Object.freeze([
  ...Array.from({ length: 100 }, (_, i) => {
    const rank = i + 1;
    return {
      rank,
      name: stubName(i),
      avatarUrl: null,
      clicks: stubClicks(rank),
      online: rank <= 5 || rank % 11 === 0,
    };
  }),
  ...HYGIENE_JUNK,
]);

/** @returns {boolean} */
export function isLocalDevHost() {
  if (typeof location === "undefined") return false;
  const host = location.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host.endsWith(".local")
  );
}
