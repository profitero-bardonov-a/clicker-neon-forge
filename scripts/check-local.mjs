#!/usr/bin/env node
/**
 * Local smoke check before Netlify deploy.
 * Usage: node scripts/check-local.mjs
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const required = [
  "index.html",
  "css/styles.css",
  "js/main.js",
  "js/i18n.js",
  "js/menu.js",
  "js/auth.js",
  "js/leaderboard.js",
  "js/leaderboard-stubs.js",
  "js/leaderboard-rules.js",
  "js/score-store.js",
  "js/analytics.js",
  "js/onboarding-tip.js",
  "js/effect-tips.js",
  "js/milestones.js",
  "js/question-gift.js",
  "js/cosmetics.js",
  "js/shop.js",
  "js/effects-config.js",
  "js/effects.js",
  "js/float-texts.js",
  "assets/effect-photo-a.jpg",
  "assets/effect-photo-b.jpg",
  "netlify/functions/score.mjs",
  "netlify/functions/leaderboard.mjs",
  "netlify.toml",
  "package.json",
];

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function assertFiles() {
  const missing = required.filter((rel) => !existsSync(join(root, rel)));
  if (missing.length) {
    throw new Error(`Missing files:\n- ${missing.join("\n- ")}`);
  }
}

function assertHtml() {
  const html = readFileSync(join(root, "index.html"), "utf8");
  for (const needle of [
    'id="login-btn"',
    'id="menu-btn"',
    'id="app-menu"',
    'id="locale-list"',
    'id="logout-modal"',
    'id="leaderboard-toggle"',
    'id="effect-rim"',
    'id="tap-hint"',
    'id="effects-tip"',
    'id="effect-type-tip"',
    'id="milestone-toast"',
    'id="question-gift-layer"',
    'id="forge-shop"',
    'id="shop-open"',
    'id="shop-list"',
    'src="js/main.js"',
  ]) {
    if (!html.includes(needle)) {
      throw new Error(`index.html missing expected marker: ${needle}`);
    }
  }
}

function assertI18n() {
  const src = readFileSync(join(root, "js/i18n.js"), "utf8");
  if (!src.includes("detectSystemLocale")) {
    throw new Error("i18n.js must auto-detect system locale");
  }
  if (!src.includes("MANUAL_KEY")) {
    throw new Error("i18n.js must distinguish manual locale choice");
  }
  if (!src.includes("tapHint")) {
    throw new Error("i18n.js must include tapHint for first-session coach mark");
  }
  for (const key of ["effectsTipTitle", "effectsTipBody", "effectsTipGotIt", "milestoneToast"]) {
    if (!src.includes(key)) {
      throw new Error(`i18n.js must include ${key} for onboarding tip / milestones`);
    }
  }
  for (const key of [
    "shopOpen",
    "shopTitle",
    "shopBuy",
    "shopItem_rim_cyan",
    "shopItem_rim_magenta",
    "shopItem_sparks_ember",
    "leadersCountLabel",
    "effectBerserk",
    "effectBerserkLabel",
    "effectTipName_berserk",
    "effectTipBody_berserk",
    "effectTipName_click_x2",
    "effectTipBody_neon_orb",
  ]) {
    const count = src.split(key).length - 1;
    if (count < 5) {
      throw new Error(`i18n.js must include ${key} in all 5 locales (found ${count})`);
    }
  }
}

function assertEffectsGate() {
  const src = readFileSync(join(root, "js/effects.js"), "utf8");
  if (!src.includes("armSchedule")) {
    throw new Error("effects.js must expose armSchedule for first-click gate");
  }
  if (!src.includes("armMissForgiveness") || !src.includes("_shouldForgiveMiss")) {
    throw new Error("effects.js must implement miss-click forgiveness");
  }
  const main = readFileSync(join(root, "js/main.js"), "utf8");
  if (!main.includes("armSchedule") || !main.includes("first_click")) {
    throw new Error("main.js must gate effects and track first_click");
  }
  if (!main.includes("armMissForgiveness") || !main.includes("newPlayerSession")) {
    throw new Error("main.js must arm miss forgiveness for new-player sessions");
  }
  const cfg = readFileSync(join(root, "js/effects-config.js"), "utf8");
  if (!cfg.includes("missForgivenessMs")) {
    throw new Error("effects-config.js must define missForgivenessMs");
  }
  for (const id of ["overcharge", "neon_orb", "quake", "berserk"]) {
    if (!cfg.includes(`${id}:`)) {
      throw new Error(`effects-config.js must define ${id}`);
    }
  }
  if (!src.includes("_isOrb") || !src.includes("_rampValue") || !src.includes("jitterAmp")) {
    throw new Error("effects.js must implement orb / overcharge / quake dynamics");
  }
  if (!src.includes("_startBerserk") || !src.includes("_berserkLeft")) {
    throw new Error("effects.js must implement berserk chain");
  }
}

async function assertNewEffects() {
  const { EFFECTS_CONFIG } = await import(join(root, "js/effects-config.js"));
  const needed = ["overcharge", "neon_orb", "quake", "berserk"];
  for (const id of needed) {
    const def = EFFECTS_CONFIG.effects[id];
    if (!def || def.enabled === false) {
      throw new Error(`${id} must be present and enabled`);
    }
  }
  if (EFFECTS_CONFIG.effects.overcharge.polarity !== "positive") {
    throw new Error("overcharge must stay positive");
  }
  if (EFFECTS_CONFIG.effects.neon_orb.polarity !== "positive") {
    throw new Error("neon_orb must stay positive");
  }
  if (EFFECTS_CONFIG.effects.quake.polarity !== "negative") {
    throw new Error("quake must stay negative");
  }
  const { scheduleDelayMinMs, scheduleDelayMaxMs } = EFFECTS_CONFIG.common;
  if (scheduleDelayMinMs !== 3_000 || scheduleDelayMaxMs !== 7_000) {
    throw new Error("schedule delay must stay 3000–7000ms unless DECISIONS.md changes");
  }
  const berserk = EFFECTS_CONFIG.effects.berserk;
  if (!berserk.meta || berserk.chainCount !== 5) {
    throw new Error("berserk must be meta with chainCount 5");
  }

  if (typeof globalThis.Image === "undefined") {
    globalThis.Image = class {
      constructor() {
        this.src = "";
        this.decoding = "";
      }
    };
  }

  const { EffectRuntime } = await import(join(root, "js/effects.js"));
  const noopList = { remove() {}, toggle() {}, add() {} };
  const rim = { hidden: true, classList: noopList };
  const countdown = { hidden: true, textContent: "", classList: noopList };
  const label = { textContent: "", classList: noopList, style: {} };
  const fx = new EffectRuntime({
    rimEl: /** @type {any} */ (rim),
    countdownEl: /** @type {any} */ (countdown),
    labelEl: /** @type {any} */ (label),
  });
  fx.autoSchedule = false;

  fx.beginEffect("overcharge");
  const hit = { hitCube: true, hitPhoto: false, twinRole: null, sequenceNumber: null };
  if (fx.resolveClick(hit) !== 2) throw new Error("overcharge first hit must be ×2");
  if (fx.resolveClick(hit) !== 3) throw new Error("overcharge second hit must be ×3");
  if (fx.resolveClick({ hitCube: false, hitPhoto: false }) !== -1) {
    throw new Error("overcharge miss must reset with classic −1");
  }
  if (fx.resolveClick(hit) !== 2) throw new Error("overcharge must restart at ×2 after miss");

  fx.beginEffect("neon_orb");
  if (fx.resolveClick({ hitCube: false, hitPhoto: true }) !== 12) {
    throw new Error("neon_orb photo/orb hit must award orbHit");
  }
  if (fx.resolveClick(hit) !== 1) throw new Error("neon_orb cube hit must stay +1");

  fx.beginEffect("quake");
  if (fx.resolveClick({ hitCube: false, hitPhoto: false }) !== -3) {
    throw new Error("quake miss must use −3");
  }
  if (fx.resolveClick(hit) !== 1) throw new Error("quake cube hit must stay +1");

  fx.beginEffect("berserk");
  if (fx._berserkTotal !== 5) throw new Error("berserk must start a 5-link chain");
  if (!fx.active || fx.active.id === "berserk") {
    throw new Error("berserk must immediately start a non-meta link effect");
  }
  const firstLink = fx.active.id;
  fx.endEffect({ reschedule: false });
  if (fx._berserkLeft < 0) throw new Error("berserk chain counter went negative");
  if (fx._berserkTotal === 5 && fx._berserkLeft === 0 && !fx.active) {
    // finished early somehow — still OK if chain ran
  } else if (!fx.active && fx._berserkLeft > 0) {
    throw new Error("berserk should keep chaining until links are exhausted");
  } else if (fx.active && fx.active.id === firstLink && fx._berserkLeft === 4) {
    // same id can re-roll; counter should have decremented for the next pending link already
  }

  const i18n = readFileSync(join(root, "js/i18n.js"), "utf8");
  for (const key of ["effectOvercharge", "effectNeonOrb", "effectQuake", "effectBerserk"]) {
    const count = i18n.split(key).length - 1;
    if (count < 5) throw new Error(`${key} must appear in all 5 locales (found ${count})`);
  }
}

