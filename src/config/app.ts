import { DEFAULT_SUN_ALTITUDE_MI, FE } from './core';

export const APP_CONFIG = {
  controlsDesktopBreakpointPx: 768,
  title: 'Flat Earth First-Person Viewer',
  headerSummary: `disc Ø ${(FE.discRadiusMi * 2).toLocaleString()} mi · sun/moon at ${DEFAULT_SUN_ALTITUDE_MI.toLocaleString()} mi`,
} as const;
