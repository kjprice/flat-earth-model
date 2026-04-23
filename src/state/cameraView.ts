// Mutable, non-reactive camera orientation shared between the Viewer's p5
// draw loop (writer in follow mode) and its drag handler (writer in manual
// mode). Kept out of zustand so 60fps updates don't re-render subscribers.
import { CAMERA_VIEW_DEFAULTS, CAMERA_VIEW_LIMITS } from '../config/camera';

export const cameraView = {
  yaw: CAMERA_VIEW_DEFAULTS.yaw,
  pitch: CAMERA_VIEW_DEFAULTS.pitch,
};

export function setCameraView(yaw: number, pitch: number) {
  cameraView.yaw = yaw;
  cameraView.pitch = Math.max(
    -CAMERA_VIEW_LIMITS.halfPiRad + CAMERA_VIEW_LIMITS.pitchEdgeOffsetRad,
    Math.min(
      CAMERA_VIEW_LIMITS.halfPiRad - CAMERA_VIEW_LIMITS.pitchEdgeOffsetRad,
      pitch,
    ),
  );
}

export function addCameraView(dYaw: number, dPitch: number) {
  setCameraView(cameraView.yaw + dYaw, cameraView.pitch + dPitch);
}