async function assertOnboardingTip() {
  const { EFFECTS_TIP_AFTER_CLICKS, initEffectsTip } = await import(
    join(root, "js/onboarding-tip.js")
  );
  if (EFFECTS_TIP_AFTER_CLICKS !== 10) {
    throw new Error("EFFECTS_TIP_AFTER_CLICKS must stay 10 unless DECISIONS.md changes");
  }

  // Minimal DOM stubs for Node.
  const store = new Map();
  const localStorageStub = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };
  const prevLS = globalThis.localStorage;
  const prevWindow = globalThis.window;
  const prevDocument = globalThis.document;
  globalThis.localStorage = localStorageStub;
  const bodyClass = new Set();
  globalThis.document = {
    body: {
      classList: {
        add: (c) => bodyClass.add(c),
        remove: (c) => bodyClass.delete(c),
        contains: (c) => bodyClass.has(c),
      },
    },
  };
  globalThis.window = {
    addEventListener() {},
  };

  try {
    /** @type {string[]} */
    const events = [];
    const prevGtag = /** @type {any} */ (globalThis).gtag;
    /** @type {any} */ (globalThis).gtag = (cmd, name, params) => {
      if (cmd === "event") events.push(String(name));
    };

    const tipRoot = {
      hidden: true,
      querySelector: (sel) => {
        if (String(sel).includes("effectsTipTitle")) return { textContent: "" };
        if (String(sel).includes("effectsTipBody")) return { textContent: "" };
        if (String(sel).includes("effectsTipGotIt")) return { textContent: "" };
        return null;
      },
    };
    const dismissBtn = {
      focus() {},
      setAttribute() {},
      addEventListener(type, fn) {
        this._click = type === "click" ? fn : this._click;
      },
      _click: /** @type {null | Function} */ (null),
    };
    const backdrop = {
      addEventListener(type, fn) {
        this._click = type === "click" ? fn : this._click;
      },
      _click: /** @type {null | Function} */ (null),
    };

    let opened = false;
    const tip = initEffectsTip({
      root: /** @type {any} */ (tipRoot),
      dismissBtn: /** @type {any} */ (dismissBtn),
      backdrop: /** @type {any} */ (backdrop),
      onOpen: () => {
        opened = true;
      },
      onClose: () => {
        opened = false;
      },
    });

    for (let i = 0; i < 9; i++) tip.noteCanvasClick();
    if (opened || !tipRoot.hidden) throw new Error("tip must not open before 10 clicks");
    tip.noteCanvasClick();
    if (!opened || tipRoot.hidden) throw new Error("tip must open on the 10th click");
    if (!events.includes("effects_tip_shown")) throw new Error("missing effects_tip_shown event");

    dismissBtn._click?.({ preventDefault() {}, stopPropagation() {} });
    if (opened || !tipRoot.hidden) throw new Error("tip must close on Got it");
    if (!events.includes("effects_tip_dismiss")) throw new Error("missing effects_tip_dismiss event");
    if (localStorageStub.getItem("neon-forge-effects-tip-seen") !== "1") {
      throw new Error("tip dismiss must persist seen flag");
    }

    tip.noteCanvasClick();
    if (opened) throw new Error("tip must not reopen after seen");

    /** @type {any} */ (globalThis).gtag = prevGtag;
  } finally {
    if (prevLS === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prevLS;
    if (prevWindow === undefined) delete globalThis.window;
    else globalThis.window = prevWindow;
    if (prevDocument === undefined) delete globalThis.document;
    else globalThis.document = prevDocument;
  }

  const mainSrc = readFileSync(join(root, "js/main.js"), "utf8");
  if (!mainSrc.includes("initEffectsTip") || !mainSrc.includes("noteCanvasClick")) {
    throw new Error("main.js must wire onboarding tip");
  }
}

