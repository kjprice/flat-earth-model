export const CAMERA_VIEW_DEFAULTS: { yaw: number; pitch: number } = {
  yaw: Math.atan2(-0.3, -0.5),
  pitch: 0,
};

export const CAMERA_VIEW_LIMITS = {
  halfPiRad: Math.PI / 2,
  pitchEdgeOffsetRad: 0.01,
} as const;
