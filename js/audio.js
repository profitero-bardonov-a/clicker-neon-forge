/**
 * Neon Forge game audio — looping music bed (Web Audio) + procedural click SFX.
 *
 * Music bed asset: assets/audio/synthwave-house-loop.ogg
 *   Track: Synthwave House Loop — Author: Fupi — License: CC0 1.0
 *   Source: https://opengameart.org/content/synthwave-house-loop
 *   See assets/audio/ATTRIBUTION.md and assets/audio/LICENSE.
 *
 * Engine code in this file: CC0 1.0 / public domain dedication.
 * No paid stock, no SaaS audio APIs.
 *
 * UX:
 * - Preference default: sound ON (`neon-forge-sound-muted` absent / not "1").
 * - Playback starts after the first user gesture (browser autoplay policy).
 * - Menu «Sound» master mute persists immediately and silences music + SFX.
 * - Effect / Berserk raise bed playbackRate (noticeable speed-up).
 * - Menu open pauses the bed (duck + suspend source clock via gain).
 */

export const SOUND_MUTED_KEY = "neon-forge-sound-muted";

/** Relative URL of the looping bed (resolved from site root). */
export const BED_URL = "assets/audio/synthwave-house-loop.ogg";

/** playbackRate: idle → effect (~1.5×) → Berserk (~2.35×). */
const IDLE_RATE = 1;
const EFFECT_RATE = 1.53;
const BERSERK_RATE = 2.36;

const CLICK_MIN_GAP_MS = 38;

/**
 * Loudness: keep master / click peaks in the same audible band as the louder
 * procedural bed ship. Sample bed uses a dedicated pre-bus gain so a full-mix
 * OGG stays comparable without clipping (BED_BUS_GAIN still ducks on menu pause).
 */
export const MASTER_GAIN = 0.28;
/** Bed bus — menu pause ducks this to 0; keep ≥2.2 so checks match louder-bed era. */
export const BED_BUS_GAIN = 2.6;
/**
 * Pre-bus sample level. Real music peaks hotter than soft oscillators;
 * ~0.38 × 2.6 ≈ 1.0 into master → ×0.28 out ≈ similar perceived bed loudness.
 */
export const BED_SAMPLE_GAIN = 0.38;
export const CLICK_PEAK_GAIN = 0.34;

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
 * Looping music bed (decoded OGG via Web Audio) + click SFX with intensity-driven rate.
 */
export class GameAudio {
  constructor() {
    /** @type {AudioContext | null} */
    this._ctx = null;
    /** @type {GainNode | null} */
    this._master = null;
    /** @type {GainNode | null} bed path only (click SFX bypasses this) */
    this._bed = null;
    /** @type {GainNode | null} */
    this._sampleGain = null;
    /** @type {AudioBuffer | null} */
    this._buffer = null;
    /** @type {AudioBufferSourceNode | null} */
    this._source = null;
    /** @type {Promise<AudioBuffer> | null} */
    this._loadPromise = null;
    this._muted = readSoundMuted();
    this._unlocked = false;
    /** @type {AudioIntensity} */
    this._intensity = "idle";
    this._lastClickAt = 0;
    /** Soft visual spin multiplier for cube coupling (1 = idle). */
    this._feelScale = 1;
    /** Menu/overlay freeze — duck bed until resume. */
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
   * Tempo / playbackRate scale relative to idle.
   * @returns {number}
   */
  getTempoScale() {
    return this._rateFor(this._intensity);
  }

  /**
   * @param {AudioIntensity} intensity
   * @returns {number}
   */
  _rateFor(intensity) {
    if (intensity === "berserk") return BERSERK_RATE;
    if (intensity === "effect") return EFFECT_RATE;
    return IDLE_RATE;
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
      await this._ensureBedPlaying();
      return;
    }
    const AC =
      typeof window !== "undefined"
        ? window.AudioContext ||
          /** @type {typeof AudioContext | undefined} */ (/** @type {any} */ (window).webkitAudioContext)
        : null;
    if (!AC) return;

    try {
      this._ctx = new AC();
      this._master = this._ctx.createGain();
      this._master.gain.value = this._muted ? 0 : MASTER_GAIN;
      this._master.connect(this._ctx.destination);
      this._bed = this._ctx.createGain();
      this._bed.gain.value = this._bedPaused ? 0 : BED_BUS_GAIN;
      this._bed.connect(this._master);
      this._sampleGain = this._ctx.createGain();
      this._sampleGain.gain.value = BED_SAMPLE_GAIN;
      this._sampleGain.connect(this._bed);
      if (this._ctx.state === "suspended") await this._ctx.resume();
      this._unlocked = true;
      await this._ensureBedPlaying();
    } catch {
      this._ctx = null;
      this._master = null;
      this._bed = null;
      this._sampleGain = null;
      this._unlocked = false;
    }
  }

  /**
   * Fetch + decode bed once; start looping BufferSource.
   * @returns {Promise<void>}
   */
  async _ensureBedPlaying() {
    if (!this._ctx || !this._sampleGain) return;
    try {
      if (!this._buffer) {
        this._buffer = await this._loadBuffer();
      }
      if (!this._buffer) return;
      if (this._source) return;
      this._startSource();
    } catch {
      // decode / network failure — clicks still work
    }
  }

  /**
   * @returns {Promise<AudioBuffer>}
   */
  _loadBuffer() {
    if (this._loadPromise) return this._loadPromise;
    const ctx = this._ctx;
    if (!ctx) return Promise.reject(new Error("no audio context"));
    this._loadPromise = fetch(BED_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`bed fetch ${res.status}`);
        return res.arrayBuffer();
      })
      .then((raw) => ctx.decodeAudioData(raw.slice(0)))
      .catch((err) => {
        this._loadPromise = null;
        throw err;
      });
    return this._loadPromise;
  }

  _startSource() {
    if (!this._ctx || !this._sampleGain || !this._buffer || this._source) return;
    const src = this._ctx.createBufferSource();
    src.buffer = this._buffer;
    src.loop = true;
    src.playbackRate.value = this._rateFor(this._intensity);
    src.connect(this._sampleGain);
    try {
      src.start(0);
    } catch {
      return;
    }
    this._source = src;
    src.onended = () => {
      if (this._source === src) this._source = null;
    };
  }

  _stopSource() {
    if (!this._source) return;
    try {
      this._source.onended = null;
      this._source.stop();
    } catch {
      // already stopped
    }
    try {
      this._source.disconnect();
    } catch {
      // ignore
    }
    this._source = null;
  }

  _applyPlaybackRate() {
    if (!this._source || !this._ctx) return;
    const now = this._ctx.currentTime;
    const rate = this._rateFor(this._intensity);
    try {
      this._source.playbackRate.cancelScheduledValues(now);
      this._source.playbackRate.setTargetAtTime(rate, now, 0.04);
    } catch {
      this._source.playbackRate.value = rate;
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
   * Pause / resume the music bed (menu open). Clicks stay available;
   * mute still zeros the master bus.
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
      void this._ensureBedPlaying();
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
    this._applyPlaybackRate();
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
