# Space Relics 3D — Solar System Explorer

An interactive 3D Solar System where every planet is surrounded by the real hardware sent to
it: rovers, landers, orbiters, satellites, space telescopes, probes, helicopters and space
stations. Click any object to read its record; ask the built-in guide about it.

**Stack:** Next.js 14 (App Router) · React 18 · Three.js / @react-three/fiber / drei ·
**static JSON data, no backend, no auth, no API keys**. The catalogue is fetched from
`public/data/` at runtime and the app exports to plain static files.

## What's inside

* **NASA-filtered dataset** — 127 missions, 3 stations, 16 launch vehicles, 19 bodies and 460
  moons, built from `public/data/source/Space_Relics_3D_Dataset.xlsx`. Records carry the NASA
  involvement filter, relic-panel story, surface-relic relevance and citation URLs.
* **Year timeline in the header** — 1962 → 2031. Drag or press play, and the whole explorer
  becomes that year: objects not yet launched disappear, cluster counts shrink, and “Year in
  review” lists that year's launches, stations, rockets and moon discoveries.
* **Docked explorer rail** — a real column on desktop (open by default, collapsed with `M`,
  remembered between visits), a drawer on tablets and phones with an edge tab.
* **First-run guided tour** — 8 spotlight steps over the live UI. It starts automatically on a
  new browser and can be replayed from the `?` button.
* **Realistic surfaces** — NASA-derived day/night/cloud/normal/specular maps for Earth, real
  maps for the Sun, planets and Moon, textured Saturn rings, procedural crater/maria surfaces
  for the other moons and dwarfs, textured solar arrays and MLI foil on the hardware.
* **Full hardware detail everywhere** — no light/full detail switch; every object in a body
  view is drawn at full fidelity.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

## Build & deploy

```bash
npm run build      # static export → ./out
```

`next.config.mjs` sets `output: 'export'`, so the build is plain HTML/CSS/JS and can be hosted
on Vercel (recommended), Netlify, GitHub Pages, S3, or any static file server. On Vercel just
import the repository and keep the defaults.

## Project layout

```
app/
  layout.jsx            metadata, fonts and the global stylesheets
  page.jsx              the single route
  ExplorerClient.jsx    browser-only dynamic import of the explorer
src/
  App.jsx               shell: rail, timeline, year panel, tour, info panel
  components/
    scene/              SolarSystemScene (orrery) and BodyScene (surface + orbit shells)
    three/              Canvas host, camera rig, planet sphere, rings, atmosphere, glow
    hardware/           procedural rovers/landers/orbiters/stations and solar arrays
    panels/             TopBar, TimelineBar, YearPanel, Sidebar, InfoPanel, PhoneBar, Welcome
    chat/               the in-browser guide
    tour/               first-run spotlight tour
  lib/                  dataStore (catalogue + timeline), textures, scale/position, constants
  services/             local API surface over the JSON, guide engine
  styles/               theme.css, app.css
public/
  data/                 solar-system-dataset.json, coordinates.json, media.json, source/
  textures/             surface maps (1024px, ~1.2 MB total)
tools/                  build-dataset.py, analyze-dataset.py
```

## Dataset

| Sheet in the workbook | Records |
|---|---|
| Planets & Dwarf Planets | 16 bodies |
| Moons (all 460) | 460 moons |
| Missions | 127 missions |
| Space Stations | 3 stations |
| Launch Vehicles | 16 rockets |
| NASA-involved missions | cross-checked into `nasaInvolved` |

The builder also derives `launchYear`, `firstFlightYear`, `firstModuleYear` and
`yearDiscovered` for the timeline. Rebuild after replacing the workbook:

```bash
python3 tools/build-dataset.py      # rewrites public/data/solar-system-dataset.json
python3 tools/analyze-dataset.py > docs/DATASET-ANALYSIS.md
```

### Year timeline

`src/lib/dataStore.js` builds the year index once:

```
missions.launchYear · stations.firstModuleYear · rockets.firstFlightYear
+ moon discoveries inside that span
→ { minYear, maxYear, years[], byYear, byBody, busiest }
```

`app.year` is `null` (all time) or a number. The rail, scene, cluster counts and info panel all
respect it. Undated records are never hidden.

## Surface imagery

`public/textures/` ships 15 equirectangular maps: Earth (day, night lights, clouds, normal,
specular), Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Sun, Moon and Saturn's ring
strip. Source: [Solar System Scope](https://www.solarsystemscope.com/textures/) (CC BY 4.0),
built from NASA imagery. Textures load asynchronously; a body keeps a tinted fallback until its
map arrives, so the app also renders offline.

## Quick tour

`src/components/tour/Tour.jsx` runs 8 spotlight steps. Each step can prepare the UI first
(open the rail, park the timeline on 1969, focus Mars), then the target rectangle is measured
with retries. Completion is stored under `space-relics-tour-v1`; the header `?` replays it.

## Shortcuts

`M` rail · `Y` year review · `F` working-now filter · `D` dwarf planets · `←`/`→` step the year
(while the review is open) · `Esc` close/go back.
