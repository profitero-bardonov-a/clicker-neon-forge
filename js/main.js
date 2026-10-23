import { Cube } from "./cube.js";
import { ParticleSystem } from "./particles.js";
import { Counter } from "./counter.js";
import { ScoreStore } from "./score-store.js";
import { initAuth } from "./auth.js";
import { Leaderboard } from "./leaderboard.js";
import { initI18n, onLocaleChange, t } from "./i18n.js";
import { initMenu } from "./menu.js";
import { EffectRuntime } from "./effects.js";
import { FloatTexts } from "./float-texts.js";
import { isLocalDevHost } from "./leaderboard-stubs.js";
import { isDemoMode, startDemoReel } from "./demo-reel.js";
import { initPwa } from "./pwa.js";
import { trackEvent } from "./analytics.js";
import { initEffectsTip } from "./onboarding-tip.js";

const TAP_HINT_KEY = "neon-forge-tap-hint-seen";
let firstClickTracked = false;
/** Soft-freeze the loop while the effects tip is open (no pause glyph). */
let tipFrozen = false;
/** Wall-clock anchor for tip freeze (separate from leaderboard pause). */
let tipPauseAnchor = 0;

initI18n(/** @type {HTMLElement} */ (document.getElementById("locale-list")));

const menu = initMenu({
  root: /** @type {HTMLElement} */ (document.getElementById("app-menu")),
  button: /** @type {HTMLButtonElement} */ (document.getElementById("menu-btn")),
  closeBtn: /** @type {HTMLButtonElement} */ (document.getElementById("menu-close")),
  backdrop: /** @type {HTMLElement} */ (document.getElementById("menu-backdrop")),
});

initPwa({
  button: /** @type {HTMLButtonElement} */ (document.getElementById("pwa-install")),
  section: document.getElementById("pwa-install-section"),
});

const aboutRoot = /** @type {HTMLElement} */ (document.getElementById("about"));
const aboutCloseBtn = /** @type {HTMLButtonElement} */ (document.getElementById("about-close"));

function openAbout() {
  menu.close();
  aboutRoot.hidden = false;
  document.body.classList.add("is-about-open");
  aboutCloseBtn.focus();
}

function closeAbout() {
  aboutRoot.hidden = true;
  document.body.classList.remove("is-about-open");
}

document.getElementById("about-open")?.addEventListener("click", openAbout);
aboutCloseBtn.addEventListener("click", closeAbout);
document.getElementById("about-backdrop")?.addEventListener("click", closeAbout);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !aboutRoot.hidden) closeAbout();
});

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("stage"));
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d", {
  alpha: false,
}));

const counterRoot = /** @type {HTMLElement} */ (document.getElementById("counter"));
const counterValue = /** @type {HTMLElement} */ (document.getElementById("counter-value"));

const cube = new Cube();
/** Slot-stable twin meshes (index 0 / 1), roles can reshuffle without swapping spin. */
const twinMesh = [new Cube(), new Cube()];
/** Meshes for the 1–6 number-order effect. */
const sequenceMesh = Array.from({ length: 6 }, () => new Cube());
const particles = new ParticleSystem();
const counter = new Counter(counterRoot, counterValue);

const scores = new ScoreStore({
  onChange(score) {
    counter.setScore(score, { animate: false });
  },
});
counter.setScore(scores.score, { animate: false });

const pauseMark = /** @type {HTMLButtonElement} */ (document.getElementById("pause-mark"));
let paused = false;
/** Wall-clock anchor so a pause does not consume effect time. */
let pauseAnchor = 0;
/** True while the pause icon is playing its collapse-out animation. */
let pauseClosing = false;

function syncPauseLabel() {
  pauseMark.setAttribute("aria-label", t("resumePause"));
}

/**
 * @param {boolean} next
 */
function setPaused(next) {
  if (paused === next && !pauseClosing) return;
  const now = performance.now();
  if (next) {
    pauseAnchor = now;
    pauseClosing = false;
    pauseMark.classList.remove("is-closing");
  } else if (pauseAnchor) {
    effects.shiftClock(now - pauseAnchor);
    pauseAnchor = 0;
  }
  paused = next;
  pauseClosing = false;
  pauseMark.classList.remove("is-closing");
  document.body.classList.toggle("is-paused", paused);
  pauseMark.hidden = !paused;
  pauseMark.setAttribute("aria-hidden", paused ? "false" : "true");
  if (paused) syncPauseLabel();
}

