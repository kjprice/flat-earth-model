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
import { cameraView } from '../state/cameraView';
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

// Eclipse-like alignment: new/full moon with sun & moon near the same
// latitude ring. Not true FE "eclipse" physics (there are no true eclipses
// on FE), but a reasonable proxy for "the two line up right now".
function eclipseState(
  phase: number,
  sunLatDeg: number,
  moonLatDeg: number,
): { kind: 'solar' | 'lunar' | null; score: number } {
  const f = ((phase % 1) + 1) % 1;
  const dLat = Math.abs(sunLatDeg - moonLatDeg);
  if (dLat > 4) return { kind: null, score: 0 };
  const distToNew = Math.min(f, 1 - f);
  const distToFull = Math.abs(f - 0.5);
  if (distToNew < 0.02) return { kind: 'solar', score: 1 - distToNew / 0.02 };
  if (distToFull < 0.02) return { kind: 'lunar', score: 1 - distToFull / 0.02 };
  return { kind: null, score: 0 };
}

// Convert camera yaw (radians) to compass bearing in degrees.
//
// Convention: yaw=0 faces scene +X and we label that North. The sun tracks
// across the scene in the XZ plane, so aligning compass N with a fixed scene
// axis (rather than "toward disc center") gives the viewer a steady frame
// of reference regardless of where they teleport.
function yawToBearing(yaw: number): number {
  const deg = (yaw * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

const COMPASS_MARKS: { label: string; deg: number; cardinal: boolean }[] = [
  { label: 'N', deg: 0, cardinal: true },
  { label: 'NE', deg: 45, cardinal: false },
  { label: 'E', deg: 90, cardinal: true },
  { label: 'SE', deg: 135, cardinal: false },
  { label: 'S', deg: 180, cardinal: true },
  { label: 'SW', deg: 225, cardinal: false },
  { label: 'W', deg: 270, cardinal: true },
  { label: 'NW', deg: 315, cardinal: false },
];

const COMPASS_HALF_SPAN = 45;

function Compass({ bearing }: { bearing: number }) {
  return (
    <div
      className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 h-8 bg-black/55 border border-slate-800 rounded-md overflow-hidden"
      style={{ width: 280 }}
    >
      {COMPASS_MARKS.map((m) => {
        let delta = m.deg - bearing;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        if (Math.abs(delta) > COMPASS_HALF_SPAN) return null;
        const xPct = 50 + (delta / COMPASS_HALF_SPAN) * 50;
        return (
          <span
            key={m.label}
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono ${
              m.cardinal ? 'text-sky-300 font-bold text-sm' : 'text-slate-400 text-[10px]'
            }`}
            style={{ left: `${xPct}%` }}
          >
            {m.label}
          </span>
        );
      })}
      <span className="absolute top-0 left-1/2 -translate-x-1/2 h-full w-px bg-amber-300/80" />
    </div>
  );
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
  const eclipse = eclipseState(phase, s.sunLatDeg, s.moonLatDeg);
  const bearing = yawToBearing(cameraView.yaw);

  return (
    <>
      <Compass bearing={bearing} />
      <div className="pointer-events-none absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-3 py-2 rounded-md text-[11px] font-mono text-slate-100 leading-tight border border-slate-800">
        <div className="text-sky-300 font-semibold">{formatSimTime(s.simMs)}</div>
        <div className="text-slate-400">moon: {phaseName(phase)} ({(phase * 100).toFixed(0)}%)</div>
        {eclipse.kind && (
          <div
            className={`mt-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${
              eclipse.kind === 'solar'
                ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                : 'bg-rose-500/25 border-rose-400 text-rose-200'
            }`}
          >
            {eclipse.kind === 'solar' ? '☼ solar alignment' : '☾ lunar alignment'}
            <span className="ml-1 text-slate-300 font-normal">
              (sun/moon lat Δ {Math.abs(s.sunLatDeg - s.moonLatDeg).toFixed(1)}°)
            </span>
          </div>
        )}
        <div className="mt-1 text-amber-300 font-semibold">Sun</div>
        <div>alt {s.sunAltitudeMi.toLocaleString()} mi · lat {s.sunLatDeg}°</div>
        <div>dist {dSunMi.toFixed(0)} mi</div>
        <div>ang Ø {sunAng.toFixed(3)}°</div>
        <div className="mt-1 text-slate-200 font-semibold">Moon</div>
        <div>alt {s.moonAltitudeMi.toLocaleString()} mi · lat {s.moonLatDeg}°</div>
        <div>dist {dMoonMi.toFixed(0)} mi</div>
        <div>ang Ø {moonAng.toFixed(3)}°</div>
        <div className="mt-1 text-slate-400">
          bearing {bearing.toFixed(0)}° · fov {s.fovDeg}°
        </div>
        {s.elevationMi > 0 && (
          <div className="mt-1 text-sky-300">Elevation: {s.elevationMi} mi</div>
        )}
      </div>
    </>
  );
}
