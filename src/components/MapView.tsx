import { useEffect, useRef } from 'react';
import p5 from 'p5';
import { FE } from '../config/core';
import {
  MAP_VIEW_CONFIG,
  MAP_VIEW_GLOW_CONFIG,
  MAP_VIEW_MARKER_CONFIG,
} from '../config/mapView';
import {
  effectiveMoonPos,
  globeSceneToLatLon,
  globeMoonLatLon,
  latLonToGlobeUnit,
  latToOrbitRadius,
  latLonToGlobeScene,
  // observedTerminatorScenePoints,
  sceneToLatLon,
  shaneMoonTrackScenePoints,
  subsolarLatLon,
  sunPos,
} from '../scene';
import { cameraView } from '../state/cameraView';
import { useScene } from '../state/store';

function sceneToUv(x: number, z: number): { u: number; v: number } {
  return { u: 0.5 + x / 2, v: 0.5 - z / 2 };
}

function uvToScene(u: number, v: number): { x: number; z: number } {
  return { x: (u - 0.5) * 2, z: -(v - 0.5) * 2 };
}

function globeMapProjection(
  latDeg: number,
  lonDeg: number,
  centerLatDeg: number,
  centerLonDeg: number,
): { x: number; y: number; visible: boolean } {
  const point = latLonToGlobeUnit(latDeg, lonDeg);
  const center = latLonToGlobeUnit(centerLatDeg, centerLonDeg);
  const east = {
    x: Math.cos((centerLonDeg * Math.PI) / 180),
    y: 0,
    z: Math.sin((centerLonDeg * Math.PI) / 180),
  };
  const north = {
    x: -Math.sin((centerLatDeg * Math.PI) / 180) * Math.sin((centerLonDeg * Math.PI) / 180),
    y: Math.cos((centerLatDeg * Math.PI) / 180),
    z: Math.sin((centerLatDeg * Math.PI) / 180) * Math.cos((centerLonDeg * Math.PI) / 180),
  };
  return {
    x: point.x * east.x + point.y * east.y + point.z * east.z,
    y: -(point.x * north.x + point.y * north.y + point.z * north.z),
    visible: point.x * center.x + point.y * center.y + point.z * center.z >= -0.02,
  };
}

