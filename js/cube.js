import {
  vec3,
  add,
  sub,
  scale,
  normalize,
  rotateXYZ,
  project,
  pointInQuad,
  interpolateOnQuad,
} from "./math3d.js";

const HALF = 1;

/** Local cube corners (order matters for faces) */
const LOCAL = [
  vec3(-HALF, -HALF, -HALF),
  vec3(HALF, -HALF, -HALF),
  vec3(HALF, HALF, -HALF),
  vec3(-HALF, HALF, -HALF),
  vec3(-HALF, -HALF, HALF),
  vec3(HALF, -HALF, HALF),
  vec3(HALF, HALF, HALF),
  vec3(-HALF, HALF, HALF),
];

const FACES = [
  { idx: [0, 1, 2, 3], color: [40, 70, 90, 0.55] },
  { idx: [5, 4, 7, 6], color: [45, 95, 110, 0.55] },
  { idx: [4, 0, 3, 7], color: [30, 55, 75, 0.5] },
  { idx: [1, 5, 6, 2], color: [50, 110, 125, 0.55] },
  { idx: [3, 2, 6, 7], color: [55, 120, 140, 0.58] },
  { idx: [4, 5, 1, 0], color: [25, 45, 60, 0.5] },
];

const EDGES = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];

/** Inverse of rotateXYZ (X→Y→Z): apply -Z → -Y → -X */
function inverseRotateXYZ(v, ax, ay, az) {
  let { x, y, z } = v;

  const cz = Math.cos(-az);
  const sz = Math.sin(-az);
  let x1 = x * cz - y * sz;
  let y1 = x * sz + y * cz;
  x = x1;
  y = y1;

  const cx = Math.cos(-ay);
  const sx = Math.sin(-ay);
  x1 = x * cx + z * sx;
  let z1 = -x * sx + z * cx;
  x = x1;
  z = z1;

  const cy = Math.cos(-ax);
  const sy = Math.sin(-ax);
  y1 = y * cy - z * sy;
  z1 = y * sy + z * cy;

  return { x, y: y1, z: z1 };
}

export class Cube {
  constructor() {
    this.rotX = 0.35;
    this.rotY = 0.55;
    this.rotZ = 0.12;
    this.spinX = 0.55;
    this.spinY = 0.85;
    this.spinZ = 0.28;

    this.recoil = vec3(0, 0, 0);
    this.scalePunch = 0;
    this.size = 1;

    /** @type {{ local: {x:number,y:number,z:number}, life: number, maxLife: number } | null} */
    this.hitMarker = null;

    /** Cosmetic rim tint (Forge Shop). */
    this.rimStroke = "rgba(200, 232, 245, 0.85)";
    this.rimGlow = "rgba(61, 231, 255, 0.45)";
    this.rimVertex = "rgba(61, 231, 255, 0.9)";

    this._world = LOCAL.map(() => vec3());
    this._projected = LOCAL.map(() => ({ x: 0, y: 0, z: 0 }));
    this._faceCache = [];
  }

  /** @param {number} dt */
  update(dt) {
    this.rotX += this.spinX * dt;
    this.rotY += this.spinY * dt;
    this.rotZ += this.spinZ * dt;

    this.spinX += Math.sin(performance.now() * 0.0004) * 0.02 * dt;
    this.spinY += Math.cos(performance.now() * 0.00055) * 0.025 * dt;

    // Soft clamp spin so it doesn't explode over time
    this.spinX += (0.55 - this.spinX) * Math.min(1, 0.4 * dt);
    this.spinY += (0.85 - this.spinY) * Math.min(1, 0.4 * dt);
    this.spinZ += (0.28 - this.spinZ) * Math.min(1, 0.4 * dt);

    this.recoil.x *= Math.exp(-8 * dt);
    this.recoil.y *= Math.exp(-8 * dt);
    this.recoil.z *= Math.exp(-8 * dt);
    this.scalePunch *= Math.exp(-10 * dt);

    if (this.hitMarker) {
      this.hitMarker.life -= dt;
      if (this.hitMarker.life <= 0) this.hitMarker = null;
    }
  }

  /**
   * @param {{x:number,y:number,z:number}} normal
   * @param {number} strength
   */
  applyRecoil(normal, strength = 0.22) {
    this.recoil.x += normal.x * strength;
    this.recoil.y += normal.y * strength;
    this.recoil.z += normal.z * strength;
    this.scalePunch = Math.min(0.18, this.scalePunch + 0.12);
    this.spinX += (Math.random() - 0.5) * 0.8;
    this.spinY += (Math.random() - 0.5) * 1.0;
    this.spinZ += (Math.random() - 0.5) * 0.5;
  }

