import {
  MOON_ALTITUDE,
  MOON_PHASE_OFFSET,
  SUN_ALTITUDE,
  SUN_ORBIT_RADIUS,
} from './constants';

// p5 WEBGL uses +Y = up (default camera with up=(0,1,0)), so celestial
// bodies sit at positive Y above the disc plane.
export type Vec3 = { x: number; y: number; z: number };

export function sunPos(t: number): Vec3 {
  return {
    x: SUN_ORBIT_RADIUS * Math.cos(t),
    y: SUN_ALTITUDE,
    z: SUN_ORBIT_RADIUS * Math.sin(t),
  };
}

export function moonPos(t: number): Vec3 {
  const m = t + MOON_PHASE_OFFSET;
  return {
    x: SUN_ORBIT_RADIUS * Math.cos(m),
    y: MOON_ALTITUDE,
    z: SUN_ORBIT_RADIUS * Math.sin(m),
  };
}

export function dist3(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v.x, v.y, v.z);
  if (l === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
