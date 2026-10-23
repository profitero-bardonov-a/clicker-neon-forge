/** @typedef {{ x: number, y: number, z: number }} Vec3 */
/** @typedef {{ x: number, y: number, z: number }} Point2Depth */

/** @param {number} x @param {number} y @param {number} z @returns {Vec3} */
export function vec3(x = 0, y = 0, z = 0) {
  return { x, y, z };
}

/** @param {Vec3} a @param {Vec3} b @returns {Vec3} */
export function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

/** @param {Vec3} a @param {Vec3} b @returns {Vec3} */
export function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

/** @param {Vec3} a @param {number} s @returns {Vec3} */
export function scale(a, s) {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

/** @param {Vec3} a @returns {number} */
export function length(a) {
  return Math.hypot(a.x, a.y, a.z);
}

/** @param {Vec3} a @returns {Vec3} */
export function normalize(a) {
  const len = length(a) || 1;
  return { x: a.x / len, y: a.y / len, z: a.z / len };
}

/** @param {Vec3} a @param {Vec3} b @returns {number} */
export function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** @param {Vec3} a @param {Vec3} b @returns {Vec3} */
export function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

/** @param {Vec3} v @param {number} ax @param {number} ay @param {number} az @returns {Vec3} */
export function rotateXYZ(v, ax, ay, az) {
  let { x, y, z } = v;

  // X
  let cy = Math.cos(ax);
  let sy = Math.sin(ax);
  let y1 = y * cy - z * sy;
  let z1 = y * sy + z * cy;
  y = y1;
  z = z1;

  // Y
  let cx = Math.cos(ay);
  let sx = Math.sin(ay);
  let x1 = x * cx + z * sx;
  z1 = -x * sx + z * cx;
  x = x1;
  z = z1;

  // Z
  let cz = Math.cos(az);
  let sz = Math.sin(az);
  x1 = x * cz - y * sz;
  y1 = x * sz + y * cz;

  return { x: x1, y: y1, z };
}

/**
 * Perspective project world point to screen.
 * @param {Vec3} v
 * @param {number} cx
 * @param {number} cy
 * @param {number} scalePx
 * @param {number} [focal=3.2]
 * @returns {Point2Depth}
 */
export function project(v, cx, cy, scalePx, focal = 3.2) {
  const depth = focal / (focal + v.z);
  return {
    x: cx + v.x * scalePx * depth,
    y: cy + v.y * scalePx * depth,
    z: v.z,
  };
}

/**
 * Point-in-triangle (barycentric), 2D.
 * @param {{x:number,y:number}} p
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b
 * @param {{x:number,y:number}} c
 */
export function pointInTriangle(p, a, b, c) {
  const v0x = c.x - a.x;
  const v0y = c.y - a.y;
  const v1x = b.x - a.x;
  const v1y = b.y - a.y;
  const v2x = p.x - a.x;
  const v2y = p.y - a.y;

  const den = v0x * v1y - v1x * v0y;
  if (Math.abs(den) < 1e-8) return false;

  const u = (v2x * v1y - v1x * v2y) / den;
  const v = (v0x * v2y - v2x * v0y) / den;
  return u >= 0 && v >= 0 && u + v <= 1;
}

/**
 * Point in convex quad (two triangles).
 * @param {{x:number,y:number}} p
 * @param {{x:number,y:number}[]} quad
 */
export function pointInQuad(p, quad) {
  return (
    pointInTriangle(p, quad[0], quad[1], quad[2]) ||
    pointInTriangle(p, quad[0], quad[2], quad[3])
  );
}

/**
 * Barycentric interpolate world position on a quad from screen hit.
 * Approximation: split into triangles, find which contains p, interpolate.
 * @param {{x:number,y:number}} p
 * @param {{x:number,y:number,z:number}[]} screenQuad projected verts with z
 * @param {Vec3[]} worldQuad world-space verts matching screenQuad
 * @returns {Vec3 | null}
 */
export function interpolateOnQuad(p, screenQuad, worldQuad) {
  const tris = [
    [0, 1, 2],
    [0, 2, 3],
  ];

  for (const [i0, i1, i2] of tris) {
    const a = screenQuad[i0];
    const b = screenQuad[i1];
    const c = screenQuad[i2];
    if (!pointInTriangle(p, a, b, c)) continue;

    const v0x = c.x - a.x;
    const v0y = c.y - a.y;
    const v1x = b.x - a.x;
    const v1y = b.y - a.y;
    const v2x = p.x - a.x;
    const v2y = p.y - a.y;
    const den = v0x * v1y - v1x * v0y;
    if (Math.abs(den) < 1e-8) continue;

    const u = (v2x * v1y - v1x * v2y) / den;
    const v = (v0x * v2y - v2x * v0y) / den;
    const w = 1 - u - v;

    const wa = worldQuad[i0];
    const wb = worldQuad[i1];
    const wc = worldQuad[i2];
    return {
      x: w * wa.x + v * wb.x + u * wc.x,
      y: w * wa.y + v * wb.y + u * wc.y,
      z: w * wa.z + v * wb.z + u * wc.z,
    };
  }
  return null;
}
