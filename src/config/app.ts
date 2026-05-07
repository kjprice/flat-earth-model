import { FE, GLOBE } from './core';

export const APP_CONFIG = {
  controlsDesktopBreakpointPx: 768,
  title: 'Earth Model First-Person Viewer',
  headerSummary: `flat disc Ø ${(FE.discRadiusMi * 2).toLocaleString()} mi · globe Earth Ø ${GLOBE.earthDiameterMi.toLocaleString(undefined, { maximumFractionDigits: 0 })} mi`,
} as const;
