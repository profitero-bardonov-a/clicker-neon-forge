/**
 * Neon Forge game audio — procedural Web Audio only (no external assets).
 *
 * License: original code in this file is CC0 1.0 (public domain dedication).
 * No third-party samples or paid SaaS. Free for commercial and personal use.
 *
 * UX:
 * - Preference default: sound ON (`neon-forge-sound-muted` absent / not "1").
 * - Playback starts after the first user gesture (browser autoplay policy).
 * - Menu «Sound» master mute persists immediately and silences music + SFX.
 * - During an active effect, bed tempo rises; during Berserk it rises further.
 */

export const SOUND_MUTED_KEY = "neon-forge-sound-muted";

/** Base pulse interval (seconds) — calm cyber bed. */
const IDLE_INTERVAL = 0.52;
/** Noticeably faster while any timed effect is active. */
const EFFECT_INTERVAL = 0.34;
/** Aggressive denser pulse for Berserk chains. */
const BERSERK_INTERVAL = 0.22;

const CLICK_MIN_GAP_MS = 38;

/**
 * Loudness (prod feedback: bed was too quiet).
 * Master mute still zeros MASTER_GAIN. Bed bus multiplies voice peaks only.
 * Prev master 0.22 → 0.28; bed bus 1.0 → 2.6 (~2.6× bed); click peak 0.18 → 0.34.
 */
export const MASTER_GAIN = 0.28;
export const BED_BUS_GAIN = 2.6;
export const CLICK_PEAK_GAIN = 0.34;
/** Kick / stab / arp voice peaks into the bed bus (pre–bus multiply). */
export const BED_KICK_GAIN = { idle: 0.16, effect: 0.22, berserk: 0.28 };
export const BED_STAB_GAIN = { effect: 0.045, berserk: 0.07 };
export const BED_ARP_GAIN = { effect: 0.022, berserk: 0.035 };

/** A-minor-ish cyber degrees (Hz). */
const BASS_NOTES = [55, 65.41, 73.42, 82.41];
const ARP_NOTES = [220, 261.63, 329.63, 392, 440, 523.25];

/**
 * @returns {boolean} true when the player muted sound
 */
