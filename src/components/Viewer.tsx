import { useEffect, useRef } from 'react';
import p5 from 'p5';
import {
  DAY_RADIUS,
  FE,
  FIRMAMENT_HEIGHT,
  MOON_RADIUS,
  SUN_RADIUS,
} from '../constants';
import { cross, moonPos, normalize, sub, sunPos, type Vec3 } from '../scene';
import { useScene } from '../state/store';
import { Hud } from './Hud';

// p5 clamps perspective near <= 0.0001 to 0.01 and spams the console. 0.001
// is the smallest value that survives the clamp; at our normalized scale
// (disc radius = 1.0), that corresponds to ~12 miles — plenty fine for a
// ground-level viewer.
const NEAR = 0.001;
const FAR = 500;
const FOVY = Math.PI / 3;

type Star = { x: number; y: number; z: number };

function makeSketch(container: HTMLDivElement) {
  return (p: p5) => {
    const stars: Star[] = [];
    let lastMs = 0;

    // Camera basis (used to build camera-facing billboards for sun/moon).
    const camRight: Vec3 = { x: 1, y: 0, z: 0 };
    const camUp: Vec3 = { x: 0, y: 1, z: 0 };
    const camFwd: Vec3 = { x: 0, y: 0, z: -1 };


    p.setup = () => {
      const w = Math.max(2, container.clientWidth);
      const h = Math.max(2, container.clientHeight);
      const canvas = p.createCanvas(w, h, p.WEBGL);
      canvas.parent(container);
      p.setAttributes('antialias', true);
      p.noStroke();

      // ~320 stars on inner hemisphere (+Y = up in p5 WEBGL).
      const r = FIRMAMENT_HEIGHT * 0.985;
      for (let i = 0; i < 320; i++) {
        const theta = p.random(p.TWO_PI);
        const phi = p.acos(p.random(0.01, 1));
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

    function updateCamBasis(eye: Vec3, center: Vec3) {
      const f = normalize(sub(center, eye));
      const worldUp: Vec3 = { x: 0, y: 1, z: 0 };
      let r = cross(f, worldUp);
      if (Math.hypot(r.x, r.y, r.z) < 1e-5) {
        r = { x: 1, y: 0, z: 0 };
      }
      r = normalize(r);
      const u = normalize(cross(r, f));
      camFwd.x = f.x; camFwd.y = f.y; camFwd.z = f.z;
      camRight.x = r.x; camRight.y = r.y; camRight.z = r.z;
      camUp.x = u.x; camUp.y = u.y; camUp.z = u.z;
    }

    function drawGround(sun: Vec3, playerNightFactor: number) {
      // Subdivided disc with per-triangle fill based on midpoint distance to sun XZ.
      // Radial × angular grid. Day triangles get a warm green; night triangles a deep blue.
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

          // Grid highlight every 5 rings and every 6 spokes.
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

      // Disc edge wall — a short thin lip so the disc edge reads from any angle.
      // +Y = up, so a positive Y lip is "ice wall" sticking up.
      p.fill(210, 220, 235);
      const N = 96;
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * p.TWO_PI;
        const a1 = ((i + 1) / N) * p.TWO_PI;
        const x0 = Math.cos(a0), z0 = Math.sin(a0);
        const x1 = Math.cos(a1), z1 = Math.sin(a1);
        const H = 0.008; // ~100 mi lip — purely visual
        p.beginShape();
        p.vertex(x0, 0, z0);
        p.vertex(x1, 0, z1);
        p.vertex(x1, H, z1);
        p.vertex(x0, H, z0);
        p.endShape(p.CLOSE);
      }

      p.pop();
      // avoid unused
      void playerNightFactor;
    }

    function drawStars(nightFactor: number) {
      if (nightFactor <= 0.01) return;
      p.push();
      p.noStroke();
      const alpha = 255 * nightFactor;
      p.fill(240, 240, 255, alpha);
      const sz = 0.003;
      for (const s of stars) {
        p.push();
        p.translate(s.x, s.y, s.z);
        p.box(sz);
        p.pop();
      }
      p.pop();
    }

    function drawSun(sun: Vec3) {
      // Scaled by a visual multiplier — true angular size (~0.15°) is < a pixel.
      // Sphere is robust to depth-test and billboard-normal issues in p5 WEBGL.
      p.push();
      p.noStroke();
      p.fill(255, 238, 168);
      p.translate(sun.x, sun.y, sun.z);
      p.sphere(SUN_RADIUS * 40, 24, 16);
      p.pop();
    }

    function drawMoon(sun: Vec3, moon: Vec3) {
      // Draw the moon as a real 3D sphere lit by a directional light coming from
      // the sun's position. This produces accurate phase shading (the terminator
      // emerges geometrically from sphere normal · sun direction). The flat-earth
      // model pretends the moon is a disc — we render it as a sphere to make the
      // famous lighting contradiction vivid: observe that the sun/moon altitudes
      // and orbit geometry cannot produce these phases on a flat disc model.
      const sdWorld = normalize(sub(sun, moon));
      // p5's directionalLight wants the direction the light TRAVELS (away from
      // source). Light comes from the sun, so direction = -sdWorld.
      p.push();
      p.ambientLight(14, 14, 20);
      p.directionalLight(230, 230, 240, -sdWorld.x, -sdWorld.y, -sdWorld.z);
      p.noStroke();
      p.ambientMaterial(255, 255, 255);
      p.translate(moon.x, moon.y, moon.z);
      p.sphere(MOON_RADIUS * 40, 32, 24);
      p.pop();
      p.noLights();
    }

    p.draw = () => {
      const now = p.millis();
      const dt = now - lastMs;
      lastMs = now;
      useScene.getState().advanceT(dt);

      const s = useScene.getState();
      // Minimum eye height so the camera never sits exactly on the ground plane
      // (which would render the disc edge-on as zero-area). 0.003 scene units
      // ≈ 37 mi — small relative to the disc but large enough to avoid
      // degeneracy at our NEAR clip.
      const eyeY = Math.max(s.elevationMi / FE.discRadiusMi, 0.003);
      const eye: Vec3 = { x: s.playerX, y: eyeY, z: s.playerZ };
      const sun = sunPos(s.t);
      const moon = moonPos(s.t);

      p.background(6, 10, 22);
      p.perspective(FOVY, p.width / p.height, NEAR, FAR);

      // p5 WEBGL display convention: +Y maps to BOTTOM of screen. To make
      // "world +Y" (our sky direction) appear at the TOP of the canvas we
      // pass up=(0,-1,0) to camera() — the p5 internal flip then renders
      // +Y world correctly at the top.
      if (s.cameraLook === 'free') {
        p.camera(0.8, 0.5, 1.8, 0, 0, 0, 0, -1, 0);
        p.orbitControl(1, 1, 0.1);
        updateCamBasis(eye, { x: 0, y: 0, z: 0 });
      } else {
        let center: Vec3 = { x: 0, y: 0, z: 0 };
        if (s.cameraLook === 'sun') center = sun;
        else if (s.cameraLook === 'moon') center = moon;
        // Lift eye a nano-step so looking horizontally along the ground plane
        // doesn't produce a degenerate view direction.
        p.camera(eye.x, eye.y + 1e-5, eye.z, center.x, center.y, center.z, 0, -1, 0);
        updateCamBasis(eye, center);
      }

      const sunDistXZ = Math.hypot(s.playerX - sun.x, s.playerZ - sun.z);
      const night = Math.max(0, Math.min(1, (sunDistXZ - DAY_RADIUS * 0.8) / 0.4));

      drawStars(night);
      drawGround(sun, night);
      drawSun(sun);
      drawMoon(sun, moon);
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

  return (
    <div className="relative w-full h-full bg-black">
      <div ref={ref} className="absolute inset-0" />
      <Hud />
    </div>
  );
}
