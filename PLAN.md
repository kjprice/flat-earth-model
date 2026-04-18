# Flat Earth First-Person Viewer — Build Plan

## Section 1 — What was built (Phase 1)

### Stack
- **React 18 + TypeScript + Vite** single-page app
- **p5.js** (v1.x) via `p5` npm package, instantiated in `new p5(sketch, containerEl)` instance mode
- **Zustand** for shared scene state (player position, sun/moon time `t`, elevation, pause, etc.)
- **Tailwind CSS** (v3) for layout + HUD styling
- Local flat earth map image served from `public/map.jpg`

### Scene constants (`src/constants.ts`)
- Single `FE` object holds all real-world dimensions in miles (disc radius, sun/moon altitude, sun/moon diameter, firmament height). Every render path reads normalized units = `miles / FE.discRadiusMi`, so disc radius = 1.0, sun altitude ≈ 0.241, moon diameter ≈ 0.00257. Swapping dimensions only requires changing this block.

### Layout (`src/App.tsx`)
- Desktop (>768px): flex row, viewer 60% / map 40%, full viewport height.
- Mobile (≤768px): column, viewer 55vh / map 45vh.
- Controls strip pinned above the viewer; live HUD overlaid inside viewer corner.

### First-person viewer (`src/components/Viewer.tsx`, WEBGL p5 instance)
- `perspective(PI/3, width/height, 0.001, 500)` called every frame. The spec
  requested a near of `0.00005`, but p5 internally clamps near ≤ 0.0001 up to
  0.01 and spams the console. `0.001` is the smallest value that survives the
  clamp — ~12 mi at our normalized scale, which is fine for ground-level
  viewing.
- p5 WEBGL display convention surprise: `+Y` world is rendered at the BOTTOM
  of the canvas even when `camera(..., 0, 1, 0)` is supplied as up. We pass
  `up = (0, -1, 0)` so `+Y` world (our sky direction) appears at the top of
  the canvas. Every Y coordinate in the scene (sun altitude, moon altitude,
  star dome, elevation) is positive for "above disc".
- Camera minimum eye height = 0.003 scene units (~37 mi). Prevents the eye
  from sitting exactly in the ground plane where the disc renders edge-on
  (zero pixels). When user elevation is 0 they're still "essentially at
  ground level" for the visualization.
- Ground: subdivided disc, 40 radial × 72 angular quads. Per-quad fill color
  picks from the midpoint's distance to sun XZ via a `dayness` term — day
  quads are warm green (`~130, 150, 100`), night quads deep slate
  (`~30, 50, 55`). Every 5th ring and every 6th spoke gets a grid highlight.
- Disc edge lip: 96 thin vertical quads ~0.008 scene units tall at the rim,
  colored pale white (the flat-earth "ice wall"). Visible as a bright line
  across the horizon from any viewer position.
- Firmament: 320 star boxes distributed on an upper hemisphere of radius
  `FIRMAMENT_HEIGHT * 0.985`. Alpha fades from 0 (day) to 1 (night) based on
  the XZ distance from the viewer to the sun's footprint.
- Sun: a 3D `sphere(SUN_RADIUS * 40)` translated to sun position. The 40× is
  a visibility multiplier — true angular size is a fraction of a pixel at our
  scale.
- Moon: a 3D `sphere(MOON_RADIUS * 40)` rendered inside a push/pop block with
  `ambientLight(14,14,20)` + `directionalLight(230,230,240, -sdWorld.xyz)`
  where `sdWorld = normalize(sunPos - moonPos)`. The sphere is geometrically
  lit by p5's Phong model, so the terminator and phase emerge automatically
  from `normal · sunDir`. When sun and moon are on opposite sides of the
  disc, we get crescent/gibbous phases in real time. `noLights()` after the
  pop resets state for subsequent frames.
- Camera: default mode recomputes look vector each frame from player XZ
  toward `(0, 0, 0)`. Free-look toggle swaps to `orbitControl()`. Look-at-Sun
  / Look-at-Moon / Look-at-Center buttons set `cameraLook` in the store and
  the viewer uses it as the camera target each frame.
- Moon phase via directional lighting replaces the original plan's
  GLSL-shader-on-a-billboard approach. p5's `texture()` + beginShape custom
  vertices didn't render reliably in p5 1.11, so we use a real 3D sphere lit
  by a directional light — cleaner code, identical visual result, and makes
  the flat-earth lighting contradiction immediately obvious (a sphere lit by
  a nearby point source cannot produce the phases we actually observe from a
  flat-earth geometry).

