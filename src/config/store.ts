export const SCENE_STORE_DEFAULTS = {
  playerX: 0.5,
  playerZ: 0.3,
  elevationMi: 0,
  paused: false,
  dayDurationSec: 60,
  cameraLook: 'center',
  moonLightingFE: false,
  fovDeg: 101,
} as const;

export const SCENE_STORE_LIMITS = {
  minElevationMi: 0,
  minDayDurationSec: 0.1,
  minTimeOfDayFraction: 0,
  maxTimeOfDayFraction: 1,
  minFovDeg: 20,
  maxFovDeg: 140,
} as const;
