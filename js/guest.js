const STORAGE_KEY = "neon-forge-guest";

const ADJECTIVES = [
  "Sad",
  "Angry",
  "Tiny",
  "Loud",
  "Sleepy",
  "Pickled",
  "Rubber",
  "Disco",
  "Wobbly",
  "Grumpy",
  "Sneaky",
  "Crispy",
  "Turbo",
  "Shy",
  "Moist",
  "Lost",
  "Fancy",
  "Cosmic",
  "Dizzy",
  "Brave",
];

const NOUNS = [
  "Pickle",
  "Toaster",
  "Potato",
  "Llama",
  "Cactus",
  "Dumpling",
  "Penguin",
  "Waffle",
  "Moth",
  "Bagel",
  "Raccoon",
  "Noodle",
  "Pigeon",
  "Taco",
  "Hamster",
  "Kettle",
  "Muffin",
  "Goblin",
  "Turnip",
  "Sock",
];

const ICONS = [
  "🥒",
  "🍞",
  "🥔",
  "🦙",
  "🌵",
  "🥟",
  "🐧",
  "🧇",
  "🦋",
  "🥯",
  "🦝",
  "🍜",
  "🐦",
  "🌮",
  "🐹",
  "🫖",
  "🧁",
  "👺",
  "🧦",
  "🦄",
  "🐸",
  "🐙",
  "🤡",
  "🧀",
];

const COLORS = ["#ff4d8d", "#3de7ff", "#ff7a1a", "#b388ff", "#7dffb3", "#ffe14a", "#ff5a3c"];

/**
 * @typedef {{ id: string, name: string, pictureUrl: string, guest: true }} GuestUser
 */

/**
 * @param {number} max
 */
function pick(max) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}

function randomId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `guest_${hex}`;
}

/**
 * @param {string} emoji
 * @param {string} color
 */
function avatarUrl(emoji, color) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" rx="32" fill="${color}"/>` +
    `<text x="32" y="44" text-anchor="middle" font-size="32">${emoji}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function createGuest() {
  /** @type {GuestUser} */
  const guest = {
    id: randomId(),
    name: `${ADJECTIVES[pick(ADJECTIVES.length)]} ${NOUNS[pick(NOUNS.length)]}`,
    pictureUrl: avatarUrl(ICONS[pick(ICONS.length)], COLORS[pick(COLORS.length)]),
    guest: true,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(guest));
  } catch {
    // private mode: the nickname lasts for this page load
  }
  return guest;
}

/**
 * @param {unknown} data
 * @returns {GuestUser | null}
 */
function parseGuest(data) {
  if (!data || typeof data !== "object") return null;
  const row = /** @type {Record<string, unknown>} */ (data);
  if (typeof row.id !== "string" || !/^guest_[0-9a-f]{32}$/.test(row.id)) return null;
  if (typeof row.name !== "string" || !row.name.trim()) return null;
  if (typeof row.pictureUrl !== "string" || !row.pictureUrl.startsWith("data:image/svg+xml,")) {
    return null;
  }
  return {
    id: row.id,
    name: row.name.trim().slice(0, 80),
    pictureUrl: row.pictureUrl,
    guest: true,
  };
}

/**
 * Saved guest, if this browser already has one.
 * @returns {GuestUser | null}
 */
export function getStoredGuest() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseGuest(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Reuse the stored guest or mint a new nickname and icon.
 * @returns {GuestUser}
 */
export function getOrCreateGuest() {
  return getStoredGuest() || createGuest();
}
