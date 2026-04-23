// All raw dimensions live here in real-world miles. Rendering code reads
// normalized scene units = miles / FE.discRadiusMi, so disc radius = 1.0.
export const FE = {
  discRadiusMi: 12_450, // half of 24,900 mi diameter
  firmamentHeightMi: 3_100,
} as const;

export const DEFAULT_CELESTIAL_CONFIG = {
  sun: {
    altitudeMi: 3_000,
    diameterMi: 32,
    latitudeDeg: 23.5, // Tropic of Cancer
  },
  moon: {
    altitudeMi: 3_000,
    diameterMi: 32,
    latitudeDeg: 18,
  },
} as const;

export const DEFAULT_SUN_ALTITUDE_MI = DEFAULT_CELESTIAL_CONFIG.sun.altitudeMi;
export const DEFAULT_MOON_ALTITUDE_MI = DEFAULT_CELESTIAL_CONFIG.moon.altitudeMi;
export const DEFAULT_SUN_DIAMETER_MI = DEFAULT_CELESTIAL_CONFIG.sun.diameterMi;
export const DEFAULT_MOON_DIAMETER_MI = DEFAULT_CELESTIAL_CONFIG.moon.diameterMi;
export const DEFAULT_SUN_LAT_DEG = DEFAULT_CELESTIAL_CONFIG.sun.latitudeDeg;
export const DEFAULT_MOON_LAT_DEG = DEFAULT_CELESTIAL_CONFIG.moon.latitudeDeg;

export const LIGHTING = {
  // Ground tinting uses this; points within this of the sun's XZ footprint are lit.
  dayRadiusScene: 0.4,
} as const;

export const DAY_RADIUS = LIGHTING.dayRadiusScene;

export const TIME = {
  dayMs: 86_400_000,
  // Moon phase reference: known new moon 2000-01-06 18:14 UTC.
  newMoonRefMs: Date.UTC(2000, 0, 6, 18, 14),
  synodicMs: 29.530588853 * 86_400_000,
  presetUtcHour: 12,
} as const;

export const FIRMAMENT_HEIGHT = FE.firmamentHeightMi / FE.discRadiusMi;
export const NEW_MOON_REF_MS = TIME.newMoonRefMs;
export const SYNODIC_MS = TIME.synodicMs;
export const DAY_MS = TIME.dayMs;
