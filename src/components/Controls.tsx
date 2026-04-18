import { useRef } from 'react';
import { DAY_MS } from '../constants';
import { useScene } from '../state/store';

// Format simMs for an <input type="datetime-local"> (local time zone).
function simMsToLocalInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToMs(s: string): number {
  const parsed = new Date(s);
  const t = parsed.getTime();
  return Number.isFinite(t) ? t : Date.now();
}

// Speed presets: seconds of real time per simulated day.
const SPEED_PRESETS: { label: string; secPerDay: number }[] = [
  { label: '10s/day', secPerDay: 10 },
  { label: '1m/day', secPerDay: 60 },
  { label: '10m/day', secPerDay: 600 },
  { label: '1h/day', secPerDay: 3600 },
  { label: 'real', secPerDay: 86400 },
];

export function Controls() {
  const {
    dayDurationSec,
    elevationMi,
    paused,
    simMs,
    cameraLook,
    sunAltitudeMi,
    sunDiameterMi,
    sunLatDeg,
    moonAltitudeMi,
    moonDiameterMi,
    moonLatDeg,
    moonLightingFE,
    setDayDuration,
    setElevation,
    togglePaused,
    setSimMs,
    setCameraLook,
    setSunConfig,
    setMoonConfig,
    setMoonLightingFE,
  } = useScene();

  // Time jog: ephemeral slider that spans ±10 simulated days around an
  // anchor snapshot of simMs taken on pointer-down.
  const jogRef = useRef<HTMLInputElement>(null);
  const jogAnchorRef = useRef<number | null>(null);
  // Jog window = 10 sim days. The speed multiplier is indirectly reflected
  // in how fast the sim auto-advances after you release.
  const JOG_SPAN_MS = 10 * DAY_MS;

  const numberInput = (
    value: number,
    onChange: (n: number) => void,
    width: string,
    step = '1',
    min?: string,
  ) => (
    <input
      type="number"
      step={step}
      min={min}
      value={value}
      onChange={(e) => {
        const n = parseFloat(e.target.value);
        onChange(Number.isFinite(n) ? n : 0);
      }}
      className={`${width} px-1.5 py-1 bg-slate-800 rounded border border-slate-700 focus:border-sky-500 focus:outline-none`}
    />
  );

  return (
    <div className="bg-slate-900/90 border-b border-slate-800 text-xs text-slate-100 font-mono">
      <div className="flex flex-wrap items-center gap-3 px-3 py-2">
        <label className="flex items-center gap-1.5">
          <span className="text-slate-400">Date</span>
          <input
            type="datetime-local"
            value={simMsToLocalInput(simMs)}
            onChange={(e) => setSimMs(localInputToMs(e.target.value))}
            className="px-1.5 py-1 bg-slate-800 rounded border border-slate-700 focus:border-sky-500 focus:outline-none"
          />
        </label>
        <button
          onClick={() => setSimMs(Date.now())}
          className="px-2 py-1 rounded border bg-slate-800 border-slate-700 hover:bg-slate-700"
          title="Reset date/time to now"
        >
          Now
        </button>

        <label className="flex items-center gap-1.5">
          <span className="text-slate-400">Speed: 1 day /</span>
          {numberInput(dayDurationSec, (n) => setDayDuration(n || 60), 'w-16', '1', '0.5')}
          <span className="text-slate-500">s</span>
        </label>
        <div className="flex items-center gap-1">
          {SPEED_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setDayDuration(p.secPerDay)}
              className={`px-1.5 py-0.5 rounded border text-[10px] ${
                dayDurationSec === p.secPerDay
                  ? 'bg-sky-600 border-sky-400 text-white'
                  : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <button
          onClick={togglePaused}
          className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold"
        >
          {paused ? 'Play' : 'Pause'}
        </button>

        <label className="flex items-center gap-1.5 flex-1 min-w-[180px]">
          <span className="text-slate-400" title="Drag to jump ±10 days; snaps back on release">
            jog ±10d
          </span>
          <input
            ref={jogRef}
            type="range"
            min={-1000}
            max={1000}
            defaultValue={0}
            onPointerDown={() => {
              jogAnchorRef.current = useScene.getState().simMs;
            }}
            onPointerUp={() => {
              if (jogRef.current) jogRef.current.value = '0';
              jogAnchorRef.current = null;
            }}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              const anchor = jogAnchorRef.current ?? useScene.getState().simMs;
              setSimMs(anchor + (v / 1000) * (JOG_SPAN_MS / 2));
            }}
            className="flex-1 accent-sky-500"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-3 py-1.5 border-t border-slate-800 bg-slate-900/60">
        <label className="flex items-center gap-1.5">
          <span className="text-slate-400">Elevation (mi)</span>
          {numberInput(elevationMi, (n) => setElevation(Math.max(0, n)), 'w-20', '1', '0')}
        </label>

        <button
          onClick={() => setCameraLook('sun')}
          className={`px-2 py-1 rounded border ${
            cameraLook === 'sun' ? 'bg-amber-500 text-black border-amber-400' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
          }`}
        >
          Look at Sun
        </button>
        <button
          onClick={() => setCameraLook('moon')}
          className={`px-2 py-1 rounded border ${
            cameraLook === 'moon' ? 'bg-slate-200 text-black border-slate-300' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
          }`}
        >
          Look at Moon
        </button>
        <button
          onClick={() => setCameraLook('center')}
          className={`px-2 py-1 rounded border ${
            cameraLook === 'center' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
          }`}
        >
          Look at Center
        </button>

        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={moonLightingFE}
            onChange={(e) => setMoonLightingFE(e.target.checked)}
            className="accent-sky-500"
          />
          <span title="Moon is self-luminous and shadowed on the sun-facing side — the inverse of real phases.">
            FE moon
          </span>
        </label>

        <span className="text-slate-500 ml-auto">drag viewer to look around</span>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-3 py-1.5 border-t border-slate-800 bg-slate-900/60">
        <span className="text-amber-300 font-semibold">Sun</span>
        <label className="flex items-center gap-1.5">
          <span className="text-slate-400">alt</span>
          {numberInput(sunAltitudeMi, (n) => setSunConfig({ altMi: n }), 'w-20', '100', '0')}
          <span className="text-slate-500">mi</span>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-slate-400">Ø</span>
          {numberInput(sunDiameterMi, (n) => setSunConfig({ diaMi: n }), 'w-16', '1', '1')}
          <span className="text-slate-500">mi</span>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-slate-400">lat</span>
          {numberInput(sunLatDeg, (n) => setSunConfig({ latDeg: n }), 'w-16', '0.5')}
          <span className="text-slate-500">°</span>
        </label>

        <span className="ml-4 text-slate-200 font-semibold">Moon</span>
        <label className="flex items-center gap-1.5">
          <span className="text-slate-400">alt</span>
          {numberInput(moonAltitudeMi, (n) => setMoonConfig({ altMi: n }), 'w-20', '100', '0')}
          <span className="text-slate-500">mi</span>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-slate-400">Ø</span>
          {numberInput(moonDiameterMi, (n) => setMoonConfig({ diaMi: n }), 'w-16', '1', '1')}
          <span className="text-slate-500">mi</span>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-slate-400">lat</span>
          {numberInput(moonLatDeg, (n) => setMoonConfig({ latDeg: n }), 'w-16', '0.5')}
          <span className="text-slate-500">°</span>
        </label>
      </div>
    </div>
  );
}
