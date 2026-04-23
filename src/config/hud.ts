export type CompassMark = { label: string; deg: number; cardinal: boolean };

export const HUD_CONFIG = {
  angularDistanceFloor: 1e-9,
  compassHalfSpanDeg: 45,
  compassWidthPx: 280,
  rerenderModulo: 1_000_000,
  centerNorthRadiusFloor: 1e-4,
} as const;

export const PHASE_LABEL_THRESHOLDS = [
  { max: 0.03, label: 'new' },
  { max: 0.22, label: 'waxing crescent' },
  { max: 0.28, label: 'first quarter' },
  { max: 0.47, label: 'waxing gibbous' },
  { max: 0.53, label: 'full' },
  { max: 0.72, label: 'waning gibbous' },
  { max: 0.78, label: 'last quarter' },
] as const;

export const ECLIPSE_CONFIG = {
  maxLatitudeDeltaDeg: 4,
  alignmentThreshold: 0.02,
} as const;

export const COMPASS_MARKS: CompassMark[] = [
  { label: 'N', deg: 0, cardinal: true },
  { label: 'NE', deg: 45, cardinal: false },
  { label: 'E', deg: 90, cardinal: true },
  { label: 'SE', deg: 135, cardinal: false },
  { label: 'S', deg: 180, cardinal: true },
  { label: 'SW', deg: 225, cardinal: false },
  { label: 'W', deg: 270, cardinal: true },
  { label: 'NW', deg: 315, cardinal: false },
];
