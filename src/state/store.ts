import { create } from 'zustand';
import {
  DEFAULT_MOON_ALTITUDE_MI,
  DEFAULT_MOON_DIAMETER_MI,
  DEFAULT_MOON_LAT_DEG,
  DEFAULT_SUN_ALTITUDE_MI,
  DEFAULT_SUN_DIAMETER_MI,
  DAY_MS,
  EARTH_MODELS,
  NEW_YORK_START,
  type EarthModel,
} from '../config/core';
import { CONTROLS_CONFIG } from '../config/controls';
import type { LandmarkId } from '../config/landmarks';
import { SCENE_STORE_DEFAULTS, SCENE_STORE_LIMITS } from '../config/store';
import { solarDeclinationDeg } from '../scene';

export type CameraLook = 'center' | 'sun' | 'moon' | 'manual' | LandmarkId;

type SunMoonPatch = Partial<{ altMi: number; diaMi: number; latDeg: number }>;

type SceneState = {
  model: EarthModel;

  // Player (viewer) position in normalized scene units. Disc radius = 1.0.
  playerX: number;
  playerZ: number;
  elevationMi: number;

  // Time & simulation.
  simMs: number; // sim clock in ms since epoch
  paused: boolean;
  dayDurationSec: number; // 1 simulated day per this many real seconds

  // Camera mode. Yaw/pitch live outside the store (see scene/cameraView.ts)
  // so the 60fps follow-mode updates don't re-render React subscribers.
  cameraLook: CameraLook;

  // Sun config (overrides FE defaults).
  sunAltitudeMi: number;
  sunDiameterMi: number;
  sunLatDeg: number;

  // Moon config.
  moonAltitudeMi: number;
  moonDiameterMi: number;
  moonLatDeg: number;

  // Flat-earther moon lighting: if true, the lit hemisphere faces AWAY from
  // the sun (matches the "moon is self-luminous, sun blocks it" claim).
  moonLightingFE: boolean;
  shaneMoonOrbit: boolean;

  // Vertical FOV in degrees for the first-person viewer.
  fovDeg: number;
  hudMetricsVisible: boolean;
  perspectiveAuditVisible: boolean;
  inverseSquareVisible: boolean;
  inverseSquareLightingEnabled: boolean;

  setPlayer: (x: number, z: number) => void;
  setModel: (model: EarthModel) => void;
  setElevation: (mi: number) => void;
  advanceSim: (deltaMs: number) => void;
  setTimeOfDay: (fraction: number) => void;
  togglePaused: () => void;
  setDayDuration: (s: number) => void;
  setCameraLook: (look: CameraLook) => void;
  setSimMs: (ms: number) => void;
  setSunConfig: (patch: SunMoonPatch) => void;
  setMoonConfig: (patch: SunMoonPatch) => void;
  setMoonLightingFE: (v: boolean) => void;
  setShaneMoonOrbit: (v: boolean) => void;
  setFov: (deg: number) => void;
  setHudMetricsVisible: (v: boolean) => void;
  setPerspectiveAuditVisible: (v: boolean) => void;
  setInverseSquareVisible: (v: boolean) => void;
  setInverseSquareLightingEnabled: (v: boolean) => void;
};

const initialSimMs = Date.now();
const initialModel = initialModelFromUrl();

function initialModelFromUrl(): EarthModel {
  if (typeof window === 'undefined') return 'flat';
  const raw = new URLSearchParams(window.location.search).get('model');
  return EARTH_MODELS.includes(raw as EarthModel) ? (raw as EarthModel) : 'flat';
}

