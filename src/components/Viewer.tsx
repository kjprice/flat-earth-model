import { useEffect, useRef } from 'react';
import p5 from 'p5';
import {
  DAY_RADIUS,
  FE,
} from '../constants';
import {
  dirToYawPitch,
  dist3,
  moonPos,
  normalize,
  sub,
  sunPos,
  yawPitchToDir,
  type Vec3,
} from '../scene';
import { addCameraView, cameraView, setCameraView } from '../state/cameraView';
import { useScene } from '../state/store';
import { Hud } from './Hud';

// p5 clamps perspective near <= 0.0001 to 0.01 and spams the console. 0.001
// survives the clamp; at our normalized scale, that's ~12 mi, plenty fine
// for a ground-level viewer.
const NEAR = 0.001;
const FAR = 500;

// Drag sensitivity (radians per pixel).
const DRAG_SENS = 0.005;

// Walking speed in scene units per second. Disc radius = 1, so 0.35 covers
// the disc in ~3s — brisk but not teleporty.
const WALK_SPEED = 0.35;
// Keep player inside the disc (scene radius 1) with a small margin so the
// camera never sits on the edge lip.
const DISC_MAX_R = 0.98;

type Star = { x: number; y: number; z: number };

function makeSketch(container: HTMLDivElement) {
  return (p: p5) => {
    const stars: Star[] = [];
    let lastMs = 0;

    p.setup = () => {
      const w = Math.max(2, container.clientWidth);
      const h = Math.max(2, container.clientHeight);
      const canvas = p.createCanvas(w, h, p.WEBGL);
      canvas.parent(container);
      p.setAttributes('antialias', true);
      p.noStroke();

      // ~320 stars on a large hemisphere. We translate them by the player's
      // XZ each frame so the dome always surrounds the observer; a radius
      // much larger than the disc keeps the stars feeling "at infinity".
      const r = 50;
      for (let i = 0; i < 320; i++) {
        const theta = p.random(p.TWO_PI);
        const phi = p.acos(p.random(0.05, 1));
        const sx = r * Math.sin(phi) * Math.cos(theta);
        const sy = r * Math.cos(phi);
        const sz = r * Math.sin(phi) * Math.sin(theta);
        stars.push({ x: sx, y: sy, z: sz });
      }

      lastMs = p.millis();
    };

    p.windowResized = () => {
      p.resizeCanvas(
        Math.max(2, container.clientWidth),
        Math.max(2, container.clientHeight),
      );
    };

    function drawGround(sun: Vec3) {
      const RADIAL = 40;
      const ANGULAR = 72;
      p.push();
      p.noStroke();

      for (let ri = 0; ri < RADIAL; ri++) {
        const r0 = ri / RADIAL;
        const r1 = (ri + 1) / RADIAL;
        for (let ai = 0; ai < ANGULAR; ai++) {
          const a0 = (ai / ANGULAR) * p.TWO_PI;
          const a1 = ((ai + 1) / ANGULAR) * p.TWO_PI;
          const mx = ((r0 + r1) / 2) * Math.cos((a0 + a1) / 2);
          const mz = ((r0 + r1) / 2) * Math.sin((a0 + a1) / 2);

          const d = Math.hypot(mx - sun.x, mz - sun.z);
          const dayness = 1 - Math.min(1, Math.max(0, (d - DAY_RADIUS * 0.7) / 0.35));
          const R = 30 + 100 * dayness;
          const G = 50 + 100 * dayness;
          const B = 55 + 45 * dayness;

          const grid = ri % 5 === 0 || ai % 6 === 0 ? 20 : 0;

          p.fill(R + grid, G + grid, B + grid);

          const x00 = r0 * Math.cos(a0), z00 = r0 * Math.sin(a0);
          const x01 = r0 * Math.cos(a1), z01 = r0 * Math.sin(a1);
          const x10 = r1 * Math.cos(a0), z10 = r1 * Math.sin(a0);
          const x11 = r1 * Math.cos(a1), z11 = r1 * Math.sin(a1);

          p.beginShape();
          p.vertex(x00, 0, z00);
          p.vertex(x10, 0, z10);
          p.vertex(x11, 0, z11);
          p.vertex(x01, 0, z01);
          p.endShape(p.CLOSE);
        }
      }

      // Disc edge wall — short thin lip so the rim reads from any angle.
      p.fill(210, 220, 235);
      const N = 96;
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * p.TWO_PI;
        const a1 = ((i + 1) / N) * p.TWO_PI;
        const x0 = Math.cos(a0), z0 = Math.sin(a0);
        const x1 = Math.cos(a1), z1 = Math.sin(a1);
        const H = 0.008;
        p.beginShape();
        p.vertex(x0, 0, z0);
        p.vertex(x1, 0, z1);
        p.vertex(x1, H, z1);
        p.vertex(x0, H, z0);
        p.endShape(p.CLOSE);
      }

      p.pop();
    }

    function drawStars(nightFactor: number, playerX: number, playerZ: number) {
      if (nightFactor <= 0.01) return;
      p.push();
      p.noStroke();
      const alpha = 255 * nightFactor;
      p.fill(240, 240, 255, alpha);
      // Star size scaled to dome radius so pixel-size stays roughly constant.
      const sz = 0.18;
      for (const s of stars) {
        p.push();
        // Star dome follows the player so the sky always feels full.
        p.translate(playerX + s.x, s.y, playerZ + s.z);
        p.sphere(sz, 6, 4);
        p.pop();
      }
      p.pop();
    }

    function drawSun(sun: Vec3, sunDiameterMi: number) {
      // Render at true scene-scale. A 32-mi sun at 3,000-mi altitude on a
      // 24,900-mi disc is a small bright dot in the sky — that's the point.
      // Toggle "inflate" in controls bumps Ø to 3,000 to make it huge.
      const radius = sunDiameterMi / 2 / FE.discRadiusMi;
      p.push();
      p.noStroke();
      p.fill(255, 238, 168);
      p.translate(sun.x, sun.y, sun.z);
      p.sphere(radius, 24, 16);
      p.pop();
    }

    function drawMoon(sun: Vec3, moon: Vec3, moonDiameterMi: number, fe: boolean) {
      const sdWorld = normalize(sub(sun, moon));
      const radius = moonDiameterMi / 2 / FE.discRadiusMi;
      p.push();
      p.noStroke();
      p.ambientMaterial(255, 255, 255);
      p.translate(moon.x, moon.y, moon.z);
      if (fe) {
        // FE mode: "self-luminous moon, shadowed where the sun's rays hit."
        // High ambient (self-glow baseline) plus a directional light that
        // travels from anti-sun toward sun so the sun-facing side gets no
        // diffuse contribution. To echo "sun snuffs the moon when they're
        // nose-to-nose", fade BOTH contributions to ~black as sun↔moon
        // distance approaches zero — a moon abutting the sun goes dark.
        const prox = Math.max(0, Math.min(1, 1 - dist3(sun, moon) / 0.35));
        const k = 1 - prox * prox; // quadratic falloff so it stays bright until quite close
        p.ambientLight(90 * k, 90 * k, 100 * k);
        p.directionalLight(200 * k, 200 * k, 215 * k, sdWorld.x, sdWorld.y, sdWorld.z);
      } else {
        // Classic astronomy: light travels from sun toward moon; the
        // sun-facing hemisphere is lit.
        p.ambientLight(14, 14, 20);
        p.directionalLight(230, 230, 240, -sdWorld.x, -sdWorld.y, -sdWorld.z);
      }
      p.sphere(radius, 32, 24);
      p.pop();
      p.noLights();
    }

    p.draw = () => {
      const now = p.millis();
      const dt = now - lastMs;
      lastMs = now;

      const store = useScene.getState();
      store.advanceSim(dt);

      const s = useScene.getState();
      const eyeY = Math.max(s.elevationMi / FE.discRadiusMi, 0.003);
      const eye: Vec3 = { x: s.playerX, y: eyeY, z: s.playerZ };
      const sun = sunPos(s.simMs, s.sunAltitudeMi, s.sunLatDeg);
      const moon = moonPos(s.simMs, s.moonAltitudeMi, s.moonLatDeg);

      // Sync yaw/pitch to the current follow target. In 'manual' mode the
      // drag handler owns them, so we leave them untouched.
      if (s.cameraLook !== 'manual') {
        let target: Vec3 | null = null;
        if (s.cameraLook === 'sun') target = sun;
        else if (s.cameraLook === 'moon') target = moon;
        else if (s.cameraLook === 'center') target = { x: 0, y: 0, z: 0 };
        if (target) {
          const toTarget = sub(target, eye);
          const mag = Math.hypot(toTarget.x, toTarget.y, toTarget.z);
          if (mag > 1e-4) {
            const yp = dirToYawPitch(toTarget);
            setCameraView(yp.yaw, yp.pitch);
          }
        }
      }

      const dir = yawPitchToDir(cameraView.yaw, cameraView.pitch);
      const center: Vec3 = {
        x: eye.x + dir.x,
        y: eye.y + dir.y,
        z: eye.z + dir.z,
      };

      p.background(6, 10, 22);
      p.perspective((s.fovDeg * Math.PI) / 180, p.width / p.height, NEAR, FAR);

      // Default up = (0, -1, 0) per p5 Y-flip convention. When looking
      // nearly straight up/down, substitute a horizontal up.
      let ux = 0, uy = -1, uz = 0;
      if (Math.abs(dir.y) > 0.999) {
        ux = 0; uy = 0; uz = 1;
      }
      p.camera(eye.x, eye.y, eye.z, center.x, center.y, center.z, ux, uy, uz);

      const sunDistXZ = Math.hypot(s.playerX - sun.x, s.playerZ - sun.z);
      const night = Math.max(0, Math.min(1, (sunDistXZ - DAY_RADIUS * 0.8) / 0.4));

      drawStars(night, s.playerX, s.playerZ);
      drawGround(sun);
      drawSun(sun, s.sunDiameterMi);
      drawMoon(sun, moon, s.moonDiameterMi, s.moonLightingFE);
    };
  };
}