const leaderboard = new Leaderboard({
  root: /** @type {HTMLElement} */ (document.getElementById("leaderboard")),
  listEl: /** @type {HTMLElement} */ (document.getElementById("leaderboard-list")),
  statusEl: /** @type {HTMLElement} */ (document.getElementById("leaderboard-status")),
  countEl: /** @type {HTMLElement | null} */ (document.getElementById("leaderboard-count")),
  toggleBtn: /** @type {HTMLButtonElement} */ (document.getElementById("leaderboard-toggle")),
  onExpanded: setPaused,
});
leaderboard.start();

/**
 * Collapse the pause mark, then resume and close the leaderboard.
 */
function dismissPauseFromIcon() {
  if (!paused || pauseClosing) return;
  pauseClosing = true;
  pauseMark.classList.add("is-closing");

  const reduceMotion =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const finish = () => {
    if (!pauseClosing) return;
    pauseMark.classList.remove("is-closing");
    pauseClosing = false;
    leaderboard.setExpanded(false);
  };

  if (reduceMotion) {
    finish();
    return;
  }

  const icon = pauseMark.querySelector(".pause-mark__icon");
  let done = false;
  const once = () => {
    if (done) return;
    done = true;
    finish();
  };
  icon?.addEventListener(
    "animationend",
    (ev) => {
      if (ev.animationName === "pause-mark-out") once();
    },
    { once: true }
  );
  window.setTimeout(once, 360);
}

pauseMark.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  dismissPauseFromIcon();
});

const effects = new EffectRuntime({
  rimEl: /** @type {HTMLElement} */ (document.getElementById("effect-rim")),
  countdownEl: /** @type {HTMLElement} */ (document.getElementById("effect-countdown")),
  labelEl: /** @type {HTMLElement} */ (document.getElementById("effect-label")),
});
effects.start();

const tapHint = /** @type {HTMLElement | null} */ (document.getElementById("tap-hint"));

/**
 * @param {boolean} [remember]
 */
function hideTapHint(remember = true) {
  if (!tapHint || tapHint.hidden) return;
  tapHint.hidden = true;
  tapHint.setAttribute("aria-hidden", "true");
  if (!remember) return;
  try {
    localStorage.setItem(TAP_HINT_KEY, "1");
  } catch {
    // private mode
  }
}

function maybeShowTapHint() {
  if (!tapHint || isDemoMode()) return;
  if (scores.score !== 0) return;
  try {
    if (localStorage.getItem(TAP_HINT_KEY) === "1") return;
  } catch {
    // ignore
  }
  tapHint.hidden = false;
  tapHint.setAttribute("aria-hidden", "false");
}

/** Zero local score at load → first-session coaching + miss forgiveness. */
const newPlayerSession = scores.score === 0 && !isDemoMode();

const effectsTip = initEffectsTip({
  root: /** @type {HTMLElement} */ (document.getElementById("effects-tip")),
  dismissBtn: /** @type {HTMLButtonElement} */ (document.getElementById("effects-tip-dismiss")),
  backdrop: /** @type {HTMLElement} */ (document.getElementById("effects-tip-backdrop")),
  enabled: !isDemoMode(),
  onOpen: () => {
    tipFrozen = true;
    tipPauseAnchor = performance.now();
  },
  onClose: () => {
    if (tipPauseAnchor) {
      effects.shiftClock(performance.now() - tipPauseAnchor);
      tipPauseAnchor = 0;
    }
    tipFrozen = false;
  },
});

// Returning players already know the loop — resume chaos immediately.
if (!newPlayerSession) {
  effects.armSchedule();
} else {
  maybeShowTapHint();
}

// Dev helper: window.__effects.beginEffect('click_x2')
if (typeof window !== "undefined") {
  /** @type {any} */ (window).__effects = effects;
}

