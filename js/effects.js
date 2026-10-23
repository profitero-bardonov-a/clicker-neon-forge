/**
 * Timed positive/negative effect runtime.
 */
import { EFFECTS_CONFIG as CFG } from "./effects-config.js";
import { t } from "./i18n.js";

/**
 * @param {number} min
 * @param {number} max
 */
function randRange(min, max) {
  return min + Math.random() * (max - min);
}

/** How far effects may sit above the usual edge inset, closer to the leaderboard. */
const PLAY_TOP_LIFT = 36;

/**
 * Play rectangle. The top edge is the collapsed leaderboard; `inset` keeps a center inside it.
 * @param {{ width: number, height: number, playTop?: number }} layout
 * @param {number} inset
 */
function playField(layout, inset) {
  const minX = inset;
  const maxX = Math.max(minX, layout.width - inset);
  const block = layout.playTop || 0;
  const minY = block > 0 ? Math.max(block, block + inset - PLAY_TOP_LIFT) : inset;
  const maxY = Math.max(minY, layout.height - inset);
  return { minX, maxX, minY, maxY };
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * @template T
 * @param {readonly T[]} list
 */
function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/** @returns {string[]} */
function effectIdsByPolarity(polarity) {
  return Object.entries(CFG.effects)
    .filter(([, def]) => def.enabled !== false && def.polarity === polarity)
    .map(([id]) => id);
}

/**
 * @typedef {typeof CFG.effects[keyof typeof CFG.effects]} EffectDef
 */

/**
 * @typedef {{
 *   id: string,
 *   def: EffectDef,
 *   polarity: "positive" | "negative",
 *   endsAt: number,
 *   startedAt: number,
 * }} ActiveEffect
 */

export class EffectRuntime {
  /**
   * @param {{
   *   rimEl: HTMLElement,
   *   countdownEl: HTMLElement,
   *   labelEl: HTMLElement,
   * }} ui
   */
  constructor(ui) {
    this.rimEl = ui.rimEl;
    this.countdownEl = ui.countdownEl;
    this.labelEl = ui.labelEl;

    /** @type {ActiveEffect | null} */
    this.active = null;
    /** When false, effects never auto-start (used by demo reel). */
    this.autoSchedule = true;
    /** @type {number} epoch ms when next effect should start; 0 = none */
    this._nextAt = 0;
    this._lastPhysicalAt = 0;
    this._idleAcc = 0;
    /** performance.now() deadline for classic −1 miss forgiveness; 0 = off */
    this._forgivenessUntil = 0;
    this._forgivenessArmed = false;

    this._cubeOffX = 0;
    this._cubeOffY = 0;
    this._cubeVx = 0;
    this._cubeVy = 0;

    this._photo = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      r: 40,
      img: /** @type {HTMLImageElement | null} */ (null),
    };

    /** @type {{ index: number, role: "good" | "bad", ox: number, oy: number, vx: number, vy: number }[]} */
    this._twins = [];
    this._twinsPlaced = false;
    this._splitFresh = false;
    /** @type {TwinLayout[] | null} */
    this._twinLayouts = null;
    /** Next award for rising_combo; 0 when inactive. */
    this._comboValue = 0;

    /** @type {{ index: number, number: number, ox: number, oy: number, vx: number, vy: number, alive: boolean }[]} */
    this._sequence = [];
    this._sequenceNext = 1;
    this._sequenceFresh = false;
    this._sequenceNeedsSpawn = false;
    /** @type {SequenceLayout[] | null} */
    this._sequenceLayouts = null;
    /** Burst points from the last sequence resolve (screen centers). */
    this._sequenceBursts = /** @type {{ x: number, y: number }[]} */ ([]);
    /** @type {{ width: number, height: number, baseCx: number, baseCy: number, baseScale: number } | null} */
    this._lastLayout = null;

    /** @type {Map<string, HTMLImageElement>} */
    this._images = new Map();
    for (const def of Object.values(CFG.effects)) {
      if ("photo" in def && typeof def.photo === "string") {
        this._images.set(def.photo, this._load(def.photo));
      }
    }

    this.hideChrome();
  }

  /**
   * @param {string} src
   */
  _load(src) {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    return img;
  }

  /**
   * @param {string | undefined} src
   */
  _img(src) {
    if (!src) return null;
    return this._images.get(src) || null;
  }

  start() {
    // Effects stay quiet until armSchedule() — see first-click gate in main.js.
  }

  /**
   * Start the random-effect timer. Idempotent; no-op when autoSchedule is off.
   */
  armSchedule() {
    if (!this.autoSchedule) return;
    if (this._nextAt > 0 || this.active) return;
    this._scheduleNext();
  }

  stop() {
    this._nextAt = 0;
    this.endEffect({ reschedule: false });
  }

  /**
   * Keep effect timers frozen while the game is paused.
   * @param {number} ms
   */
  shiftClock(ms) {
    if (!(ms > 0)) return;
    if (this.active) {
      this.active.startedAt += ms;
      this.active.endsAt += ms;
    }
    if (this._nextAt > 0) this._nextAt += ms;
    if (this._lastPhysicalAt > 0) this._lastPhysicalAt += ms;
    if (this._forgivenessUntil > 0) this._forgivenessUntil += ms;
  }

  /**
   * Start the new-player miss forgiveness window (idempotent).
   * Call once after the first click for a zero-score session.
   */
  armMissForgiveness() {
    if (this._forgivenessArmed) return;
    this._forgivenessArmed = true;
    const ms = Number(CFG.common.missForgivenessMs) || 0;
    if (ms <= 0) {
      this._forgivenessUntil = 0;
      return;
    }
    this._forgivenessUntil = performance.now() + ms;
  }

  /** @returns {boolean} */
  isMissForgivenessActive() {
    return this._forgivenessUntil > 0 && performance.now() < this._forgivenessUntil;
  }

  hideChrome() {
    this.rimEl.hidden = true;
    this.rimEl.classList.remove("is-positive", "is-negative");
    this.countdownEl.hidden = true;
    this.countdownEl.textContent = "";
    this.countdownEl.classList.remove("is-positive", "is-negative");
    this.labelEl.textContent = "";
    this.labelEl.classList.remove("is-on-photo");
    this.labelEl.style.left = "";
    this.labelEl.style.top = "";
  }

  _scheduleNext() {
    const { scheduleDelayMinMs, scheduleDelayMaxMs } = CFG.common;
    const delay = randRange(scheduleDelayMinMs, scheduleDelayMaxMs);
    this._nextAt = performance.now() + delay;
  }

  beginRandomEffect() {
    if (this.active) this.endEffect({ reschedule: false });
    const polarity = Math.random() < 0.5 ? "positive" : "negative";
    let pool = effectIdsByPolarity(polarity);
    if (!pool.length) {
      // fallback to any enabled effect
      pool = Object.entries(CFG.effects)
        .filter(([, def]) => def.enabled !== false)
        .map(([id]) => id);
    }
    if (!pool.length) {
      this._scheduleNext();
      return;
    }
    this.beginEffect(pick(pool));
  }

  /**
   * @param {string} id
   * @param {{ durationMs?: number }} [opts]
   */
  beginEffect(id, opts = {}) {
    const def = CFG.effects[/** @type {keyof typeof CFG.effects} */ (id)];
    if (!def || def.enabled === false) {
      if (this.autoSchedule) this._scheduleNext();
      return;
    }

    if (this.active) this.endEffect({ reschedule: false });

    const { durationMinMs, durationMaxMs } = CFG.common;
    const forced = Number(opts.durationMs);
    const duration =
      Number.isFinite(forced) && forced > 0
        ? forced
        : randRange(durationMinMs, durationMaxMs);
    const now = performance.now();
    const polarity = def.polarity;

    this.active = {
      id,
      def,
      polarity,
      startedAt: now,
      endsAt: now + duration,
    };

    this._lastPhysicalAt = now;
    this._idleAcc = 0;
    this._comboValue = "startHit" in def ? def.startHit : 0;
    this._initMotion(def);

    this.rimEl.hidden = false;
    this.rimEl.classList.toggle("is-positive", polarity === "positive");
    this.rimEl.classList.toggle("is-negative", polarity === "negative");
    this.countdownEl.hidden = false;
    this.countdownEl.classList.toggle("is-positive", polarity === "positive");
    this.countdownEl.classList.toggle("is-negative", polarity === "negative");
    this.labelEl.textContent = this._labelFor(def);
    this._syncCountdown(now);
  }

  /**
   * @param {EffectDef} def
   */
  _initMotion(def) {
    this._twins = [];
    this._twinsPlaced = false;
    this._splitFresh = false;
    this._twinLayouts = null;
    this._sequence = [];
    this._sequenceNext = 1;
    this._sequenceFresh = false;
    this._sequenceNeedsSpawn = false;
    this._sequenceLayouts = null;
    this._sequenceBursts = [];

    if (this._isSequence(def)) {
      this._sequenceNeedsSpawn = true;
      return;
    }

    if (this._isSplit(def)) return;

    if ("speedMin" in def && "speedMax" in def && "scaleFactor" in def) {
      const speed = randRange(def.speedMin, def.speedMax);
      const ang = Math.random() * Math.PI * 2;
      this._cubeOffX = 0;
      this._cubeOffY = 0;
      this._cubeVx = Math.cos(ang) * speed;
      this._cubeVy = Math.sin(ang) * speed;
    }

    if ("speedMin" in def && "speedMax" in def && "sizeFactor" in def) {
      const pSpeed = randRange(def.speedMin, def.speedMax);
      const pAng = Math.random() * Math.PI * 2;
      this._photo.vx = Math.cos(pAng) * pSpeed;
      this._photo.vy = Math.sin(pAng) * pSpeed;
    }

    this._photo.x = (typeof window !== "undefined" ? window.innerWidth : 400) * 0.5;
    this._photo.y = (typeof window !== "undefined" ? window.innerHeight : 700) * 0.45;
    this._photo.img = "photo" in def ? this._img(def.photo) : null;
  }

  /**
   * @param {EffectDef} def
   */
  _labelFor(def) {
    const x =
      "sequenceCount" in def
        ? this._sequenceNext
        : "startHit" in def
          ? this._comboValue || def.startHit
          : "hitMultiplier" in def
            ? def.hitMultiplier
            : "photoHit" in def
              ? def.photoHit
              : undefined;
    return t(def.labelKey || "leaders", x == null ? undefined : { x });
  }

  /**
   * @param {{ reschedule?: boolean }} [opts]
   */
  endEffect(opts = {}) {
    const reschedule = opts.reschedule !== false;
    this.active = null;
    this._idleAcc = 0;
    this._twinsPlaced = false;
    this._splitFresh = false;
    this._twinLayouts = null;
    this._comboValue = 0;
    this._sequence = [];
    this._sequenceNext = 1;
    this._sequenceFresh = false;
    this._sequenceNeedsSpawn = false;
    this._sequenceLayouts = null;
    this._sequenceBursts = [];
    this.hideChrome();
    if (reschedule && this.autoSchedule) this._scheduleNext();
  }

  notifyPhysicalClick() {
    this._lastPhysicalAt = performance.now();
    this._idleAcc = 0;
    this.armSchedule();
  }

  /**
   * @param {number} now
   */
  _syncCountdown(now) {
    if (!this.active) return;
    const left = Math.max(0, this.active.endsAt - now);
    const sec = Math.ceil(left / 1000);
    this.countdownEl.textContent = String(sec);
  }

  /**
   * @param {{ width: number, height: number, baseCx: number, baseCy: number, baseScale: number, playTop?: number }} layout
   */
  getCubeLayout(layout) {
    const { baseCx, baseCy, baseScale } = layout;
    const def = this.active?.def;
    if (!def || !this._isShrink(def)) {
      const field = playField(layout, baseScale);
      return {
        cx: clamp(baseCx, field.minX, field.maxX),
        cy: clamp(baseCy, field.minY, field.maxY),
        scale: baseScale,
      };
    }
    const scale = baseScale * def.scaleFactor;
    const field = playField(layout, def.margin + scale);
    return {
      cx: clamp(baseCx + this._cubeOffX, field.minX, field.maxX),
      cy: clamp(baseCy + this._cubeOffY, field.minY, field.maxY),
      scale,
    };
  }

  /**
   * @param {EffectDef | null | undefined} def
   */
  _isShrink(def) {
    return Boolean(
      def &&
        "scaleFactor" in def &&
        "margin" in def &&
        !("goodHit" in def) &&
        !("sequenceCount" in def)
    );
  }

  /**
   * @param {EffectDef | null | undefined} def
   */
  _isSplit(def) {
    return Boolean(def && "goodHit" in def && "badHit" in def && "scaleFactor" in def);
  }

  /**
   * @param {EffectDef | null | undefined} def
   */
  _isSequence(def) {
    return Boolean(def && "sequenceCount" in def && "stepScore" in def && "scaleFactor" in def);
  }

  isSequence() {
    return this._isSequence(this.active?.def);
  }

  /**
   * @param {EffectDef | null | undefined} def
   */
  _isLottery(def) {
    return Boolean(def && this._isSplit(def) && "stationary" in def && def.stationary);
  }

  isSplit() {
    return this._isSplit(this.active?.def);
  }

  isLottery() {
    return this._isLottery(this.active?.def);
  }

  /** True once, on the frame the twins appear, so meshes can copy the main cube. */
  claimSplitSpawn() {
    if (!this._splitFresh || !this.isSplit()) return false;
    this._splitFresh = false;
    return true;
  }

  /** True once when sequence cubes (re)spawn. */
  claimSequenceSpawn() {
    if (!this._sequenceFresh || !this.isSequence()) return false;
    this._sequenceFresh = false;
    return true;
  }

  /**
   * Particle burst points from the most recent sequence click.
   * @returns {{ x: number, y: number }[]}
   */
  takeSequenceBursts() {
    const bursts = this._sequenceBursts;
    this._sequenceBursts = [];
    return bursts;
  }

  /**
   * @param {EffectDef | null | undefined} def
   */
  _isFlying(def) {
    return Boolean(def && "sizeFactor" in def && "photo" in def);
  }

  /**
   * @param {EffectDef | null | undefined} def
   */
  _isCover(def) {
    return Boolean(def && "coverOfCube" in def && "photo" in def);
  }

  /**
   * @param {EffectDef | null | undefined} def
   */
  _hasIdleDrain(def) {
    return Boolean(
      def &&
        def.polarity === "negative" &&
        CFG.common.negativeIdleEveryMs > 0 &&
        CFG.common.negativeIdleDrain > 0
    );
  }

  /**
   * @param {number} dt
   * @param {{ width: number, height: number, baseCx: number, baseCy: number, baseScale: number }} layout
   * @returns {number}
   */
  update(dt, layout) {
    const now = performance.now();

    if (!this.active && this.autoSchedule && this._nextAt > 0 && now >= this._nextAt) {
      this._nextAt = 0;
      this.beginRandomEffect();
    }

    if (!this.active) return 0;

    if (now >= this.active.endsAt) {
      this.endEffect({ reschedule: true });
      return 0;
    }

    this._syncCountdown(now);
    this.refreshLabel();
    this._syncLabelPosition();

    const def = this.active.def;
    let drainDelta = 0;
    this._lastLayout = layout;

    if (this._isSequence(def) && "scaleFactor" in def) {
      if (this._sequenceNeedsSpawn || !this._sequence.length) {
        this._spawnSequence(def, layout);
      }
      this._moveSequence(dt, layout, def);
    }

    if (this._isSplit(def) && "scaleFactor" in def && "margin" in def && "goodHit" in def) {
      const scale = layout.baseScale * def.scaleFactor;
      if (!this._twinsPlaced) this._placeTwins(def, scale);
      if (!this._isLottery(def)) this._moveTwins(dt, layout, def, scale);
    }

    if (this._isShrink(def) && "scaleFactor" in def && "margin" in def) {
      this._cubeOffX += this._cubeVx * dt;
      this._cubeOffY += this._cubeVy * dt;
      const scale = layout.baseScale * def.scaleFactor;
      const field = playField(layout, def.margin + scale);
      const x = layout.baseCx + this._cubeOffX;
      const y = layout.baseCy + this._cubeOffY;
      if (x < field.minX || x > field.maxX) this._cubeVx *= -1;
      if (y < field.minY || y > field.maxY) this._cubeVy *= -1;
      this._cubeOffX = clamp(x, field.minX, field.maxX) - layout.baseCx;
      this._cubeOffY = clamp(y, field.minY, field.maxY) - layout.baseCy;
    }

    if (this._isFlying(def) || this._isCover(def)) {
      this._updatePhoto(dt, layout);
    }

    if (this._hasIdleDrain(def)) {
      const idleFor = now - this._lastPhysicalAt;
      const every = CFG.common.negativeIdleEveryMs;
      if (idleFor >= CFG.common.negativeIdleGraceMs) {
        this._idleAcc += dt * 1000;
        if (this._idleAcc >= every) {
          const ticks = Math.floor(this._idleAcc / every);
          this._idleAcc -= ticks * every;
          drainDelta = -ticks * CFG.common.negativeIdleDrain;
        }
      } else {
        this._idleAcc = 0;
      }
    }

    return drainDelta;
  }

  refreshLabel() {
    if (!this.active) return;
    this.labelEl.textContent = this._labelFor(this.active.def);
  }

  _syncLabelPosition() {
    if (!this.active) return;
    const def = this.active.def;
    const onPhoto = "photo" in def;
    this.labelEl.classList.toggle("is-on-photo", onPhoto);
    if (!onPhoto) {
      this.labelEl.style.left = "";
      this.labelEl.style.top = "";
      return;
    }
    this.labelEl.style.left = `${this._photo.x}px`;
    this.labelEl.style.top = `${this._photo.y - this._photo.r - 10}px`;
  }

  /**
   * @param {number} dt
   * @param {{ width: number, height: number, baseCx: number, baseCy: number, baseScale: number }} layout
   */
  _updatePhoto(dt, layout) {
    const def = this.active?.def;
    if (!def) return;
    const cube = this.getCubeLayout(layout);

    if (this._isCover(def) && "coverOfCube" in def) {
      const diameter = cube.scale * 2 * def.coverOfCube;
      this._photo.r = diameter * 0.5;
      this._photo.x = cube.cx;
      this._photo.y = cube.cy;
      this._photo.img = "photo" in def ? this._img(def.photo) : null;
      return;
    }

    if (!this._isFlying(def) || !("sizeFactor" in def) || !("speedMax" in def)) return;

    this._photo.r = layout.baseScale * def.sizeFactor * 0.5;
    this._photo.x += this._photo.vx * dt;
    this._photo.y += this._photo.vy * dt;
    const tx = cube.cx + Math.sin(performance.now() * 0.003) * layout.baseScale * 1.2;
    const ty = cube.cy + Math.cos(performance.now() * 0.0024) * layout.baseScale * 1.1;
    this._photo.vx += (tx - this._photo.x) * 1.8 * dt;
    this._photo.vy += (ty - this._photo.y) * 1.8 * dt;
    const sp = Math.hypot(this._photo.vx, this._photo.vy) || 1;
    const maxSp = def.speedMax;
    if (sp > maxSp) {
      this._photo.vx = (this._photo.vx / sp) * maxSp;
      this._photo.vy = (this._photo.vy / sp) * maxSp;
    }
    const field = playField(layout, this._photo.r + 8);
    if (this._photo.x < field.minX || this._photo.x > field.maxX) this._photo.vx *= -1;
    if (this._photo.y < field.minY || this._photo.y > field.maxY) this._photo.vy *= -1;
    this._photo.x = clamp(this._photo.x, field.minX, field.maxX);
    this._photo.y = clamp(this._photo.y, field.minY, field.maxY);
    this._photo.img = "photo" in def ? this._img(def.photo) : null;
  }

  /**
   * @param {EffectDef & { scaleFactor: number, goodHit: number }} def
   * @param {number} scale
   */
  _placeTwins(def, scale) {
    const roles = this._pickTwinRoles();

    if (this._isLottery(def)) {
      const gap = scale * ("gapFactor" in def ? def.gapFactor : 1.55);
      this._twins = [
        { index: 0, role: roles[0], ox: -gap, oy: 0, vx: 0, vy: 0 },
        { index: 1, role: roles[1], ox: gap, oy: 0, vx: 0, vy: 0 },
      ];
      this._twinsPlaced = true;
      this._splitFresh = true;
      return;
    }

    if (!("speedMin" in def) || !("speedMax" in def)) return;

    const ang = Math.random() * Math.PI * 2;
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    const px = -uy;
    const py = ux;
    const gap = scale * 1.85;
    const speed = randRange(def.speedMin, def.speedMax);
    const side = randRange(0.35, 0.7) * speed;
    this._twins = [
      {
        index: 0,
        role: roles[0],
        ox: ux * gap,
        oy: uy * gap,
        vx: ux * speed * 0.35 + px * side,
        vy: uy * speed * 0.35 + py * side,
      },
      {
        index: 1,
        role: roles[1],
        ox: -ux * gap,
        oy: -uy * gap,
        vx: -ux * speed * 0.35 - px * side * 0.8,
        vy: -uy * speed * 0.35 - py * side * 0.8,
      },
    ];
    this._twinsPlaced = true;
    this._splitFresh = true;
  }

  /** @returns {["good" | "bad", "good" | "bad"]} */
  _pickTwinRoles() {
    return Math.random() < 0.5 ? ["good", "bad"] : ["bad", "good"];
  }

  _reshuffleTwinRoles() {
    if (this._twins.length < 2) return;
    const roles = this._pickTwinRoles();
    this._twins[0].role = roles[0];
    this._twins[1].role = roles[1];
  }

  /**
   * @param {number} dt
   * @param {{ width: number, height: number, baseCx: number, baseCy: number, baseScale: number }} layout
   * @param {EffectDef & { margin: number, scaleFactor: number }} def
   * @param {number} scale
   */
  _moveTwins(dt, layout, def, scale) {
    const limit = def.margin + scale;
    for (const twin of this._twins) this._stepTwin(twin, dt, layout, limit);
    this._separateTwins(scale * 2.55, layout, limit);
  }

  /**
   * @param {{ ox: number, oy: number, vx: number, vy: number }} twin
   * @param {number} dt
   * @param {{ width: number, height: number, baseCx: number, baseCy: number }} layout
   * @param {number} limit
   */
  _stepTwin(twin, dt, layout, limit) {
    twin.ox += twin.vx * dt;
    twin.oy += twin.vy * dt;
    const field = playField(layout, limit);
    const x = layout.baseCx + twin.ox;
    const y = layout.baseCy + twin.oy;
    if (x < field.minX || x > field.maxX) twin.vx *= -1;
    if (y < field.minY || y > field.maxY) twin.vy *= -1;
    twin.ox = clamp(x, field.minX, field.maxX) - layout.baseCx;
    twin.oy = clamp(y, field.minY, field.maxY) - layout.baseCy;
  }

  /**
   * @param {number} minDist
   * @param {{ width: number, height: number, baseCx: number, baseCy: number }} layout
   * @param {number} limit
   */
  _separateTwins(minDist, layout, limit) {
    const a = this._twins[0];
    const b = this._twins[1];
    if (!a || !b) return;
    let dx = b.ox - a.ox;
    let dy = b.oy - a.oy;
    let dist = Math.hypot(dx, dy);
    if (dist >= minDist) return;
    if (dist < 0.001) {
      dx = 1;
      dy = 0;
      dist = 1;
    }
    const push = (minDist - dist) * 0.5;
    const nx = dx / dist;
    const ny = dy / dist;
    a.ox -= nx * push;
    a.oy -= ny * push;
    b.ox += nx * push;
    b.oy += ny * push;
    const field = playField(layout, limit);
    for (const twin of this._twins) {
      twin.ox = clamp(layout.baseCx + twin.ox, field.minX, field.maxX) - layout.baseCx;
      twin.oy = clamp(layout.baseCy + twin.oy, field.minY, field.maxY) - layout.baseCy;
    }
  }

  /**
   * Back-to-front twin placements. Null when the split effect is off.
   * @param {{ width: number, height: number, baseCx: number, baseCy: number, baseScale: number }} layout
   * @returns {TwinLayout[] | null}
   */
  getTwinLayouts(layout) {
    const def = this.active?.def;
    if (!this._isSplit(def) || !this._twinsPlaced || !("scaleFactor" in def) || !("margin" in def) || !("goodHit" in def) || !("badHit" in def)) {
      this._twinLayouts = null;
      return null;
    }
    const scale = layout.baseScale * def.scaleFactor;
    const field = playField(layout, def.margin + scale);
    const faceMark = "faceMark" in def && typeof def.faceMark === "string" ? def.faceMark : null;
    /** @type {TwinLayout[]} */
    const layouts = this._twins.map((twin) => ({
      index: twin.index,
      role: twin.role,
      cx: clamp(layout.baseCx + twin.ox, field.minX, field.maxX),
      cy: clamp(layout.baseCy + twin.oy, field.minY, field.maxY),
      scale,
      faceMark,
    }));
    layouts.sort((p, q) => p.cy - q.cy);
    this._twinLayouts = layouts;
    return layouts;
  }

  /**
   * @param {number} x
   * @param {number} y
   */
  hitTestPhoto(x, y) {
    const def = this.active?.def;
    if (!def || (!this._isFlying(def) && !this._isCover(def))) return false;
    const dx = x - this._photo.x;
    const dy = y - this._photo.y;
    return dx * dx + dy * dy <= this._photo.r * this._photo.r;
  }

  /** Screen center of the active photo effect, if any. */
  getPhotoPoint() {
    const def = this.active?.def;
    if (!def || (!this._isFlying(def) && !this._isCover(def))) return null;
    return { x: this._photo.x, y: this._photo.y };
  }

  /**
   * @param {EffectDef & { sequenceCount: number, scaleFactor: number, ringRadiusFactor?: number, speedMin?: number, speedMax?: number, margin?: number }} def
   * @param {{ width: number, height: number, baseCx: number, baseCy: number, baseScale: number }} layout
   */
  _spawnSequence(def, layout) {
    const count = def.sequenceCount;
    const scale = layout.baseScale * def.scaleFactor;
    const ring = scale * ("ringRadiusFactor" in def ? def.ringRadiusFactor : 2.75);
    const margin = ("margin" in def ? def.margin : 52) + scale;
    const speedMin = "speedMin" in def ? def.speedMin : 100;
    const speedMax = "speedMax" in def ? def.speedMax : 180;

    /** @type {number[]} */
    const numbers = [];
    for (let n = 1; n <= count; n++) numbers.push(n);
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = numbers[i];
      numbers[i] = numbers[j];
      numbers[j] = tmp;
    }

    /** @type {{ index: number, number: number, ox: number, oy: number, vx: number, vy: number, alive: boolean }[]} */
    const pieces = [];
    for (let i = 0; i < count; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI * 2) / count + randRange(-0.2, 0.2);
      const speed = randRange(speedMin, speedMax);
      const dir = Math.random() * Math.PI * 2;
      const field = playField(layout, margin);
      let ox = Math.cos(ang) * ring;
      let oy = Math.sin(ang) * ring;
      ox = clamp(layout.baseCx + ox, field.minX, field.maxX) - layout.baseCx;
      oy = clamp(layout.baseCy + oy, field.minY, field.maxY) - layout.baseCy;
      pieces.push({
        index: i,
        number: numbers[i],
        ox,
        oy,
        vx: Math.cos(dir) * speed,
        vy: Math.sin(dir) * speed,
        alive: true,
      });
    }
    this._sequence = pieces;
    this._sequenceNext = 1;
    this._sequenceFresh = true;
    this._sequenceNeedsSpawn = false;
    this.refreshLabel();
  }

  /**
   * @param {number} dt
   * @param {{ width: number, height: number, baseCx: number, baseCy: number, baseScale: number }} layout
   * @param {EffectDef & { scaleFactor: number, margin?: number, separateFactor?: number }} def
   */
  _moveSequence(dt, layout, def) {
    const scale = layout.baseScale * def.scaleFactor;
    const limit = ("margin" in def ? def.margin : 52) + scale;
    const minDist = scale * ("separateFactor" in def ? def.separateFactor : 2.6);

    for (const piece of this._sequence) {
      if (!piece.alive) continue;
      piece.ox += piece.vx * dt;
      piece.oy += piece.vy * dt;
      const field = playField(layout, limit);
      const x = layout.baseCx + piece.ox;
      const y = layout.baseCy + piece.oy;
      if (x < field.minX || x > field.maxX) piece.vx *= -1;
      if (y < field.minY || y > field.maxY) piece.vy *= -1;
      piece.ox = clamp(x, field.minX, field.maxX) - layout.baseCx;
      piece.oy = clamp(y, field.minY, field.maxY) - layout.baseCy;
    }

    // Soft separation so cubes don't overlap.
    const alive = this._sequence.filter((p) => p.alive);
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i];
        const b = alive[j];
        let dx = b.ox - a.ox;
        let dy = b.oy - a.oy;
        let dist = Math.hypot(dx, dy);
        if (dist >= minDist) continue;
        if (dist < 0.001) {
          dx = 1;
          dy = 0;
          dist = 1;
        }
        const push = (minDist - dist) * 0.5;
        const nx = dx / dist;
        const ny = dy / dist;
        a.ox -= nx * push;
        a.oy -= ny * push;
        b.ox += nx * push;
        b.oy += ny * push;
        // Nudge velocities apart so they keep drifting away.
        const bounce = 28;
        a.vx -= nx * bounce;
        a.vy -= ny * bounce;
        b.vx += nx * bounce;
        b.vy += ny * bounce;
      }
    }

    const field = playField(layout, limit);
    for (const piece of alive) {
      piece.ox = clamp(layout.baseCx + piece.ox, field.minX, field.maxX) - layout.baseCx;
      piece.oy = clamp(layout.baseCy + piece.oy, field.minY, field.maxY) - layout.baseCy;
      const sp = Math.hypot(piece.vx, piece.vy) || 1;
      const maxSp = "speedMax" in def ? def.speedMax : 180;
      const minSp = "speedMin" in def ? def.speedMin : 100;
      if (sp > maxSp) {
        piece.vx = (piece.vx / sp) * maxSp;
        piece.vy = (piece.vy / sp) * maxSp;
      } else if (sp < minSp * 0.55) {
        piece.vx = (piece.vx / sp) * minSp * 0.75;
        piece.vy = (piece.vy / sp) * minSp * 0.75;
      }
    }
  }

  /**
   * Alive numbered cubes, back-to-front. Null when sequence effect is off.
   * @param {{ width: number, height: number, baseCx: number, baseCy: number, baseScale: number }} layout
   * @returns {SequenceLayout[] | null}
   */
  getSequenceLayouts(layout) {
    const def = this.active?.def;
    if (!this._isSequence(def) || !this._sequence.length || !("scaleFactor" in def)) {
      this._sequenceLayouts = null;
      return null;
    }
    const scale = layout.baseScale * def.scaleFactor;
    const field = playField(layout, ("margin" in def ? def.margin : 52) + scale);
    /** @type {SequenceLayout[]} */
    const layouts = [];
    for (const piece of this._sequence) {
      if (!piece.alive) continue;
      layouts.push({
        index: piece.index,
        number: piece.number,
        cx: clamp(layout.baseCx + piece.ox, field.minX, field.maxX),
        cy: clamp(layout.baseCy + piece.oy, field.minY, field.maxY),
        scale,
        faceMark: String(piece.number),
      });
    }
    layouts.sort((a, b) => a.cy - b.cy);
    this._sequenceLayouts = layouts;
    return layouts;
  }

  /**
   * @param {{ hitCube: boolean, hitPhoto: boolean, twinRole?: "good" | "bad" | null, sequenceNumber?: number | null }} hit
   */
  resolveClick(hit) {
    const delta = this._resolveClickRaw(hit);
    if (this._shouldForgiveMiss(delta, hit)) return 0;
    return delta;
  }

  /**
   * Soften only the classic empty-space −1 miss during the new-player window.
   * @param {number} delta
   * @param {{ hitCube: boolean, hitPhoto: boolean, twinRole?: "good" | "bad" | null, sequenceNumber?: number | null }} hit
   */
  _shouldForgiveMiss(delta, hit) {
    if (!this.isMissForgivenessActive()) return false;
    if (delta !== CFG.common.miss) return false;
    if (hit.hitCube || hit.hitPhoto) return false;
    if (hit.twinRole) return false;
    if (hit.sequenceNumber != null) return false;
    return true;
  }

  /**
   * @param {{ hitCube: boolean, hitPhoto: boolean, twinRole?: "good" | "bad" | null, sequenceNumber?: number | null }} hit
   */
  _resolveClickRaw(hit) {
    const common = CFG.common;
    const def = this.active?.def;

    if (
      hit.sequenceNumber != null &&
      def &&
      this._isSequence(def) &&
      "stepScore" in def &&
      "sequenceCount" in def
    ) {
      return this._resolveSequenceClick(hit.sequenceNumber, def);
    }

    if (hit.twinRole && def && "goodHit" in def && "badHit" in def) {
      const delta = hit.twinRole === "good" ? def.goodHit : def.badHit;
      if ("reshuffleOnHit" in def && def.reshuffleOnHit) this._reshuffleTwinRoles();
      return delta;
    }

    if (hit.hitPhoto && def && "photoHit" in def) {
      return def.photoHit;
    }

    if (def && "startHit" in def && "stepHit" in def) {
      if (hit.hitCube) {
        const award = this._comboValue || def.startHit;
        const cap = "maxHit" in def ? def.maxHit : Number.POSITIVE_INFINITY;
        this._comboValue = Math.min(cap, award + def.stepHit);
        this.refreshLabel();
        return award;
      }
      this._comboValue = def.startHit;
      this.refreshLabel();
      return "miss" in def ? def.miss : common.miss;
    }

    if (def && "hit" in def && "miss" in def && !("hitMultiplier" in def) && !("photo" in def)) {
      // invert_clicks style
      return hit.hitCube ? def.hit : def.miss;
    }

    // During sequence, empty space is a normal miss (main cube is gone).
    if (this._isSequence(def)) {
      return common.miss;
    }

    if (hit.hitCube) {
      const mult = def && "hitMultiplier" in def ? def.hitMultiplier : 1;
      return common.hit * mult;
    }

    return common.miss;
  }

  /**
   * @param {number} number
   * @param {EffectDef & { stepScore: number, sequenceCount: number, scaleFactor: number, ringRadiusFactor?: number }} def
   */
  _resolveSequenceClick(number, def) {
    const layouts = this._sequenceLayouts || [];
    const layout =
      this._lastLayout || {
        width: typeof window !== "undefined" ? window.innerWidth : 400,
        height: typeof window !== "undefined" ? window.innerHeight : 700,
        baseCx: typeof window !== "undefined" ? window.innerWidth * 0.5 : 200,
        baseCy: typeof window !== "undefined" ? window.innerHeight * 0.48 : 340,
        baseScale: 120,
      };
    const burstFor = (predicate) => {
      /** @type {{ x: number, y: number }[]} */
      const points = [];
      for (const piece of this._sequence) {
        if (!predicate(piece)) continue;
        const lay = layouts.find((l) => l.index === piece.index);
        if (lay) points.push({ x: lay.cx, y: lay.cy });
        else points.push({ x: layout.baseCx + piece.ox, y: layout.baseCy + piece.oy });
      }
      return points;
    };

    if (number === this._sequenceNext) {
      const piece = this._sequence.find((p) => p.alive && p.number === number);
      if (!piece) return CFG.common.miss;
      this._sequenceBursts = burstFor((p) => p.index === piece.index);
      piece.alive = false;
      const award = number * def.stepScore;
      if (this._sequenceNext >= def.sequenceCount) {
        // Round cleared — respawn a fresh set while the effect still runs.
        this._spawnSequence(def, layout);
      } else {
        this._sequenceNext += 1;
        this.refreshLabel();
      }
      return award;
    }

    // Wrong number: penalty and full reset.
    this._sequenceBursts = burstFor((p) => p.alive);
    const penalty = -(number * def.stepScore);
    this._spawnSequence(def, layout);
    return penalty;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    const def = this.active?.def;
    if (!def || (!this._isFlying(def) && !this._isCover(def))) return;

    const img = this._photo.img;
    const { x, y, r } = this._photo;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    if (img && img.complete && img.naturalWidth) {
      const size = r * 2;
      ctx.drawImage(img, x - r, y - r, size, size);
    } else {
      ctx.fillStyle = "rgba(61, 231, 255, 0.35)";
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    const positive = this.active?.polarity === "positive";
    ctx.strokeStyle = positive ? "rgba(80, 255, 140, 0.85)" : "rgba(255, 90, 100, 0.85)";
    ctx.lineWidth = 3;
    ctx.shadowColor = positive ? "rgba(80, 255, 140, 0.55)" : "rgba(255, 90, 100, 0.55)";
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.restore();
  }

}

/**
 * @typedef {{
 *   index: number,
 *   role: "good" | "bad",
 *   cx: number,
 *   cy: number,
 *   scale: number,
 *   faceMark: string | null,
 * }} TwinLayout
 */

/**
 * @typedef {{
 *   index: number,
 *   number: number,
 *   cx: number,
 *   cy: number,
 *   scale: number,
 *   faceMark: string,
 * }} SequenceLayout
 */
