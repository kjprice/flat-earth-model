import { useEffect, useRef } from 'react';
import p5 from 'p5';
import { latToOrbitRadius, moonPos, sunPos } from '../scene';
import { useScene } from '../state/store';

// Map coord convention:
//   scene +X → map +U (right)
//   scene +Z → map -V (up)   — flipped so sun visibly moves CW (E→W) on map.
// The local map image is azimuthal-equidistant, North Pole center.
function sceneToUv(x: number, z: number): { u: number; v: number } {
  return { u: 0.5 + x / 2, v: 0.5 - z / 2 };
}
function uvToScene(u: number, v: number): { x: number; z: number } {
  return { x: (u - 0.5) * 2, z: -(v - 0.5) * 2 };
}

function makeSketch(container: HTMLDivElement) {
  return (p: p5) => {
    let mapImg: p5.Image | null = null;
    let mapLoadFailed = false;

    p.setup = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      const canvas = p.createCanvas(w, h);
      canvas.parent(container);
      p.loadImage(
        '/map.jpg',
        (img) => {
          mapImg = img;
        },
        () => {
          mapLoadFailed = true;
        },
      );
    };

    p.windowResized = () => {
      p.resizeCanvas(container.clientWidth, container.clientHeight);
    };

    p.mousePressed = () => {
      if (!Number.isFinite(p.mouseX) || !Number.isFinite(p.mouseY)) return;
      if (p.mouseX < 0 || p.mouseY < 0 || p.mouseX > p.width || p.mouseY > p.height) return;
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

      const size = Math.min(p.width, p.height);
      const ox = (p.width - size) / 2;
      const oy = (p.height - size) / 2;

      // Map image.
      p.push();
      p.noStroke();
      if (mapImg) {
        p.image(mapImg, ox, oy, size, size);
      } else {
        p.fill(30, 40, 55);
        p.rect(ox, oy, size, size);
        p.fill(200);
        p.textAlign(p.CENTER, p.CENTER);
        p.text(mapLoadFailed ? 'map.jpg failed to load' : 'Loading map...', p.width / 2, p.height / 2);
      }
      p.pop();

      const s = useScene.getState();
      const sun = sunPos(s.simMs, s.sunAltitudeMi, s.sunLatDeg);
      const moon = moonPos(s.simMs, s.moonAltitudeMi, s.moonLatDeg);
      const sunUv = sceneToUv(sun.x, sun.z);
      const moonUv = sceneToUv(moon.x, moon.z);
      const sunPx = ox + sunUv.u * size;
      const sunPy = oy + sunUv.v * size;
      const moonPx = ox + moonUv.u * size;
      const moonPy = oy + moonUv.v * size;

      // Day radius in pixels: orbit radius is up to 1.0 scene unit, which
      // maps to half the canvas size. The lit region is roughly disc-size.
      const sunInner = Math.max(6, size * 0.02);
      const sunOuter = Math.max(80, size * 0.32);
      const moonInner = Math.max(4, size * 0.012);
      const moonOuter = Math.max(40, size * 0.14);

      // Darken everywhere, then cut holes at the sun and moon with
      // destination-out composite so the map shows through.
      const ctx = p.drawingContext as CanvasRenderingContext2D;
      ctx.save();

      ctx.fillStyle = 'rgba(0, 0, 12, 0.82)';
      ctx.fillRect(0, 0, p.width, p.height);

      ctx.globalCompositeOperation = 'destination-out';
      const sunHole = ctx.createRadialGradient(sunPx, sunPy, sunInner, sunPx, sunPy, sunOuter);
      sunHole.addColorStop(0, 'rgba(0,0,0,1)');
      sunHole.addColorStop(0.6, 'rgba(0,0,0,0.55)');
      sunHole.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sunHole;
      ctx.fillRect(0, 0, p.width, p.height);

      const moonHole = ctx.createRadialGradient(moonPx, moonPy, moonInner, moonPx, moonPy, moonOuter);
      moonHole.addColorStop(0, 'rgba(0,0,0,0.8)');
      moonHole.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = moonHole;
      ctx.fillRect(0, 0, p.width, p.height);

      ctx.globalCompositeOperation = 'source-over';

      // Warm additive glow at the sun, cool glow at the moon.
      ctx.globalCompositeOperation = 'lighter';
      const sunGlow = ctx.createRadialGradient(sunPx, sunPy, 0, sunPx, sunPy, sunOuter);
      sunGlow.addColorStop(0, 'rgba(255, 230, 120, 0.38)');
      sunGlow.addColorStop(1, 'rgba(255, 230, 120, 0)');
      ctx.fillStyle = sunGlow;
      ctx.fillRect(0, 0, p.width, p.height);

      const moonGlow = ctx.createRadialGradient(moonPx, moonPy, 0, moonPx, moonPy, moonOuter);
      moonGlow.addColorStop(0, 'rgba(180, 200, 255, 0.22)');
      moonGlow.addColorStop(1, 'rgba(180, 200, 255, 0)');
      ctx.fillStyle = moonGlow;
      ctx.fillRect(0, 0, p.width, p.height);

      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();

      // Sun + moon orbit rings. The orbit radius is 1 scene unit at latitude
      // 0, 0 at the pole — so the ring reads as "the track the body walks
      // around the disc today". Half-disc = size/2 on canvas.
      const cx = ox + size / 2;
      const cy = oy + size / 2;
      const sunRingR = latToOrbitRadius(s.sunLatDeg) * (size / 2);
      const moonRingR = latToOrbitRadius(s.moonLatDeg) * (size / 2);

      ctx.save();
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(255, 210, 80, 0.55)';
      ctx.beginPath();
      ctx.arc(cx, cy, sunRingR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(200, 215, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(cx, cy, moonRingR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Markers.
      const drawMarker = (
        x: number,
        z: number,
        r: number,
        fill: [number, number, number],
        stroke: [number, number, number] | null = null,
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

      drawMarker(sun.x, sun.z, Math.max(6, size * 0.015), [255, 210, 60], [140, 90, 0]);
      drawMarker(moon.x, moon.z, Math.max(5, size * 0.012), [230, 230, 240], [90, 90, 100]);
      drawMarker(s.playerX, s.playerZ, Math.max(5, size * 0.012), [70, 255, 120], [0, 100, 30]);

      p.noStroke();
      p.fill(255, 220);
      p.textSize(11);
      p.textAlign(p.LEFT, p.TOP);
      p.text('click to teleport', ox + 8, oy + 6);
    };
  };
}

export function MapView() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const inst = new p5(makeSketch(ref.current), ref.current);
    return () => inst.remove();
  }, []);

  return <div ref={ref} className="relative w-full h-full bg-slate-950" />;
}
