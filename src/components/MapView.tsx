import { useEffect, useRef } from 'react';
import p5 from 'p5';
import { moonPos, sunPos } from '../scene';
import { useScene } from '../state/store';

// Map coordinate convention:
//   scene XZ in [-1, 1] (disc radius = 1 scene unit)
//   map UV in [0, 1], with disc edge at a circle of radius 0.5 centered at (0.5, 0.5)
// The local map image is azimuthal-equidistant, North Pole center.
function sceneToUv(x: number, z: number): { u: number; v: number } {
  return { u: 0.5 + x / 2, v: 0.5 + z / 2 };
}
function uvToScene(u: number, v: number): { x: number; z: number } {
  return { x: (u - 0.5) * 2, z: (v - 0.5) * 2 };
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
      if (p.mouseX < 0 || p.mouseY < 0 || p.mouseX > p.width || p.mouseY > p.height) return;
      const size = Math.min(p.width, p.height);
      const ox = (p.width - size) / 2;
      const oy = (p.height - size) / 2;
      const u = (p.mouseX - ox) / size;
      const v = (p.mouseY - oy) / size;
      const dx = u - 0.5;
      const dy = v - 0.5;
      if (dx * dx + dy * dy > 0.25) return; // outside disc
      const { x, z } = uvToScene(u, v);
      useScene.getState().setPlayer(x, z);
    };

    p.draw = () => {
      p.background(10, 14, 22);

      const size = Math.min(p.width, p.height);
      const ox = (p.width - size) / 2;
      const oy = (p.height - size) / 2;

      // Disc background — keeps the map square/centered regardless of panel aspect.
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
      const sun = sunPos(s.t);
      const moon = moonPos(s.t);

      const drawMarker = (x: number, z: number, r: number, fill: [number, number, number], stroke: [number, number, number] | null = null, alpha = 255) => {
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

      // Sun: yellow filled circle
      drawMarker(sun.x, sun.z, Math.max(6, size * 0.015), [255, 210, 60], [140, 90, 0]);
      // Moon: pale gray
      drawMarker(moon.x, moon.z, Math.max(5, size * 0.012), [230, 230, 240], [90, 90, 100]);
      // Player: bright green
      drawMarker(s.playerX, s.playerZ, Math.max(5, size * 0.012), [70, 255, 120], [0, 100, 30]);

      // small scale legend
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