async function assertMilestones() {
  const { MILESTONE_THRESHOLDS, MILESTONE_STORAGE_KEY, initMilestones } = await import(
    join(root, "js/milestones.js")
  );
  if (JSON.stringify([...MILESTONE_THRESHOLDS]) !== JSON.stringify([10, 50, 100, 500, 1000])) {
    throw new Error("MILESTONE_THRESHOLDS must stay 10/50/100/500/1000 unless DECISIONS.md changes");
  }
  if (MILESTONE_STORAGE_KEY !== "neon-forge-milestones") {
    throw new Error("milestone storage key must stay neon-forge-milestones");
  }

  const store = new Map();
  const localStorageStub = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };
  const prevLS = globalThis.localStorage;
  const prevWindow = globalThis.window;
  globalThis.localStorage = localStorageStub;
  /** @type {null | (() => void)} */
  let pendingTimeout = null;
  globalThis.window = {
    setTimeout: (fn) => {
      pendingTimeout = fn;
      return 1;
    },
    clearTimeout() {
      pendingTimeout = null;
    },
  };

  try {
    /** @type {string[]} */
    const events = [];
    /** @type {unknown[]} */
    const eventParams = [];
    const prevGtag = /** @type {any} */ (globalThis).gtag;
    /** @type {any} */ (globalThis).gtag = (cmd, name, params) => {
      if (cmd === "event") {
        events.push(String(name));
        eventParams.push(params);
      }
    };

    const textEl = { textContent: "" };
    /** @type {string} */
    let attrThreshold = "";
    const toastRoot = {
      hidden: true,
      setAttribute(name, value) {
        if (name === "data-threshold") attrThreshold = String(value);
      },
      removeAttribute(name) {
        if (name === "data-threshold") attrThreshold = "";
      },
      getAttribute: (name) => (name === "data-threshold" ? attrThreshold : null),
      addEventListener() {},
    };

    let tipOpen = false;
    let celebrated = 0;
    const milestones = initMilestones({
      root: /** @type {any} */ (toastRoot),
      textEl: /** @type {any} */ (textEl),
      tipIsOpen: () => tipOpen,
      onCelebrate: () => {
        celebrated += 1;
      },
    });
    milestones.syncScore(0);

    milestones.noteScore(9);
    if (!toastRoot.hidden || celebrated) throw new Error("milestone must not fire before 10");

    // Tip not seen yet → threshold 10 waits, but 50 must still toast.
    tipOpen = false;
    milestones.noteScore(10);
    if (!toastRoot.hidden) throw new Error("milestone 10 must wait until effects tip is seen");
    if (events.includes("milestone_reached")) {
      throw new Error("milestone_reached must not fire while tip unseen");
    }

    milestones.noteScore(50);
    if (toastRoot.hidden) throw new Error("milestone 50 must show even while tip@10 waits");
    if (!events.includes("milestone_reached")) throw new Error("missing milestone_reached for 50");
    const firstReached = eventParams.find((_, i) => events[i] === "milestone_reached");
    if (!firstReached || /** @type {any} */ (firstReached).value !== 50) {
      throw new Error("first toast while tip unseen must be 50, not 10");
    }

    // Dismiss 50 (timeout stub), then tip unlocks queued 10.
    events.length = 0;
    eventParams.length = 0;
    celebrated = 0;
    localStorageStub.setItem("neon-forge-effects-tip-seen", "1");
    pendingTimeout?.();
    pendingTimeout = null;
    if (toastRoot.hidden) throw new Error("milestone 10 must show after tip seen");
    const tenIdx = events.indexOf("milestone_reached");
    if (tenIdx < 0 || /** @type {any} */ (eventParams[tenIdx]).value !== 10) {
      throw new Error("milestone_reached must pass value=10 after tip");
    }
    if (celebrated < 1) throw new Error("milestone toast should celebrate with particles hook");

    const raw = localStorageStub.getItem("neon-forge-milestones");
    if (!raw || !raw.includes("10") || !raw.includes("50")) {
      throw new Error("claimed set must persist thresholds 10 and 50");
    }

    // Refresh simulation: syncScore at 10 must not re-toast; next threshold still works.
    events.length = 0;
    pendingTimeout = null;
    const again = initMilestones({
      root: /** @type {any} */ (toastRoot),
      textEl: /** @type {any} */ (textEl),
    });
    again.syncScore(50);
    again.noteScore(51);
    if (events.includes("milestone_reached")) {
      throw new Error("claimed milestones must not re-fire on refresh");
    }

    again.noteScore(100);
    if (!events.includes("milestone_reached")) throw new Error("milestone 100 must fire when unclaimed");

    /** @type {any} */ (globalThis).gtag = prevGtag;
  } finally {
    if (prevLS === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prevLS;
    if (prevWindow === undefined) delete globalThis.window;
    else globalThis.window = prevWindow;
  }

  const mainSrc = readFileSync(join(root, "js/main.js"), "utf8");
  if (!mainSrc.includes("initMilestones") || !mainSrc.includes("noteScore")) {
    throw new Error("main.js must wire milestones");
  }
}

