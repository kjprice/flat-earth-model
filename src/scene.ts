import { DAY_MS, FE, NEW_MOON_REF_MS, SYNODIC_MS } from './config/core';
import { VIEWER_CAMERA_CONFIG } from './config/viewer';

export type Vec3 = { x: number; y: number; z: number };

const SOLAR_OBLIQUITY_DEG = 23.44;
const TROPICAL_YEAR_MS = 365.2422 * DAY_MS;
const SPRING_EQUINOX_REF_MS = Date.UTC(2000, 2, 20, 12, 0, 0);
const CENTER_NORTH_RADIUS_FLOOR = 1e-6;
const SHANE_ZERO_DATE_MS = Date.UTC(2017, 0, 1, 0, 0, 0);
const SHANE_SIDEREAL_DAY_HOURS = 23.93447;
const SHANE_SUN_ANGLE_OFFSET_DAYS = 78.5;
const SHANE_MOON_ECLIPTIC_DEG = 5.145;
const SHANE_MOON_ANGLE_OFFSET_DAYS = 0.48;
const SHANE_MOON_PERIOD_DAYS = 27.321661;
const SHANE_MOON_PRECESS_PERIOD_DAYS = -6798.383;
const SHANE_MOON_PRECESS_OFFSET_DAYS = -301.996;

// FE AE projection: +90° latitude → disc center, -90° → disc edge.
export function latToOrbitRadius(latDeg: number): number {
  const clamped = Math.max(-90, Math.min(90, latDeg));
  return (90 - clamped) / 180;
}

export function sceneToLatLon(
  x: number,
  z: number,
): { latDeg: number; lonDeg: number | null } {
  const radius = Math.min(1, Math.hypot(x, z));
  const latDeg = 90 - radius * 180;
  if (radius < 1e-6) return { latDeg, lonDeg: null };

  let lonDeg = (Math.atan2(x, -z) * 180) / Math.PI;
  if (lonDeg > 180) lonDeg -= 360;
  if (lonDeg <= -180) lonDeg += 360;
  return { latDeg, lonDeg };
}

export function latLonToScene(latDeg: number, lonDeg: number): { x: number; z: number } {
  const r = latToOrbitRadius(latDeg);
  const lonRad = (lonDeg * Math.PI) / 180;
  return {
    x: r * Math.sin(lonRad),
    z: -r * Math.cos(lonRad),
  };
}

export function solarDeclinationDeg(simMs: number): number {
  const yearPhase =
    (((simMs - SPRING_EQUINOX_REF_MS) % TROPICAL_YEAR_MS) + TROPICAL_YEAR_MS) /
    TROPICAL_YEAR_MS;
  return SOLAR_OBLIQUITY_DEG * Math.sin(yearPhase * 2 * Math.PI);
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

function shaneDateDays(simMs: number): number {
  return (simMs - SHANE_ZERO_DATE_MS) / DAY_MS;
}

function normalizeDeg(deg: number): number {
  let normalized = deg % 360;
  if (normalized > 180) normalized -= 360;
  if (normalized <= -180) normalized += 360;
  return normalized;
}

function shaneEarthRotationDeg(dateDays: number): number {
  return (
    (360 * (dateDays - SHANE_SUN_ANGLE_OFFSET_DAYS) * 24) / SHANE_SIDEREAL_DAY_HOURS
  );
}

function rotateX(v: Vec3, angleRad: number): Vec3 {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
}

function rotateZ(v: Vec3, angleRad: number): Vec3 {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c, z: v.z };
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

export function observedTerminatorScenePoints(
  simMs: number,
  sunLatDeg: number,
  steps = 180,
): Array<{ x: number; z: number }> {
  const sun = sunPos(simMs, 0, sunLatDeg);
  const sunLatLon = sceneToLatLon(sun.x, sun.z);
  const sunLonDeg = sunLatLon.lonDeg ?? 0;
  const sunVec = latLonToUnit(sunLatDeg, sunLonDeg);
  const pole = Math.abs(sunVec.z) > 0.98 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 0, z: 1 };
  const basisA = normalize(cross(sunVec, pole));
  const basisB = normalize(cross(sunVec, basisA));
  const points: Array<{ x: number; z: number }> = [];

  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const p = {
      x: basisA.x * Math.cos(angle) + basisB.x * Math.sin(angle),
      y: basisA.y * Math.cos(angle) + basisB.y * Math.sin(angle),
      z: basisA.z * Math.cos(angle) + basisB.z * Math.sin(angle),
    };
    const latDeg = (Math.asin(Math.max(-1, Math.min(1, p.z))) * 180) / Math.PI;
    const lonDeg = (Math.atan2(p.x, p.y) * 180) / Math.PI;
    points.push(latLonToScene(latDeg, lonDeg));
  }

  return points;
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