### Sun & moon orbit (`src/state/store.ts`)
- `t` advances from `requestAnimationFrame` loop using `millis / 1000 / dayDuration * TWO_PI`. Paused halts `t` advance; scrubber writes `t` directly.
- Sun: `x = 0.4 * cos(t)`, `z = 0.4 * sin(t)`, `y = -0.241`.
- Moon: same formula with `t + PI * 0.944`.

### 2D map view (`src/components/MapView.tsx`, p5 2D instance)
- Background: local `public/map.jpg` (azimuthal equidistant flat earth map, North Pole center). `loadImage()` with gray placeholder until ready. Disc spans full canvas width, centered.
- Scene → map UV: `u = 0.5 + x / 2`, `v = 0.5 + z / 2` (disc radius = 1 scene unit).
- Player marker: lime green dot + subtle outline at player UV.
- Sun: yellow filled circle at sun UV. Moon: light gray circle at moon UV.
- Click anywhere → convert pixel → UV → scene XZ, write to store. Elevation snapped to 0 unless user input is nonzero.

### Controls panel (`src/components/Controls.tsx`)
- Number input "Day duration (sec)" default 10.
- Number input "Elevation (miles)" default 0 → `cameraY = -elevation / FE.discRadiusMi`.
- Pause/Play toggle button.
- Range input 0–100 scrubber mapped to `0..TWO_PI` on `t`, bidirectional.
- Free-look checkbox.
- Look-at-Sun / Look-at-Moon buttons.

### HUD (`src/components/Hud.tsx`)
- Sun altitude (3000 mi), moon altitude (3000 mi).
- Live distance from viewer to sun and moon.
- Live angular size of sun and moon: `2 * atan(radius / distance)` in degrees. This visibly changes as the sun orbits overhead vs near the horizon — a flat earth contradiction surfaced in real time.

### Defaults
- Player starts at scene `(0.5, 0, 0.3)`, elevation 0.
- Camera facing `(0, 0, 0)` from that position.

---

## Section 2 — Phase 2 (do next)

1. **Atmosphere haze** — add a radial horizon gradient quad pinned to the camera, blending sky color to pale blue near the horizon. In the ground shader, mix ground color toward fog color based on `distanceFromCamera / fogRange`. Apply near the disc edge to soften it. Fragment-shader based so it can be tuned via uniforms (density, color).

2. **Sun corona / glow** — multi-layer radial gradient billboards (do not use bloom post). Stack 3–4 camera-facing quads behind the sun disc: innermost small bright-yellow alpha = 0.6, middle medium warm alpha = 0.3, outermost large pale alpha = 0.1. Draw with additive blending (`blendMode(ADD)`), then reset. No shader needed; a precomputed radial-gradient `p5.Graphics` used as a texture.

3. **Spotlight cone on map** — on the 2D map, before drawing player/sun/moon markers, fill a radial gradient circle centered at the sun's UV. Center color = warm yellow with alpha 0.35, edge alpha 0. Radius matches the day radius (0.4 scene units → 0.2 of canvas width). Use `drawingContext.createRadialGradient` for smooth falloff.

4. **FE model selector** — dropdown bound to a key of `FE_MODELS` (e.g., `standard3000`, `tall4000`, `wideDisc`). Each entry is a full `FE` constant object. Current `FE` becomes a Zustand selector `useFE()` reading from `FE_MODELS[selected]`. All render code already reads through the selector, so switching is instant.

5. **FOV slider** — range input 30°–120°, stored in Zustand. Viewer calls `perspective(radians(fov), width/height, 0.00005, 500)` each frame with the current value.

6. **Stars rotating around Polaris** — Polaris fixed at scene `(0, -FE.firmamentHeightMi/FE.discRadiusMi, 0)`. Each other star stored with a base spherical angle `(theta, phi)`. Per frame, add `rotationOffset = t` (same rate as sun cycle) to `theta` before conversion to cartesian. Polaris position bypasses the offset. This uses the existing firmament mesh — just recompute star positions each frame instead of caching.

---

## Section 3 — Optional / stretch goals

- **4-up split viewer** — multiple `Viewer` instances in a 2×2 CSS grid, each with its own player state in a `players: PlayerState[]` Zustand slice. Map shows all markers. A single shared time `t`.
- **Shareable URL** — encode `{x, z, elevation, t, paused, dayDuration, model}` into the URL hash as base64 JSON. On load, hydrate store from hash. Debounced write on state change.
- **FE vs globe side-by-side** — second viewer component rendering a sphere earth with the same lat/lon derived from flat-disc polar coords, same sun/moon positions. Makes the contradictions obvious visually.
- **Export PNG** — button calls `canvas.toBlob()` on the WEBGL canvas, downloads via `URL.createObjectURL`.
- **Contradiction annotations** — overlay labels pinned to scene points (sun, horizon, Antarctica ring) that explain the physics inconsistency on hover.
