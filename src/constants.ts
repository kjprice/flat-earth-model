// All raw dimensions live here in real-world miles. Rendering code reads
// normalized scene units = miles / FE.discRadiusMi, so disc radius = 1.0.
export const FE = {
  discRadiusMi: 12_450, // half of 24,900 mi diameter
  sunAltitudeMi: 3_000,
  moonAltitudeMi: 3_000,
  sunDiameterMi: 32,
  moonDiameterMi: 32,
  firmamentHeightMi: 3_100,
} as const;

// Orbit radius of sun/moon track, roughly above the tropic circle.
export const SUN_ORBIT_RADIUS = 0.4; // scene units
export const MOON_PHASE_OFFSET = Math.PI * 0.944; // ~170° behind the sun
// Day radius on the ground — points within this of the sun's XZ footprint are lit.
export const DAY_RADIUS = 0.4;

// Derived normalized values.
export const SUN_ALTITUDE = FE.sunAltitudeMi / FE.discRadiusMi;
export const MOON_ALTITUDE = FE.moonAltitudeMi / FE.discRadiusMi;
export const SUN_RADIUS = FE.sunDiameterMi / 2 / FE.discRadiusMi;
export const MOON_RADIUS = FE.moonDiameterMi / 2 / FE.discRadiusMi;
export const FIRMAMENT_HEIGHT = FE.firmamentHeightMi / FE.discRadiusMi;
