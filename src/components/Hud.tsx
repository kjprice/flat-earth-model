import { useEffect, useState } from 'react';
import { FE } from '../constants';
import { dist3, moonPos, sunPos, type Vec3 } from '../scene';
import { useScene } from '../state/store';

// Angular size in degrees of a body with given diameter (mi) at given distance (scene units).
function angularSizeDeg(diameterMi: number, distanceSceneUnits: number): number {
  const radiusScene = diameterMi / 2 / FE.discRadiusMi;
  return (2 * Math.atan(radiusScene / Math.max(1e-9, distanceSceneUnits)) * 180) / Math.PI;
}

export function Hud() {
  // Re-render on an animation tick so HUD tracks t without triggering Zustand
  // subscriptions on every frame.
  const [, setTick] = useState(0);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setTick((n) => (n + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const s = useScene.getState();
  const eye: Vec3 = { x: s.playerX, y: s.elevationMi / FE.discRadiusMi, z: s.playerZ };
  const sun = sunPos(s.t);
  const moon = moonPos(s.t);

  const dSun = dist3(eye, sun);
  const dMoon = dist3(eye, moon);

  const dSunMi = dSun * FE.discRadiusMi;
  const dMoonMi = dMoon * FE.discRadiusMi;

  const sunAng = angularSizeDeg(FE.sunDiameterMi, dSun);
  const moonAng = angularSizeDeg(FE.moonDiameterMi, dMoon);

  return (
    <div className="pointer-events-none absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-3 py-2 rounded-md text-[11px] font-mono text-slate-100 leading-tight border border-slate-800">
      <div className="text-amber-300 font-semibold">Sun</div>
      <div>alt {FE.sunAltitudeMi.toLocaleString()} mi</div>
      <div>dist {dSunMi.toFixed(0)} mi</div>
      <div>ang Ø {sunAng.toFixed(3)}°</div>
      <div className="mt-1 text-slate-200 font-semibold">Moon</div>
      <div>alt {FE.moonAltitudeMi.toLocaleString()} mi</div>
      <div>dist {dMoonMi.toFixed(0)} mi</div>
      <div>ang Ø {moonAng.toFixed(3)}°</div>
      {s.elevationMi > 0 && (
        <div className="mt-1 text-sky-300">Elevation: {s.elevationMi} mi</div>
      )}
    </div>
  );
}