  /**
   * @param {number} cx
   * @param {number} cy
   * @param {number} scalePx
   */
  rebuild(cx, cy, scalePx) {
    const s = this.size * (1 + this.scalePunch);
    const rx = this.rotX;
    const ry = this.rotY;
    const rz = this.rotZ;

    for (let i = 0; i < LOCAL.length; i++) {
      const rotated = rotateXYZ(scale(LOCAL[i], s), rx, ry, rz);
      const world = add(rotated, this.recoil);
      this._world[i] = world;
      this._projected[i] = project(world, cx, cy, scalePx);
    }

    this._faceCache = FACES.map((face) => {
      const worldVerts = face.idx.map((i) => this._world[i]);
      const screenVerts = face.idx.map((i) => this._projected[i]);
      const avgZ =
        (worldVerts[0].z +
          worldVerts[1].z +
          worldVerts[2].z +
          worldVerts[3].z) /
        4;

      const e1 = {
        x: worldVerts[1].x - worldVerts[0].x,
        y: worldVerts[1].y - worldVerts[0].y,
        z: worldVerts[1].z - worldVerts[0].z,
      };
      const e2 = {
        x: worldVerts[2].x - worldVerts[0].x,
        y: worldVerts[2].y - worldVerts[0].y,
        z: worldVerts[2].z - worldVerts[0].z,
      };
      const normal = normalize({
        x: e1.y * e2.z - e1.z * e2.y,
        y: e1.z * e2.x - e1.x * e2.z,
        z: e1.x * e2.y - e1.y * e2.x,
      });

      return { color: face.color, worldVerts, screenVerts, avgZ, normal };
    });

    this._faceCache.sort((a, b) => a.avgZ - b.avgZ);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx
   * @param {number} cy
   * @param {number} scalePx
   * @param {{ faceMark?: string | null }} [opts]
   */
  draw(ctx, cx, cy, scalePx, opts = {}) {
    for (const face of this._faceCache) {
      const [r, g, b, a] = face.color;
      const depthFade = 0.55 + 0.45 * (1 - (face.avgZ + 2) / 4);
      ctx.beginPath();
      const sv = face.screenVerts;
      ctx.moveTo(sv[0].x, sv[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(sv[i].x, sv[i].y);
      ctx.closePath();
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a * Math.max(0.35, depthFade)})`;
      ctx.fill();
    }

    if (opts.faceMark) this._drawFaceMarks(ctx, opts.faceMark);

    ctx.lineWidth = 1.6;
    ctx.strokeStyle = this.rimStroke;
    ctx.shadowColor = this.rimGlow;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    for (const [a, b] of EDGES) {
      const pa = this._projected[a];
      const pb = this._projected[b];
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = this.rimVertex;
    for (const p of this._projected) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    this._drawHitMarker(ctx, cx, cy, scalePx);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} mark
   */
  _drawFaceMarks(ctx, mark) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(232, 244, 250, 0.92)";
    ctx.shadowColor = "rgba(61, 231, 255, 0.55)";
    ctx.shadowBlur = 10;

    for (const face of this._faceCache) {
      const sv = face.screenVerts;
      let area = 0;
      for (let i = 0; i < 4; i++) {
        const a = sv[i];
        const b = sv[(i + 1) % 4];
        area += a.x * b.y - b.x * a.y;
      }
      // Skip backfaces / near edge-on faces.
      if (area <= 120) continue;

      const fx = (sv[0].x + sv[1].x + sv[2].x + sv[3].x) * 0.25;
      const fy = (sv[0].y + sv[1].y + sv[2].y + sv[3].y) * 0.25;
      const size = Math.min(54, Math.sqrt(area) * 0.28);
      ctx.font = `800 ${size}px Syne, sans-serif`;
      ctx.fillText(mark, fx, fy + size * 0.04);
    }
    ctx.restore();
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx
   * @param {number} cy
   * @param {number} scalePx
   */
  _drawHitMarker(ctx, cx, cy, scalePx) {
    if (!this.hitMarker) return;
    const t = this.hitMarker.life / this.hitMarker.maxLife;
    const s = this.size * (1 + this.scalePunch);
    const world = add(
      rotateXYZ(scale(this.hitMarker.local, s), this.rotX, this.rotY, this.rotZ),
      this.recoil
    );
    const screen = project(world, cx, cy, scalePx);
    const { x, y } = screen;
    const r = 6 + (1 - t) * 18;

    ctx.save();
    ctx.globalAlpha = t;
    ctx.strokeStyle = "#ffb347";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#3de7ff";
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#ff7a1a";
    ctx.lineWidth = 1.5;
    const tick = 10 + (1 - t) * 8;
    ctx.beginPath();
    ctx.moveTo(x - tick, y);
    ctx.lineTo(x - 4, y);
    ctx.moveTo(x + 4, y);
    ctx.lineTo(x + tick, y);
    ctx.moveTo(x, y - tick);
    ctx.lineTo(x, y - 4);
    ctx.moveTo(x, y + 4);
    ctx.lineTo(x, y + tick);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * @param {number} px
   * @param {number} py
   * @param {number} cx
   * @param {number} cy
   * @param {number} scalePx
   */
  hitTest(px, py, cx, cy, scalePx) {
    const point = { x: px, y: py };
    for (let i = this._faceCache.length - 1; i >= 0; i--) {
      const face = this._faceCache[i];
      if (!pointInQuad(point, face.screenVerts)) continue;

      const world = interpolateOnQuad(point, face.screenVerts, face.worldVerts);
      if (!world) continue;

      const screen = project(world, cx, cy, scalePx);
      return {
        screen: { x: screen.x, y: screen.y },
        world,
        normal: face.normal,
      };
    }
    return null;
  }

  /**
   * Store hit in cube-local space so the marker rides the surface.
   * @param {{x:number,y:number,z:number}} world
   */
  setHitMarker(world) {
    const s = this.size * (1 + this.scalePunch) || 1;
    const untranslated = sub(world, this.recoil);
    const unrotated = inverseRotateXYZ(untranslated, this.rotX, this.rotY, this.rotZ);
    this.hitMarker = {
      local: scale(unrotated, 1 / s),
      life: 0.65,
      maxLife: 0.65,
    };
  }
}