export function Viewer() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const inst = new p5(makeSketch(ref.current), ref.current);
    return () => {
      inst.remove();
    };
  }, []);

  // Drag-to-look. Any drag switches to 'manual' mode and un-toggles sun/moon
  // follow. We use pointer events on the container so it works on touch too.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let dragging = false;
    let activePointer = -1;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      dragging = true;
      activePointer = e.pointerId;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // ignore capture failures (e.g. synthetic events in tests)
      }
      e.preventDefault();
    };

    const onMove = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== activePointer) return;
      const st = useScene.getState();
      if (st.cameraLook !== 'manual') {
        // The viewer's draw loop keeps cameraView in sync with the follow
        // target; just flip the mode and subsequent drags are additive.
        st.setCameraLook('manual');
      }
      // FPS-look convention: dragging RIGHT turns the view right (yaw +),
      // dragging DOWN tilts up (pitch +). X and Y are both additive.
      addCameraView(e.movementX * DRAG_SENS, e.movementY * DRAG_SENS);
      e.preventDefault();
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== activePointer) return;
      dragging = false;
      activePointer = -1;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, []);

  // WASD / arrow-key walking. Forward vector is derived from camera yaw each
  // frame so movement always feels "toward where I'm looking". A shared rAF
  // loop integrates held keys into store player position.
  useEffect(() => {
    const pressed: Record<string, boolean> = {};

    const isTyping = (t: EventTarget | null) => {
      if (!(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
    };

    const keyFor = (e: KeyboardEvent): string | null => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') return 'fwd';
      if (k === 's' || k === 'arrowdown') return 'back';
      if (k === 'a' || k === 'arrowleft') return 'left';
      if (k === 'd' || k === 'arrowright') return 'right';
      return null;
    };

    const onDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const k = keyFor(e);
      if (!k) return;
      pressed[k] = true;
      e.preventDefault();
    };
    const onUp = (e: KeyboardEvent) => {
      const k = keyFor(e);
      if (!k) return;
      pressed[k] = false;
    };

    let raf = 0;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      const fwd = (pressed.fwd ? 1 : 0) - (pressed.back ? 1 : 0);
      const strafe = (pressed.right ? 1 : 0) - (pressed.left ? 1 : 0);
      if (fwd !== 0 || strafe !== 0) {
        const yaw = cameraView.yaw;
        // Forward-on-ground is the XZ projection of yawPitchToDir(yaw, 0):
        // (cos yaw, 0, sin yaw). Strafe-right is that rotated -90° in XZ.
        const fx = Math.cos(yaw);
        const fz = Math.sin(yaw);
        const rx = Math.sin(yaw);
        const rz = -Math.cos(yaw);
        let nx = useScene.getState().playerX + (fwd * fx + strafe * rx) * WALK_SPEED * dt;
        let nz = useScene.getState().playerZ + (fwd * fz + strafe * rz) * WALK_SPEED * dt;
        const r = Math.hypot(nx, nz);
        if (r > DISC_MAX_R) {
          nx = (nx / r) * DISC_MAX_R;
          nz = (nz / r) * DISC_MAX_R;
        }
        useScene.getState().setPlayer(nx, nz);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-black">
      <div ref={ref} className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing" />
      <Hud />
    </div>
  );
}
