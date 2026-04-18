import { useEffect, useState } from 'react';
import { FE } from '../constants';
import {
  dist3,
  formatSimTime,
  moonPos,
  phaseFraction,
  sunPos,
  type Vec3,
} from '../scene';
import { useScene } from '../state/store';

function angularSizeDeg(diameterMi: number, distanceSceneUnits: number): number {
  const radiusScene = diameterMi / 2 / FE.discRadiusMi;
  return (2 * Math.atan(radiusScene / Math.max(1e-9, distanceSceneUnits)) * 180) / Math.PI;
}

function phaseName(frac: number): string {
  const f = ((frac % 1) + 1) % 1;
  if (f < 0.03 || f > 0.97) return 'new';
  if (f < 0.22) return 'waxing crescent';
  if (f < 0.28) return 'first quarter';
  if (f < 0.47) return 'waxing gibbous';
  if (f < 0.53) return 'full';
  if (f < 0.72) return 'waning gibbous';
  if (f < 0.78) return 'last quarter';
  return 'waning crescent';
}

export function Hud() {
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
  const sun = sunPos(s.simMs, s.sunAltitudeMi, s.sunLatDeg);
  const moon = moonPos(s.simMs, s.moonAltitudeMi, s.moonLatDeg);

  const dSun = dist3(eye, sun);
  const dMoon = dist3(eye, moon);

  const dSunMi = dSun * FE.discRadiusMi;
  const dMoonMi = dMoon * FE.discRadiusMi;

  const sunAng = angularSizeDeg(s.sunDiameterMi, dSun);
  const moonAng = angularSizeDeg(s.moonDiameterMi, dMoon);

  const phase = phaseFraction(s.simMs);

  return (
    <div className="pointer-events-none absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-3 py-2 rounded-md text-[11px] font-mono text-slate-100 leading-tight border border-slate-800">
      <div className="text-sky-300 font-semibold">{formatSimTime(s.simMs)}</div>
      <div className="text-slate-400">moon: {phaseName(phase)} ({(phase * 100).toFixed(0)}%)</div>
      <div className="mt-1 text-amber-300 font-semibold">Sun</div>
      <div>alt {s.sunAltitudeMi.toLocaleString()} mi · lat {s.sunLatDeg}°</div>
      <div>dist {dSunMi.toFixed(0)} mi</div>
      <div>ang Ø {sunAng.toFixed(3)}°</div>
      <div className="mt-1 text-slate-200 font-semibold">Moon</div>
      <div>alt {s.moonAltitudeMi.toLocaleString()} mi · lat {s.moonLatDeg}°</div>
      <div>dist {dMoonMi.toFixed(0)} mi</div>
      <div>ang Ø {moonAng.toFixed(3)}°</div>
      {s.elevationMi > 0 && (
        <div className="mt-1 text-sky-300">Elevation: {s.elevationMi} mi</div>
      )}
    </div>
  );
}
