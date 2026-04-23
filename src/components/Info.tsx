import {
  DEFAULT_SUN_ALTITUDE_MI,
  DEFAULT_SUN_DIAMETER_MI,
  FE,
  TIME,
} from '../config/core';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function Info({ open, onClose }: Props) {
  if (!open) return null;
  const discDiameterMi = FE.discRadiusMi * 2;
  const synodicDays = TIME.synodicMs / TIME.dayMs;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3"
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-full max-h-[85vh] overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-5 text-sm text-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-2 right-2 w-8 h-8 rounded hover:bg-slate-800 flex items-center justify-center"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <line x1="3" y1="3" x2="13" y2="13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="13" y1="3" x2="3" y2="13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>

        <h2 className="text-lg font-semibold text-sky-300">About this app</h2>
        <p className="mt-2 text-slate-300 leading-relaxed">
          A first-person simulator of the classical Flat Earth (FE) model: a disc
          {discDiameterMi.toLocaleString()} miles across with a small, low sun and moon circling overhead.
          Stand anywhere on the disc, point your camera wherever, and see what
          the sky would <em>actually</em> look like if the FE claims were
          geometrically true. Spoiler: it doesn't match what anyone observes.
        </p>

        <h3 className="mt-4 text-amber-300 font-semibold">Controls</h3>
        <ul className="mt-1 list-disc pl-5 space-y-1 text-slate-200">
          <li><b>Viewer (left):</b> click-drag to look around. On touch, drag to look.</li>
          <li><b>Map (right):</b> click anywhere inside the disc to teleport there.</li>
          <li><b>Hamburger button:</b> toggles the Controls panel (time, sun/moon size, FOV, etc.).</li>
          <li><b>Look at Sun / Moon / Center:</b> snaps the camera toward that target.</li>
          <li><b>Elevation:</b> raises the viewer above the ground, in miles.</li>
          <li><b>FOV:</b> vertical field of view. Human binocular vision is ≈ 100°.</li>
          <li><b>Time speed:</b> how many real-time seconds equal one simulated day.</li>
        </ul>

        <h3 className="mt-4 text-amber-300 font-semibold">Where the numbers come from</h3>
        <dl className="mt-1 space-y-2 text-slate-200">
          <div>
            <dt className="font-semibold">Disc diameter: {discDiameterMi.toLocaleString()} mi</dt>
            <dd className="text-slate-400">
              The standard FE figure, equal to Earth's measured equatorial
              circumference. Originates from Samuel Rowbotham's <em>Zetetic
              Astronomy</em> (1865) and is used by the modern Flat Earth Society.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">
              Sun &amp; moon altitude: {DEFAULT_SUN_ALTITUDE_MI.toLocaleString()} mi
            </dt>
            <dd className="text-slate-400">
              Rowbotham's figure, derived by applying plane trigonometry to the
              sun's observed altitude at two different latitudes (a calculation
              that assumes a flat Earth in its premise).
            </dd>
          </div>
          <div>
            <dt className="font-semibold">
              Sun &amp; moon diameter: {DEFAULT_SUN_DIAMETER_MI.toLocaleString()} mi
            </dt>
            <dd className="text-slate-400">
              Also from Rowbotham, by measuring the sun's angular size and
              assuming it is {DEFAULT_SUN_ALTITUDE_MI.toLocaleString()} miles away.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">
              Firmament height: {FE.firmamentHeightMi.toLocaleString()} mi
            </dt>
            <dd className="text-slate-400">
              A commonly cited FE figure, placing the "dome" just above the sun
              and moon. Varies wildly between FE sources.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Sun/moon latitude tracks (rings)</dt>
            <dd className="text-slate-400">
              The sun spirals between the Tropic of Cancer (23.5° N) and the
              Tropic of Capricorn (23.5° S) over the year — these are the real
              astronomical subsolar latitudes. On this map, 90° N is the disc
              center and 90° S is the rim.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Moon phase</dt>
            <dd className="text-slate-400">
              Synodic month ≈ {synodicDays.toFixed(2)} days, anchored to the 2000-01-06 18:14 UTC
              new moon. Phase is driven by the angular separation between the
              sun and moon on the disc.
            </dd>
          </div>
        </dl>

        <h3 className="mt-4 text-amber-300 font-semibold">Map projection</h3>
        <p className="mt-1 text-slate-300 leading-relaxed">
          The overlay map is an azimuthal-equidistant projection with the North
          Pole at center — the standard FE / UN-logo layout. Scene +X maps to
          map-right, scene +Z maps to map-up; +Y is vertical in the world.
        </p>

        <p className="mt-4 text-slate-500 text-xs">
          This project is a geometry demo, not an endorsement. All figures are
          taken at FE-community face value so you can see what the sky they
          describe would actually look like.
        </p>
      </div>
    </div>
  );
}
