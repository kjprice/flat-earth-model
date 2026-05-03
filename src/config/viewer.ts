import { DAY_RADIUS, FE } from './core';

export const VIEWER_RENDER_CONFIG = {
  minCanvasSizePx: 2,
  // Must be closer than nearby landmark targets; p5 clamps <= 0.0001 to 0.01,
  // so keep this just above that threshold. 0.0002 scene units is ~2.5 mi.
  perspectiveNear: 0.0002,
  perspectiveFar: 500,
  backgroundColor: [6, 10, 22] as const,
} as const;

export const VIEWER_INTERACTION_CONFIG = {
  dragSensitivityRadPerPx: 0.005,
  // ~0.35 disc radii / sec = ~4,358 mph at FE scale; tuned for "cross the map"
  // usability rather than human walking speed.
  walkSpeedSceneUnitsPerSec: 0.35,
  // Keep the player slightly inside the rim so movement never intersects the wall.
  discMaxRadius: 0.98,
  // Clamp dt so a tab stall does not turn into a huge teleport on the next frame.
  maxWalkStepSec: 0.1,
} as const;

export const VIEWER_SKY_CONFIG = {
  starCount: 320,
  starDomeRadius: 50,
  starPhiRandomMin: 0.05,
  starSizeSceneUnits: 0.18,
  // Skip star rendering until the scene is at least 1% into "night" to avoid
  // faint daytime speckling.
  nightVisibilityMin: 0.01,
} as const;

export const VIEWER_GROUND_CONFIG = {
  textureRenderSizePx: 1536,
  texturedAngularSegments: 160,
  // Keep a very low ambient floor when the sun is nearby so only the local
  // daylight patch reads clearly instead of the whole disc popping into view.
  textureAmbientBrightnessNearSun: 5,
  // Lift the far-sun ambient a bit above pure black so moonless/night scenes
  // still leave some terrain context in first-person.
  textureAmbientBrightnessFarSun: 26,
  // The sun hotspot starts at ~45% of the daylight radius, leaving a bright
  // core before the wider fade pushes out to the full lit zone.
  sunRadiusStart: DAY_RADIUS * 0.45,
  sunFadeDistance: 0.22,
  sunTextureAlphaMax: 228,
  sunColorBoost: [78, 82, 34] as const,
  sunGlowAlphaMax: 52,
  // Moonlight is intentionally tighter and dimmer than sunlight, so its core
  // radius begins smaller and the tint stays localized.
  moonRadiusStart: DAY_RADIUS * 0.28,
  moonFadeDistance: 0.18,
  moonTextureAlphaMax: 150,
  moonColorBoost: [70, 92, 138] as const,
  moonGlowAlphaMax: 48,
  rimSegments: 96,
  // A shallow rim gives the disc edge a readable horizon without becoming the
  // old 100-mile wall that hid low landmarks.
  rimHeight: 0.00016,
  rimColor: [210, 220, 235] as const,
} as const;

export const VIEWER_SUN_CONFIG = {
  color: [255, 238, 168] as const,
  sphereDetail: [24, 16] as const,
} as const;

export const VIEWER_MOON_CONFIG = {
  sphereDetail: [32, 24] as const,
  // Normalize sun↔moon separation against the widest practical spacing on the disc.
  lightStrengthDistanceMax: 2.05,
  // Keep the moon from going black; it should be dim near the sun, not gone.
  visibleStrengthMin: 0.28,
  visibleStrengthPower: 1.15,
  // Ground light stays subtler than the visible moon but still casts a faint
  // patch even when the sun and moon are close.
  groundLightStrengthMin: 0.08,
  groundLightStrengthPower: 1.25,
  feAmbientLight: [90, 90, 100] as const,
  feDirectionalLight: [200, 200, 215] as const,
  classicAmbientLight: [14, 14, 20] as const,
  classicDirectionalLight: [230, 230, 240] as const,
} as const;

export const VIEWER_CAMERA_CONFIG = {
  // Treat "ground level" as a 6 ft eye line so a zero-elevation viewer is not
  // mathematically coplanar with the disc mesh.
  minEyeHeightMi: 6 / 5280,
  minEyeHeightScene: (6 / 5280) / FE.discRadiusMi,
  targetLookMinDistance: 1e-4,
  // Switch away from the normal up-vector only when the camera is almost
  // straight up/down; 0.999 is ~2.6 degrees from vertical.
  verticalDirectionThreshold: 0.999,
  defaultUp: [0, -1, 0] as [number, number, number],
  fallbackUp: [0, 0, 1] as [number, number, number],
  centerTarget: { x: 0, y: 0, z: 0 },
} as const;

export const VIEWER_NIGHT_CONFIG = {
  startRadius: DAY_RADIUS * 0.25,
  fadeDistance: 0.18,
} as const;
