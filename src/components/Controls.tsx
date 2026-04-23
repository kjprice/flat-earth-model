import { useRef } from 'react';
import { DAY_MS, TIME } from '../config/core';
import {
  CONTROLS_CONFIG,
  DATE_PRESETS,
  FE_THEORIES,
  SPEED_PRESETS,
  type FeTheory,
} from '../config/controls';
import { SCENE_STORE_DEFAULTS } from '../config/store';
import { useScene } from '../state/store';

// Split the datetime-local input into a native date picker + time picker.
// Chrome/Safari render a calendar popup for type=date on desktop, which is
// the "real date picker" the user wanted.
function simMsToDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function simMsToTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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
    fovDeg,
    setDayDuration,
    setElevation,
    togglePaused,
    setSimMs,
    setCameraLook,
    setSunConfig,
    setMoonConfig,
    setMoonLightingFE,
    setFov,
  } = useScene();

  const applyPreset = (p: (typeof DATE_PRESETS)[number]) => {
    const year = new Date(simMs).getFullYear();
    setSimMs(Date.UTC(year, p.monthIdx, p.day, TIME.presetUtcHour, 0, 0));
    setSunConfig({ latDeg: p.sunLat });
  };

  // A date preset is "active" when the sim clock matches its month/day AND
  // the sun latitude matches. Year is ignored so a preset stays highlighted
  // regardless of which year you jumped to.
  const isDatePresetActive = (p: (typeof DATE_PRESETS)[number]) => {
    const d = new Date(simMs);
    return (
      d.getUTCMonth() === p.monthIdx &&
      d.getUTCDate() === p.day &&
      Math.abs(sunLatDeg - p.sunLat) < CONTROLS_CONFIG.activeDatePresetLatToleranceDeg
    );
  };

  // Theory match: all four dimensions agree (within a small slop for the
  // user's hand-typed values).
  const isTheoryActive = (t: FeTheory) =>
    Math.abs(sunAltitudeMi - t.sunAltMi) < CONTROLS_CONFIG.theoryToleranceMi &&
    Math.abs(sunDiameterMi - t.sunDiaMi) < CONTROLS_CONFIG.theoryToleranceMi &&
    Math.abs(moonAltitudeMi - t.moonAltMi) < CONTROLS_CONFIG.theoryToleranceMi &&
    Math.abs(moonDiameterMi - t.moonDiaMi) < CONTROLS_CONFIG.theoryToleranceMi;

  const applyTheory = (t: FeTheory) => {
    setSunConfig({ altMi: t.sunAltMi, diaMi: t.sunDiaMi });
    setMoonConfig({ altMi: t.moonAltMi, diaMi: t.moonDiaMi });
  };

  // Inflate toggle: one-click swap between the canonical 32 mi Ø and a
  // 1,000 mi "visibility" size. Preserves the current moon:sun ratio in both
  // directions so a theory like Firmament (sun 2000 / moon 1500, ratio 0.75)
  // round-trips as 32→24 or 1000→750 — the toggle changes scale, not
  // proportion. Altitude and latitude stay put.
  const inflated =
    sunDiameterMi > CONTROLS_CONFIG.inflatedThresholdMi &&
    moonDiameterMi > CONTROLS_CONFIG.inflatedThresholdMi;
  const toggleInflate = () => {
    const ratio =
      sunDiameterMi > 0 && Number.isFinite(moonDiameterMi / sunDiameterMi)
        ? moonDiameterMi / sunDiameterMi
        : 1;
    const targetSun = inflated
      ? CONTROLS_CONFIG.shrinkSunDiameterMi
      : CONTROLS_CONFIG.inflateSunDiameterMi;
    setSunConfig({ diaMi: targetSun });
    setMoonConfig({
      diaMi: Math.max(CONTROLS_CONFIG.minBodyDiameterMi, Math.round(targetSun * ratio)),
    });
  };

  // Date/time helpers — preserve the opposite field when one changes.
  const onDateChange = (s: string) => {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return;
    const [, y, mo, d] = m;
    const cur = new Date(simMs);
    cur.setFullYear(Number(y));
    cur.setMonth(Number(mo) - 1);
    cur.setDate(Number(d));
    setSimMs(cur.getTime());
  };
  const onTimeChange = (s: string) => {
    const m = s.match(/^(\d{2}):(\d{2})$/);
    if (!m) return;
    const [, h, mm] = m;
    const cur = new Date(simMs);
    cur.setHours(Number(h));
    cur.setMinutes(Number(mm));
    cur.setSeconds(0);
    setSimMs(cur.getTime());
  };

  // Time jog: ephemeral slider that spans ±10 simulated days around an
  // anchor snapshot of simMs taken on pointer-down.
  const jogRef = useRef<HTMLInputElement>(null);
  const jogAnchorRef = useRef<number | null>(null);

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
            type="date"
            value={simMsToDate(simMs)}
            onChange={(e) => onDateChange(e.target.value)}
            className="px-1.5 py-1 bg-slate-800 rounded border border-slate-700 focus:border-sky-500 focus:outline-none"
          />
          <input
            type="time"
            value={simMsToTime(simMs)}
            onChange={(e) => onTimeChange(e.target.value)}
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
          {numberInput(
            dayDurationSec,
            (n) => setDayDuration(n || SCENE_STORE_DEFAULTS.dayDurationSec),
            'w-16',
            '1',
            '0.5',
          )}
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

        <div className="flex items-center gap-1">
          {DATE_PRESETS.map((p) => {
            const active = isDatePresetActive(p);
            return (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className={`px-1.5 py-0.5 rounded border text-[10px] ${
                  active
                    ? 'bg-sky-600 border-sky-400 text-white'
                    : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
                }`}
                title={`Jump to ${p.label} (sun lat ${p.sunLat}°)`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

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
              setSimMs(
                anchor +
                  (v / 1000) * ((CONTROLS_CONFIG.jogSpanDays * DAY_MS) / 2),
              );
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

        <label className="flex items-center gap-1.5">
          <span className="text-slate-400">FOV</span>
          <input
            type="range"
            min={30}
            max={120}
            step={1}
            value={fovDeg}
            onChange={(e) => setFov(parseFloat(e.target.value))}
            className="w-28 accent-sky-500"
          />
          <span className="text-slate-500 w-10 tabular-nums">{fovDeg}°</span>
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

      </div>

      <div className="flex flex-wrap items-center gap-3 px-3 py-1.5 border-t border-slate-800 bg-slate-900/60">
        <label className="flex items-center gap-1.5">
          <span className="text-slate-400">Theory</span>
          <select
            value={FE_THEORIES.find(isTheoryActive)?.id ?? ''}
            onChange={(e) => {
              const t = FE_THEORIES.find((x) => x.id === e.target.value);
              if (t) applyTheory(t);
            }}
            className="px-1.5 py-1 bg-slate-800 rounded border border-slate-700 focus:border-sky-500 focus:outline-none"
          >
            <option value="" disabled>
              Custom
            </option>
            {FE_THEORIES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={toggleInflate}
          className={`px-2 py-1 rounded border text-[11px] ${
            inflated
              ? 'bg-amber-500 text-black border-amber-400'
              : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
          }`}
          title="Swap sun/moon Ø between canonical 32 mi and a huge 3,000 mi"
        >
          {inflated ? 'shrink to 32 mi' : 'inflate sun/moon → 1,000 mi'}
        </button>

        <span className="ml-4 text-amber-300 font-semibold">Sun</span>
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
