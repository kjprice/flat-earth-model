export const SCENE_STORE_DEFAULTS = {
  playerX: 0,
  playerZ: 0,
  elevationMi: 10_000,
  paused: false,
  dayDurationSec: 10,
  cameraLook: 'center',
  moonLightingFE: false,
  shaneMoonOrbit: false,
  fovDeg: 101,
  hudMetricsVisible: false,
  perspectiveAuditVisible: false,
  inverseSquareVisible: false,
} as const;

export const SCENE_STORE_LIMITS = {
  minElevationMi: 0,
  minDayDurationSec: 0.1,
  minTimeOfDayFraction: 0,
  maxTimeOfDayFraction: 1,
  minFovDeg: 20,
  maxFovDeg: 140,
} as const;
