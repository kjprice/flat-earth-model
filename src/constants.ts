// All raw dimensions live here in real-world miles. Rendering code reads
// normalized scene units = miles / FE.discRadiusMi, so disc radius = 1.0.
export const FE = {
  discRadiusMi: 12_450, // half of 24,900 mi diameter
  firmamentHeightMi: 3_100,
} as const;

// Sun/moon defaults — user-overridable via Controls.
export const DEFAULT_SUN_ALTITUDE_MI = 3_000;
export const DEFAULT_MOON_ALTITUDE_MI = 3_000;
export const DEFAULT_SUN_DIAMETER_MI = 32;
export const DEFAULT_MOON_DIAMETER_MI = 32;
// Latitude on the FE azimuthal-equidistant map: 90°N = disc center, -90°S = disc edge.
export const DEFAULT_SUN_LAT_DEG = 23.5; // Tropic of Cancer
export const DEFAULT_MOON_LAT_DEG = 18;

// Day radius — ground tinting uses this (points within this of the sun's XZ footprint are lit).
export const DAY_RADIUS = 0.4;

// Derived normalized values.
export const FIRMAMENT_HEIGHT = FE.firmamentHeightMi / FE.discRadiusMi;

// Moon phase reference: known new moon 2000-01-06 18:14 UTC.
export const NEW_MOON_REF_MS = Date.UTC(2000, 0, 6, 18, 14);
export const SYNODIC_MS = 29.530588853 * 86_400_000;

export const DAY_MS = 86_400_000;
