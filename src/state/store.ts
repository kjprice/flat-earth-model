import { create } from 'zustand';

export type CameraLook = 'center' | 'sun' | 'moon' | 'free';

type SceneState = {
  // Player (viewer) position in normalized scene units. Disc radius = 1.0.
  playerX: number;
  playerZ: number;
  elevationMi: number; // raw miles; camera Y = -(elevationMi / FE.discRadiusMi)

  // Time & simulation.
  t: number; // radians, 0..TWO_PI, drives sun/moon orbit
  paused: boolean;
  dayDurationSec: number;

  // Camera.
  cameraLook: CameraLook; // 'center' (auto look-at-origin), 'sun', 'moon', or 'free' (orbitControl)

  setPlayer: (x: number, z: number) => void;
  setElevation: (mi: number) => void;
  setT: (t: number) => void;
  advanceT: (deltaMs: number) => void;
  setPaused: (p: boolean) => void;
  togglePaused: () => void;
  setDayDuration: (s: number) => void;
  setCameraLook: (look: CameraLook) => void;
};

const TWO_PI = Math.PI * 2;

export const useScene = create<SceneState>((set, get) => ({
  playerX: 0.5,
  playerZ: 0.3,
  elevationMi: 0,

  t: 0,
  paused: false,
  dayDurationSec: 10,

  cameraLook: 'center',

  setPlayer: (x, z) => set({ playerX: x, playerZ: z }),
  setElevation: (mi) => set({ elevationMi: mi }),
  setT: (t) => set({ t: ((t % TWO_PI) + TWO_PI) % TWO_PI }),
  advanceT: (deltaMs) => {
    const { paused, dayDurationSec, t } = get();
    if (paused) return;
    const dur = Math.max(0.1, dayDurationSec);
    const next = (t + (deltaMs / 1000 / dur) * TWO_PI) % TWO_PI;
    set({ t: next });
  },
  setPaused: (p) => set({ paused: p }),
  togglePaused: () => set((s) => ({ paused: !s.paused })),
  setDayDuration: (s) => set({ dayDurationSec: Math.max(0.1, s) }),
  setCameraLook: (look) => set({ cameraLook: look }),
}));
