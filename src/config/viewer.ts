import { DAY_RADIUS } from './core';

export const VIEWER_RENDER_CONFIG = {
  minCanvasSizePx: 2,
  perspectiveNear: 0.001,
  perspectiveFar: 500,
  backgroundColor: [6, 10, 22] as const,
} as const;

export const VIEWER_INTERACTION_CONFIG = {
  dragSensitivityRadPerPx: 0.005,
  walkSpeedSceneUnitsPerSec: 0.35,
  discMaxRadius: 0.98,
  maxWalkStepSec: 0.1,
} as const;

export const VIEWER_SKY_CONFIG = {
  starCount: 320,
  starDomeRadius: 50,
  starPhiRandomMin: 0.05,
  starSizeSceneUnits: 0.18,
  nightVisibilityMin: 0.01,
} as const;

export const VIEWER_GROUND_CONFIG = {
  texturedAngularSegments: 96,
  rimSegments: 96,
  rimHeight: 0.008,
  rimColor: [210, 220, 235] as const,
} as const;

export const VIEWER_SUN_CONFIG = {
  color: [255, 238, 168] as const,
  sphereDetail: [24, 16] as const,
} as const;

export const VIEWER_MOON_CONFIG = {
  sphereDetail: [32, 24] as const,
  feLightingDistance: 0.35,
  feAmbientLight: [90, 90, 100] as const,
  feDirectionalLight: [200, 200, 215] as const,
  classicAmbientLight: [14, 14, 20] as const,
  classicDirectionalLight: [230, 230, 240] as const,
} as const;

export const VIEWER_CAMERA_CONFIG = {
  minEyeHeightScene: 0.003,
  targetLookMinDistance: 1e-4,
  verticalDirectionThreshold: 0.999,
  defaultUp: [0, -1, 0] as [number, number, number],
  fallbackUp: [0, 0, 1] as [number, number, number],
  centerTarget: { x: 0, y: 0, z: 0 },
} as const;

export const VIEWER_NIGHT_CONFIG = {
  startRadius: DAY_RADIUS * 0.8,
  fadeDistance: 0.4,
} as const;
