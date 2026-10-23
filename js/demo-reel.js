/**
 * Local ~60s gameplay reel for screen recording (Shorts / Reels).
 * Open with `?demo=1` — no pause, main effects only.
 *
 * QA: `?berserk=1` forces one Berserk chain soon after load (prod-safe verify).
 */

/** @returns {boolean} */
export function isDemoMode() {
  if (typeof location === "undefined") return false;
  return new URLSearchParams(location.search).has("demo");
}

/** Force-start Berserk for visual QA without changing schedule rarity. */
/** @returns {boolean} */
export function isBerserkDemo() {
  if (typeof location === "undefined") return false;
  return new URLSearchParams(location.search).has("berserk");
}

/**
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {number} x canvas-local x
 * @param {number} y canvas-local y
 */
function tapCanvas(canvas, x, y) {
  const rect = canvas.getBoundingClientRect();
  const clientX = rect.left + x;
  const clientY = rect.top + y;
  canvas.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      button: 0,
      buttons: 1,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
    })
  );
}

/**
 * @param {{
 *   canvas: HTMLCanvasElement,
 *   effects: import("./effects.js").EffectRuntime,
 *   leaderboard: import("./leaderboard.js").Leaderboard,
 *   scores: import("./score-store.js").ScoreStore,
 *   counter: { setScore: (n: number, opts?: object) => void },
 *   layoutState: () => { width: number, height: number, baseCx: number, baseCy: number, baseScale: number },
 * }} api
 */
export async function startDemoReel(api) {
  const { canvas, effects, leaderboard, scores, counter, layoutState } = api;

  document.body.classList.add("is-demo");
  const login = document.getElementById("login-btn");
  const devFx = document.getElementById("dev-fx");
  if (login) login.hidden = true;
  if (devFx) devFx.hidden = true;

  effects.autoSchedule = false;
  effects.stop();

  scores.setScore(1337, { sync: false });
  counter.setScore(scores.score, { animate: false });

  /**
   * @param {string} id
   * @param {number} durationMs
   */
  const play = (id, durationMs) => {
    effects.beginEffect(id, { durationMs });
  };

  const cubeTap = () => {
    const { cx, cy } = effects.getCubeLayout(layoutState());
    tapCanvas(canvas, cx, cy);
  };

  const missTap = () => {
    const { width, height } = layoutState();
    tapCanvas(canvas, width * 0.12, height * 0.18);
  };

  /**
   * @param {number} count
   * @param {number} gapMs
   * @param {() => void} fn
   */
  const burst = async (count, gapMs, fn) => {
    for (let i = 0; i < count; i++) {
      fn();
      if (i < count - 1) await sleep(gapMs);
    }
  };

  const waitFrames = async (n = 2) => {
    for (let i = 0; i < n; i++) {
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    }
  };

  // 0–5s — hold before action (recording lead-in)
  await sleep(5000);

  // ~5–8s — baseline
  await burst(6, 350, cubeTap);
  await sleep(400);

  // 3–8s — ×2
  play("click_x2", 4800);
  await sleep(250);
  await burst(8, 420, cubeTap);
  await sleep(350);

  // 8–13s — ×3
  play("click_x3", 4800);
  await sleep(250);
  await burst(7, 450, cubeTap);
  await sleep(350);

  // 13–19s — rising combo
  play("rising_combo", 5500);
  await sleep(250);
  await burst(10, 400, cubeTap);
  await sleep(400);

  // 19–26s — lottery
  play("split_lottery", 6500);
  await waitFrames(3);
  await sleep(250);
  for (let i = 0; i < 5; i++) {
    const twins = effects.getTwinLayouts(layoutState());
    const good = twins?.find((t) => t.role === "good");
    const pick = good || twins?.[0];
    if (pick) tapCanvas(canvas, pick.cx, pick.cy);
    await sleep(850);
  }
  {
    const twins = effects.getTwinLayouts(layoutState());
    const bad = twins?.find((t) => t.role === "bad");
    if (bad) tapCanvas(canvas, bad.cx, bad.cy);
  }
  await sleep(700);

  // 26–33s — split twins
  play("split_twins", 6500);
  await waitFrames(3);
  await sleep(250);
  for (let i = 0; i < 6; i++) {
    const twins = effects.getTwinLayouts(layoutState());
    const good = twins?.find((t) => t.role === "good");
    if (good) tapCanvas(canvas, good.cx, good.cy);
    else if (twins?.[0]) tapCanvas(canvas, twins[0].cx, twins[0].cy);
    await sleep(700);
  }
  await sleep(500);

  // 33–41s — number order 1→6
  play("number_order", 7500);
  await waitFrames(3);
  await sleep(300);
  for (let n = 1; n <= 6; n++) {
    const seq = effects.getSequenceLayouts(layoutState());
    const piece = seq?.find((p) => p.number === n);
    if (piece) tapCanvas(canvas, piece.cx, piece.cy);
    await sleep(700);
  }
  await sleep(500);

  // 41–46s — flying photo
  play("flying_photo", 4800);
  await sleep(400);
  for (let i = 0; i < 6; i++) {
    const photo = effects.getPhotoPoint();
    if (photo) tapCanvas(canvas, photo.x, photo.y);
    else cubeTap();
    await sleep(550);
  }
  await sleep(350);

  // 46–51s — shrink wander
  play("shrink_wander", 4800);
  await sleep(300);
  await burst(7, 450, () => {
    const { cx, cy } = effects.getCubeLayout(layoutState());
    tapCanvas(canvas, cx, cy);
  });
  await sleep(350);

  // 51–55s — invert
  play("invert_clicks", 4000);
  await sleep(250);
  await burst(4, 420, cubeTap);
  missTap();
  await sleep(400);
  missTap();
  await sleep(400);
  await burst(3, 420, cubeTap);
  await sleep(300);

  // 55–59s — cover photo
  play("cover_photo", 4000);
  await sleep(300);
  for (let i = 0; i < 4; i++) {
    const photo = effects.getPhotoPoint();
    if (photo) tapCanvas(canvas, photo.x, photo.y);
    await sleep(500);
  }
  cubeTap();
  await sleep(450);

  // finale — number_order again (~12.5s), then leaders list
  play("number_order", 12500);
  await waitFrames(3);
  await sleep(350);
  for (let n = 1; n <= 6; n++) {
    const seq = effects.getSequenceLayouts(layoutState());
    const piece = seq?.find((p) => p.number === n);
    if (piece) tapCanvas(canvas, piece.cx, piece.cy);
    await sleep(900);
  }
  await sleep(5000);

  effects.endEffect({ reschedule: false });

  const toggle = /** @type {HTMLButtonElement | null} */ (
    document.getElementById("leaderboard-toggle")
  );
  if (toggle) {
    const r = toggle.getBoundingClientRect();
    toggle.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        clientX: r.left + r.width / 2,
        clientY: r.top + r.height / 2,
      })
    );
  } else {
    leaderboard.setExpanded(true);
  }

  document.body.classList.add("is-demo-done");
}