if (isLocalDevHost()) {
  const devFx = /** @type {HTMLElement} */ (document.getElementById("dev-fx"));
  devFx.hidden = false;
  /** @type {Array<[string, string]>} */
  const localFxButtons = [
    ["dev-fx-split", "split_twins"],
    ["dev-fx-lottery", "split_lottery"],
    ["dev-fx-combo", "rising_combo"],
    ["dev-fx-order", "number_order"],
    ["dev-fx-overcharge", "overcharge"],
    ["dev-fx-orb", "neon_orb"],
    ["dev-fx-quake", "quake"],
  ];
  for (const [btnId, effectId] of localFxButtons) {
    const btn = /** @type {HTMLButtonElement} */ (document.getElementById(btnId));
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      effects.beginEffect(effectId);
    });
  }
}

const floats = new FloatTexts(
  /** @type {HTMLElement} */ (document.getElementById("float-layer"))
);

const auth = await initAuth({
  loginBtn: /** @type {HTMLButtonElement} */ (document.getElementById("login-btn")),
  menuLoginBtn: /** @type {HTMLButtonElement} */ (document.getElementById("menu-login-btn")),
  menuLoginSection: /** @type {HTMLElement} */ (document.getElementById("menu-login-section")),
  logoutBtn: /** @type {HTMLButtonElement} */ (document.getElementById("logout-btn")),
  logoutConfirmBtn: /** @type {HTMLButtonElement} */ (document.getElementById("logout-confirm")),
  logoutCancelBtn: /** @type {HTMLButtonElement} */ (document.getElementById("logout-cancel")),
  logoutModal: /** @type {HTMLElement} */ (document.getElementById("logout-modal")),
  logoutBackdrop: /** @type {HTMLElement} */ (document.getElementById("logout-backdrop")),
  userEl: /** @type {HTMLElement} */ (document.getElementById("auth-user")),
  nameEl: /** @type {HTMLElement} */ (document.getElementById("auth-name")),
  avatarEl: /** @type {HTMLImageElement} */ (document.getElementById("auth-avatar")),
  accountSection: /** @type {HTMLElement} */ (document.getElementById("menu-account-section")),
  onOpenLogout: () => menu.close(),
  async onUser(user) {
    if (user) {
      await scores.attachUser(user);
      counter.setScore(scores.score, { animate: false });
      void leaderboard.refresh();
    } else {
      scores.detachUser();
    }
  },
});

onLocaleChange(() => {
  auth.refreshLabels();
  effects.refreshLabel();
  if (paused) syncPauseLabel();
  if (tapHint && !tapHint.hidden) {
    tapHint.textContent = t("tapHint");
  }
});

let width = 0;
let height = 0;
let dpr = 1;
let baseCx = 0;
let baseCy = 0;
let baseScale = 120;
let lastTime = performance.now();

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  baseCx = width * 0.5;
  baseCy = height * 0.48;
  baseScale = Math.min(width, height) * 0.18;
}

/** Top of the cube zone: the bottom edge of the collapsed leaderboard. */
function playTop() {
  const board = document.getElementById("leaderboard");
  if (!board || board.classList.contains("is-expanded")) return 0;
  const bottom = board.getBoundingClientRect().bottom;
  return bottom > 0 ? bottom : 0;
}

function layoutState() {
  return { width, height, baseCx, baseCy, baseScale, playTop: playTop() };
}

/**
 * @param {CanvasRenderingContext2D} c
 * @param {number} cx
 * @param {number} cy
 */
function drawBackground(c, cx, cy) {
  const g = c.createRadialGradient(cx, cy, 40, cx, cy, Math.max(width, height) * 0.75);
  g.addColorStop(0, "#162030");
  g.addColorStop(0.45, "#0e1520");
  g.addColorStop(1, "#0a0e14");
  c.fillStyle = g;
  c.fillRect(0, 0, width, height);

  c.save();
  c.lineWidth = 1;
  const vanishingY = height * 0.38;
  const rows = 16;
  for (let i = 1; i <= rows; i++) {
    const t = i / rows;
    const y = vanishingY + (height - vanishingY) * (t * t);
    c.strokeStyle = `rgba(61, 231, 255, ${0.04 + 0.1 * (1 - t)})`;
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(width, y);
    c.stroke();
  }

  const cols = 20;
  for (let i = 0; i <= cols; i++) {
    const u = i / cols;
    const xTop = cx + (u - 0.5) * width * 0.12;
    const xBot = cx + (u - 0.5) * width * 1.7;
    c.strokeStyle = "rgba(61, 231, 255, 0.07)";
    c.beginPath();
    c.moveTo(xTop, vanishingY);
    c.lineTo(xBot, height);
    c.stroke();
  }
  c.restore();

  const vig = c.createRadialGradient(cx, cy, Math.min(width, height) * 0.25, cx, cy, Math.max(width, height) * 0.7);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.45)");
  c.fillStyle = vig;
  c.fillRect(0, 0, width, height);
}