export function readSoundMuted() {
  try {
    return localStorage.getItem(SOUND_MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * @param {boolean} muted
 */
export function writeSoundMuted(muted) {
  try {
    if (muted) localStorage.setItem(SOUND_MUTED_KEY, "1");
    else localStorage.removeItem(SOUND_MUTED_KEY);
  } catch {
    // private mode
  }
}

/**
 * @typedef {"idle" | "effect" | "berserk"} AudioIntensity
 */

/**
 * Procedural music bed + click SFX with intensity-driven tempo.
 */
export class GameAudio {
  constructor() {
    /** @type {AudioContext | null} */
    this._ctx = null;
    /** @type {GainNode | null} */
    this._master = null;
    /** @type {GainNode | null} bed voices only (click SFX bypasses this) */
    this._bed = null;
    this._muted = readSoundMuted();
    this._unlocked = false;
    /** @type {AudioIntensity} */
    this._intensity = "idle";
    this._pulseStep = 0;
    this._nextPulseAt = 0;
    this._raf = 0;
    this._lastClickAt = 0;
    /** Soft visual spin multiplier for cube coupling (1 = idle). */
    this._feelScale = 1;
    /** Menu/overlay freeze — pause bed clock (no pulses) until resume. */
    this._bedPaused = false;
  }

  /** @returns {boolean} */
  get muted() {
    return this._muted;
  }

  /** @returns {boolean} */
  get unlocked() {
    return this._unlocked;
  }

  /**
   * Visual feel scale: 1 idle, ~1.2 effect, ~1.45 berserk.
   * @returns {number}
   */
  getFeelScale() {
    return this._feelScale;
  }

  /**
   * Tempo scale relative to idle (for debugging / light game coupling).
   * @returns {number}
   */
  getTempoScale() {
    if (this._intensity === "berserk") return IDLE_INTERVAL / BERSERK_INTERVAL;
    if (this._intensity === "effect") return IDLE_INTERVAL / EFFECT_INTERVAL;
    return 1;
  }

  /**
   * Unlock AudioContext after a user gesture. Safe to call repeatedly.
   * @returns {Promise<void>}
   */
  async unlock() {
    if (this._unlocked && this._ctx) {
      if (this._ctx.state === "suspended") {
        try {
          await this._ctx.resume();
        } catch {
          // ignore
        }
      }
      return;
    }
    const AC =
      typeof window !== "undefined"
        ? window.AudioContext || /** @type {typeof AudioContext | undefined} */ (/** @type {any} */ (window).webkitAudioContext)
        : null;
    if (!AC) return;

    try {
      this._ctx = new AC();
      this._master = this._ctx.createGain();
      this._master.gain.value = this._muted ? 0 : MASTER_GAIN;
      this._master.connect(this._ctx.destination);
      this._bed = this._ctx.createGain();
      this._bed.gain.value = BED_BUS_GAIN;
      this._bed.connect(this._master);
      if (this._ctx.state === "suspended") await this._ctx.resume();
      this._unlocked = true;
      this._nextPulseAt = this._ctx.currentTime + 0.05;
      this._startScheduler();
    } catch {
      this._ctx = null;
      this._master = null;
      this._bed = null;
      this._unlocked = false;
    }
  }

  /**
   * Master mute — music + SFX. Persists to localStorage.
   * @param {boolean} muted
   */
  setMuted(muted) {
    this._muted = Boolean(muted);
    writeSoundMuted(this._muted);
    if (this._master && this._ctx) {
      const now = this._ctx.currentTime;
      this._master.gain.cancelScheduledValues(now);
      this._master.gain.setTargetAtTime(this._muted ? 0 : MASTER_GAIN, now, 0.03);
    }
  }

  /**
   * Pause / resume the music bed clock (menu open). Clicks stay available;
   * mute still zeros the master bus. On resume, re-anchors the pulse timeline.
   * @param {boolean} paused
   */
  setBedPaused(paused) {
    const next = Boolean(paused);
    if (this._bedPaused === next) return;
    this._bedPaused = next;
    if (!this._ctx || !this._bed) return;
    const now = this._ctx.currentTime;
    this._bed.gain.cancelScheduledValues(now);
    if (next) {
      this._bed.gain.setTargetAtTime(0, now, 0.02);
    } else {
      this._bed.gain.setTargetAtTime(BED_BUS_GAIN, now, 0.04);
      this._nextPulseAt = now + 0.06;
    }
  }

  /** @returns {boolean} */
  get bedPaused() {
    return this._bedPaused;
  }

  /**
   * @param {AudioIntensity} intensity
   */
  setIntensity(intensity) {
    if (this._intensity === intensity) return;
    this._intensity = intensity;
    if (intensity === "berserk") this._feelScale = 1.45;
    else if (intensity === "effect") this._feelScale = 1.2;
    else this._feelScale = 1;
  }

  /**
   * Derive intensity from effect runtime state.
   * @param {{ active: unknown, isBerserkActive?: () => boolean, _berserkTotal?: number }} effects
   */
  syncFromEffects(effects) {
    const berserk =
      typeof effects.isBerserkActive === "function"
        ? effects.isBerserkActive()
        : (effects._berserkTotal || 0) > 0;
    if (berserk) this.setIntensity("berserk");
    else if (effects.active) this.setIntensity("effect");
    else this.setIntensity("idle");
  }

  /**
   * Short click / tap blip. Throttled so rapid taps stay pleasant.
   */
  playClick() {
    if (this._muted || !this._unlocked || !this._ctx || !this._master) return;
    const nowMs = performance.now();
    if (nowMs - this._lastClickAt < CLICK_MIN_GAP_MS) return;
    this._lastClickAt = nowMs;

    const ctx = this._ctx;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const bright = this._intensity === "berserk" ? 1.25 : this._intensity === "effect" ? 1.1 : 1;
    osc.type = "triangle";
    osc.frequency.setValueAtTime(720 * bright, t0);
    osc.frequency.exponentialRampToValueAtTime(180 * bright, t0 + 0.06);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(CLICK_PEAK_GAIN, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07);
    osc.connect(gain);
    gain.connect(this._master);
    osc.start(t0);
    osc.stop(t0 + 0.08);
  }

  _interval() {
    if (this._intensity === "berserk") return BERSERK_INTERVAL;
    if (this._intensity === "effect") return EFFECT_INTERVAL;
    return IDLE_INTERVAL;
  }

  _startScheduler() {
    if (this._raf) return;
    const tick = () => {
      this._raf = requestAnimationFrame(tick);
      this._scheduleAhead();
    };
    this._raf = requestAnimationFrame(tick);
  }

  _scheduleAhead() {
    if (!this._ctx || !this._master) return;
    if (this._bedPaused) return;
    const ctx = this._ctx;
    const horizon = ctx.currentTime + 0.18;
    while (this._nextPulseAt < horizon) {
      if (!this._muted) this._emitPulse(this._nextPulseAt, this._pulseStep);
      this._pulseStep += 1;
      this._nextPulseAt += this._interval();
    }
  }

  /**
   * @param {number} when
   * @param {number} step
   */
  _emitPulse(when, step) {
    if (!this._ctx || !this._master || !this._bed) return;
    const ctx = this._ctx;
    const bed = this._bed;
    const intense = this._intensity !== "idle";
    const berserk = this._intensity === "berserk";

    // Soft kick / sub pulse
    {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      const base = BASS_NOTES[step % BASS_NOTES.length];
      osc.frequency.setValueAtTime(base * (berserk ? 1.08 : 1), when);
      osc.frequency.exponentialRampToValueAtTime(base * 0.5, when + 0.12);
      const kick = berserk
        ? BED_KICK_GAIN.berserk
        : intense
          ? BED_KICK_GAIN.effect
          : BED_KICK_GAIN.idle;
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(kick, when + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.16);
      osc.connect(gain);
      gain.connect(bed);
      osc.start(when);
      osc.stop(when + 0.18);
    }

    // Mid cyber stab every other beat (every beat in berserk)
    if (berserk || step % 2 === 0) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      const note = ARP_NOTES[(step * 2) % ARP_NOTES.length];
      osc.frequency.setValueAtTime(note, when);
      osc.frequency.exponentialRampToValueAtTime(note * 1.5, when + 0.05);
      const stab = berserk ? BED_STAB_GAIN.berserk : BED_STAB_GAIN.effect;
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(stab, when + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.09);
      osc.connect(gain);
      gain.connect(bed);
      osc.start(when);
      osc.stop(when + 0.1);
    }

    // Dense high arp ticks when boosted
    if (intense) {
      const extra = berserk ? 2 : 1;
      for (let i = 0; i < extra; i++) {
        const t = when + (i + 1) * (this._interval() / (extra + 1));
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        const note = ARP_NOTES[(step + i + 3) % ARP_NOTES.length] * 2;
        const arp = berserk ? BED_ARP_GAIN.berserk : BED_ARP_GAIN.effect;
        osc.frequency.setValueAtTime(note, t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(arp, t + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
        osc.connect(gain);
        gain.connect(bed);
        osc.start(t);
        osc.stop(t + 0.05);
      }
    }
  }
}

/**
 * Wire menu toggle + label sync.
 * @param {{
 *   audio: GameAudio,
 *   button: HTMLButtonElement,
 *   labelKeyOn?: string,
 *   labelKeyOff?: string,
 *   t: (key: string) => string,
 *   onLocaleChange: (fn: () => void) => void,
 * }} opts
 */
export function initSoundToggle(opts) {
  const { audio, button, t, onLocaleChange } = opts;
  const onKey = opts.labelKeyOn || "soundOn";
  const offKey = opts.labelKeyOff || "soundOff";

  function sync() {
    const muted = audio.muted;
    button.setAttribute("aria-pressed", muted ? "false" : "true");
    button.textContent = muted ? t(offKey) : t(onKey);
    button.classList.toggle("is-muted", muted);
  }

  button.addEventListener("click", async () => {
    await audio.unlock();
    audio.setMuted(!audio.muted);
    sync();
  });

  onLocaleChange(sync);
  sync();
  return { sync };
}
