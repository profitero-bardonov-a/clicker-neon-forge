export class Counter {
  /**
   * @param {HTMLElement} root
   * @param {HTMLElement} valueEl
   */
  constructor(root, valueEl) {
    this.root = root;
    this.valueEl = valueEl;
    this.score = 0;
    this._bumpTimer = 0;
  }

  /**
   * @param {number} score
   * @param {{ hitCube?: boolean, animate?: boolean }} [meta]
   */
  setScore(score, meta = {}) {
    const n = Math.floor(Number(score));
    this.score = Number.isFinite(n) ? n : 0;
    this._render(meta.hitCube === true, meta.animate !== false);
  }

  /**
   * @param {{ hitCube?: boolean }} [meta]
   */
  increment(meta = {}) {
    this.setScore(this.score + 1, { hitCube: meta.hitCube === true, animate: true });
  }

  /**
   * @param {boolean} hitCube
   * @param {boolean} animate
   */
  _render(hitCube, animate) {
    const next = String(this.score);
    this.valueEl.innerHTML = "";
    const span = document.createElement("span");
    span.className = animate ? "digit-flip" : "";
    span.textContent = next;
    this.valueEl.appendChild(span);

    if (!animate) return;

    this.root.classList.remove("is-bump", "is-hit", "is-miss");
    void this.root.offsetWidth;
    this.root.classList.add("is-bump");
    this.root.classList.add(hitCube ? "is-hit" : "is-miss");

    clearTimeout(this._bumpTimer);
    this._bumpTimer = window.setTimeout(() => {
      this.root.classList.remove("is-bump", "is-hit", "is-miss");
    }, 420);
  }
}
