/**
 * Floating +/- labels at click points and from the counter.
 */
export class FloatTexts {
  /** @param {HTMLElement} layer */
  constructor(layer) {
    this.layer = layer;
  }

  /**
   * @param {number} x client/page-relative to layer (viewport CSS px)
   * @param {number} y
   * @param {number} delta
   */
  spawnAt(x, y, delta) {
    if (!delta) return;
    const el = document.createElement("span");
    el.className = `float-text ${delta > 0 ? "is-plus" : "is-minus"}`;
    el.textContent = delta > 0 ? `+${delta}` : String(delta);
    el.style.left = `${x}px`;
    // Sit above the finger/cursor, not centered on the hit point.
    el.style.top = `${y - 56}px`;
    this.layer.appendChild(el);
    el.addEventListener(
      "animationend",
      () => {
        el.remove();
      },
      { once: true }
    );
  }

  /**
   * Jump up from the main counter (idle drain feedback).
   * @param {HTMLElement} counterRoot
   * @param {number} delta
   */
  spawnFromCounter(counterRoot, delta) {
    if (!delta) return;
    const rect = counterRoot.getBoundingClientRect();
    this.spawnAt(rect.left + rect.width * 0.5, rect.top + rect.height * 0.2, delta);
  }
}
