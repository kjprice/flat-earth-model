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
          <li><b>Hamburger button:</b> toggles the Controls panel.</li>
          <li><b>Control sections:</b> open Time, View, Presets, Sun, or Moon to change those settings.</li>
          <li><b>Look at menu:</b> snaps the camera toward the selected target or leaves it in manual mode.</li>
          <li><b>Elevation:</b> raises the viewer above the ground, in miles.</li>
          <li><b>FOV:</b> vertical field of view. Human binocular vision is ≈ 100°.</li>
          <li><b>Shane lunar track:</b> in the Moon section, optionally switches the moon from a fixed FE latitude ring to a tilted, slowly precessing observational track.</li>
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
          <div>
            <dt className="font-semibold">Optional Shane lunar track</dt>
            <dd className="text-slate-400">
              Uses Shane/Walter-style lunar geometry: a 5.145° lunar tilt against
              the solar ecliptic, a 27.321661-day sidereal month, and an
              approximately 18.6-year precession cycle. This changes where the
              moon travels on the map; it does not change the synodic phase
              clock used for the phase label.
            </dd>
          </div>
        </dl>

        <h3 className="mt-4 text-amber-300 font-semibold">Map projection</h3>
        <p className="mt-1 text-slate-300 leading-relaxed">
          The overlay map is an azimuthal-equidistant projection with the North
          Pole at center — the standard FE / UN-logo layout. Scene +X maps to
          map-right, scene +Z maps to map-up; +Y is vertical in the world.
          The thin white curve is a projected day/night terminator; it is an
          observational overlay, separate from the local FE sun/moon light
          patches.
        </p>

        <h3 className="mt-4 text-amber-300 font-semibold">How perspective works</h3>
        <p className="mt-1 text-slate-300 leading-relaxed">
          Perspective is ordinary geometry: objects take up less of your view as
          their distance from you increases. A nearby object spans a larger angle
          in your eye or camera; the same object farther away spans a smaller
          angle. That is why railroad tracks appear to converge, why buildings
          shrink toward the horizon, and why a local FE sun should visibly change
          angular size as it moves closer or farther from the observer.
        </p>
        <p className="mt-2 text-slate-300 leading-relaxed">
          Perspective also changes elevation angle. If the sun stays at a fixed
          height but moves horizontally away, your line of sight tilts lower:
          elevation = atan(height / horizontal distance). On the FE geometry,
          that makes the sun descend toward the horizon because the viewing
          triangle gets longer and flatter.
        </p>
        <p className="mt-2 text-slate-300 leading-relaxed">
          What perspective does <em>not</em> do is hide distance, preserve
          brightness, or keep angular size constant. It predicts specific
          changes that can be measured. The Perspective Audit toggle shows the
          sun's apparent size relative to the same sun directly overhead, plus
          the horizontal-distance triangle that drives the elevation angle. The
          first-person viewer already uses a real perspective camera projection,
          so this is an audit of the geometry rather than a separate physics mode.
        </p>

        <h3 className="mt-4 text-amber-300 font-semibold">Inverse-square light problem</h3>
        <p className="mt-1 text-slate-300 leading-relaxed">
          Light intensity from a point-like source falls as <b>1 / distance²</b>.
          Double the distance and the same light is spread over four times the
          area, so the brightness drops to one quarter. Triple the distance and
          it drops to one ninth.
        </p>
        <p className="mt-2 text-slate-300 leading-relaxed">
          In this FE model the sun is only {DEFAULT_SUN_ALTITUDE_MI.toLocaleString()} miles
          above the disc. Standing directly below it means the sun is about{' '}
          {DEFAULT_SUN_ALTITUDE_MI.toLocaleString()} miles away. If the same sun is
          6,000 miles away horizontally, the line-of-sight distance is about
          6,700 miles, so the sunlight would be roughly 20% as intense as the
          overhead value before atmospheric effects. That is not what daylight
          does on Earth.
        </p>
        <p className="mt-2 text-slate-300 leading-relaxed">
          Another way to say it: perspective is what your camera angle measures.
          It makes the sun lower in the sky and smaller when it is farther away.
          Brightness is a separate energy-spreading problem. When enabled, the
          app's Sun HUD can show both numbers: "perspective size" is angular
          shrink, and "inverse-square light" is the brightness loss. A
          perspective argument has to explain both, not just rename one of them.
          The View tab can also apply inverse-square lighting to the rendered
          sun, daylight patch, stars, and moonlight so the physics consequence is
          visible instead of only listed as a metric.
        </p>

        <h3 className="mt-4 text-amber-300 font-semibold">Celestial sphere reference</h3>
        <p className="mt-1 text-slate-300 leading-relaxed">
          The observer azimuth/elevation readouts, projected terminator overlay,
          and track-overlay direction are inspired by Shane's Personal Celestial
          Sphere Model, itself based on Walter Bislin's public-domain model.
          Those ideas are ported here as native TypeScript helpers rather than
          embedded as legacy script code.
          The Moon panel can optionally switch to Shane's tilted, slowly
          precessing lunar track. This app still keeps the original physical FE
          view available so the simple centered-ring model and the observational
          projection model can be compared directly.
        </p>
        <p className="mt-1 text-slate-400 text-xs">
          Reference:{' '}
          <a
            href="https://adl.place/shanes-fe-model"
            target="_blank"
            rel="noreferrer"
            className="text-sky-300 underline hover:text-sky-200"
          >
            Shane's FE model
          </a>{' '}
          ·{' '}
          <a
            href="https://adl.place/shanes-fe-model/license.html"
            target="_blank"
            rel="noreferrer"
            className="text-sky-300 underline hover:text-sky-200"
          >
            license/attribution
          </a>
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
