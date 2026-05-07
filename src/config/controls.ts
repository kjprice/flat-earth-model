import { DEFAULT_SUN_DIAMETER_MI } from './core';

export type SpeedPreset = { label: string; secPerDay: number };
export type DatePreset = { label: string; monthIdx: number; day: number; sunLat: number };
export type FeTheory = {
  id: string;
  label: string;
  sunAltMi: number;
  sunDiaMi: number;
  moonAltMi: number;
  moonDiaMi: number;
};

export const SPEED_PRESETS: SpeedPreset[] = [
  { label: '1s/day', secPerDay: 1 },
  { label: '10s/day', secPerDay: 10 },
  { label: '1m/day', secPerDay: 60 },
  { label: '2m/day', secPerDay: 120 },
];

export const DATE_PRESETS: DatePreset[] = [
  { label: 'Spring eq.', monthIdx: 2, day: 20, sunLat: 0 },
  { label: 'Summer sol.', monthIdx: 5, day: 21, sunLat: 23.5 },
  { label: 'Fall eq.', monthIdx: 8, day: 22, sunLat: 0 },
  { label: 'Winter sol.', monthIdx: 11, day: 21, sunLat: -23.5 },
];

export const FE_THEORIES: FeTheory[] = [
  {
    id: 'rowbotham',
    label: 'Rowbotham — Zetetic (1865)',
    sunAltMi: 3000,
    sunDiaMi: 32,
    moonAltMi: 3000,
    moonDiaMi: 32,
  },
  {
    id: 'dubay',
    label: 'Dubay — modern FE (2014)',
    sunAltMi: 4000,
    sunDiaMi: 32,
    moonAltMi: 4000,
    moonDiaMi: 32,
  },
  {
    id: 'firmament',
    label: 'Firmament dome (biblical lit.)',
    sunAltMi: 3100,
    sunDiaMi: 2000,
    moonAltMi: 3100,
    moonDiaMi: 1500,
  },
];

export const CONTROLS_CONFIG = {
  inflateSunDiameterMi: 1000,
  shrinkSunDiameterMi: DEFAULT_SUN_DIAMETER_MI,
  inflatedThresholdMi: 500,
  theoryToleranceMi: 1,
  activeDatePresetLatToleranceDeg: 0.5,
  minBodyDiameterMi: 1,
  jogSpanDays: 10,
  centerTeleportElevationMi: 10_000,
  globeLowOrbitElevationMi: 250,
  globeHighOrbitElevationMi: 10_000,
  globeDeepSpaceElevationMi: 60_000,
} as const;
