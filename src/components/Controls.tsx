import { useRef, useState, type ReactNode } from 'react';
import { DAY_MS, TIME } from '../config/core';
import {
  CONTROLS_CONFIG,
  DATE_PRESETS,
  FE_THEORIES,
  SPEED_PRESETS,
  type FeTheory,
} from '../config/controls';
import { SCENE_STORE_DEFAULTS } from '../config/store';
import { latLonToScene, shaneMoonLatLon } from '../scene';
import { useScene } from '../state/store';

type SectionId = 'time' | 'view' | 'presets' | 'sun' | 'moon';

const inputClass =
  'px-1.5 py-1 bg-slate-800 rounded border border-slate-700 focus:border-sky-500 focus:outline-none';
const sectionShellClass = 'border border-slate-800 rounded-md bg-slate-900/60 overflow-hidden';
const NEW_YORK_MOON_VIEW = {
  latDeg: 47.27,
  lonDeg: -68.37,
  elevationMi: 0.001243,
  elevationLabel: '2 m (~6 ft)',
} as const;

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

type SectionProps = {
  id: SectionId;
  title: string;
  summary: string;
  openSection: SectionId | null;
  onToggle: (id: SectionId) => void;
  children: ReactNode;
};

function Section({ id, title, summary, openSection, onToggle, children }: SectionProps) {
  const open = openSection === id;
  return (
    <section className={sectionShellClass}>
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-800/70"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-slate-100">{title}</span>
          <span className="text-[11px] text-slate-400 truncate">{summary}</span>
        </span>
        <span className="text-slate-500 text-sm">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="px-3 pb-3 pt-1 border-t border-slate-800">{children}</div>}
    </section>
  );
}