/**
 * @param {number} delta
 * @param {number} x
 * @param {number} y
 * @param {{ fromCounter?: boolean, hitCube?: boolean }} [meta]
 */
function applyDelta(delta, x, y, meta = {}) {
  if (!delta) return;
  scores.add(delta);
  counter.setScore(scores.score, {
    hitCube: meta.hitCube ?? delta > 0,
    animate: true,
  });
  if (meta.fromCounter) {
    floats.spawnFromCounter(counterRoot, delta);
  } else {
    floats.spawnAt(x, y, delta);
  }
}

/**
 * @param {PointerEvent} e
 */
function onPointerDown(e) {
  if (e.button !== 0) return;
  if (document.body.classList.contains("is-about-open")) return;
  if (document.body.classList.contains("is-tip-open")) return;
  if (document.body.classList.contains("is-menu-open")) {
    menu.close();
    return;
  }
  if (paused) return;
  e.preventDefault();

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const layout = layoutState();
  const sequence = effects.getSequenceLayouts(layout);
  const twins = sequence ? null : effects.getTwinLayouts(layout);
  /** @type {{ world: {x:number,y:number,z:number}, normal: {x:number,y:number,z:number}, screen: {x:number,y:number} } | null} */
  let hit = null;
  /** @type {"good" | "bad" | null} */
  let twinRole = null;
  /** @type {number | null} */
  let twinIndex = null;
  /** @type {number | null} */
  let sequenceNumber = null;
  let hitPhoto = false;

  if (sequence) {
    for (let i = sequence.length - 1; i >= 0; i--) {
      const piece = sequence[i];
      const mesh = sequenceMesh[piece.index];
      mesh.rebuild(piece.cx, piece.cy, piece.scale);
      const pieceHit = mesh.hitTest(x, y, piece.cx, piece.cy, piece.scale);
      if (!pieceHit) continue;
      hit = pieceHit;
      sequenceNumber = piece.number;
      break;
    }
  } else if (twins) {
    for (let i = twins.length - 1; i >= 0; i--) {
      const twin = twins[i];
      const mesh = twinMesh[twin.index];
      mesh.rebuild(twin.cx, twin.cy, twin.scale);
      const twinHit = mesh.hitTest(x, y, twin.cx, twin.cy, twin.scale);
      if (!twinHit) continue;
      hit = twinHit;
      twinRole = twin.role;
      twinIndex = twin.index;
      break;
    }
  } else {
    const cubeLayout = effects.getCubeLayout(layout);
    cube.rebuild(cubeLayout.cx, cubeLayout.cy, cubeLayout.scale);
    hitPhoto = effects.hitTestPhoto(x, y);
    hit = hitPhoto ? null : cube.hitTest(x, y, cubeLayout.cx, cubeLayout.cy, cubeLayout.scale);
  }

  effects.notifyPhysicalClick();
  if (newPlayerSession) effects.armMissForgiveness();

  const delta = effects.resolveClick({
    hitCube: Boolean(hit),
    hitPhoto,
    twinRole,
    sequenceNumber,
  });

  applyDelta(delta, e.clientX, e.clientY, {
    hitCube: delta > 0,
  });

  if (!firstClickTracked) {
    firstClickTracked = true;
    hideTapHint(true);
    trackEvent("first_click", {
      hit_cube: Boolean(hit),
      score_after: scores.score,
      miss_forgiven: delta === 0 && !hit && !hitPhoto,
    });
  }

  effectsTip.noteCanvasClick();

  const seqBursts = effects.takeSequenceBursts();
  if (seqBursts.length) {
    for (const p of seqBursts) {
      particles.burst(p.x, p.y, { intense: true });
    }
  } else if (hitPhoto) {
    particles.burst(x, y, { intense: true });
  } else if (hit && twinIndex != null) {
    const mesh = twinMesh[twinIndex];
    mesh.setHitMarker(hit.world);
    mesh.applyRecoil(hit.normal, 0.28);
    particles.burst(hit.screen.x, hit.screen.y, { intense: true });
  } else if (hit) {
    cube.setHitMarker(hit.world);
    cube.applyRecoil(hit.normal, 0.28);
    particles.burst(hit.screen.x, hit.screen.y, { intense: true });
  } else {
    particles.burst(x, y, { intense: false });
  }
}

