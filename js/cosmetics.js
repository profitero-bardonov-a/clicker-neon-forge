/**
 * Forge Shop cosmetics v0 — local visual inventory.
 * Spends clicks via ScoreStore; never changes hit/miss or effect schedule.
 */
import { trackEvent } from "./analytics.js";

export const COSMETICS_STORAGE_KEY = "neon-forge-cosmetics";

/** @typedef {"rim" | "sparks"} CosmeticSlot */
/** @typedef {"rim_cyan" | "rim_magenta" | "sparks_ember"} CosmeticId */

/**
 * @typedef {{
 *   id: CosmeticId,
 *   slot: CosmeticSlot,
 *   price: number,
 * }} CosmeticSku
 */

/** @type {readonly CosmeticSku[]} */
export const SHOP_CATALOG = Object.freeze([
  Object.freeze({ id: "rim_cyan", slot: "rim", price: 50 }),
  Object.freeze({ id: "rim_magenta", slot: "rim", price: 100 }),
  Object.freeze({ id: "sparks_ember", slot: "sparks", price: 150 }),
]);

/** @type {Record<CosmeticId, CosmeticSku>} */
const BY_ID = Object.fromEntries(SHOP_CATALOG.map((s) => [s.id, s]));

const DEFAULT_RIM = Object.freeze({
  stroke: "rgba(200, 232, 245, 0.85)",
  glow: "rgba(61, 231, 255, 0.45)",
  vertex: "rgba(61, 231, 255, 0.9)",
});

/** @type {Record<string, typeof DEFAULT_RIM>} */
const RIM_LOOKS = {
  rim_cyan: Object.freeze({
    stroke: "rgba(61, 231, 255, 0.95)",
    glow: "rgba(61, 231, 255, 0.7)",
    vertex: "rgba(122, 240, 255, 0.95)",
  }),
  rim_magenta: Object.freeze({
    stroke: "rgba(255, 80, 200, 0.95)",
    glow: "rgba(255, 60, 180, 0.65)",
    vertex: "rgba(255, 140, 220, 0.95)",
  }),
};

/**
 * @returns {{ owned: CosmeticId[], equipped: { rim: CosmeticId | null, sparks: CosmeticId | null } }}
 */
export function readCosmetics() {
  try {
    const raw = localStorage.getItem(COSMETICS_STORAGE_KEY);
    if (!raw) return { owned: [], equipped: { rim: null, sparks: null } };
    const parsed = JSON.parse(raw);
    const ownedRaw = Array.isArray(parsed?.owned) ? parsed.owned : [];
    /** @type {CosmeticId[]} */
    const owned = [];
    for (const id of ownedRaw) {
      if (typeof id === "string" && id in BY_ID && !owned.includes(/** @type {CosmeticId} */ (id))) {
        owned.push(/** @type {CosmeticId} */ (id));
      }
    }
    const eq = parsed?.equipped && typeof parsed.equipped === "object" ? parsed.equipped : {};
    /** @type {CosmeticId | null} */
    let rim = typeof eq.rim === "string" && owned.includes(eq.rim) ? eq.rim : null;
    /** @type {CosmeticId | null} */
    let sparks = typeof eq.sparks === "string" && owned.includes(eq.sparks) ? eq.sparks : null;
    if (rim && BY_ID[rim]?.slot !== "rim") rim = null;
    if (sparks && BY_ID[sparks]?.slot !== "sparks") sparks = null;
    return { owned, equipped: { rim, sparks } };
  } catch {
    return { owned: [], equipped: { rim: null, sparks: null } };
  }
}

/**
 * @param {{ owned: CosmeticId[], equipped: { rim: CosmeticId | null, sparks: CosmeticId | null } }} state
 */
export function writeCosmetics(state) {
  try {
    localStorage.setItem(
      COSMETICS_STORAGE_KEY,
      JSON.stringify({
        owned: [...state.owned],
        equipped: { rim: state.equipped.rim, sparks: state.equipped.sparks },
      })
    );
  } catch {
    // private mode
  }
}

/**
 * @param {import("./cube.js").Cube} mesh
 * @param {CosmeticId | null} rimId
 */
export function applyRimToCube(mesh, rimId) {
  const look = (rimId && RIM_LOOKS[rimId]) || DEFAULT_RIM;
  mesh.rimStroke = look.stroke;
  mesh.rimGlow = look.glow;
  mesh.rimVertex = look.vertex;
}

/**
 * @param {Iterable<import("./cube.js").Cube>} meshes
 * @param {CosmeticId | null} rimId
 */
export function applyRimToCubes(meshes, rimId) {
  for (const mesh of meshes) applyRimToCube(mesh, rimId);
}

/**
 * @param {import("./particles.js").ParticleSystem} particles
 * @param {CosmeticId | null} sparksId
 */
export function applySparksToParticles(particles, sparksId) {
  particles.setPalette(sparksId === "sparks_ember" ? "ember" : "default");
}

/**
 * Buy if affordable; deducts clicks via ScoreStore; auto-equips.
 * @param {{
 *   itemId: string,
 *   scores: { score: number, add: (n: number) => void },
 *   readOnly?: boolean,
 * }} opts
 * @returns {{ ok: true, sku: CosmeticSku, state: ReturnType<typeof readCosmetics> } | { ok: false, reason: "unknown" | "owned" | "broke" | "readonly" }}
 */
export function purchaseCosmetic(opts) {
  const { itemId, scores, readOnly = false } = opts;
  if (readOnly) return { ok: false, reason: "readonly" };
  const sku = BY_ID[/** @type {CosmeticId} */ (itemId)];
  if (!sku) return { ok: false, reason: "unknown" };

  const state = readCosmetics();
  if (state.owned.includes(sku.id)) return { ok: false, reason: "owned" };
  if (scores.score < sku.price) return { ok: false, reason: "broke" };

  scores.add(-sku.price);
  state.owned.push(sku.id);
  if (sku.slot === "rim") state.equipped.rim = sku.id;
  else state.equipped.sparks = sku.id;
  writeCosmetics(state);
  trackEvent("shop_buy", { item_id: sku.id, value: sku.price });
  return { ok: true, sku, state };
}

/**
 * Equip an owned cosmetic (or clear slot with null).
 * @param {CosmeticSlot} slot
 * @param {CosmeticId | null} itemId
 * @returns {ReturnType<typeof readCosmetics>}
 */
export function equipCosmetic(slot, itemId) {
  const state = readCosmetics();
  if (itemId == null) {
    state.equipped[slot] = null;
  } else {
    const sku = BY_ID[itemId];
    if (!sku || sku.slot !== slot || !state.owned.includes(itemId)) return state;
    state.equipped[slot] = itemId;
  }
  writeCosmetics(state);
  if (itemId) trackEvent("shop_equip", { item_id: itemId });
  return state;
}
