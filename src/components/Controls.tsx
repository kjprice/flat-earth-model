import { useScene } from '../state/store';

const TWO_PI = Math.PI * 2;

export function Controls() {
  const {
    dayDurationSec,
    elevationMi,
    paused,
    t,
    cameraLook,
    setDayDuration,
    setElevation,
    togglePaused,
    setT,
    setCameraLook,
  } = useScene();

  const freeLook = cameraLook === 'free';

  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-2 bg-slate-900/90 border-b border-slate-800 text-xs text-slate-100 font-mono">
      <label className="flex items-center gap-1.5">
        <span className="text-slate-400">Day (s)</span>
        <input
          type="number"
          step="0.5"
          min="0.5"
          value={dayDurationSec}
          onChange={(e) => setDayDuration(parseFloat(e.target.value) || 10)}
          className="w-16 px-1.5 py-1 bg-slate-800 rounded border border-slate-700 focus:border-sky-500 focus:outline-none"
        />
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-slate-400">Elevation (mi)</span>
        <input
          type="number"
          step="1"
          min="0"
          value={elevationMi}
          onChange={(e) => setElevation(Math.max(0, parseFloat(e.target.value) || 0))}
          className="w-20 px-1.5 py-1 bg-slate-800 rounded border border-slate-700 focus:border-sky-500 focus:outline-none"
        />
      </label>

      <button
        onClick={togglePaused}
        className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold"
      >
        {paused ? 'Play' : 'Pause'}
      </button>

      <label className="flex items-center gap-1.5 flex-1 min-w-[180px]">
        <span className="text-slate-400">t</span>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round((t / TWO_PI) * 1000)}
          onChange={(e) => setT((parseInt(e.target.value, 10) / 1000) * TWO_PI)}
          className="flex-1 accent-sky-500"
        />
      </label>

      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={freeLook}
          onChange={(e) => setCameraLook(e.target.checked ? 'free' : 'center')}
          className="accent-sky-500"
        />
        <span>Free look</span>
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
    </div>
  );
}
