import { DAY_MS } from '../constants';
import { useScene } from '../state/store';

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
    setTimeOfDay,
    setCameraLook,
    setSunConfig,
    setMoonConfig,
    setMoonLightingFE,
  } = useScene();

  const todFraction = ((simMs % DAY_MS) + DAY_MS) % DAY_MS / DAY_MS;

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
          <span className="text-slate-400">Day (s)</span>
          {numberInput(dayDurationSec, (n) => setDayDuration(n || 60), 'w-16', '1', '0.5')}
        </label>

        <label className="flex items-center gap-1.5">
          <span className="text-slate-400">Elevation (mi)</span>
          {numberInput(elevationMi, (n) => setElevation(Math.max(0, n)), 'w-20', '1', '0')}
        </label>

        <button
          onClick={togglePaused}
          className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold"
        >
          {paused ? 'Play' : 'Pause'}
        </button>

        <label className="flex items-center gap-1.5 flex-1 min-w-[180px]">
          <span className="text-slate-400">time of day</span>
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(todFraction * 1000)}
            onChange={(e) => setTimeOfDay(parseInt(e.target.value, 10) / 1000)}
            className="flex-1 accent-sky-500"
          />
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
          <span title="Lit hemisphere of the moon faces AWAY from the sun — the flat-earther 'self-luminous moon, shadowed by sun' claim.">
            FE moon
          </span>
        </label>
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

        <span className="text-slate-500 ml-auto">drag viewer to look around</span>
      </div>
    </div>
  );
}
