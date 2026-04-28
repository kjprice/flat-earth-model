import { DAY_MS, FE, NEW_MOON_REF_MS, SYNODIC_MS } from './config/core';
import { VIEWER_CAMERA_CONFIG } from './config/viewer';

export type Vec3 = { x: number; y: number; z: number };

// FE AE projection: +90° latitude → disc center, -90° → disc edge.
export function latToOrbitRadius(latDeg: number): number {
  const clamped = Math.max(-90, Math.min(90, latDeg));
  return (90 - clamped) / 180;
}

// Fraction through the synodic month. 0 = new moon, 0.5 = full, 1 = next new.
export function phaseFraction(simMs: number): number {
  const elapsed = simMs - NEW_MOON_REF_MS;
  return (((elapsed % SYNODIC_MS) + SYNODIC_MS) % SYNODIC_MS) / SYNODIC_MS;
}

// Sun orbit angle. We reverse direction (note the negated sin in the position
// formulas below) so that in the first-person view the sun visibly tracks
// east→west, which also makes the map read clockwise from above the N pole.
export function sunAngle(simMs: number): number {
  const tod = (((simMs % DAY_MS) + DAY_MS) % DAY_MS) / DAY_MS;
  return tod * 2 * Math.PI;
}

export function moonAngle(simMs: number): number {
  return sunAngle(simMs) - 2 * Math.PI * phaseFraction(simMs);
}

export function sunPos(simMs: number, altitudeMi: number, latDeg: number): Vec3 {
  const r = latToOrbitRadius(latDeg);
  const a = sunAngle(simMs);
  return {
    x: r * Math.cos(a),
    y: altitudeMi / FE.discRadiusMi,
    z: -r * Math.sin(a),
  };
}

export function moonPos(simMs: number, altitudeMi: number, latDeg: number): Vec3 {
  const r = latToOrbitRadius(latDeg);
  const a = moonAngle(simMs);
  return {
    x: r * Math.cos(a),
    y: altitudeMi / FE.discRadiusMi,
    z: -r * Math.sin(a),
  };
}

export function eyeHeightMi(elevationMi: number): number {
  return Math.max(elevationMi, VIEWER_CAMERA_CONFIG.minEyeHeightMi);
}

export function eyeHeightScene(elevationMi: number): number {
  return eyeHeightMi(elevationMi) / FE.discRadiusMi;
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

// Convert a direction vector to yaw (horizontal angle from +X toward +Z) and
// pitch (elevation above horizontal).
export function dirToYawPitch(d: Vec3): { yaw: number; pitch: number } {
  const horiz = Math.hypot(d.x, d.z) || 1e-9;
  const yaw = Math.atan2(d.z, d.x);
  const pitch = Math.atan2(d.y, horiz);
  return { yaw, pitch };
}

export function yawPitchToDir(yaw: number, pitch: number): Vec3 {
  const cp = Math.cos(pitch);
  return {
    x: cp * Math.cos(yaw),
    y: Math.sin(pitch),
    z: cp * Math.sin(yaw),
  };
}

// Format simMs as a local date/time string.
export function formatSimTime(simMs: number): string {
  const d = new Date(simMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}
