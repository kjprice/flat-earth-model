// Mutable, non-reactive camera orientation shared between the Viewer's p5
// draw loop (writer in follow mode) and its drag handler (writer in manual
// mode). Kept out of zustand so 60fps updates don't re-render subscribers.
export const cameraView = {
  yaw: Math.atan2(-0.3, -0.5),
  pitch: 0,
};

const HALF_PI = Math.PI / 2;

export function setCameraView(yaw: number, pitch: number) {
  cameraView.yaw = yaw;
  cameraView.pitch = Math.max(-HALF_PI + 0.01, Math.min(HALF_PI - 0.01, pitch));
}

export function addCameraView(dYaw: number, dPitch: number) {
  setCameraView(cameraView.yaw + dYaw, cameraView.pitch + dPitch);
}
