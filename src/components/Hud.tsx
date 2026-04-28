import { useEffect, useState } from 'react';
import { FE } from '../config/core';
import {
  COMPASS_MARKS,
  ECLIPSE_CONFIG,
  HUD_CONFIG,
  PHASE_LABEL_THRESHOLDS,
} from '../config/hud';
import {
  dist3,
  eyeHeightMi,
  formatSimTime,
  moonPos,
  phaseFraction,
  sceneToLatLon,
  sunPos,
  type Vec3,
} from '../scene';
import { cameraView } from '../state/cameraView';
import { useScene } from '../state/store';

function angularSizeDeg(diameterMi: number, distanceSceneUnits: number): number {
  const radiusScene = diameterMi / 2 / FE.discRadiusMi;
  return (
    (2 * Math.atan(radiusScene / Math.max(HUD_CONFIG.angularDistanceFloor, distanceSceneUnits)) *
      180) /
    Math.PI
  );
}

function formatEyeHeight(heightMi: number): string {
  if (heightMi < 1) return `${(heightMi * 5280).toFixed(1)} ft`;
  return `${heightMi.toFixed(2)} mi`;
}

function formatSignedCoordinate(valueDeg: number, positive: string, negative: string): string {
  const suffix = valueDeg >= 0 ? positive : negative;
  return `${Math.abs(valueDeg).toFixed(2)}°${suffix}`;
}

function phaseName(frac: number): string {
  const f = ((frac % 1) + 1) % 1;
  if (f < PHASE_LABEL_THRESHOLDS[0].max || f > 1 - PHASE_LABEL_THRESHOLDS[0].max) return 'new';
  for (let i = 1; i < PHASE_LABEL_THRESHOLDS.length; i++) {
    if (f < PHASE_LABEL_THRESHOLDS[i].max) return PHASE_LABEL_THRESHOLDS[i].label;
  }
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
  if (dLat > ECLIPSE_CONFIG.maxLatitudeDeltaDeg) return { kind: null, score: 0 };
  const distToNew = Math.min(f, 1 - f);
  const distToFull = Math.abs(f - 0.5);
  if (distToNew < ECLIPSE_CONFIG.alignmentThreshold) {
    return { kind: 'solar', score: 1 - distToNew / ECLIPSE_CONFIG.alignmentThreshold };
  }
  if (distToFull < ECLIPSE_CONFIG.alignmentThreshold) {
    return { kind: 'lunar', score: 1 - distToFull / ECLIPSE_CONFIG.alignmentThreshold };
  }
  return { kind: null, score: 0 };
}

// Convert camera yaw (radians) to a compass bearing in degrees on the FE
// azimuthal-equidistant disc: "north" = direction from the player toward
// the disc center (the pole). At the center north is undefined; fall back
// to scene +X so the compass still renders, but the value is meaningless.
function yawToBearing(yaw: number, playerX: number, playerZ: number): number {
  const r = Math.hypot(playerX, playerZ);
  const northYaw = r < HUD_CONFIG.centerNorthRadiusFloor ? 0 : Math.atan2(-playerZ, -playerX);
  const deg = ((northYaw - yaw) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

function Compass({ bearing }: { bearing: number }) {
  return (
    <div
      className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 h-8 bg-black/55 border border-slate-800 rounded-md overflow-hidden"
      style={{ width: HUD_CONFIG.compassWidthPx }}
    >
      {COMPASS_MARKS.map((m) => {
        let delta = m.deg - bearing;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        if (Math.abs(delta) > HUD_CONFIG.compassHalfSpanDeg) return null;
        const xPct = 50 + (delta / HUD_CONFIG.compassHalfSpanDeg) * 50;
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
      setTick((n) => (n + 1) % HUD_CONFIG.rerenderModulo);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const s = useScene.getState();
  const renderedEyeMi = eyeHeightMi(s.elevationMi);
  const eye: Vec3 = { x: s.playerX, y: renderedEyeMi / FE.discRadiusMi, z: s.playerZ };
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
  const bearing = yawToBearing(cameraView.yaw, s.playerX, s.playerZ);
  const eyeLatLon = sceneToLatLon(s.playerX, s.playerZ);
  const eyeLat = formatSignedCoordinate(eyeLatLon.latDeg, 'N', 'S');
  const eyeLon =
    eyeLatLon.lonDeg === null ? 'n/a' : formatSignedCoordinate(eyeLatLon.lonDeg, 'E', 'W');

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
        <div className="mt-1 text-sky-300">eye {formatEyeHeight(renderedEyeMi)}</div>
        <div className="text-slate-400">
          lat {eyeLat} · lon {eyeLon}
        </div>
        {s.elevationMi !== renderedEyeMi && (
          <div className="text-slate-500">requested {s.elevationMi.toFixed(2)} mi</div>
        )}
      </div>
    </>
  );
}