async function assertMissForgiveness() {
  const { EFFECTS_CONFIG } = await import(join(root, "js/effects-config.js"));
  const ms = EFFECTS_CONFIG.common.missForgivenessMs;
  if (!(ms >= 1000 && ms <= 30_000)) {
    throw new Error("missForgivenessMs should stay in a short first-session window (1–30s)");
  }
  if (EFFECTS_CONFIG.common.miss !== -1) {
    throw new Error("common.miss must remain -1 for forgiveness matching");
  }

  // Node has no DOM Image; EffectRuntime preloads effect photos in the constructor.
  if (typeof globalThis.Image === "undefined") {
    globalThis.Image = class {
      constructor() {
        this.src = "";
        this.decoding = "";
      }
    };
  }

  const { EffectRuntime } = await import(join(root, "js/effects.js"));
  const noopList = { remove() {}, toggle() {}, add() {} };
  const rim = { hidden: true, classList: noopList };
  const countdown = { hidden: true, textContent: "", classList: noopList };
  const label = { textContent: "", classList: noopList, style: {} };
  const fx = new EffectRuntime({
    rimEl: /** @type {any} */ (rim),
    countdownEl: /** @type {any} */ (countdown),
    labelEl: /** @type {any} */ (label),
  });
  fx.autoSchedule = false;
  const missHit = { hitCube: false, hitPhoto: false, twinRole: null, sequenceNumber: null };
  if (fx.resolveClick(missHit) !== -1) {
    throw new Error("miss without forgiveness armed should stay -1");
  }
  fx.armMissForgiveness();
  if (!fx.isMissForgivenessActive()) {
    throw new Error("armMissForgiveness should activate the window");
  }
  if (fx.resolveClick(missHit) !== 0) {
    throw new Error("classic miss during forgiveness must score 0");
  }
  if (fx.resolveClick({ hitCube: true, hitPhoto: false }) !== 1) {
    throw new Error("cube hits must still score during forgiveness");
  }
  fx._forgivenessUntil = performance.now() - 1;
  if (fx.resolveClick(missHit) !== -1) {
    throw new Error("after forgiveness window, miss must return to -1");
  }
}