function shaneMoonLatLonForAngle(dateDays: number, moonAngleRad: number): {
  latDeg: number;
  lonDeg: number;
} {
  const moonPrecessRad =
    (2 * Math.PI * (dateDays - SHANE_MOON_PRECESS_OFFSET_DAYS)) /
    SHANE_MOON_PRECESS_PERIOD_DAYS;
  const moonEclipticRad = (SHANE_MOON_ECLIPTIC_DEG * Math.PI) / 180;
  const solarObliquityRad = (SOLAR_OBLIQUITY_DEG * Math.PI) / 180;
  const base = { x: Math.cos(moonAngleRad), y: Math.sin(moonAngleRad), z: 0 };
  const tiltedToMoonEcliptic = rotateX(base, moonEclipticRad);
  const precessedToSunEcliptic = rotateZ(tiltedToMoonEcliptic, moonPrecessRad);
  const celest = normalize(rotateX(precessedToSunEcliptic, solarObliquityRad));
  const latDeg = (Math.asin(Math.max(-1, Math.min(1, celest.z))) * 180) / Math.PI;
  const celestialLonDeg = (Math.atan2(celest.y, celest.x) * 180) / Math.PI;
  return { latDeg, lonDeg: normalizeDeg(90 - celestialLonDeg - shaneEarthRotationDeg(dateDays)) };
}

export function shaneMoonLatLon(simMs: number): { latDeg: number; lonDeg: number } {
  const dateDays = shaneDateDays(simMs);
  const moonAngleRad =
    (2 * Math.PI * (dateDays - SHANE_MOON_ANGLE_OFFSET_DAYS)) / SHANE_MOON_PERIOD_DAYS;
  return shaneMoonLatLonForAngle(dateDays, moonAngleRad);
}

export function shaneMoonTrackScenePoints(
  simMs: number,
  steps = 180,
): Array<{ x: number; z: number }> {
  const dateDays = shaneDateDays(simMs);
  const points: Array<{ x: number; z: number }> = [];

  for (let i = 0; i <= steps; i++) {
    const moonAngleRad = (i / steps) * 2 * Math.PI;
    const latLon = shaneMoonLatLonForAngle(dateDays, moonAngleRad);
    points.push(latLonToScene(latLon.latDeg, latLon.lonDeg));
  }

  return points;
}

export function shaneMoonPos(simMs: number, altitudeMi: number): Vec3 {
  const latLon = shaneMoonLatLon(simMs);
  const ground = latLonToScene(latLon.latDeg, latLon.lonDeg);
  return {
    x: ground.x,
    y: altitudeMi / FE.discRadiusMi,
    z: ground.z,
  };
}

export function effectiveMoonPos(
  simMs: number,
  altitudeMi: number,
  latDeg: number,
  shaneOrbit: boolean,
): Vec3 {
  return shaneOrbit ? shaneMoonPos(simMs, altitudeMi) : moonPos(simMs, altitudeMi, latDeg);
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

export function inverseSquareRelativeIntensity(
  distanceMi: number,
  referenceDistanceMi: number,
): number {
  if (!Number.isFinite(distanceMi) || !Number.isFinite(referenceDistanceMi)) return 0;
  const distance = Math.max(distanceMi, 1e-9);
  const reference = Math.max(referenceDistanceMi, 1e-9);
  return (reference / distance) ** 2;
}

export function localAzimuthElevationDeg(observer: Vec3, target: Vec3): {
  azimuthDeg: number | null;
  elevationDeg: number;
} {
  const dx = target.x - observer.x;
  const dy = target.y - observer.y;
  const dz = target.z - observer.z;
  const horizontal = Math.hypot(dx, dz);
  const targetYaw = Math.atan2(dz, dx);
  const observerRadius = Math.hypot(observer.x, observer.z);
  const azimuthDeg =
    observerRadius < CENTER_NORTH_RADIUS_FLOOR
      ? null
      : (((Math.atan2(-observer.z, -observer.x) - targetYaw) * 180) / Math.PI + 360) % 360;
  const elevationDeg = (Math.atan2(dy, horizontal) * 180) / Math.PI;
  return { azimuthDeg, elevationDeg };
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

function latLonToUnit(latDeg: number, lonDeg: number): Vec3 {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  const c = Math.cos(lat);
  return { x: c * Math.sin(lon), y: c * Math.cos(lon), z: Math.sin(lat) };
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
