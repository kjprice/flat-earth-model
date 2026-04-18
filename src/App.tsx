import { Controls } from './components/Controls';
import { MapView } from './components/MapView';
import { Viewer } from './components/Viewer';

export default function App() {
  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900">
        <h1 className="text-sm font-semibold tracking-wide">
          Flat Earth First-Person Viewer
          <span className="ml-2 text-xs text-slate-400 font-normal">
            disc Ø 24,900 mi · sun/moon at 3,000 mi
          </span>
        </h1>
      </header>

      <Controls />

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <section className="relative md:w-[60%] h-[55vh] md:h-auto">
          <Viewer />
        </section>
        <section className="relative md:w-[40%] h-[45vh] md:h-auto border-t md:border-t-0 md:border-l border-slate-800">
          <MapView />
        </section>
      </main>
    </div>
  );
}