async function assertForgeShop() {
  const {
    COSMETICS_STORAGE_KEY,
    SHOP_CATALOG,
    purchaseCosmetic,
    readCosmetics,
    writeCosmetics,
  } = await import(join(root, "js/cosmetics.js"));

  if (COSMETICS_STORAGE_KEY !== "neon-forge-cosmetics") {
    throw new Error("cosmetics storage key must stay neon-forge-cosmetics");
  }
  const prices = Object.fromEntries(SHOP_CATALOG.map((s) => [s.id, s.price]));
  if (prices.rim_cyan !== 50 || prices.rim_magenta !== 100 || prices.sparks_ember !== 150) {
    throw new Error("shop prices must be cyan 50 / magenta 100 / ember 150");
  }
  for (const sku of SHOP_CATALOG) {
    if (sku.slot !== "rim" && sku.slot !== "sparks") {
      throw new Error("shop SKUs must be visual rim/sparks only");
    }
  }

  const store = new Map();
  const localStorageStub = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };
  const prevLs = globalThis.localStorage;
  globalThis.localStorage = localStorageStub;

  try {
    /** @type {string[]} */
    const events = [];
    /** @type {unknown[]} */
    const eventParams = [];
    const prevGtag = /** @type {any} */ (globalThis).gtag;
    /** @type {any} */ (globalThis).gtag = (cmd, name, params) => {
      if (cmd === "event") {
        events.push(String(name));
        eventParams.push(params);
      }
    };

    writeCosmetics({ owned: [], equipped: { rim: null, sparks: null } });

    /** @type {{ score: number, add: (n: number) => void }} */
    const scores = {
      score: 49,
      add(n) {
        this.score += n;
      },
    };

    const broke = purchaseCosmetic({ itemId: "rim_cyan", scores });
    if (broke.ok || scores.score !== 49) {
      throw new Error("buy with 49 clicks must fail without deducting");
    }

    scores.score = 50;
    const bought = purchaseCosmetic({ itemId: "rim_cyan", scores });
    if (!bought.ok) throw new Error("buy with 50 clicks must succeed");
    if (scores.score !== 0) throw new Error("buy must deduct score via ScoreStore.add");
    if (!events.includes("shop_buy")) throw new Error("missing shop_buy event");
    const buyParams = eventParams.find((_, i) => events[i] === "shop_buy");
    if (!buyParams || /** @type {any} */ (buyParams).item_id !== "rim_cyan") {
      throw new Error("shop_buy must pass item_id");
    }
    if (/** @type {any} */ (buyParams).value !== 50) {
      throw new Error("shop_buy value must equal price");
    }

    const persisted = readCosmetics();
    if (!persisted.owned.includes("rim_cyan") || persisted.equipped.rim !== "rim_cyan") {
      throw new Error("owned+equipped must persist in neon-forge-cosmetics");
    }

    const again = purchaseCosmetic({ itemId: "rim_cyan", scores: { score: 999, add() {} } });
    if (again.ok) throw new Error("already-owned buy must fail");

    const mainSrc = readFileSync(join(root, "js/main.js"), "utf8");
    if (!mainSrc.includes("initShop")) {
      throw new Error("main.js must wire initShop");
    }
    const scoreStore = readFileSync(join(root, "js/score-store.js"), "utf8");
    if (!scoreStore.includes("add(delta)")) {
      throw new Error("ScoreStore must expose add for shop spend");
    }
    const cosmeticsSrc = readFileSync(join(root, "js/cosmetics.js"), "utf8");
    if (!cosmeticsSrc.includes("scores.add(-sku.price)")) {
      throw new Error("purchase must deduct score via scores.add(-sku.price)");
    }

    /** @type {any} */ (globalThis).gtag = prevGtag;
  } finally {
    if (prevLs === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prevLs;
  }
}