export function Controls() {
  const [openSection, setOpenSection] = useState<SectionId | null>('time');
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
    shaneMoonOrbit,
    fovDeg,
    hudMetricsVisible,
    perspectiveAuditVisible,
    inverseSquareVisible,
    inverseSquareLightingEnabled,
    setDayDuration,
    setElevation,
    setPlayer,
    togglePaused,
    setSimMs,
    setCameraLook,
    setSunConfig,
    setMoonConfig,
    setMoonLightingFE,
    setShaneMoonOrbit,
    setFov,
    setPerspectiveAuditVisible,
    setInverseSquareVisible,
    setInverseSquareLightingEnabled,
  } = useScene();

  const teleportToCenterHighView = () => {
    setPlayer(0, 0);
    setElevation(CONTROLS_CONFIG.centerTeleportElevationMi);
    setCameraLook('center');
  };

  const teleportToNewYorkMoonView = () => {
    const position = latLonToScene(NEW_YORK_MOON_VIEW.latDeg, NEW_YORK_MOON_VIEW.lonDeg);
    setPlayer(position.x, position.z);
    setElevation(NEW_YORK_MOON_VIEW.elevationMi);
    setCameraLook('moon');
  };

  const applyPreset = (p: (typeof DATE_PRESETS)[number]) => {
    const year = new Date(simMs).getFullYear();
    setSimMs(Date.UTC(year, p.monthIdx, p.day, TIME.presetUtcHour, 0, 0));
    setSunConfig({ latDeg: p.sunLat });
  };

  const isDatePresetActive = (p: (typeof DATE_PRESETS)[number]) => {
    const d = new Date(simMs);
    return (
      d.getUTCMonth() === p.monthIdx &&
      d.getUTCDate() === p.day &&
      Math.abs(sunLatDeg - p.sunLat) < CONTROLS_CONFIG.activeDatePresetLatToleranceDeg
    );
  };

  const isTheoryActive = (t: FeTheory) =>
    Math.abs(sunAltitudeMi - t.sunAltMi) < CONTROLS_CONFIG.theoryToleranceMi &&
    Math.abs(sunDiameterMi - t.sunDiaMi) < CONTROLS_CONFIG.theoryToleranceMi &&
    Math.abs(moonAltitudeMi - t.moonAltMi) < CONTROLS_CONFIG.theoryToleranceMi &&
    Math.abs(moonDiameterMi - t.moonDiaMi) < CONTROLS_CONFIG.theoryToleranceMi;

  const applyTheory = (t: FeTheory) => {
    setSunConfig({ altMi: t.sunAltMi, diaMi: t.sunDiaMi });
    setMoonConfig({ altMi: t.moonAltMi, diaMi: t.moonDiaMi });
  };

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

  const jogRef = useRef<HTMLInputElement>(null);
  const jogAnchorRef = useRef<number | null>(null);

  const numberInput = (
    value: number,
    onChange: (n: number) => void,
    width: string,
    step = '1',
    min?: string,
    disabled = false,
  ) => (
    <input
      type="number"
      step={step}
      min={min}
      value={value}
      disabled={disabled}
      onChange={(e) => {
        const n = parseFloat(e.target.value);
        onChange(Number.isFinite(n) ? n : 0);
      }}
      className={`${width} ${inputClass} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    />
  );

  const activeSpeedPreset = SPEED_PRESETS.find((p) => p.secPerDay === dayDurationSec)?.label ?? '';
  const activeDatePreset = DATE_PRESETS.find(isDatePresetActive)?.label ?? '';
  const activeTheory = FE_THEORIES.find(isTheoryActive)?.id ?? '';
  const shaneMoonLat = shaneMoonLatLon(simMs).latDeg;
  const auditSummary =
    [
      perspectiveAuditVisible && 'perspective audit',
      inverseSquareVisible && 'inverse square',
      inverseSquareLightingEnabled && 'inverse-square lighting',
    ]
      .filter(Boolean)
      .join(' + ') || 'audits off';
  const metricsSummary = hudMetricsVisible ? 'metrics shown' : 'metrics hidden';

  return (
    <div className="bg-slate-900/90 border-b border-slate-800 text-xs text-slate-100 font-mono">
      <div className="flex flex-wrap items-center gap-3 px-3 py-2 border-b border-slate-800 bg-slate-900/70">
        <button
          onClick={togglePaused}
          className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold"
        >
          {paused ? 'Play' : 'Pause'}
        </button>

        <label className="flex items-center gap-1.5">
          <span className="text-slate-400">Look at</span>
          <select
            value={cameraLook}
            onChange={(e) => setCameraLook(e.target.value as typeof cameraLook)}
            className={inputClass}
          >
            <option value="center">Center</option>
            <option value="sun">Sun</option>
            <option value="moon">Moon</option>
            <option value="manual">Manual</option>
          </select>
        </label>

        <label className="flex items-center gap-1.5">
          <span className="text-slate-400">Elevation</span>
          {numberInput(elevationMi, (n) => setElevation(Math.max(0, n)), 'w-20', '1', '0')}
          <span className="text-slate-500">mi</span>
        </label>

        <button
          onClick={teleportToCenterHighView}
          className="px-2 py-1 rounded border bg-slate-800 border-slate-700 hover:bg-slate-700"
          title={`Teleport to the map center at ${CONTROLS_CONFIG.centerTeleportElevationMi.toLocaleString()} miles elevation`}
        >
          Center @ {CONTROLS_CONFIG.centerTeleportElevationMi.toLocaleString()} mi
        </button>

        <button
          onClick={teleportToNewYorkMoonView}
          className="px-2 py-1 rounded border bg-slate-800 border-slate-700 hover:bg-slate-700"
          title={`Teleport to ${NEW_YORK_MOON_VIEW.latDeg}° lat, ${NEW_YORK_MOON_VIEW.lonDeg}° lon at ${NEW_YORK_MOON_VIEW.elevationLabel} elevation and look at the moon`}
        >
          New York Facing Moon
        </button>
      </div>

      <div className="p-3 space-y-2">
        <Section
          id="time"
          title="Time"
          summary={`${simMsToDate(simMs)} ${simMsToTime(simMs)} • 1 day / ${dayDurationSec}s`}
          openSection={openSection}
          onToggle={(id) => setOpenSection(openSection === id ? null : id)}
        >
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5">
              <span className="text-slate-400">Date</span>
              <input
                type="date"
                value={simMsToDate(simMs)}
                onChange={(e) => onDateChange(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex items-center gap-1.5">
              <span className="text-slate-400">Time</span>
              <input
                type="time"
                value={simMsToTime(simMs)}
                onChange={(e) => onTimeChange(e.target.value)}
                className={inputClass}
              />
            </label>
            <button
              onClick={() => setSimMs(Date.now())}
              className="px-2 py-1 rounded border bg-slate-800 border-slate-700 hover:bg-slate-700"
              title="Reset date/time to now"
            >
              Now
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5">
              <span className="text-slate-400">1 day /</span>
              {numberInput(
                dayDurationSec,
                (n) => setDayDuration(n || SCENE_STORE_DEFAULTS.dayDurationSec),
                'w-16',
                '1',
                '0.5',
              )}
              <span className="text-slate-500">s</span>
            </label>

            <label className="flex items-center gap-1.5">
              <span className="text-slate-400">Speed</span>
              <select
                value={activeSpeedPreset}
                onChange={(e) => {
                  const preset = SPEED_PRESETS.find((p) => p.label === e.target.value);
                  if (preset) setDayDuration(preset.secPerDay);
                }}
                className={inputClass}
              >
                <option value="">Custom</option>
                {SPEED_PRESETS.map((p) => (
                  <option key={p.label} value={p.label}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-1.5">
              <span className="text-slate-400">Season</span>
              <select
                value={activeDatePreset}
                onChange={(e) => {
                  const preset = DATE_PRESETS.find((p) => p.label === e.target.value);
                  if (preset) applyPreset(preset);
                }}
                className={inputClass}
              >
                <option value="">Custom</option>
                {DATE_PRESETS.map((p) => (
                  <option key={p.label} value={p.label}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-2 flex items-center gap-2">
            <span className="text-slate-400 min-w-16" title="Drag to jump ±10 days; snaps back on release">
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
                setSimMs(anchor + (v / 1000) * ((CONTROLS_CONFIG.jogSpanDays * DAY_MS) / 2));
              }}
              className="flex-1 accent-sky-500"
            />
          </label>
        </Section>

        <Section
          id="view"
          title="View"
          summary={`look ${cameraLook} • ${elevationMi} mi • ${fovDeg}° FOV • ${metricsSummary} • ${auditSummary}`}
          openSection={openSection}
          onToggle={(id) => setOpenSection(openSection === id ? null : id)}
        >
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5">
              <span className="text-slate-400">Look at</span>
              <select
                value={cameraLook}
                onChange={(e) => setCameraLook(e.target.value as typeof cameraLook)}
                className={inputClass}
              >
                <option value="center">Center</option>
                <option value="sun">Sun</option>
                <option value="moon">Moon</option>
                <option value="manual">Manual</option>
              </select>
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
                className="w-32 accent-sky-500"
              />
              <span className="text-slate-500 w-10 tabular-nums">{fovDeg}°</span>
            </label>

            <button
              onClick={teleportToCenterHighView}
              className="px-2 py-1 rounded border bg-slate-800 border-slate-700 hover:bg-slate-700"
            >
              Center high view
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={perspectiveAuditVisible}
                onChange={(e) => setPerspectiveAuditVisible(e.target.checked)}
                className="accent-sky-500"
              />
              <span className="text-slate-400">Perspective Audit</span>
            </label>

            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={inverseSquareVisible}
                onChange={(e) => setInverseSquareVisible(e.target.checked)}
                className="accent-sky-500"
              />
              <span className="text-slate-400">Inverse Square</span>
            </label>

            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={inverseSquareLightingEnabled}
                onChange={(e) => setInverseSquareLightingEnabled(e.target.checked)}
                className="accent-amber-500"
              />
              <span
                className="text-slate-400"
                title="Actually dims rendered sun, daylight, and moonlight by distance squared"
              >
                Apply inverse-square lighting
              </span>
            </label>
          </div>
        </Section>

        <Section
          id="presets"
          title="Presets"
          summary={`${activeTheory || 'custom theory'} • ${inflated ? 'inflated bodies' : 'canonical sizes'}`}
          openSection={openSection}
          onToggle={(id) => setOpenSection(openSection === id ? null : id)}
        >
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5">
              <span className="text-slate-400">Theory</span>
              <select
                value={activeTheory}
                onChange={(e) => {
                  const t = FE_THEORIES.find((x) => x.id === e.target.value);
                  if (t) applyTheory(t);
                }}
                className={inputClass}
              >
                <option value="">Custom</option>
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
              title="Swap sun/moon Ø between canonical 32 mi and a huge 1,000 mi"
            >
              {inflated ? 'shrink to 32 mi' : 'inflate sun/moon'}
            </button>
          </div>
        </Section>

        <Section
          id="sun"
          title="Sun"
          summary={`${sunAltitudeMi.toLocaleString()} mi alt • ${sunDiameterMi.toLocaleString()} mi Ø • ${sunLatDeg}° lat`}
          openSection={openSection}
          onToggle={(id) => setOpenSection(openSection === id ? null : id)}
        >
          <div className="flex flex-wrap items-center gap-3">
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
          </div>
        </Section>

        <Section
          id="moon"
          title="Moon"
          summary={`${moonAltitudeMi.toLocaleString()} mi alt • ${moonDiameterMi.toLocaleString()} mi Ø • ${
            shaneMoonOrbit ? `${shaneMoonLat.toFixed(1)}° Shane track` : `${moonLatDeg}° lat`
          }`}
          openSection={openSection}
          onToggle={(id) => setOpenSection(openSection === id ? null : id)}
        >
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5">
              <span className="text-slate-400">alt</span>
              {numberInput(
                moonAltitudeMi,
                (n) => setMoonConfig({ altMi: n }),
                'w-20',
                '100',
                '0',
              )}
              <span className="text-slate-500">mi</span>
            </label>
            <label className="flex items-center gap-1.5">
              <span className="text-slate-400">Ø</span>
              {numberInput(
                moonDiameterMi,
                (n) => setMoonConfig({ diaMi: n }),
                'w-16',
                '1',
                '1',
              )}
              <span className="text-slate-500">mi</span>
            </label>
            <label className="flex items-center gap-1.5">
              <span className="text-slate-400">lat</span>
              {numberInput(
                shaneMoonOrbit ? Number(shaneMoonLat.toFixed(1)) : moonLatDeg,
                (n) => setMoonConfig({ latDeg: n }),
                'w-16',
                '0.5',
                undefined,
                shaneMoonOrbit,
              )}
              <span className="text-slate-500">°</span>
            </label>

            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={shaneMoonOrbit}
                onChange={(e) => setShaneMoonOrbit(e.target.checked)}
                className="accent-sky-500"
              />
              <span title="Use Shane's 5.145° tilted, slowly precessing lunar track instead of a fixed centered FE ring.">
                Shane lunar track
              </span>
            </label>

            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={moonLightingFE}
                onChange={(e) => setMoonLightingFE(e.target.checked)}
                className="accent-sky-500"
              />
              <span title="Moon is self-luminous and shadowed on the sun-facing side — the inverse of real phases.">
                FE moon lighting
              </span>
            </label>
          </div>
        </Section>
      </div>
    </div>
  );
}
