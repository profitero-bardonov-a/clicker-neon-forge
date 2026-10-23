/**
 * Effect settings — edit here only.
 *
 * `common`  — shared schedule / duration / base hit-miss
 * `effects` — one entry per effect with its own knobs
 */
export const EFFECTS_CONFIG = {
  common: {
    /** Wait before next effect (ms). */
    scheduleDelayMinMs: 6_000,
    scheduleDelayMaxMs: 12_000,

    /** Active effect length (ms). */
    durationMinMs: 7_000,
    durationMaxMs: 10_000,

    /** Default click deltas when an effect does not override them. */
    hit: 1,
    miss: -1,

    /**
     * Negative effects: after this pause without a click, the score drains.
     * Set the interval or the amount to 0 to turn the drain off.
     */
    negativeIdleGraceMs: 500,
    /** How often a drain tick fires (ms). */
    negativeIdleEveryMs: 150,
    /** Clicks removed on each tick. */
    negativeIdleDrain: 3,
  },

  effects: {
    click_x2: {
      polarity: "positive",
      labelKey: "effectX2",
      enabled: true,
      /** Cube hit multiplier (miss still uses common.miss). */
      hitMultiplier: 3,
    },

    click_x3: {
      polarity: "positive",
      labelKey: "effectX3",
      enabled: true,
      hitMultiplier: 5,
    },

    flying_photo: {
      polarity: "positive",
      labelKey: "effectFlyingPhoto",
      enabled: true,
      photo: "assets/effect-photo-a.jpg",
      /** Score on photo click. */
      photoHit: 10,
      /** Photo diameter relative to cubeScale. */
      sizeFactor: 2.2,
      speedMin: 140,
      speedMax: 260,
    },

    /**
     * Rising combo: each cube hit awards more (+1, +2, +3…).
     * Miss is −1 and resets the chain.
     */
    rising_combo: {
      polarity: "positive",
      labelKey: "effectRisingCombo",
      enabled: true,
      startHit: 1,
      stepHit: 1,
      maxHit: 20,
      miss: -1,
    },

    /**
     * Six numbered cubes. Tap 1→6 for +10,+20…+60.
     * Wrong number: −10×N, all explode, then respawn.
     */
    number_order: {
      polarity: "positive",
      labelKey: "effectNumberOrder",
      enabled: true,
      sequenceCount: 6,
      scaleFactor: 0.34,
      /** Initial ring radius relative to each mini-cube scale. */
      ringRadiusFactor: 2.75,
      /** Award / penalty = step × this value. */
      stepScore: 10,
      speedMin: 100,
      speedMax: 180,
      margin: 52,
      /** Minimum center distance between cubes, relative to scale. */
      separateFactor: 2.6,
    },

    shrink_wander: {
      polarity: "negative",
      labelKey: "effectShrinkWander",
      enabled: true,
      /** Cube size while effect is active. */
      scaleFactor: 0.5,
      speedMin: 90,
      speedMax: 170,
      margin: 56,
    },

    invert_clicks: {
      polarity: "negative",
      labelKey: "effectInvert",
      enabled: true,
      /** Overrides common hit/miss while active. */
      hit: -1,
      miss: 1,
    },

    cover_photo: {
      polarity: "negative",
      labelKey: "effectCoverPhoto",
      enabled: true,
      photo: "assets/effect-photo-b.jpg",
      /** Click on photo (not cube) subtracts clicks. */
      photoHit: -1,
      /** Diameter as fraction of cube visual size (~2 * cubeScale). */
      coverOfCube: 1.4,
    },

    split_twins: {
      polarity: "negative",
      labelKey: "effectSplitTwins",
      enabled: true,
      /** Each twin is this fraction of the normal cube. */
      scaleFactor: 0.46,
      speedMin: 110,
      speedMax: 190,
      margin: 56,
      goodHit: 10,
      badHit: -10,
    },

    split_lottery: {
      polarity: "positive",
      labelKey: "effectSplitLottery",
      enabled: true,
      /** Each twin is this fraction of the normal cube. */
      scaleFactor: 0.52,
      /** Half-gap between the two cubes, relative to twin scale. */
      gapFactor: 2.35,
      margin: 56,
      goodHit: 100,
      badHit: -100,
      /** Stay centered and only spin in place. */
      stationary: true,
      /** Swap which cube is +/− after every cube hit. */
      reshuffleOnHit: true,
      /** Glyph painted on each face. */
      faceMark: "?",
    },
  },
};