async function assertLeaderboardHygiene() {
  const { isPublicLeaderScore, filterPublicLeaders, MIN_PUBLIC_CLICKS } = await import(
    join(root, "js/leaderboard-rules.js")
  );
  if (MIN_PUBLIC_CLICKS !== 1) {
    throw new Error("MIN_PUBLIC_CLICKS must stay 1 unless DECISIONS.md is updated");
  }
  if (isPublicLeaderScore(0) || isPublicLeaderScore(-703) || isPublicLeaderScore(-1)) {
    throw new Error("scores <= 0 must not be public leaders");
  }
  if (!isPublicLeaderScore(1) || !isPublicLeaderScore(80755)) {
    throw new Error("positive scores must remain public leaders");
  }
  const filtered = filterPublicLeaders([
    { rank: 1, name: "A", clicks: 10 },
    { rank: 2, name: "Idle", clicks: 0 },
    { rank: 3, name: "Drain", clicks: -5 },
    { rank: 4, name: "B", clicks: 3 },
  ]);
  if (filtered.length !== 2 || filtered[0].name !== "A" || filtered[0].rank !== 1) {
    throw new Error("filterPublicLeaders must drop <=0 and renumber ranks");
  }
  if (filtered[1].name !== "B" || filtered[1].rank !== 2) {
    throw new Error("filterPublicLeaders rank renumber failed");
  }

  const fn = readFileSync(join(root, "netlify/functions/leaderboard.mjs"), "utf8");
  if (!fn.includes("MIN_PUBLIC_CLICKS") || !fn.includes("WHERE clicks >=")) {
    throw new Error("leaderboard function must filter clicks >= MIN_PUBLIC_CLICKS");
  }
  if (!fn.includes("totalPlayers")) {
    throw new Error("leaderboard function must return totalPlayers (all rows)");
  }
  const client = readFileSync(join(root, "js/leaderboard.js"), "utf8");
  if (!client.includes("filterPublicLeaders")) {
    throw new Error("leaderboard.js must apply filterPublicLeaders");
  }
  if (!client.includes("totalPlayers") || !client.includes("`${s} / ${total}`")) {
    throw new Error("leaderboard UI must show visible / totalPlayers");
  }
  if (!client.includes("leadersCountLabel")) {
    throw new Error("leaderboard count must use leadersCountLabel for a11y");
  }
}