function makeSketch(container: HTMLDivElement) {
  return (p: p5) => {
    let mapImg: p5.Image | null = null;
    let earthImg: p5.Image | null = null;
    let mapLoadFailed = false;

    p.setup = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      const canvas = p.createCanvas(w, h);
      canvas.parent(container);
      p.loadImage(
        `${import.meta.env.BASE_URL}map.jpg`,
        (img) => {
          mapImg = img;
        },
        () => {
          mapLoadFailed = true;
        },
      );
      p.loadImage(`${import.meta.env.BASE_URL}earth-blue-marble.jpg`, (img) => {
        earthImg = img;
      });
    };

    p.windowResized = () => {
      p.resizeCanvas(container.clientWidth, container.clientHeight);
    };

    p.mousePressed = () => {
      if (!Number.isFinite(p.mouseX) || !Number.isFinite(p.mouseY)) return;
      if (p.mouseX < 0 || p.mouseY < 0 || p.mouseX > p.width || p.mouseY > p.height) return;
      if (useScene.getState().model === 'globe') {
        const s = useScene.getState();
        const centerLatLon = globeSceneToLatLon(s.playerX, s.playerZ);
        const size = Math.min(p.width, p.height);
        const radius = size * 0.43;
        const cx = p.width / 2;
        const cy = p.height / 2;
        const mx = (p.mouseX - cx) / radius;
        const my = (p.mouseY - cy) / radius;
        const r2 = mx * mx + my * my;
        if (r2 > 1) return;
        const z = Math.sqrt(1 - r2);
        const center = latLonToGlobeUnit(centerLatLon.latDeg, centerLatLon.lonDeg);
        const east = {
          x: Math.cos((centerLatLon.lonDeg * Math.PI) / 180),
          y: 0,
          z: Math.sin((centerLatLon.lonDeg * Math.PI) / 180),
        };
        const north = {
          x:
            -Math.sin((centerLatLon.latDeg * Math.PI) / 180) *
            Math.sin((centerLatLon.lonDeg * Math.PI) / 180),
          y: Math.cos((centerLatLon.latDeg * Math.PI) / 180),
          z:
            Math.sin((centerLatLon.latDeg * Math.PI) / 180) *
            Math.cos((centerLatLon.lonDeg * Math.PI) / 180),
        };
        const unit = {
          x: east.x * mx - north.x * my + center.x * z,
          y: east.y * mx - north.y * my + center.y * z,
          z: east.z * mx - north.z * my + center.z * z,
        };
        const latDeg = (Math.asin(Math.max(-1, Math.min(1, unit.y))) * 180) / Math.PI;
        const lonDeg = (Math.atan2(unit.x, -unit.z) * 180) / Math.PI;
        const next = latLonToGlobeScene(latDeg, lonDeg);
        useScene.getState().setPlayer(next.x, next.z);
        return;
      }
      const size = Math.min(p.width, p.height);
      if (!(size > 0)) return;
      const ox = (p.width - size) / 2;
      const oy = (p.height - size) / 2;
      const u = (p.mouseX - ox) / size;
      const v = (p.mouseY - oy) / size;
      const dx = u - 0.5;
      const dy = v - 0.5;
      const r2 = dx * dx + dy * dy;
      if (!(r2 <= 0.25)) return;
      const { x, z } = uvToScene(u, v);
      useScene.getState().setPlayer(x, z);
    };

    p.draw = () => {
      p.background(4, 6, 12);

      const s = useScene.getState();
      if (s.model === 'globe') {
        const size = Math.min(p.width, p.height);
        const radius = size * 0.43;
        const cx = p.width / 2;
        const cy = p.height / 2;
        const centerLatLon = globeSceneToLatLon(s.playerX, s.playerZ);
        const px = (latDeg: number, lonDeg: number) => {
          const projected = globeMapProjection(
            latDeg,
            lonDeg,
            centerLatLon.latDeg,
            centerLatLon.lonDeg,
          );
          return { x: cx + projected.x * radius, y: cy + projected.y * radius, visible: projected.visible };
        };
        const marker = (
          latDeg: number,
          lonDeg: number,
          r: number,
          fill: readonly [number, number, number],
          stroke: readonly [number, number, number] | null = null,
        ) => {
          const projected = px(latDeg, lonDeg);
          if (!projected.visible) return;
          if (stroke) {
            p.stroke(stroke[0], stroke[1], stroke[2]);
            p.strokeWeight(2);
          } else {
            p.noStroke();
          }
          p.fill(fill[0], fill[1], fill[2]);
          p.circle(projected.x, projected.y, r * 2);
        };
        p.fill(2, 6, 18, 235);
        p.rect(0, 0, p.width, p.height);
        p.fill(6, 18, 40);
        p.circle(cx, cy, radius * 2);

        const ctx = p.drawingContext as CanvasRenderingContext2D;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.clip();
        if (earthImg) {
          earthImg.loadPixels();
          const globeImg = p.createImage(p.width, p.height);
          globeImg.loadPixels();
          const center = latLonToGlobeUnit(centerLatLon.latDeg, centerLatLon.lonDeg);
          const east = {
            x: Math.cos((centerLatLon.lonDeg * Math.PI) / 180),
            y: 0,
            z: Math.sin((centerLatLon.lonDeg * Math.PI) / 180),
          };
          const north = {
            x:
              -Math.sin((centerLatLon.latDeg * Math.PI) / 180) *
              Math.sin((centerLatLon.lonDeg * Math.PI) / 180),
            y: Math.cos((centerLatLon.latDeg * Math.PI) / 180),
            z:
              Math.sin((centerLatLon.latDeg * Math.PI) / 180) *
              Math.cos((centerLatLon.lonDeg * Math.PI) / 180),
          };

          for (let y = 0; y < p.height; y++) {
            for (let x = 0; x < p.width; x++) {
              const dx = (x - cx) / radius;
              const dy = (y - cy) / radius;
              const r2 = dx * dx + dy * dy;
              const outIdx = 4 * (y * p.width + x);
              if (r2 > 1) {
                globeImg.pixels[outIdx + 3] = 0;
                continue;
              }

              const dz = Math.sqrt(1 - r2);
              const unit = {
                x: east.x * dx - north.x * dy + center.x * dz,
                y: east.y * dx - north.y * dy + center.y * dz,
                z: east.z * dx - north.z * dy + center.z * dz,
              };
              const latDeg = (Math.asin(Math.max(-1, Math.min(1, unit.y))) * 180) / Math.PI;
              let lonDeg = (Math.atan2(unit.x, -unit.z) * 180) / Math.PI;
              if (lonDeg > 180) lonDeg -= 360;
              if (lonDeg <= -180) lonDeg += 360;

              const sx = Math.max(
                0,
                Math.min(earthImg.width - 1, Math.floor(((lonDeg + 180) / 360) * earthImg.width)),
              );
              const sy = Math.max(
                0,
                Math.min(earthImg.height - 1, Math.floor(((90 - latDeg) / 180) * earthImg.height)),
              );
              const srcIdx = 4 * (sy * earthImg.width + sx);
              const shade = 0.68 + dz * 0.32;
              globeImg.pixels[outIdx] = earthImg.pixels[srcIdx] * shade;
              globeImg.pixels[outIdx + 1] = earthImg.pixels[srcIdx + 1] * shade;
              globeImg.pixels[outIdx + 2] = earthImg.pixels[srcIdx + 2] * shade;
              globeImg.pixels[outIdx + 3] = 255;
            }
          }
          globeImg.updatePixels();
          p.image(globeImg, 0, 0);
        } else {
          ctx.globalAlpha = 0.55;
          ctx.fillStyle = '#164b82';
          ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
          ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.20)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
        for (let lon = -180; lon <= 180; lon += 30) {
          ctx.beginPath();
          let started = false;
          for (let lat = -85; lat <= 85; lat += 5) {
            const point = px(lat, lon);
            if (!point.visible) {
              started = false;
              continue;
            }
            if (!started) {
              ctx.moveTo(point.x, point.y);
              started = true;
            } else {
              ctx.lineTo(point.x, point.y);
            }
          }
          ctx.stroke();
        }
        for (let lat = -60; lat <= 60; lat += 30) {
          ctx.beginPath();
          let started = false;
          for (let lon = -180; lon <= 180; lon += 5) {
            const point = px(lat, lon);
            if (!point.visible) {
              started = false;
              continue;
            }
            if (!started) {
              ctx.moveTo(point.x, point.y);
              started = true;
            } else {
              ctx.lineTo(point.x, point.y);
            }
          }
          ctx.stroke();
        }
        ctx.restore();

        const playerLatLon = globeSceneToLatLon(s.playerX, s.playerZ);
        const sunLatLon = subsolarLatLon(s.simMs);
        const moonLatLon = globeMoonLatLon(s.simMs);
        marker(
          sunLatLon.latDeg,
          sunLatLon.lonDeg,
          8,
          MAP_VIEW_CONFIG.markerPalette.sunFill,
          MAP_VIEW_CONFIG.markerPalette.sunStroke,
        );
        marker(
          moonLatLon.latDeg,
          moonLatLon.lonDeg,
          6,
          MAP_VIEW_CONFIG.markerPalette.moonFill,
          MAP_VIEW_CONFIG.markerPalette.moonStroke,
        );
        marker(
          playerLatLon.latDeg,
          playerLatLon.lonDeg,
          6,
          MAP_VIEW_CONFIG.markerPalette.playerFill,
          MAP_VIEW_CONFIG.markerPalette.playerStroke,
        );

        p.noStroke();
        p.fill(255, 220);
        p.textSize(11);
        p.textAlign(p.LEFT, p.TOP);
        p.text('globe mini map', MAP_VIEW_CONFIG.textPaddingPx.x, MAP_VIEW_CONFIG.textPaddingPx.y);
        p.fill(255, 170);
        p.textSize(10);
        p.text('click visible side', MAP_VIEW_CONFIG.textPaddingPx.x, MAP_VIEW_CONFIG.textPaddingPx.y + MAP_VIEW_CONFIG.helperTextSpacingPx);
        return;
      }

      const size = Math.min(p.width, p.height);
      const ox = (p.width - size) / 2;
      const oy = (p.height - size) / 2;

      p.push();
      p.noStroke();
      if (mapImg) {
        p.image(mapImg, ox, oy, size, size);
      } else {
        p.fill(
          MAP_VIEW_CONFIG.mapFallbackBackground[0],
          MAP_VIEW_CONFIG.mapFallbackBackground[1],
          MAP_VIEW_CONFIG.mapFallbackBackground[2],
        );
        p.rect(ox, oy, size, size);
        p.fill(200);
        p.textAlign(p.CENTER, p.CENTER);
        p.text(mapLoadFailed ? 'map.jpg failed to load' : 'Loading map...', p.width / 2, p.height / 2);
      }
      p.pop();

      const sun = sunPos(s.simMs, s.sunAltitudeMi, s.sunLatDeg);
      const moon = effectiveMoonPos(s.simMs, s.moonAltitudeMi, s.moonLatDeg, s.shaneMoonOrbit);
      const sunUv = sceneToUv(sun.x, sun.z);
      const moonUv = sceneToUv(moon.x, moon.z);
      const sunPx = ox + sunUv.u * size;
      const sunPy = oy + sunUv.v * size;
      const moonPx = ox + moonUv.u * size;
      const moonPy = oy + moonUv.v * size;

      const sunInner = Math.max(
        MAP_VIEW_GLOW_CONFIG.sunInnerMinPx,
        size * MAP_VIEW_GLOW_CONFIG.sunInnerFraction,
      );
      const sunOuter = Math.max(
        MAP_VIEW_GLOW_CONFIG.sunOuterMinPx,
        size * MAP_VIEW_GLOW_CONFIG.sunOuterFraction,
      );
      const moonInner = Math.max(
        MAP_VIEW_GLOW_CONFIG.moonInnerMinPx,
        size * MAP_VIEW_GLOW_CONFIG.moonInnerFraction,
      );
      const moonOuter = Math.max(
        MAP_VIEW_GLOW_CONFIG.moonOuterMinPx,
        size * MAP_VIEW_GLOW_CONFIG.moonOuterFraction,
      );

      const ctx = p.drawingContext as CanvasRenderingContext2D;
      ctx.save();

      ctx.fillStyle = MAP_VIEW_CONFIG.overlayFill;
      ctx.fillRect(0, 0, p.width, p.height);

      ctx.globalCompositeOperation = 'destination-out';
      const sunHole = ctx.createRadialGradient(sunPx, sunPy, sunInner, sunPx, sunPy, sunOuter);
      MAP_VIEW_CONFIG.sunHoleStops.forEach(([stop, color]) => sunHole.addColorStop(stop, color));
      ctx.fillStyle = sunHole;
      ctx.fillRect(0, 0, p.width, p.height);

      const moonHole = ctx.createRadialGradient(
        moonPx,
        moonPy,
        moonInner,
        moonPx,
        moonPy,
        moonOuter,
      );
      MAP_VIEW_CONFIG.moonHoleStops.forEach(([stop, color]) => moonHole.addColorStop(stop, color));
      ctx.fillStyle = moonHole;
      ctx.fillRect(0, 0, p.width, p.height);

      ctx.globalCompositeOperation = 'source-over';

      ctx.globalCompositeOperation = 'lighter';
      const sunGlow = ctx.createRadialGradient(sunPx, sunPy, 0, sunPx, sunPy, sunOuter);
      MAP_VIEW_CONFIG.sunGlowStops.forEach(([stop, color]) => sunGlow.addColorStop(stop, color));
      ctx.fillStyle = sunGlow;
      ctx.fillRect(0, 0, p.width, p.height);

      const moonGlow = ctx.createRadialGradient(moonPx, moonPy, 0, moonPx, moonPy, moonOuter);
      MAP_VIEW_CONFIG.moonGlowStops.forEach(([stop, color]) => moonGlow.addColorStop(stop, color));
      ctx.fillStyle = moonGlow;
      ctx.fillRect(0, 0, p.width, p.height);

      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();

      const cx = ox + size / 2;
      const cy = oy + size / 2;
      const sunRingR = latToOrbitRadius(s.sunLatDeg) * (size / 2);
      const moonLatLon = sceneToLatLon(moon.x, moon.z);
      const moonRingR = latToOrbitRadius(moonLatLon.latDeg) * (size / 2);
      // const tropicNorthR = latToOrbitRadius(23.44) * (size / 2);
      // const tropicSouthR = latToOrbitRadius(-23.44) * (size / 2);

      const drawScenePolyline = (
        points: Array<{ x: number; z: number }>,
        strokeStyle: string,
        lineWidth: number,
      ) => {
        if (points.length < 2) return;
        ctx.save();
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        points.forEach((point, index) => {
          const uv = sceneToUv(point.x, point.z);
          const px = ox + uv.u * size;
          const py = oy + uv.v * size;
          if (index === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
        ctx.restore();
      };

      ctx.save();
      ctx.lineWidth = MAP_VIEW_CONFIG.ringLineWidthPx;
      ctx.setLineDash([...MAP_VIEW_CONFIG.ringDashPx]);
      // ctx.strokeStyle = MAP_VIEW_CONFIG.solsticeRingStroke;
      // ctx.beginPath();
      // ctx.arc(cx, cy, tropicNorthR, 0, Math.PI * 2);
      // ctx.stroke();
      // ctx.beginPath();
      // ctx.arc(cx, cy, tropicSouthR, 0, Math.PI * 2);
      // ctx.stroke();
      ctx.strokeStyle = MAP_VIEW_CONFIG.sunRingStroke;
      ctx.beginPath();
      ctx.arc(cx, cy, sunRingR, 0, Math.PI * 2);
      ctx.stroke();
      if (!s.shaneMoonOrbit) {
        ctx.strokeStyle = MAP_VIEW_CONFIG.moonRingStroke;
        ctx.beginPath();
        ctx.arc(cx, cy, moonRingR, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();

      if (s.shaneMoonOrbit) {
        ctx.save();
        ctx.setLineDash([...MAP_VIEW_CONFIG.ringDashPx]);
        drawScenePolyline(
          shaneMoonTrackScenePoints(s.simMs),
          MAP_VIEW_CONFIG.moonRingStroke,
          MAP_VIEW_CONFIG.ringLineWidthPx,
        );
        ctx.restore();
      }

      // const terminatorPoints = observedTerminatorScenePoints(s.simMs, s.sunLatDeg);
      // drawScenePolyline(
      //   terminatorPoints,
      //   MAP_VIEW_CONFIG.terminatorShadowStroke,
      //   MAP_VIEW_CONFIG.terminatorLineWidthPx + 2,
      // );
      // drawScenePolyline(
      //   terminatorPoints,
      //   MAP_VIEW_CONFIG.terminatorStroke,
      //   MAP_VIEW_CONFIG.terminatorLineWidthPx,
      // );

      const drawMarker = (
        x: number,
        z: number,
        r: number,
        fill: readonly [number, number, number],
        stroke: readonly [number, number, number] | null = null,
        alpha = 255,
      ) => {
        const { u, v } = sceneToUv(x, z);
        const px = ox + u * size;
        const py = oy + v * size;
        if (stroke) {
          p.stroke(stroke[0], stroke[1], stroke[2]);
          p.strokeWeight(2);
        } else {
          p.noStroke();
        }
        p.fill(fill[0], fill[1], fill[2], alpha);
        p.circle(px, py, r * 2);
      };

      const trueScaleSunR = (s.sunDiameterMi * size) / (4 * FE.discRadiusMi);
      const trueScaleMoonR = (s.moonDiameterMi * size) / (4 * FE.discRadiusMi);

      const maxR = size * MAP_VIEW_CONFIG.markerMaxFraction;
      const sunFloor = Math.max(
        MAP_VIEW_MARKER_CONFIG.sunFloorMinPx,
        size * MAP_VIEW_MARKER_CONFIG.sunFloorFraction,
      );
      const moonFloor = Math.max(
        MAP_VIEW_MARKER_CONFIG.moonFloorMinPx,
        size * MAP_VIEW_MARKER_CONFIG.moonFloorFraction,
      );
      const inflatedSunR = Math.min(
        maxR,
        Math.max(sunFloor, trueScaleSunR * MAP_VIEW_CONFIG.markerExaggeration),
      );
      const inflatedMoonR = Math.min(
        maxR,
        Math.max(moonFloor, trueScaleMoonR * MAP_VIEW_CONFIG.markerExaggeration),
      );

      drawMarker(
        sun.x,
        sun.z,
        inflatedSunR,
        MAP_VIEW_CONFIG.markerPalette.sunFill,
        MAP_VIEW_CONFIG.markerPalette.sunStroke,
        MAP_VIEW_MARKER_CONFIG.inflatedAlpha,
      );
      drawMarker(
        moon.x,
        moon.z,
        inflatedMoonR,
        MAP_VIEW_CONFIG.markerPalette.moonFill,
        MAP_VIEW_CONFIG.markerPalette.moonStroke,
        MAP_VIEW_MARKER_CONFIG.inflatedAlpha,
      );

      drawMarker(
        sun.x,
        sun.z,
        Math.max(MAP_VIEW_CONFIG.minTrueScaleDotRadiusPx, trueScaleSunR),
        MAP_VIEW_CONFIG.markerPalette.sunDot,
      );
      drawMarker(
        moon.x,
        moon.z,
        Math.max(MAP_VIEW_CONFIG.minTrueScaleDotRadiusPx, trueScaleMoonR),
        MAP_VIEW_CONFIG.markerPalette.moonDot,
      );

      drawMarker(
        s.playerX,
        s.playerZ,
        Math.max(
          MAP_VIEW_CONFIG.playerMarkerMinRadiusPx,
          size * MAP_VIEW_CONFIG.playerMarkerFraction,
        ),
        MAP_VIEW_CONFIG.markerPalette.playerFill,
        MAP_VIEW_CONFIG.markerPalette.playerStroke,
      );

      const pUv = sceneToUv(s.playerX, s.playerZ);
      const pPx = ox + pUv.u * size;
      const pPy = oy + pUv.v * size;
      const fdx = Math.cos(cameraView.yaw);
      const fdz = Math.sin(cameraView.yaw);
      const arrowLen = Math.max(
        MAP_VIEW_CONFIG.arrowMinLengthPx,
        size * MAP_VIEW_CONFIG.arrowLengthFraction,
      );
      const endPx = pPx + fdx * arrowLen;
      const endPy = pPy + -fdz * arrowLen;
      ctx.save();
      ctx.strokeStyle = MAP_VIEW_CONFIG.playerArrowStroke;
      ctx.fillStyle = MAP_VIEW_CONFIG.playerArrowFill;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pPx, pPy);
      ctx.lineTo(endPx, endPy);
      ctx.stroke();
      const headAng = Math.atan2(endPy - pPy, endPx - pPx);
      const headLen = Math.max(
        MAP_VIEW_CONFIG.arrowHeadMinLengthPx,
        size * MAP_VIEW_CONFIG.arrowHeadLengthFraction,
      );
      ctx.beginPath();
      ctx.moveTo(endPx, endPy);
      ctx.lineTo(
        endPx - headLen * Math.cos(headAng - 0.45),
        endPy - headLen * Math.sin(headAng - 0.45),
      );
      ctx.lineTo(
        endPx - headLen * Math.cos(headAng + 0.45),
        endPy - headLen * Math.sin(headAng + 0.45),
      );
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      p.noStroke();
      p.fill(255, 220);
      p.textSize(11);
      p.textAlign(p.LEFT, p.TOP);
      p.text(
        'click to teleport',
        ox + MAP_VIEW_CONFIG.textPaddingPx.x,
        oy + MAP_VIEW_CONFIG.textPaddingPx.y,
      );
      p.fill(255, 170);
      p.textSize(10);
      p.text(
        'inner dot = true scale',
        ox + MAP_VIEW_CONFIG.textPaddingPx.x,
        oy + MAP_VIEW_CONFIG.textPaddingPx.y + MAP_VIEW_CONFIG.helperTextSpacingPx,
      );
    };
  };
}

export function MapView() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const inst = new p5(makeSketch(ref.current), ref.current);
    return () => {
      inst.remove();
    };
  }, []);

  return <div ref={ref} className="w-full h-full" />;
}
