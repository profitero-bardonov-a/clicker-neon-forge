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
  for (const key of ["effectsTipTitle", "effectsTipBody", "effectsTipGotIt"]) {
    if (!src.includes(key)) {
      throw new Error(`i18n.js must include ${key} for onboarding tip`);
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
  const client = readFileSync(join(root, "js/leaderboard.js"), "utf8");
  if (!client.includes("filterPublicLeaders")) {
    throw new Error("leaderboard.js must apply filterPublicLeaders");
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
  await assertOnboardingTip();
  await assertMissForgiveness();
  await assertLeaderboardHygiene();
  await serveAndFetch();
  console.log("Local check passed");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