function writeModelToUrl(model: EarthModel) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (model === 'flat') {
    url.searchParams.delete('model');
  } else {
    url.searchParams.set('model', model);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

export const useScene = create<SceneState>((set, get) => ({
  model: initialModel,

  playerX:
    initialModel === 'globe' ? NEW_YORK_START.globeSceneX : SCENE_STORE_DEFAULTS.playerX,
  playerZ:
    initialModel === 'globe' ? NEW_YORK_START.globeSceneZ : SCENE_STORE_DEFAULTS.playerZ,
  elevationMi: SCENE_STORE_DEFAULTS.elevationMi,

  simMs: initialSimMs,
  paused: SCENE_STORE_DEFAULTS.paused,
  dayDurationSec:
    initialModel === 'globe'
      ? SCENE_STORE_DEFAULTS.globeDayDurationSec
      : SCENE_STORE_DEFAULTS.dayDurationSec,

  cameraLook: initialModel === 'globe' ? 'sun' : SCENE_STORE_DEFAULTS.cameraLook,

  sunAltitudeMi: DEFAULT_SUN_ALTITUDE_MI,
  sunDiameterMi: CONTROLS_CONFIG.inflateSunDiameterMi,
  sunLatDeg: solarDeclinationDeg(initialSimMs),

  moonAltitudeMi: DEFAULT_MOON_ALTITUDE_MI,
  moonDiameterMi: Math.max(
    CONTROLS_CONFIG.minBodyDiameterMi,
    Math.round(
      CONTROLS_CONFIG.inflateSunDiameterMi * (DEFAULT_MOON_DIAMETER_MI / DEFAULT_SUN_DIAMETER_MI),
    ),
  ),
  moonLatDeg: DEFAULT_MOON_LAT_DEG,

  moonLightingFE: SCENE_STORE_DEFAULTS.moonLightingFE,
  shaneMoonOrbit: SCENE_STORE_DEFAULTS.shaneMoonOrbit,

  fovDeg: SCENE_STORE_DEFAULTS.fovDeg,
  hudMetricsVisible: SCENE_STORE_DEFAULTS.hudMetricsVisible,
  perspectiveAuditVisible: SCENE_STORE_DEFAULTS.perspectiveAuditVisible,
  inverseSquareVisible: SCENE_STORE_DEFAULTS.inverseSquareVisible,
  inverseSquareLightingEnabled: SCENE_STORE_DEFAULTS.inverseSquareLightingEnabled,

  setModel: (model) => {
    if (!EARTH_MODELS.includes(model)) return;
    writeModelToUrl(model);
    set((s) => ({
      model,
      playerX: model === 'globe' ? NEW_YORK_START.globeSceneX : SCENE_STORE_DEFAULTS.playerX,
      playerZ: model === 'globe' ? NEW_YORK_START.globeSceneZ : SCENE_STORE_DEFAULTS.playerZ,
      cameraLook: model === 'globe' && s.cameraLook === 'center' ? 'sun' : s.cameraLook,
      dayDurationSec:
        model === 'globe' && s.dayDurationSec === SCENE_STORE_DEFAULTS.dayDurationSec
          ? SCENE_STORE_DEFAULTS.globeDayDurationSec
          : s.dayDurationSec,
    }));
  },
  setPlayer: (x, z) => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    set({ playerX: x, playerZ: z });
  },
  setElevation: (mi) => {
    if (!Number.isFinite(mi)) return;
    set({ elevationMi: Math.max(SCENE_STORE_LIMITS.minElevationMi, mi) });
  },
  advanceSim: (deltaMs) => {
    const { paused, dayDurationSec, simMs } = get();
    if (paused) return;
    const scale = DAY_MS / (Math.max(SCENE_STORE_LIMITS.minDayDurationSec, dayDurationSec) * 1000);
    const nextSimMs = simMs + deltaMs * scale;
    set({ simMs: nextSimMs, sunLatDeg: solarDeclinationDeg(nextSimMs) });
  },
  setTimeOfDay: (fraction) => {
    const { simMs } = get();
    const startOfDay = Math.floor(simMs / DAY_MS) * DAY_MS;
    const nextSimMs =
      startOfDay +
      Math.max(
        SCENE_STORE_LIMITS.minTimeOfDayFraction,
        Math.min(SCENE_STORE_LIMITS.maxTimeOfDayFraction, fraction),
      ) *
        DAY_MS;
    set({ simMs: nextSimMs, sunLatDeg: solarDeclinationDeg(nextSimMs) });
  },
  togglePaused: () => set((s) => ({ paused: !s.paused })),
  setDayDuration: (s) =>
    set({ dayDurationSec: Math.max(SCENE_STORE_LIMITS.minDayDurationSec, s) }),
  setCameraLook: (look) => set({ cameraLook: look }),
  setSimMs: (ms) => {
    if (!Number.isFinite(ms)) return;
    set({ simMs: ms, sunLatDeg: solarDeclinationDeg(ms) });
  },
  setSunConfig: (patch) =>
    set((s) => ({
      sunAltitudeMi: Number.isFinite(patch.altMi) ? (patch.altMi as number) : s.sunAltitudeMi,
      sunDiameterMi: Number.isFinite(patch.diaMi) ? (patch.diaMi as number) : s.sunDiameterMi,
      sunLatDeg: Number.isFinite(patch.latDeg) ? (patch.latDeg as number) : s.sunLatDeg,
    })),
  setMoonConfig: (patch) =>
    set((s) => ({
      moonAltitudeMi: Number.isFinite(patch.altMi) ? (patch.altMi as number) : s.moonAltitudeMi,
      moonDiameterMi: Number.isFinite(patch.diaMi) ? (patch.diaMi as number) : s.moonDiameterMi,
      moonLatDeg: Number.isFinite(patch.latDeg) ? (patch.latDeg as number) : s.moonLatDeg,
    })),
  setMoonLightingFE: (v) => set({ moonLightingFE: v }),
  setShaneMoonOrbit: (v) => set({ shaneMoonOrbit: v }),
  setFov: (deg) => {
    if (!Number.isFinite(deg)) return;
    set({
      fovDeg: Math.max(
        SCENE_STORE_LIMITS.minFovDeg,
        Math.min(SCENE_STORE_LIMITS.maxFovDeg, deg),
      ),
    });
  },
  setHudMetricsVisible: (v) => set({ hudMetricsVisible: v }),
  setPerspectiveAuditVisible: (v) => set({ perspectiveAuditVisible: v }),
  setInverseSquareVisible: (v) => set({ inverseSquareVisible: v }),
  setInverseSquareLightingEnabled: (v) => set({ inverseSquareLightingEnabled: v }),
}));
