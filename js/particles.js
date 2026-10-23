const POOL_SIZE = 280;

/**
 * @typedef {object} Particle
 * @property {boolean} alive
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} life
 * @property {number} maxLife
 * @property {number} size
 * @property {number} rotation
 * @property {number} spin
 * @property {'shard'|'spark'|'ring'} kind
 * @property {string} color
 */

function createParticle() {
  return {
    alive: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 1,
    size: 4,
    rotation: 0,
    spin: 0,
    kind: /** @type {'shard'|'spark'|'ring'} */ ("shard"),
    color: "#3de7ff",
  };
}

const CYANS = ["#3de7ff", "#7af0ff", "#1a8fa0", "#c8e8f5"];
const AMBERS = ["#ffb347", "#ff7a1a", "#ffd28a", "#ff9f4a"];

export class ParticleSystem {
  constructor() {
    /** @type {Particle[]} */
    this.pool = Array.from({ length: POOL_SIZE }, createParticle);
  }

  /** @returns {Particle | null} */
  _alloc() {
    for (const p of this.pool) {
      if (!p.alive) return p;
    }
    return null;
  }

  /**
   * Radial geometric burst at screen point.
   * @param {number} x
   * @param {number} y
   * @param {{ intense?: boolean }} [opts]
   */
  burst(x, y, opts = {}) {
    const intense = opts.intense === true;
    const count = intense ? 42 : 22;
    const speed = intense ? 520 : 340;

    for (let i = 0; i < count; i++) {
      const p = this._alloc();
      if (!p) break;
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const mag = speed * (0.35 + Math.random() * 0.75);
      const isSpark = Math.random() > 0.55;
      const palette = intense
        ? Math.random() > 0.4
          ? AMBERS
          : CYANS
        : Math.random() > 0.65
          ? AMBERS
          : CYANS;

      p.alive = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * mag;
      p.vy = Math.sin(angle) * mag;
      p.life = intense ? 0.55 + Math.random() * 0.35 : 0.35 + Math.random() * 0.3;
      p.maxLife = p.life;
      p.size = isSpark ? 2 + Math.random() * 2.5 : 4 + Math.random() * 7;
      p.rotation = Math.random() * Math.PI;
      p.spin = (Math.random() - 0.5) * 12;
      p.kind = isSpark ? "spark" : "shard";
      p.color = palette[(Math.random() * palette.length) | 0];
    }

    // Ripple ring
    const ring = this._alloc();
    if (ring) {
      ring.alive = true;
      ring.x = x;
      ring.y = y;
      ring.vx = 0;
      ring.vy = 0;
      ring.life = intense ? 0.45 : 0.3;
      ring.maxLife = ring.life;
      ring.size = intense ? 18 : 10;
      ring.rotation = 0;
      ring.spin = 0;
      ring.kind = "ring";
      ring.color = intense ? "#ffb347" : "#3de7ff";
    }
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    const drag = Math.exp(-3.2 * dt);
    const gravity = 420;

    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }

      if (p.kind === "ring") {
        p.size += (p.maxLife > 0.4 ? 280 : 200) * dt;
        continue;
      }

      p.vx *= drag;
      p.vy = p.vy * drag + gravity * dt * 0.35;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.spin * dt;
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    for (const p of this.pool) {
      if (!p.alive) continue;
      const t = p.life / p.maxLife;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalAlpha = Math.max(0, t);

      if (p.kind === "ring") {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2 * t;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === "spark") {
        ctx.rotate(p.rotation);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-p.size * 1.8, 0);
        ctx.lineTo(p.size * 1.8, 0);
        ctx.stroke();
      } else {
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        const s = p.size * (0.6 + 0.4 * t);
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.7, 0);
        ctx.lineTo(0, s * 0.55);
        ctx.lineTo(-s * 0.7, 0);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }
  }
}
