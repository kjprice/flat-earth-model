import { useState } from 'react';
import { Controls } from './components/Controls';
import { Info } from './components/Info';
import { MapView } from './components/MapView';
import { Viewer } from './components/Viewer';
import { APP_CONFIG } from './config/app';
import { useScene } from './state/store';

export default function App() {
  // Controls panel toggle. Default open on desktop, closed on mobile so the
  // viewer gets max real estate for screen recording (TikTok etc.).
  const [controlsOpen, setControlsOpen] = useState(
    typeof window === 'undefined'
      ? true
      : window.innerWidth >= APP_CONFIG.controlsDesktopBreakpointPx,
  );
  const [infoOpen, setInfoOpen] = useState(false);
  const model = useScene((s) => s.model);

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900">
        <h1 className="text-sm font-semibold tracking-wide">
          {APP_CONFIG.title}
          <span className="ml-2 text-xs text-slate-400 font-normal hidden sm:inline">
            {APP_CONFIG.headerSummary}
          </span>
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setInfoOpen(true)}
            aria-label="About this app"
            className="px-2 py-1 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100 flex items-center gap-1.5"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
              <rect x="7.2" y="6.8" width="1.6" height="4.4" fill="currentColor" />
              <circle cx="8" cy="4.8" r="0.9" fill="currentColor" />
            </svg>
            <span className="text-[11px]">info</span>
          </button>
          <button
            onClick={() => setControlsOpen((v) => !v)}
            aria-label={controlsOpen ? 'Hide controls' : 'Show controls'}
            aria-expanded={controlsOpen}
            className="px-2 py-1 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100 flex items-center gap-1.5"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              {controlsOpen ? (
                <>
                  <line x1="3" y1="3" x2="13" y2="13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  <line x1="13" y1="3" x2="3" y2="13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </>
              ) : (
                <>
                  <rect x="2" y="4" width="12" height="1.6" fill="currentColor" />
                  <rect x="2" y="7.2" width="12" height="1.6" fill="currentColor" />
                  <rect x="2" y="10.4" width="12" height="1.6" fill="currentColor" />
                </>
              )}
            </svg>
            <span className="text-[11px]">{controlsOpen ? 'hide' : 'controls'}</span>
          </button>
        </div>
      </header>

      <Info open={infoOpen} onClose={() => setInfoOpen(false)} />

      {controlsOpen && <Controls />}

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        <section className={`relative min-h-0 ${model === 'globe' ? 'flex-1' : 'flex-[1_1_55%] md:flex-none md:w-[60%]'}`}>
          <Viewer />
          {model === 'globe' && (
            <div className="absolute right-3 bottom-3 h-44 w-44 sm:h-56 sm:w-56 overflow-hidden rounded-md border border-slate-700 bg-black/70 shadow-xl">
              <MapView />
            </div>
          )}
        </section>
        {model === 'flat' && (
          <section className="relative flex-[1_1_45%] md:flex-none md:w-[40%] border-t md:border-t-0 md:border-l border-slate-800 min-h-0">
            <MapView />
          </section>
        )}
      </main>
    </div>
  );
}
