import { useEffect, useRef, useState } from 'react';
import p5 from 'p5';
import { FE, GLOBE } from '../config/core';
import { LANDMARKS, type Landmark } from '../config/landmarks';
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
  add,
  cross,
  dirToYawPitch,
  dot,
  dist3,
  eyeHeightScene,
  effectiveMoonPos,
  globeBodyRenderRadiusScene,
  globeMoonPosition,
  globeObserverPosition,
  globeObserverSurfaceNormal,
  globeSunPosition,
  globeUnitToLatLon,
  inverseSquareRelativeIntensity,
  landmarkGroundPosition,
  landmarkLookTarget,
  latLonToGlobeScene,
  latLonToGlobeUnit,
  normalize,
  scale,
  sub,
  sunPos,
  yawPitchToDir,
  type Vec3,
} from '../scene';
import { addCameraView, cameraView, setCameraView } from '../state/cameraView';
import { useScene, type CameraLook } from '../state/store';
import { Hud } from './Hud';

type Star = { x: number; y: number; z: number; brightness: number; sizePx: number };
type PerspectiveAuditData = {
  horizonY: number;
  elevationDeg: number;
  angularDeg: number;
  sizeRatio: number;
  sunDistanceMi: number;
  horizontalMi: number;
  width: number;
  height: number;
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function angularSizeDeg(diameterMi: number, distanceSceneUnits: number): number {
  const radiusScene = diameterMi / 2 / FE.discRadiusMi;
  return (2 * Math.atan(radiusScene / Math.max(1e-9, distanceSceneUnits)) * 180) / Math.PI;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function targetForCameraLook(
  look: CameraLook,
  sun: Vec3,
  moon: Vec3,
): Vec3 | null {
  if (look === 'sun') return sun;
  if (look === 'moon') return moon;
  if (look === 'center') return VIEWER_CAMERA_CONFIG.centerTarget;
  if (look === 'manual') return null;
  return landmarkLookTarget(look);
}

function globeLandmarkPosition(landmark: Landmark, heightMi = landmark.heightMi): Vec3 {
  return scale(
    latLonToGlobeUnit(landmark.latDeg, landmark.lonDeg),
    GLOBE.earthRadiusScene + heightMi / GLOBE.earthRadiusMi,
  );
}

function targetForGlobeCameraLook(
  look: CameraLook,
  eye: Vec3,
  sun: Vec3,
  moon: Vec3,
): Vec3 | null {
  const normal = normalize(eye);
  if (look === 'sun') return globeVisibleOrHorizonTarget(eye, normal, sun, GLOBE.sunDiameterMi, GLOBE.sunDistanceMi);
  if (look === 'moon') return globeVisibleOrHorizonTarget(eye, normal, moon, GLOBE.moonDiameterMi, GLOBE.moonDistanceMi);
  if (look === 'center') {
    return Math.hypot(eye.x, eye.y, eye.z) > GLOBE.earthRadiusScene * 1.2
      ? { x: 0, y: 0, z: 0 }
      : add(eye, globeLocalBasis(eye).north);
  }
  if (look === 'manual') return null;
  const landmark = LANDMARKS.find((candidate) => candidate.id === look);
  return landmark ? globeLandmarkPosition(landmark, landmark.heightMi * 2) : null;
}

function globeLocalBasis(normalLike: Vec3): { normal: Vec3; east: Vec3; north: Vec3 } {
  const normal = normalize(normalLike);
  let east = normalize(cross({ x: 0, y: 1, z: 0 }, normal));
  if (Math.hypot(east.x, east.y, east.z) < 1e-6) {
    east = { x: 1, y: 0, z: 0 };
  }
  const north = normalize(cross(normal, east));
  return { normal, east, north };
}

function yawPitchToGlobeDir(yaw: number, pitch: number, normalLike: Vec3): Vec3 {
  const { normal, east, north } = globeLocalBasis(normalLike);
  const cp = Math.cos(pitch);
  return normalize(
    add(
      add(scale(east, Math.cos(yaw) * cp), scale(north, Math.sin(yaw) * cp)),
      scale(normal, Math.sin(pitch)),
    ),
  );
}

function dirToGlobeYawPitch(dir: Vec3, normalLike: Vec3): { yaw: number; pitch: number } {
  const { normal, east, north } = globeLocalBasis(normalLike);
  const d = normalize(dir);
  const up = dot(d, normal);
  const tangent = normalize(sub(d, scale(normal, up)));
  return {
    yaw: Math.atan2(dot(tangent, north), dot(tangent, east)),
    pitch: Math.asin(Math.max(-1, Math.min(1, up))),
  };
}

function moveOnGlobe(playerX: number, playerZ: number, tangentDir: Vec3, angularStep: number) {
  const normal = globeObserverSurfaceNormal(playerX, playerZ);
  const tangent = normalize(sub(tangentDir, scale(normal, dot(tangentDir, normal))));
  if (Math.hypot(tangent.x, tangent.y, tangent.z) < 1e-6) return { x: playerX, z: playerZ };
  const nextNormal = normalize(
    add(scale(normal, Math.cos(angularStep)), scale(tangent, Math.sin(angularStep))),
  );
  const nextLatLon = globeUnitToLatLon(nextNormal);
  return latLonToGlobeScene(nextLatLon.latDeg, nextLatLon.lonDeg);
}

function globeBodyElevationDeg(eye: Vec3, normal: Vec3, body: Vec3): number {
  return (Math.asin(dot(normalize(sub(body, eye)), normal)) * 180) / Math.PI;
}

function globeAngularRadiusDeg(diameterMi: number, distanceMi: number): number {
  return (Math.atan((diameterMi / 2) / Math.max(1e-9, distanceMi)) * 180) / Math.PI;
}

function globeBodyVisibleFromSurface(
  eye: Vec3,
  normal: Vec3,
  body: Vec3,
  diameterMi: number,
  distanceMi: number,
): boolean {
  const eyeAltitudeScene = Math.hypot(eye.x, eye.y, eye.z) - GLOBE.earthRadiusScene;
  if (eyeAltitudeScene > 100 / GLOBE.earthRadiusMi) return globeLineOfSightClearsEarth(eye, body);
  return globeBodyElevationDeg(eye, normal, body) >= -globeAngularRadiusDeg(diameterMi, distanceMi);
}

function globeLineOfSightClearsEarth(eye: Vec3, body: Vec3): boolean {
  const toBody = sub(body, eye);
  const distance = Math.hypot(toBody.x, toBody.y, toBody.z);
  if (distance <= 1e-9) return true;
  const dir = scale(toBody, 1 / distance);
  const closestT = -dot(eye, dir);
  if (closestT <= 0 || closestT >= distance) return true;
  const closest = add(eye, scale(dir, closestT));
  return Math.hypot(closest.x, closest.y, closest.z) > GLOBE.earthRadiusScene;
}

function globeVisibleOrHorizonTarget(
  eye: Vec3,
  normal: Vec3,
  body: Vec3,
  diameterMi: number,
  distanceMi: number,
): Vec3 {
  if (globeBodyVisibleFromSurface(eye, normal, body, diameterMi, distanceMi)) return body;

  const bodyDir = normalize(sub(body, eye));
  let tangent = normalize(sub(bodyDir, scale(normal, dot(bodyDir, normal))));
  if (Math.hypot(tangent.x, tangent.y, tangent.z) < 1e-6) {
    tangent = globeLocalBasis(normal).north;
  }
  return add(eye, add(scale(tangent, 1), scale(normal, 0.01)));
}

function globeDayFactor(eye: Vec3, normal: Vec3, sun: Vec3): number {
  const altitudeMi =
    (Math.hypot(eye.x, eye.y, eye.z) - GLOBE.earthRadiusScene) * GLOBE.earthRadiusMi;
  const atmosphereFactor = clamp01(1 - altitudeMi / VIEWER_SKY_CONFIG.globeAtmosphereFadeEndMi);
  const sunAltitudeSin = Math.sin((globeBodyElevationDeg(eye, normal, sun) * Math.PI) / 180);
  return atmosphereFactor * clamp01(
    (sunAltitudeSin - VIEWER_SKY_CONFIG.globeDayFadeStartSin) /
      (VIEWER_SKY_CONFIG.globeDayFadeEndSin - VIEWER_SKY_CONFIG.globeDayFadeStartSin),
  );
}

function globeInSpace(eye: Vec3): boolean {
  const altitudeMi =
    (Math.hypot(eye.x, eye.y, eye.z) - GLOBE.earthRadiusScene) * GLOBE.earthRadiusMi;
  return altitudeMi >= VIEWER_SKY_CONFIG.globeAtmosphereFadeEndMi;
}

function globeAltitudeMi(eye: Vec3): number {
  return Math.max(0, (Math.hypot(eye.x, eye.y, eye.z) - GLOBE.earthRadiusScene) * GLOBE.earthRadiusMi);
}

function buildPerspectiveAuditData(width: number, height: number): PerspectiveAuditData | null {
  const s = useScene.getState();
  if (s.model === 'globe' || !s.perspectiveAuditVisible || width <= 0 || height <= 0) return null;

  const eye: Vec3 = {
    x: s.playerX,
    y: eyeHeightScene(s.elevationMi),
    z: s.playerZ,
  };
  const sun = sunPos(s.simMs, s.sunAltitudeMi, s.sunLatDeg);
  const moon = effectiveMoonPos(s.simMs, s.moonAltitudeMi, s.moonLatDeg, s.shaneMoonOrbit);
  let forward = yawPitchToDir(cameraView.yaw, cameraView.pitch);
  if (s.cameraLook !== 'manual') {
    const target = targetForCameraLook(s.cameraLook, sun, moon);
    if (target) {
      const toTarget = sub(target, eye);
      const mag = Math.hypot(toTarget.x, toTarget.y, toTarget.z);
      if (mag > VIEWER_CAMERA_CONFIG.targetLookMinDistance) {
        forward = normalize(toTarget);
      }
    }
  }
  const view = dirToYawPitch(forward);
  const horizonY =
    height / 2 + (Math.tan(view.pitch) * height) / 2 / Math.tan((s.fovDeg * Math.PI) / 360);
  const sunDistanceScene = dist3(eye, sun);
  const sunDistanceMi = sunDistanceScene * FE.discRadiusMi;
  const horizontalMi = Math.hypot(eye.x - sun.x, eye.z - sun.z) * FE.discRadiusMi;
  const heightMi = sun.y * FE.discRadiusMi - eye.y * FE.discRadiusMi;
  const elevationDeg = (Math.atan2(heightMi, horizontalMi) * 180) / Math.PI;
  const angularDeg = angularSizeDeg(s.sunDiameterMi, sunDistanceScene);
  const overheadAngularDeg = angularSizeDeg(s.sunDiameterMi, s.sunAltitudeMi / FE.discRadiusMi);
  const sizeRatio = overheadAngularDeg > 0 ? angularDeg / overheadAngularDeg : 0;

  return {
    horizonY,
    elevationDeg,
    angularDeg,
    sizeRatio,
    sunDistanceMi,
    horizontalMi,
    width,
    height,
  };
}

function makeSketch(container: HTMLDivElement) {
  return (p: p5) => {
    const stars: Star[] = [];
    let groundMap: p5.Image | null = null;
    let groundTexture: p5.Graphics | null = null;
    let groundLightTexture: p5.Graphics | null = null;
    let earthTexture: p5.Image | p5.Graphics | null = null;
    let lastMs = 0;

    p.setup = () => {
      const w = Math.max(VIEWER_RENDER_CONFIG.minCanvasSizePx, container.clientWidth);
      const h = Math.max(VIEWER_RENDER_CONFIG.minCanvasSizePx, container.clientHeight);
      const canvas = p.createCanvas(w, h, p.WEBGL);
      canvas.parent(container);
      p.setAttributes('antialias', true);
      p.noStroke();
      p.loadImage(`${import.meta.env.BASE_URL}map.jpg`, (img) => {
        groundMap = img;
      });
      groundTexture = p.createGraphics(
        VIEWER_GROUND_CONFIG.textureRenderSizePx,
        VIEWER_GROUND_CONFIG.textureRenderSizePx,
      );
      groundLightTexture = p.createGraphics(
        VIEWER_GROUND_CONFIG.textureRenderSizePx,
        VIEWER_GROUND_CONFIG.textureRenderSizePx,
      );
      earthTexture = createEarthTexture();
      p.loadImage(`${import.meta.env.BASE_URL}earth-blue-marble.jpg`, (img) => {
        earthTexture = img;
      });

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
        stars.push({
          x: sx,
          y: sy,
          z: sz,
          brightness: p.random(0.45, 1),
          sizePx: p.random(
            VIEWER_SKY_CONFIG.globeStarMinPointPx,
            VIEWER_SKY_CONFIG.globeStarMaxPointPx,
          ),
        });
      }

      lastMs = p.millis();
    };

    p.windowResized = () => {
      p.resizeCanvas(
        Math.max(VIEWER_RENDER_CONFIG.minCanvasSizePx, container.clientWidth),
        Math.max(VIEWER_RENDER_CONFIG.minCanvasSizePx, container.clientHeight),
      );
    };

    function drawGroundRim() {
      p.push();
      p.noStroke();
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

    function applyBodyLight(
      body: Vec3,
      radiusStart: number,
      fadeDistance: number,
      textureAlphaMax: number,
      glowColor: readonly [number, number, number],
      glowAlphaMax: number,
      strength: number,
    ) {
      if (!groundMap || !groundTexture || !groundLightTexture || strength <= 0) return;

      const bodyPx = (0.5 + body.x / 2) * groundTexture.width;
      const bodyPy = (0.5 - body.z / 2) * groundTexture.height;
      const inner = radiusStart * (groundTexture.width / 2);
      const outer = (radiusStart + fadeDistance) * (groundTexture.width / 2);

      groundLightTexture.clear();
      groundLightTexture.image(
        groundMap,
        0,
        0,
        groundLightTexture.width,
        groundLightTexture.height,
      );
      const lightCtx = groundLightTexture.drawingContext as CanvasRenderingContext2D;
      lightCtx.save();
      lightCtx.globalCompositeOperation = 'destination-in';
      const reveal = lightCtx.createRadialGradient(bodyPx, bodyPy, inner, bodyPx, bodyPy, outer);
      reveal.addColorStop(0, `rgba(255, 255, 255, ${(textureAlphaMax * strength) / 255})`);
      reveal.addColorStop(0.65, `rgba(255, 255, 255, ${(textureAlphaMax * strength * 0.45) / 255})`);
      reveal.addColorStop(1, 'rgba(255, 255, 255, 0)');
      lightCtx.fillStyle = reveal;
      lightCtx.fillRect(0, 0, groundLightTexture.width, groundLightTexture.height);
      lightCtx.restore();

      groundTexture.image(
        groundLightTexture,
        0,
        0,
        groundTexture.width,
        groundTexture.height,
      );

      const ctx = groundTexture.drawingContext as CanvasRenderingContext2D;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(bodyPx, bodyPy, inner, bodyPx, bodyPy, outer);
      glow.addColorStop(
        0,
        `rgba(${glowColor[0]}, ${glowColor[1]}, ${glowColor[2]}, ${(glowAlphaMax * strength) / 255})`,
      );
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, groundTexture.width, groundTexture.height);
      ctx.restore();
    }

    function moonSeparationStrength(
      sun: Vec3,
      moon: Vec3,
      minStrength: number,
      power: number,
    ): number {
      const separation = clamp01(
        dist3(sun, moon) / VIEWER_MOON_CONFIG.lightStrengthDistanceMax,
      );
      return minStrength + (1 - minStrength) * Math.pow(separation, power);
    }

    function moonVisibleStrength(sun: Vec3, moon: Vec3): number {
      return moonSeparationStrength(
        sun,
        moon,
        VIEWER_MOON_CONFIG.visibleStrengthMin,
        VIEWER_MOON_CONFIG.visibleStrengthPower,
      );
    }

    function moonGroundLightStrength(sun: Vec3, moon: Vec3): number {
      return moonSeparationStrength(
        sun,
        moon,
        VIEWER_MOON_CONFIG.groundLightStrengthMin,
        VIEWER_MOON_CONFIG.groundLightStrengthPower,
      );
    }

    function bodyLightStrength(eye: Vec3, body: Vec3, referenceDistanceMi: number): number {
      return clamp01(
        inverseSquareRelativeIntensity(dist3(eye, body) * FE.discRadiusMi, referenceDistanceMi),
      );
    }

    function drawLandmark(landmark: Landmark) {
      const ground = landmarkGroundPosition(landmark);
      const height = landmark.heightMi / FE.discRadiusMi;
      const radius = landmark.footprintRadiusMi / FE.discRadiusMi;

      p.push();
      p.noStroke();
      p.emissiveMaterial(landmark.color[0], landmark.color[1], landmark.color[2]);

      if (landmark.kind === 'mountain') {
        p.translate(ground.x, height / 2, ground.z);
        p.cone(radius, height, 5, 1);
      } else {
        p.translate(ground.x, height / 2, ground.z);
        p.box(radius, height, radius);
      }

      p.pop();
    }

    function drawLandmarks() {
      for (const landmark of LANDMARKS) {
        drawLandmark(landmark);
      }
    }

    function createEarthTexture() {
      const tex = p.createGraphics(2048, 1024);
      const px = (lonDeg: number) => ((lonDeg + 180) / 360) * tex.width;
      const py = (latDeg: number) => ((90 - latDeg) / 180) * tex.height;
      const poly = (points: Array<[number, number]>) => {
        tex.beginShape();
        points.forEach(([lon, lat]) => tex.vertex(px(lon), py(lat)));
        tex.endShape(p.CLOSE);
      };

      tex.background(20, 76, 132);
      tex.noStroke();
      tex.fill(58, 132, 83);
      poly([
        [-168, 72],
        [-130, 70],
        [-62, 52],
        [-52, 28],
        [-82, 8],
        [-116, 18],
        [-124, 42],
      ]);
      poly([
        [-82, 12],
        [-50, 2],
        [-42, -24],
        [-68, -55],
        [-82, -28],
      ]);
      poly([
        [-12, 72],
        [48, 72],
        [148, 56],
        [164, 22],
        [92, 6],
        [42, 32],
        [14, 32],
        [-10, 38],
      ]);
      poly([
        [-18, 34],
        [34, 34],
        [52, 8],
        [30, -34],
        [12, -36],
        [-8, 4],
      ]);
      poly([
        [112, -10],
        [154, -12],
        [150, -42],
        [114, -36],
      ]);
      tex.fill(236, 238, 232);
      tex.rect(0, py(-62), tex.width, tex.height - py(-62));

      tex.stroke(255, 255, 255, 42);
      tex.strokeWeight(1);
      for (let lon = -180; lon <= 180; lon += 15) {
        tex.line(px(lon), 0, px(lon), tex.height);
      }
      for (let lat = -75; lat <= 75; lat += 15) {
        tex.line(0, py(lat), tex.width, py(lat));
      }

      return tex;
    }

    function updateGroundTexture(
      sunAwayFactor: number,
      sun: Vec3,
      moon: Vec3,
      sunStrength: number,
      moonStrength: number,
    ) {
      if (!groundMap || !groundTexture || !groundLightTexture) return;

      const ambientBrightness = lerp(
        VIEWER_GROUND_CONFIG.textureAmbientBrightnessNearSun,
        VIEWER_GROUND_CONFIG.textureAmbientBrightnessFarSun,
        sunAwayFactor,
      );
      const darknessAlpha = clamp01((255 - ambientBrightness) / 255) * 255;

      groundTexture.clear();
      groundTexture.image(groundMap, 0, 0, groundTexture.width, groundTexture.height);
      groundTexture.push();
      groundTexture.noStroke();
      groundTexture.fill(0, 0, 0, darknessAlpha);
      groundTexture.rect(0, 0, groundTexture.width, groundTexture.height);
      groundTexture.pop();

      applyBodyLight(
        sun,
        VIEWER_GROUND_CONFIG.sunRadiusStart,
        VIEWER_GROUND_CONFIG.sunFadeDistance,
        VIEWER_GROUND_CONFIG.sunTextureAlphaMax,
        VIEWER_GROUND_CONFIG.sunColorBoost,
        VIEWER_GROUND_CONFIG.sunGlowAlphaMax,
        sunStrength,
      );
      applyBodyLight(
        moon,
        VIEWER_GROUND_CONFIG.moonRadiusStart,
        VIEWER_GROUND_CONFIG.moonFadeDistance,
        VIEWER_GROUND_CONFIG.moonTextureAlphaMax,
        VIEWER_GROUND_CONFIG.moonColorBoost,
        VIEWER_GROUND_CONFIG.moonGlowAlphaMax,
        moonStrength,
      );
    }

    function drawTexturedGround() {
      if (!groundTexture) return;

      p.push();
      p.noStroke();
      p.textureMode(p.NORMAL);
      p.texture(groundTexture);
      p.beginShape(p.TRIANGLES);
      for (let i = 0; i < VIEWER_GROUND_CONFIG.texturedAngularSegments; i++) {
        const a0 = (i / VIEWER_GROUND_CONFIG.texturedAngularSegments) * p.TWO_PI;
        const a1 = ((i + 1) / VIEWER_GROUND_CONFIG.texturedAngularSegments) * p.TWO_PI;
        const x0 = Math.cos(a0);
        const z0 = Math.sin(a0);
        const x1 = Math.cos(a1);
        const z1 = Math.sin(a1);

        p.vertex(0, 0, 0, 0.5, 0.5);
        p.vertex(x0, 0, z0, 0.5 + x0 / 2, 0.5 - z0 / 2);
        p.vertex(x1, 0, z1, 0.5 + x1 / 2, 0.5 - z1 / 2);
      }
      p.endShape();
      p.pop();
    }

    function drawGround(
      sunAwayFactor: number,
      sun: Vec3,
      moon: Vec3,
      sunStrength: number,
      moonStrength: number,
    ) {
      updateGroundTexture(sunAwayFactor, sun, moon, sunStrength, moonStrength);
      drawTexturedGround();
      drawGroundRim();
    }

    function drawStars(nightFactor: number, playerX: number, playerZ: number, playerY = 0) {
      if (nightFactor <= VIEWER_SKY_CONFIG.nightVisibilityMin) return;
      p.push();
      p.noStroke();
      const alpha = 255 * nightFactor;
      p.fill(240, 240, 255, alpha);
      for (const s of stars) {
        p.push();
        p.translate(playerX + s.x, playerY + s.y, playerZ + s.z);
        p.sphere(VIEWER_SKY_CONFIG.starSizeSceneUnits, 6, 4);
        p.pop();
      }
      p.pop();
    }

    function drawGlobeStars(eye: Vec3, normal: Vec3, nightFactor: number) {
      if (nightFactor <= VIEWER_SKY_CONFIG.nightVisibilityMin) return;

      const { east, north } = globeLocalBasis(normal);
      p.push();
      for (const star of stars) {
        const local = normalize({ x: star.x, y: star.y, z: star.z });
        const dir = normalize(
          add(add(scale(east, local.x), scale(normal, Math.abs(local.y))), scale(north, local.z)),
        );
        const pos = add(eye, scale(dir, VIEWER_SKY_CONFIG.globeStarRadius));
        p.stroke(238, 242, 255, 230 * nightFactor * star.brightness);
        p.strokeWeight(star.sizePx);
        p.point(pos.x, pos.y, pos.z);
      }
      p.pop();
    }

    function drawSun(sun: Vec3, sunDiameterMi: number, brightness: number) {
      // Render at true scene-scale. A 32-mi sun at 3,000-mi altitude on a
      // 24,900-mi disc is a small bright dot in the sky — that's the point.
      const radius = sunDiameterMi / 2 / FE.discRadiusMi;
      const strength = clamp01(brightness);
      p.push();
      p.noStroke();
      p.fill(
        VIEWER_SUN_CONFIG.color[0] * strength,
        VIEWER_SUN_CONFIG.color[1] * strength,
        VIEWER_SUN_CONFIG.color[2] * strength,
      );
      p.translate(sun.x, sun.y, sun.z);
      p.sphere(radius, VIEWER_SUN_CONFIG.sphereDetail[0], VIEWER_SUN_CONFIG.sphereDetail[1]);
      p.pop();
    }

    function drawMoon(
      sun: Vec3,
      moon: Vec3,
      moonDiameterMi: number,
      fe: boolean,
      brightness: number,
    ) {
      const sdWorld = normalize(sub(sun, moon));
      const radius = moonDiameterMi / 2 / FE.discRadiusMi;
      const strength = clamp01(brightness);
      p.push();
      p.noStroke();
      p.ambientMaterial(255, 255, 255);
      p.translate(moon.x, moon.y, moon.z);
      if (fe) {
        p.ambientLight(
          VIEWER_MOON_CONFIG.feAmbientLight[0] * strength,
          VIEWER_MOON_CONFIG.feAmbientLight[1] * strength,
          VIEWER_MOON_CONFIG.feAmbientLight[2] * strength,
        );
        p.directionalLight(
          VIEWER_MOON_CONFIG.feDirectionalLight[0] * strength,
          VIEWER_MOON_CONFIG.feDirectionalLight[1] * strength,
          VIEWER_MOON_CONFIG.feDirectionalLight[2] * strength,
          sdWorld.x,
          sdWorld.y,
          sdWorld.z,
        );
      } else {
        p.ambientLight(
          VIEWER_MOON_CONFIG.classicAmbientLight[0] * strength,
          VIEWER_MOON_CONFIG.classicAmbientLight[1] * strength,
          VIEWER_MOON_CONFIG.classicAmbientLight[2] * strength,
        );
        p.directionalLight(
          VIEWER_MOON_CONFIG.classicDirectionalLight[0] * strength,
          VIEWER_MOON_CONFIG.classicDirectionalLight[1] * strength,
          VIEWER_MOON_CONFIG.classicDirectionalLight[2] * strength,
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

    function drawGlobeEarth(sun: Vec3) {
      const sunDir = normalize(sun);
      p.push();
      p.ambientLight(20, 28, 38);
      p.directionalLight(245, 235, 205, -sunDir.x, -sunDir.y, -sunDir.z);
      p.noStroke();
      if (earthTexture) {
        p.textureMode(p.NORMAL);
        p.texture(earthTexture);
        drawTexturedGlobeMesh();
      } else {
        p.ambientMaterial(34, 92, 150);
        p.sphere(GLOBE.earthRadiusScene, 96, 64);
      }
      p.pop();
      p.noLights();
    }

    function drawTexturedGlobeMesh() {
      const latSegments = 72;
      const lonSegments = 144;

      for (let latIndex = 0; latIndex < latSegments; latIndex++) {
        const lat0 = 90 - (latIndex / latSegments) * 180;
        const lat1 = 90 - ((latIndex + 1) / latSegments) * 180;
        p.beginShape(p.TRIANGLE_STRIP);
        for (let lonIndex = 0; lonIndex <= lonSegments; lonIndex++) {
          const lon = -180 + (lonIndex / lonSegments) * 360;
          const u = lonIndex / lonSegments;
          const v0 = latIndex / latSegments;
          const v1 = (latIndex + 1) / latSegments;
          const p0 = scale(latLonToGlobeUnit(lat0, lon), GLOBE.earthRadiusScene);
          const p1 = scale(latLonToGlobeUnit(lat1, lon), GLOBE.earthRadiusScene);
          p.normal(p0.x, p0.y, p0.z);
          p.vertex(p0.x, p0.y, p0.z, u, v0);
          p.normal(p1.x, p1.y, p1.z);
          p.vertex(p1.x, p1.y, p1.z, u, v1);
        }
        p.endShape();
      }
    }

    function drawGlobeLandmarks(eye: Vec3) {
      if (globeAltitudeMi(eye) < VIEWER_SKY_CONFIG.globeSurfaceViewMaxMi) return;

      for (const landmark of LANDMARKS) {
        const base = globeLandmarkPosition(landmark, 0);
        const normal = normalize(base);
        const { east, north } = globeLocalBasis(normal);
        const markerHeight = landmark.kind === 'mountain' ? 0.035 : 0.028;
        const markerRadius = landmark.kind === 'mountain' ? 0.012 : 0.008;
        const bottom = scale(normal, GLOBE.earthRadiusScene + 0.004);
        const top = scale(normal, GLOBE.earthRadiusScene + markerHeight);

        p.push();
        p.noStroke();
        p.emissiveMaterial(landmark.color[0], landmark.color[1], landmark.color[2]);
        if (landmark.kind === 'mountain') {
          p.beginShape(p.TRIANGLES);
          for (let i = 0; i < 8; i++) {
            const a0 = (i / 8) * p.TWO_PI;
            const a1 = ((i + 1) / 8) * p.TWO_PI;
            const b0 = add(
              add(bottom, scale(east, Math.cos(a0) * markerRadius)),
              scale(north, Math.sin(a0) * markerRadius),
            );
            const b1 = add(
              add(bottom, scale(east, Math.cos(a1) * markerRadius)),
              scale(north, Math.sin(a1) * markerRadius),
            );
            p.vertex(top.x, top.y, top.z);
            p.vertex(b0.x, b0.y, b0.z);
            p.vertex(b1.x, b1.y, b1.z);
          }
          p.endShape();
        } else {
          const corners = [
            add(add(bottom, scale(east, -markerRadius)), scale(north, -markerRadius)),
            add(add(bottom, scale(east, markerRadius)), scale(north, -markerRadius)),
            add(add(bottom, scale(east, markerRadius)), scale(north, markerRadius)),
            add(add(bottom, scale(east, -markerRadius)), scale(north, markerRadius)),
          ];
          const topCorners = corners.map((corner) => add(corner, scale(normal, markerHeight - 0.004)));
          p.beginShape(p.QUADS);
          for (let i = 0; i < 4; i++) {
            const next = (i + 1) % 4;
            p.vertex(corners[i].x, corners[i].y, corners[i].z);
            p.vertex(corners[next].x, corners[next].y, corners[next].z);
            p.vertex(topCorners[next].x, topCorners[next].y, topCorners[next].z);
            p.vertex(topCorners[i].x, topCorners[i].y, topCorners[i].z);
          }
          p.endShape();
        }
        p.pop();
      }
    }

    function drawGlobeSun(sun: Vec3) {
      p.push();
      p.stroke(
        VIEWER_SUN_CONFIG.color[0],
        VIEWER_SUN_CONFIG.color[1],
        VIEWER_SUN_CONFIG.color[2],
      );
      p.strokeWeight(9);
      p.point(sun.x, sun.y, sun.z);
      p.pop();
    }

    function drawGlobeMoon(sun: Vec3, moon: Vec3) {
      const sdWorld = normalize(sub(sun, moon));
      const radius = globeBodyRenderRadiusScene(GLOBE.moonDiameterMi, GLOBE.moonDistanceMi);
      p.push();
      p.noStroke();
      p.ambientMaterial(
        VIEWER_MOON_CONFIG.globeColor[0],
        VIEWER_MOON_CONFIG.globeColor[1],
        VIEWER_MOON_CONFIG.globeColor[2],
      );
      p.translate(moon.x, moon.y, moon.z);
      p.ambientLight(8, 8, 12);
      p.directionalLight(210, 218, 230, -sdWorld.x, -sdWorld.y, -sdWorld.z);
      p.sphere(radius, VIEWER_MOON_CONFIG.sphereDetail[0], VIEWER_MOON_CONFIG.sphereDetail[1]);
      p.pop();
      p.noLights();
    }

    function drawGlobeScene(s: ReturnType<typeof useScene.getState>) {
      const eye = globeObserverPosition(s.playerX, s.playerZ, s.elevationMi);
      const normal = globeObserverSurfaceNormal(s.playerX, s.playerZ);
      const sun = globeSunPosition(s.simMs);
      const moon = globeMoonPosition(s.simMs);
      const dayFactor = globeDayFactor(eye, normal, sun);
      const inSpace = globeInSpace(eye);
      const altitudeMi = globeAltitudeMi(eye);
      const surfaceView = altitudeMi < VIEWER_SKY_CONFIG.globeSurfaceViewMaxMi;
      const sunVisible = globeBodyVisibleFromSurface(
        eye,
        normal,
        sun,
        GLOBE.sunDiameterMi,
        GLOBE.sunDistanceMi,
      );
      const moonVisible = globeBodyVisibleFromSurface(
        eye,
        normal,
        moon,
        GLOBE.moonDiameterMi,
        GLOBE.moonDistanceMi,
      );

      if (s.cameraLook !== 'manual') {
        const target = targetForGlobeCameraLook(s.cameraLook, eye, sun, moon);
        if (target) {
          const toTarget = sub(target, eye);
          if (Math.hypot(toTarget.x, toTarget.y, toTarget.z) > VIEWER_CAMERA_CONFIG.targetLookMinDistance) {
            const yp = dirToGlobeYawPitch(toTarget, normal);
            setCameraView(yp.yaw, yp.pitch);
          }
        }
      }

      const dir = yawPitchToGlobeDir(cameraView.yaw, cameraView.pitch, normal);
      const center = add(eye, dir);
      const up = Math.abs(dot(dir, normal)) > VIEWER_CAMERA_CONFIG.verticalDirectionThreshold
        ? globeLocalBasis(normal).north
        : scale(normal, -1);

      p.background(
        lerp(VIEWER_SKY_CONFIG.globeNightBackground[0], VIEWER_SKY_CONFIG.globeDayBackground[0], dayFactor),
        lerp(VIEWER_SKY_CONFIG.globeNightBackground[1], VIEWER_SKY_CONFIG.globeDayBackground[1], dayFactor),
        lerp(VIEWER_SKY_CONFIG.globeNightBackground[2], VIEWER_SKY_CONFIG.globeDayBackground[2], dayFactor),
      );
      p.perspective(
        (s.fovDeg * Math.PI) / 180,
        p.width / p.height,
        VIEWER_RENDER_CONFIG.perspectiveNear,
        VIEWER_RENDER_CONFIG.perspectiveFar,
      );
      p.camera(eye.x, eye.y, eye.z, center.x, center.y, center.z, up.x, up.y, up.z);

      drawGlobeStars(eye, normal, inSpace ? 1 : 1 - dayFactor);
      if (!surfaceView) drawGlobeEarth(sun);
      drawGlobeLandmarks(eye);
      if (moonVisible) drawGlobeMoon(sun, moon);
      if (sunVisible) drawGlobeSun(sun);
    }

    p.draw = () => {
      const now = p.millis();
      const dt = now - lastMs;
      lastMs = now;

      const store = useScene.getState();
      store.advanceSim(dt);

      const s = useScene.getState();
      if (s.model === 'globe') {
        drawGlobeScene(s);
        return;
      }

      const eyeY = eyeHeightScene(s.elevationMi);
      const eye: Vec3 = { x: s.playerX, y: eyeY, z: s.playerZ };
      const sun = sunPos(s.simMs, s.sunAltitudeMi, s.sunLatDeg);
      const moon = effectiveMoonPos(s.simMs, s.moonAltitudeMi, s.moonLatDeg, s.shaneMoonOrbit);

      if (s.cameraLook !== 'manual') {
        const target = targetForCameraLook(s.cameraLook, sun, moon);
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
      const sunAwayFactor = clamp01(
        (sunDistXZ - VIEWER_NIGHT_CONFIG.startRadius) / VIEWER_NIGHT_CONFIG.fadeDistance,
      );
      const sunLightingStrength = s.inverseSquareLightingEnabled
        ? bodyLightStrength(eye, sun, s.sunAltitudeMi)
        : 1;
      const moonLightingStrength = s.inverseSquareLightingEnabled
        ? bodyLightStrength(eye, moon, s.moonAltitudeMi)
        : 1;
      const effectiveSunAwayFactor = s.inverseSquareLightingEnabled
        ? clamp01(1 - (1 - sunAwayFactor) * sunLightingStrength)
        : sunAwayFactor;
      const moonGroundStrength = moonGroundLightStrength(sun, moon) * moonLightingStrength;
      const moonBrightness = moonVisibleStrength(sun, moon) * moonLightingStrength;

      drawStars(effectiveSunAwayFactor, s.playerX, s.playerZ);
      drawGround(effectiveSunAwayFactor, sun, moon, sunLightingStrength, moonGroundStrength);
      drawLandmarks();
      drawSun(sun, s.sunDiameterMi, sunLightingStrength);
      drawMoon(sun, moon, s.moonDiameterMi, s.moonLightingFE, moonBrightness);
    };
  };
}

function PerspectiveAuditOverlay() {
  const ref = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<PerspectiveAuditData | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = ref.current;
      if (!el) {
        raf = requestAnimationFrame(tick);
        return;
      }

      setData(buildPerspectiveAuditData(el.clientWidth, el.clientHeight));
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const labelClass =
    'absolute rounded border border-amber-300/60 bg-slate-950/80 px-2 py-1 font-mono text-[11px] leading-tight text-slate-100 shadow';
  const horizonLabelClass =
    'absolute font-mono text-[11px] leading-none text-sky-200 drop-shadow';

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 overflow-hidden">
      {data && (
        <>
          {data.horizonY > -data.height && data.horizonY < data.height * 2 && (
            <>
              <div
                className="absolute left-3 right-3 border-t border-dashed border-sky-300/70"
                style={{ top: data.horizonY }}
              />
              <div
                className={horizonLabelClass}
                style={{
                  left: 18,
                  top: clamp(data.horizonY + 8, 8, data.height - 28),
                }}
              >
                level horizon
              </div>
            </>
          )}

          <div
            className={labelClass}
            style={{
              right: 8,
              bottom: 8,
            }}
          >
            <div className="text-amber-300">sun perspective</div>
            <div>view elev {data.elevationDeg.toFixed(1)} deg</div>
            <div>apparent Ø {data.angularDeg.toFixed(3)} deg</div>
            <div>size {(data.sizeRatio * 100).toFixed(1)}% overhead</div>
            <div>ground {data.horizontalMi.toFixed(0)} mi</div>
            <div>dist {data.sunDistanceMi.toFixed(0)} mi</div>
          </div>
        </>
      )}
    </div>
  );
}

function GlobeSurfaceOverlay() {
  const ref = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<{
    horizonY: number;
    visible: boolean;
    dayFactor: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = ref.current;
      const s = useScene.getState();
      if (!el || s.model !== 'globe') {
        setData(null);
        raf = requestAnimationFrame(tick);
        return;
      }

      const eye = globeObserverPosition(s.playerX, s.playerZ, s.elevationMi);
      const altitudeMi = globeAltitudeMi(eye);
      if (altitudeMi >= VIEWER_SKY_CONFIG.globeSurfaceViewMaxMi) {
        setData(null);
        raf = requestAnimationFrame(tick);
        return;
      }

      const normal = globeObserverSurfaceNormal(s.playerX, s.playerZ);
      const sun = globeSunPosition(s.simMs);
      const horizonY =
        el.clientHeight / 2 +
        (Math.tan(cameraView.pitch) * el.clientHeight) /
          2 /
          Math.tan((s.fovDeg * Math.PI) / 360);
      setData({
        horizonY,
        visible: horizonY < el.clientHeight,
        dayFactor: globeDayFactor(eye, normal, sun),
        height: el.clientHeight,
      });
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const groundTop = data ? clamp(data.horizonY, 0, data.height) : 0;
  const brightness = data ? 0.45 + data.dayFactor * 0.55 : 1;
  const land = VIEWER_GROUND_CONFIG.globeSurfaceLandColor;
  const groundColor = `rgb(${Math.round(land[0] * brightness)}, ${Math.round(
    land[1] * brightness,
  )}, ${Math.round(land[2] * brightness)})`;

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 overflow-hidden">
      {data?.visible && (
        <>
          <div
            className="absolute left-0 right-0"
            style={{
              top: groundTop,
              bottom: 0,
              background: `linear-gradient(to bottom, ${groundColor}, rgb(20, 45, 30))`,
            }}
          />
          <div
            className="absolute left-0 right-0 h-px bg-sky-100/35"
            style={{ top: groundTop }}
          />
        </>
      )}
    </div>
  );
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
        const state = useScene.getState();
        if (state.model === 'globe') {
          const normal = globeObserverSurfaceNormal(state.playerX, state.playerZ);
          const forward = yawPitchToGlobeDir(cameraView.yaw, 0, normal);
          const right = normalize(cross(forward, normal));
          const tangent = normalize(add(scale(forward, fwd), scale(right, strafe)));
          const next = moveOnGlobe(
            state.playerX,
            state.playerZ,
            tangent,
            VIEWER_INTERACTION_CONFIG.walkSpeedSceneUnitsPerSec * dt,
          );
          state.setPlayer(next.x, next.z);
        } else {
          const yaw = cameraView.yaw;
          const fx = Math.cos(yaw);
          const fz = Math.sin(yaw);
          const rx = Math.sin(yaw);
          const rz = -Math.cos(yaw);
          let nx =
            state.playerX +
            (fwd * fx + strafe * rx) * VIEWER_INTERACTION_CONFIG.walkSpeedSceneUnitsPerSec * dt;
          let nz =
            state.playerZ +
            (fwd * fz + strafe * rz) * VIEWER_INTERACTION_CONFIG.walkSpeedSceneUnitsPerSec * dt;
          const r = Math.hypot(nx, nz);
          if (r > VIEWER_INTERACTION_CONFIG.discMaxRadius) {
            nx = (nx / r) * VIEWER_INTERACTION_CONFIG.discMaxRadius;
            nz = (nz / r) * VIEWER_INTERACTION_CONFIG.discMaxRadius;
          }
          state.setPlayer(nx, nz);
        }
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
      <GlobeSurfaceOverlay />
      <PerspectiveAuditOverlay />
      <Hud />
    </div>
  );
}