/**
 * @param {number} now
 */
function frame(now) {
  const elapsed = now - lastTime;
  lastTime = now;
  if (paused && pauseAnchor) {
    effects.shiftClock(now - pauseAnchor);
    pauseAnchor = now;
  }
  if (tipFrozen && tipPauseAnchor) {
    effects.shiftClock(now - tipPauseAnchor);
    tipPauseAnchor = now;
  }
  const dt = paused || tipFrozen ? 0 : Math.min(0.033, elapsed / 1000);

  const layout = layoutState();
  const drain = effects.update(dt, layout);
  if (drain) {
    applyDelta(drain, 0, 0, { fromCounter: true, hitCube: false });
  }

  const cubeLayout = effects.getCubeLayout(layout);

  cube.update(dt);
  particles.update(dt);

  drawBackground(ctx, cubeLayout.cx, cubeLayout.cy);

  if (effects.claimSplitSpawn()) {
    const lottery = effects.isLottery();
    for (let i = 0; i < twinMesh.length; i++) {
      const mesh = twinMesh[i];
      mesh.rotX = cube.rotX + (lottery ? i * 0.85 : 0);
      mesh.rotY = cube.rotY + (lottery ? i * 1.1 : 0);
      mesh.rotZ = cube.rotZ;
      if (lottery) {
        mesh.spinX = 1.35 + i * 0.25;
        mesh.spinY = 1.85 + i * 0.2;
        mesh.spinZ = 0.55 + i * 0.15;
      } else {
        mesh.spinX = cube.spinX;
        mesh.spinY = cube.spinY;
        mesh.spinZ = cube.spinZ;
      }
      mesh.scalePunch = 0.16;
      mesh.hitMarker = null;
    }
  }

  if (effects.claimSequenceSpawn()) {
    for (let i = 0; i < sequenceMesh.length; i++) {
      const mesh = sequenceMesh[i];
      mesh.rotX = cube.rotX + i * 0.4;
      mesh.rotY = cube.rotY + i * 0.55;
      mesh.rotZ = cube.rotZ;
      mesh.spinX = 1.1 + (i % 3) * 0.2;
      mesh.spinY = 1.45 + (i % 2) * 0.25;
      mesh.spinZ = 0.4 + i * 0.08;
      mesh.scalePunch = 0.2;
      mesh.hitMarker = null;
    }
  }

  const sequence = effects.getSequenceLayouts(layout);
  const twins = sequence ? null : effects.getTwinLayouts(layout);
  if (sequence) {
    for (const piece of sequence) {
      sequenceMesh[piece.index].update(dt);
    }
    for (const piece of sequence) {
      const mesh = sequenceMesh[piece.index];
      mesh.rebuild(piece.cx, piece.cy, piece.scale);
      mesh.draw(ctx, piece.cx, piece.cy, piece.scale, { faceMark: piece.faceMark });
    }
  } else if (twins) {
    for (const twin of twins) {
      twinMesh[twin.index].update(dt);
    }
    for (const twin of twins) {
      const mesh = twinMesh[twin.index];
      mesh.rebuild(twin.cx, twin.cy, twin.scale);
      mesh.draw(ctx, twin.cx, twin.cy, twin.scale, { faceMark: twin.faceMark });
    }
  } else {
    cube.rebuild(cubeLayout.cx, cubeLayout.cy, cubeLayout.scale);
    cube.draw(ctx, cubeLayout.cx, cubeLayout.cy, cubeLayout.scale);
  }
  effects.draw(ctx);
  particles.draw(ctx);

  requestAnimationFrame(frame);
}

resize();
window.addEventListener("resize", resize);
canvas.addEventListener("pointerdown", onPointerDown);
requestAnimationFrame(frame);

if (isDemoMode()) {
  void startDemoReel({
    canvas,
    effects,
    leaderboard,
    scores,
    counter,
    layoutState,
  });
}
