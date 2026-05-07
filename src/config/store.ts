export const SCENE_STORE_DEFAULTS = {
  playerX: -0.2632184436630496,
  playerZ: -0.07544684448512398,
  elevationMi: 6 / 5280,
  paused: false,
  dayDurationSec: 10,
  globeDayDurationSec: 120,
  cameraLook: 'center',
  moonLightingFE: false,
  shaneMoonOrbit: false,
  fovDeg: 101,
  hudMetricsVisible: false,
  perspectiveAuditVisible: false,
  inverseSquareVisible: false,
  inverseSquareLightingEnabled: false,
} as const;

export const SCENE_STORE_LIMITS = {
  minElevationMi: 0,
  minDayDurationSec: 0.1,
  minTimeOfDayFraction: 0,
  maxTimeOfDayFraction: 1,
  minFovDeg: 20,
  maxFovDeg: 140,
} as const;
