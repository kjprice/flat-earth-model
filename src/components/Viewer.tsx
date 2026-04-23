import { useEffect, useRef } from 'react';
import p5 from 'p5';
import { FE } from '../config/core';
import {
  VIEWER_CAMERA_CONFIG,
  VIEWER_GROUND_CONFIG,
  VIEWER_INTERACTION_CONFIG,
  VIEWER_MOON_CONFIG,
  VIEWER_NIGHT_CONFIG,
  VIEWER_RENDER_CONFIG,
  VIEWER_SKY_CONFIG,
  VIEWER_SUN_CONFIG,
} from '../config/viewer';
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

type Star = { x: number; y: number; z: number };

function makeSketch(container: HTMLDivElement) {
  return (p: p5) => {
    const stars: Star[] = [];
    let lastMs = 0;

    p.setup = () => {
      const w = Math.max(VIEWER_RENDER_CONFIG.minCanvasSizePx, container.clientWidth);
      const h = Math.max(VIEWER_RENDER_CONFIG.minCanvasSizePx, container.clientHeight);
      const canvas = p.createCanvas(w, h, p.WEBGL);
      canvas.parent(container);
      p.setAttributes('antialias', true);
      p.noStroke();

      // ~320 stars on a large hemisphere. We translate them by the player's
      // XZ each frame so the dome always surrounds the observer; a radius
      // much larger than the disc keeps the stars feeling "at infinity".
      const r = VIEWER_SKY_CONFIG.starDomeRadius;
      for (let i = 0; i < VIEWER_SKY_CONFIG.starCount; i++) {
        const theta = p.random(p.TWO_PI);
        const phi = p.acos(p.random(VIEWER_SKY_CONFIG.starPhiRandomMin, 1));
        const sx = r * Math.sin(phi) * Math.cos(theta);
        const sy = r * Math.cos(phi);
        const sz = r * Math.sin(phi) * Math.sin(theta);
        stars.push({ x: sx, y: sy, z: sz });
      }

      lastMs = p.millis();
    };

    p.windowResized = () => {
      p.resizeCanvas(
        Math.max(VIEWER_RENDER_CONFIG.minCanvasSizePx, container.clientWidth),
        Math.max(VIEWER_RENDER_CONFIG.minCanvasSizePx, container.clientHeight),
      );
    };

    function drawGround(sun: Vec3) {
      p.push();
      p.noStroke();

      for (let ri = 0; ri < VIEWER_GROUND_CONFIG.radialSegments; ri++) {
        const r0 = ri / VIEWER_GROUND_CONFIG.radialSegments;
        const r1 = (ri + 1) / VIEWER_GROUND_CONFIG.radialSegments;
        for (let ai = 0; ai < VIEWER_GROUND_CONFIG.angularSegments; ai++) {
          const a0 = (ai / VIEWER_GROUND_CONFIG.angularSegments) * p.TWO_PI;
          const a1 = ((ai + 1) / VIEWER_GROUND_CONFIG.angularSegments) * p.TWO_PI;
          const mx = ((r0 + r1) / 2) * Math.cos((a0 + a1) / 2);
          const mz = ((r0 + r1) / 2) * Math.sin((a0 + a1) / 2);

          const d = Math.hypot(mx - sun.x, mz - sun.z);
          const dayness =
            1 -
            Math.min(
              1,
              Math.max(
                0,
                (d - VIEWER_GROUND_CONFIG.dayRadiusStart) / VIEWER_GROUND_CONFIG.dayFadeDistance,
              ),
            );
          const R =
            VIEWER_GROUND_CONFIG.baseColor[0] +
            VIEWER_GROUND_CONFIG.dayColorBoost[0] * dayness;
          const G =
            VIEWER_GROUND_CONFIG.baseColor[1] +
            VIEWER_GROUND_CONFIG.dayColorBoost[1] * dayness;
          const B =
            VIEWER_GROUND_CONFIG.baseColor[2] +
            VIEWER_GROUND_CONFIG.dayColorBoost[2] * dayness;

          const grid =
            ri % VIEWER_GROUND_CONFIG.gridRadialStride === 0 ||
            ai % VIEWER_GROUND_CONFIG.gridAngularStride === 0
              ? VIEWER_GROUND_CONFIG.gridBoost
              : 0;

          p.fill(R + grid, G + grid, B + grid);

          const x00 = r0 * Math.cos(a0);
          const z00 = r0 * Math.sin(a0);
          const x01 = r0 * Math.cos(a1);
          const z01 = r0 * Math.sin(a1);
          const x10 = r1 * Math.cos(a0);
          const z10 = r1 * Math.sin(a0);
          const x11 = r1 * Math.cos(a1);
          const z11 = r1 * Math.sin(a1);

          p.beginShape();
          p.vertex(x00, 0, z00);
          p.vertex(x10, 0, z10);
          p.vertex(x11, 0, z11);
          p.vertex(x01, 0, z01);
          p.endShape(p.CLOSE);
        }
      }

      // Disc edge wall — short thin lip so the rim reads from any angle.
      p.fill(
        VIEWER_GROUND_CONFIG.rimColor[0],
        VIEWER_GROUND_CONFIG.rimColor[1],
        VIEWER_GROUND_CONFIG.rimColor[2],
      );
      for (let i = 0; i < VIEWER_GROUND_CONFIG.rimSegments; i++) {
        const a0 = (i / VIEWER_GROUND_CONFIG.rimSegments) * p.TWO_PI;
        const a1 = ((i + 1) / VIEWER_GROUND_CONFIG.rimSegments) * p.TWO_PI;
        const x0 = Math.cos(a0);
        const z0 = Math.sin(a0);
        const x1 = Math.cos(a1);
        const z1 = Math.sin(a1);
        p.beginShape();
        p.vertex(x0, 0, z0);
        p.vertex(x1, 0, z1);
        p.vertex(x1, VIEWER_GROUND_CONFIG.rimHeight, z1);
        p.vertex(x0, VIEWER_GROUND_CONFIG.rimHeight, z0);
        p.endShape(p.CLOSE);
      }

      p.pop();
    }

    function drawStars(nightFactor: number, playerX: number, playerZ: number) {
      if (nightFactor <= VIEWER_SKY_CONFIG.nightVisibilityMin) return;
      p.push();
      p.noStroke();
      const alpha = 255 * nightFactor;
      p.fill(240, 240, 255, alpha);
      for (const s of stars) {
        p.push();
        p.translate(playerX + s.x, s.y, playerZ + s.z);
        p.sphere(VIEWER_SKY_CONFIG.starSizeSceneUnits, 6, 4);
        p.pop();
      }
      p.pop();
    }

    function drawSun(sun: Vec3, sunDiameterMi: number) {
      // Render at true scene-scale. A 32-mi sun at 3,000-mi altitude on a
      // 24,900-mi disc is a small bright dot in the sky — that's the point.
      const radius = sunDiameterMi / 2 / FE.discRadiusMi;
      p.push();
      p.noStroke();
      p.fill(
        VIEWER_SUN_CONFIG.color[0],
        VIEWER_SUN_CONFIG.color[1],
        VIEWER_SUN_CONFIG.color[2],
      );
      p.translate(sun.x, sun.y, sun.z);
      p.sphere(radius, VIEWER_SUN_CONFIG.sphereDetail[0], VIEWER_SUN_CONFIG.sphereDetail[1]);
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
        // Fade both contributions toward black as sun↔moon distance shrinks.
        const prox = Math.max(
          0,
          Math.min(1, 1 - dist3(sun, moon) / VIEWER_MOON_CONFIG.feLightingDistance),
        );
        const k = 1 - prox * prox;
        p.ambientLight(
          VIEWER_MOON_CONFIG.feAmbientLight[0] * k,
          VIEWER_MOON_CONFIG.feAmbientLight[1] * k,
          VIEWER_MOON_CONFIG.feAmbientLight[2] * k,
        );
        p.directionalLight(
          VIEWER_MOON_CONFIG.feDirectionalLight[0] * k,
          VIEWER_MOON_CONFIG.feDirectionalLight[1] * k,
          VIEWER_MOON_CONFIG.feDirectionalLight[2] * k,
          sdWorld.x,
          sdWorld.y,
          sdWorld.z,
        );
      } else {
        p.ambientLight(
          VIEWER_MOON_CONFIG.classicAmbientLight[0],
          VIEWER_MOON_CONFIG.classicAmbientLight[1],
          VIEWER_MOON_CONFIG.classicAmbientLight[2],
        );
        p.directionalLight(
          VIEWER_MOON_CONFIG.classicDirectionalLight[0],
          VIEWER_MOON_CONFIG.classicDirectionalLight[1],
          VIEWER_MOON_CONFIG.classicDirectionalLight[2],
          -sdWorld.x,
          -sdWorld.y,
          -sdWorld.z,
        );
      }
      p.sphere(
        radius,
        VIEWER_MOON_CONFIG.sphereDetail[0],
        VIEWER_MOON_CONFIG.sphereDetail[1],
      );
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
      const eyeY = Math.max(
        s.elevationMi / FE.discRadiusMi,
        VIEWER_CAMERA_CONFIG.minEyeHeightScene,
      );
      const eye: Vec3 = { x: s.playerX, y: eyeY, z: s.playerZ };
      const sun = sunPos(s.simMs, s.sunAltitudeMi, s.sunLatDeg);
      const moon = moonPos(s.simMs, s.moonAltitudeMi, s.moonLatDeg);

      if (s.cameraLook !== 'manual') {
        let target: Vec3 | null = null;
        if (s.cameraLook === 'sun') target = sun;
        else if (s.cameraLook === 'moon') target = moon;
        else if (s.cameraLook === 'center') target = VIEWER_CAMERA_CONFIG.centerTarget;
        if (target) {
          const toTarget = sub(target, eye);
          const mag = Math.hypot(toTarget.x, toTarget.y, toTarget.z);
          if (mag > VIEWER_CAMERA_CONFIG.targetLookMinDistance) {
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

      p.background(
        VIEWER_RENDER_CONFIG.backgroundColor[0],
        VIEWER_RENDER_CONFIG.backgroundColor[1],
        VIEWER_RENDER_CONFIG.backgroundColor[2],
      );
      p.perspective(
        (s.fovDeg * Math.PI) / 180,
        p.width / p.height,
        VIEWER_RENDER_CONFIG.perspectiveNear,
        VIEWER_RENDER_CONFIG.perspectiveFar,
      );

      let [ux, uy, uz] = VIEWER_CAMERA_CONFIG.defaultUp;
      if (Math.abs(dir.y) > VIEWER_CAMERA_CONFIG.verticalDirectionThreshold) {
        [ux, uy, uz] = VIEWER_CAMERA_CONFIG.fallbackUp;
      }
      p.camera(eye.x, eye.y, eye.z, center.x, center.y, center.z, ux, uy, uz);

      const sunDistXZ = Math.hypot(s.playerX - sun.x, s.playerZ - sun.z);
      const night = Math.max(
        0,
        Math.min(
          1,
          (sunDistXZ - VIEWER_NIGHT_CONFIG.startRadius) / VIEWER_NIGHT_CONFIG.fadeDistance,
        ),
      );

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
        st.setCameraLook('manual');
      }
      addCameraView(
        e.movementX * VIEWER_INTERACTION_CONFIG.dragSensitivityRadPerPx,
        e.movementY * VIEWER_INTERACTION_CONFIG.dragSensitivityRadPerPx,
      );
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
      const dt = Math.min(VIEWER_INTERACTION_CONFIG.maxWalkStepSec, (now - last) / 1000);
      last = now;

      const fwd = (pressed.fwd ? 1 : 0) - (pressed.back ? 1 : 0);
      const strafe = (pressed.right ? 1 : 0) - (pressed.left ? 1 : 0);
      if (fwd !== 0 || strafe !== 0) {
        const yaw = cameraView.yaw;
        const fx = Math.cos(yaw);
        const fz = Math.sin(yaw);
        const rx = Math.sin(yaw);
        const rz = -Math.cos(yaw);
        let nx =
          useScene.getState().playerX +
          (fwd * fx + strafe * rx) * VIEWER_INTERACTION_CONFIG.walkSpeedSceneUnitsPerSec * dt;
        let nz =
          useScene.getState().playerZ +
          (fwd * fz + strafe * rz) * VIEWER_INTERACTION_CONFIG.walkSpeedSceneUnitsPerSec * dt;
        const r = Math.hypot(nx, nz);
        if (r > VIEWER_INTERACTION_CONFIG.discMaxRadius) {
          nx = (nx / r) * VIEWER_INTERACTION_CONFIG.discMaxRadius;
          nz = (nz / r) * VIEWER_INTERACTION_CONFIG.discMaxRadius;
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
