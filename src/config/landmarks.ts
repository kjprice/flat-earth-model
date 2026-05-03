import { FE } from './core';

export const NEW_YORK_MOON_VIEW = {
  latDeg: 47.27,
  lonDeg: -68.37,
  elevationMi: 0.001243,
  elevationLabel: '2 m (~6 ft)',
} as const;

export const EMPIRE_STATE_DISTANCE_FROM_START_MI = 10;
const aeLatitudeOffsetDeg = (EMPIRE_STATE_DISTANCE_FROM_START_MI / FE.discRadiusMi) * 180;

export const LANDMARKS = [
  {
    id: 'everest',
    label: 'Mount Everest',
    shortLabel: 'Everest',
    kind: 'mountain',
    latDeg: 27.9881,
    lonDeg: 86.925,
    heightMi: 29_032 / 5280,
    footprintRadiusMi: 0.9,
    color: [232, 234, 238] as const,
    accent: [124, 170, 255] as const,
  },
  {
    id: 'empireState',
    label: 'Empire State Building',
    shortLabel: 'Empire',
    kind: 'tower',
    latDeg: NEW_YORK_MOON_VIEW.latDeg - aeLatitudeOffsetDeg,
    lonDeg: NEW_YORK_MOON_VIEW.lonDeg,
    heightMi: 1454 / 5280,
    footprintRadiusMi: 0.22,
    color: [255, 214, 102] as const,
    accent: [255, 214, 102] as const,
  },
] as const;

export type Landmark = (typeof LANDMARKS)[number];
export type LandmarkId = Landmark['id'];