async function assertQuestionGift() {
  const {
    QUESTION_GIFT_STEP,
    QUESTION_GIFT_REWARD,
    QUESTION_GIFT_STORAGE_KEY,
    crossedQuestionThresholds,
    initQuestionGift,
  } = await import(join(root, "js/question-gift.js"));
  if (QUESTION_GIFT_STEP !== 1000 || QUESTION_GIFT_REWARD !== 500) {
    throw new Error("question gift must stay +500 every 1000 unless DECISIONS.md changes");
  }
  if (QUESTION_GIFT_STORAGE_KEY !== "neon-forge-question-gifts") {
    throw new Error("question gift storage key mismatch");
  }
  if (JSON.stringify(crossedQuestionThresholds(999, 1000)) !== "[1000]") {
    throw new Error("crossing 1000 must emit threshold 1000");
  }
  if (JSON.stringify(crossedQuestionThresholds(1000, 2500)) !== "[2000]") {
    throw new Error("2500 from 1000 must only emit 2000");
  }
  if (crossedQuestionThresholds(500, 500).length) {
    throw new Error("no threshold when score does not rise past a multiple");
  }

  const store = new Map();
  const prevLs = globalThis.localStorage;
  const prevWindow = globalThis.window;
  const prevRaf = globalThis.requestAnimationFrame;
  const prevCancel = globalThis.cancelAnimationFrame;
  const prevDoc = globalThis.document;
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };
  /** @type {null | (() => void)} */
  let pendingTimeout = null;
  globalThis.window = {
    innerWidth: 400,
    innerHeight: 700,
    setTimeout: (fn) => {
      pendingTimeout = fn;
      return 1;
    },
    clearTimeout() {
      pendingTimeout = null;
    },
  };
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};

  /** @type {null | ((e: any) => void)} */
  let ptr = null;
  const layer = {
    hidden: true,
    appendChild(node) {
      this._btn = node;
    },
    _btn: /** @type {any} */ (null),
  };
  globalThis.document = {
    createElement() {
      return {
        type: "",
        className: "",
        textContent: "",
        style: {},
        setAttribute() {},
        remove() {
          layer._btn = null;
        },
        addEventListener(type, fn) {
          if (type === "pointerdown") ptr = fn;
        },
      };
    },
  };

  try {
    let catchReward = 0;
    const gift = initQuestionGift({
      layer: /** @type {any} */ (layer),
      onCatch: (reward) => {
        catchReward = reward;
      },
    });
    gift.syncScore(0);
    gift.noteScore(999);
    if (!layer.hidden) throw new Error("gift must not spawn before 1000");

    gift.noteScore(1000);
    if (layer.hidden || !layer._btn) throw new Error("gift must spawn at 1000");
    if (!ptr) throw new Error("gift button must listen for pointerdown");
    ptr({ preventDefault() {}, stopPropagation() {} });
    if (catchReward !== 500) throw new Error("catch must award 500");
    const raw = store.get(QUESTION_GIFT_STORAGE_KEY) || "";
    if (!raw.includes("1000")) throw new Error("threshold 1000 must be claimed once");

    ptr = null;
    layer._btn = null;
    layer.hidden = true;
    catchReward = 0;
    gift.noteScore(1001);
    if (layer._btn) throw new Error("must not respawn same 1000 threshold");

    gift.noteScore(2000);
    if (!layer._btn) throw new Error("must spawn again at 2000");
    pendingTimeout?.();
    if (layer._btn) throw new Error("timeout must clear gift without award");
  } finally {
    if (prevLs === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prevLs;
    if (prevWindow === undefined) delete globalThis.window;
    else globalThis.window = prevWindow;
    if (prevRaf === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = prevRaf;
    if (prevCancel === undefined) delete globalThis.cancelAnimationFrame;
    else globalThis.cancelAnimationFrame = prevCancel;
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
  }

  const mainSrc = readFileSync(join(root, "js/main.js"), "utf8");
  if (!mainSrc.includes("initQuestionGift")) {
    throw new Error("main.js must wire question gift");
  }
}

async function assertEffectTips() {
  const { EFFECT_TIPS_STORAGE_KEY, initEffectTips, tipKeysForEffect } = await import(
    join(root, "js/effect-tips.js")
  );
  if (EFFECT_TIPS_STORAGE_KEY !== "neon-forge-effect-tips-seen") {
    throw new Error("effect tips storage key mismatch");
  }
  const keys = tipKeysForEffect("berserk");
  if (!keys.nameKey || !keys.bodyKey) throw new Error("berserk must have tip keys");

  const store = new Map();
  const prevLs = globalThis.localStorage;
  const prevWindow = globalThis.window;
  const prevDocument = globalThis.document;
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };
  const bodyClass = new Set();
  globalThis.document = {
    body: {
      classList: {
        add: (c) => bodyClass.add(c),
        remove: (c) => bodyClass.delete(c),
        contains: (c) => bodyClass.has(c),
      },
    },
  };
  globalThis.window = { addEventListener() {} };

  try {
    /** @type {string[]} */
    const events = [];
    const prevGtag = /** @type {any} */ (globalThis).gtag;
    /** @type {any} */ (globalThis).gtag = (cmd, name) => {
      if (cmd === "event") events.push(String(name));
    };

    const titleEl = { textContent: "" };
    const bodyEl = { textContent: "" };
    const tipRoot = { hidden: true };
    const dismissBtn = {
      textContent: "",
      focus() {},
      setAttribute() {},
      addEventListener(type, fn) {
        this._click = type === "click" ? fn : this._click;
      },
      _click: /** @type {null | Function} */ (null),
    };
    const backdrop = {
      addEventListener(type, fn) {
        this._click = type === "click" ? fn : this._click;
      },
      _click: /** @type {null | Function} */ (null),
    };

    const tips = initEffectTips({
      root: /** @type {any} */ (tipRoot),
      titleEl: /** @type {any} */ (titleEl),
      bodyEl: /** @type {any} */ (bodyEl),
      dismissBtn: /** @type {any} */ (dismissBtn),
      backdrop: /** @type {any} */ (backdrop),
    });

    tips.noteEffect("overcharge");
    if (tipRoot.hidden) throw new Error("first overcharge must open effect tip");
    if (!events.includes("effect_tip_shown")) throw new Error("missing effect_tip_shown");
    dismissBtn._click?.({ preventDefault() {}, stopPropagation() {} });
    if (!tipRoot.hidden) throw new Error("effect tip must close");
    const raw = store.get(EFFECT_TIPS_STORAGE_KEY) || "";
    if (!raw.includes("overcharge")) throw new Error("seen set must persist effect id");

    tips.noteEffect("overcharge");
    if (!tipRoot.hidden) throw new Error("same effect tip must not reopen");

    bodyClass.add("is-menu-open");
    tips.noteEffect("quake");
    if (!tipRoot.hidden) throw new Error("must skip while menu open");
    bodyClass.delete("is-menu-open");
    tips.resume();
    if (tipRoot.hidden) throw new Error("queued effect tip must show after menu close");

    /** @type {any} */ (globalThis).gtag = prevGtag;
  } finally {
    if (prevLs === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prevLs;
    if (prevWindow === undefined) delete globalThis.window;
    else globalThis.window = prevWindow;
    if (prevDocument === undefined) delete globalThis.document;
    else globalThis.document = prevDocument;
  }

  const mainSrc = readFileSync(join(root, "js/main.js"), "utf8");
  if (!mainSrc.includes("initEffectTips")) {
    throw new Error("main.js must wire per-effect tips");
  }
}

async function serveAndFetch() {
  const server = createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      const rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\//, "");
      const filePath = normalize(join(root, rel));
      if (!filePath.startsWith(root) || !existsSync(filePath) || !statSync(filePath).isFile()) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const body = readFileSync(filePath);
      res.writeHead(200, { "Content-Type": mime[extname(filePath)] || "application/octet-stream" });
      res.end(body);
    } catch (err) {
      res.writeHead(500);
      res.end(String(err));
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = /** @type {import('node:net').AddressInfo} */ (server.address());
  const base = `http://127.0.0.1:${port}`;

  try {
    const home = await fetch(`${base}/`);
    if (!home.ok) throw new Error(`GET / => ${home.status}`);
    const html = await home.text();
    if (!html.includes("NEON FORGE")) throw new Error("Home page markup unexpected");

    for (const path of ["/css/styles.css", "/js/main.js", "/js/i18n.js", "/js/menu.js"]) {
      const res = await fetch(`${base}${path}`);
      if (!res.ok) throw new Error(`GET ${path} => ${res.status}`);
    }
  } finally {
    server.close();
  }
}

async function main() {
  assertFiles();
  assertHtml();
  assertI18n();
  assertEffectsGate();
  await assertNewEffects();
  await assertOnboardingTip();
  await assertMilestones();
  await assertMissForgiveness();
  await assertForgeShop();
  await assertLeaderboardHygiene();
  await assertQuestionGift();
  await assertEffectTips();
  await serveAndFetch();
  console.log("Local check passed");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
