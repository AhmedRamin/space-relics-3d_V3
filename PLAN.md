# Space Relics 3D — Architecture Plan

A single-view, file-backed 3D Solar System explorer. No database server, no accounts:
the whole catalogue lives in **one JSON data file** that the static app fetches at runtime.

## Data file (the "database")
```
client/public/data/solar-system-dataset.json   built from the NASA-filtered workbook
client/public/data/source/*.xlsx               the original workbook, kept so it can be replaced
tools/build-dataset.py             rebuilds the JSON from any workbook in the same shape
```
Content: **19 bodies · 460 moons · 127 missions · 3 space stations · 16 launch vehicles**, plus a
pre-computed `index` that maps every body to the hardware that belongs to it — that index is what
the 3D scene consumes.

### Dataset shape
```jsonc
{
  "meta":     { counts, sourceWorkbook, builtUtc },
  "bodies":   [{ id, name, type, isPlanet, isDwarf, meanDistanceAu, diameterKm, ... }],
  "moons":    [{ id, name, parentId, semiMajorAxisKm, meanRadiusKm, yearDiscovered, ... }],
  "missions": [{ id, name, agency, type, target, bodyId, visualKind, launchDate,
                 launchVehicle, status, statusGroup, workingNow, currentLocation,
                 story, achievement, imageUrl, referenceUrl }],
  "stations": [{ id, name, operator, type, firstModuleLaunch, status, workingNow, orbit, ... }],
  "rockets":  [{ id, name, country, manufacturer, firstFlight, heightM, payloadLeoKg, ... }],
  "index":    { "<bodyId>": { missions: [id], stations: [id], counts: { kind: n }, total } }
}
```
`visualKind` is the 3D contract: `rover | lander | helicopter | orbiter | satellite | telescope | probe | impactor | station`.

## Positions
The workbook has no coordinates, so positions live in a second editable file that is
merged over the dataset at load time:

```
client/public/data/coordinates.json
├── sites  { "<missionId>": { lat, lng, label, region, precision, source } }
└── orbits { "<id>": { altitudeKm, inclinationDeg, label, precision, source } }
```
`store.positionFor(id)` attaches `location`, `orbit`, `positionPrecision` and
`coordinateSource` to every hardware record, mission detail and station. The client
turns that into a position with `lib/position.js`:

```
published lat/lng   → point on the sphere, model stood on the local vertical
published altitude  → orbit radius (altitude compressed, never ignored) + real inclination
                      plane, plus a labelled ring drawn at the real altitude
no published data   → labelled shell (orbiters) or band (surface), flagged unpublished
```
Precision codes surfaced in the UI: `measured · reported · approximate · unlocated · shell`.
Coverage at build time: 52 landing sites and 163 orbital element sets, covering the large
majority of the 127 NASA-filtered missions.

## Year timeline
```
lib/dataStore.js buildTimeline()
  missions.launchYear · stations.firstModuleYear · rockets.firstFlightYear
  + moon discoveries inside that range
  → { minYear, maxYear, years:[{year,total,missions,stations,rockets,moons}], byBody }
```
`app.year` is `null` (all time) or a number. The rail, body view and Solar System cluster
counts all filter through it; the header's `TimelineBar` drives it and `YearPanel` lists the
year's events. Nothing is guessed: records without a date are never hidden.

## Realism stack
```
textures.js   real NASA-derived maps (day/night/clouds/normal/specular) for the Sun, planets
              and Moon; procedural fBm colour + bump + drawn craters for the rest;
              shared solar-cell and MLI-foil maps for hardware; pmrem environment map
Atmosphere    fresnel shader shell (Earth, Venus, Mars, giants) + separate cloud layer
SunGlow       three additive corona shells, toneMapped=false
Starfield     drei <Stars> shader point cloud
AsteroidBelt  1,100 instanced rocks between 2.15 and 3.3 AU
Materials     metalness/roughness/emissive PBR profiles for every hardware part
```

## Rendering and lighting contract
```
key light     pointLight at the Sun, decay 0, intensity ≈2.1   (museum lighting: every orbit stays legible)
fill          ambient 0.36 blue + hemisphere 0.22 + a top directional 0.22
tone mapping  ACES Filmic, exposure 1.15, sRGB output
textures      generated colour + bump maps; saturation pushed per profile so nothing is grey
```
Rule of thumb kept in code comments: this scene is compressed, not physical — light values in the
hundreds or thousands (correct in candela for a real sun) saturate every surface to white.

## Chat pipeline
```
question ──▶ answerEngine (dataset)          → grounded answer + confidence + matched kind
          ──▶ webKnowledge (Wikipedia REST)  → only when the dataset cannot answer, or the
                                               question is conceptual ("what is…", "why do…")
          ──▶ modelProviders.reword()        → optional: paid key, else keyless free endpoint,
                                               with a cooldown after rate-limit failures
          ──▶ answer + sources[] + citations → the UI renders source badges per bubble
```

## Scene layout contract (lib/scale.js)
```
layoutOrbits(bodies) → Map<id, radius>
   inner zone  (≤ 1.6 AU)  linear:  20 + 16·AU          generous spacing for Mercury…Mars
   outer zone  (> 1.6 AU)  log:     45.6 + 25.3·ln(AU/1.6), capped at 232
   sunRadius()             capped at 4.2 units          (true size would swallow Mercury)
   minOrbitRadius(r)       4.2 + r + 3.4                nothing may intersect the Sun
   fan-out                 neighbour gap ≥ 1.2 units    handles near-identical orbits
                                                        (Haumea 43.13 vs Quaoar 43.69 AU)
```
Both the scene and the test call this one function, so a new dataset cannot silently
reintroduce an overlap.

## Details panel media
```
record.imageUrl → destination body imageUrl → generated SVG card (data URI)
```
The catalog payload carries `imageUrl` for every body; that omission was why ISS records
showed no picture (ISS has no photo of its own, so it depends on Earth's).

## Responsive layout
```
≤700px    phone   drawer rail + edge tab · bottom-sheet info · full-screen guide · FAB
≤1080px   tablet  rail as a drawer with a scrim, narrower info panel
≥1081px   desktop docked rail column (open by default, state remembered)
≥1440px   desktop roomier rail/info/chat, larger gaps
≥1920px   large   320px rail, 430px info panel
```
The shell is a two-row grid (header, body). `.app__body` is a two-column grid whose explicit
`grid-template-rows: minmax(0,1fr)` is what keeps a long hardware list from stretching the
canvas. On phones the body switches to `display:block` and the rail becomes an absolute
drawer, because an out-of-flow sidebar in a grid would occupy a zero-width column.

## First-run tour
`components/tour/Tour.jsx` runs 8 spotlight steps over the live UI. Each step may call a
`prepare(api)` action first (open rail, `showYear(1969)`, `showBody('mars')`), then the target
rect is measured with retries until the panel mounts. Stored under `space-relics-tour-v1`;
replay from the header `?`.

## Data layer (static, no server)
```
client/public/data/*.json        the catalogue shipped with the app, fetched at runtime
client/src/lib/dataStore.js      loads it once, builds Maps, exposes lookups + filters
client/src/services/api.js       the old API surface, now local functions over dataStore
client/src/services/guide/       answerEngine + Wikipedia lookup + keyless reword, in-browser
```
The former Express routes are now plain functions with the same names and response shapes
(`catalog`, `body`, `missions`, `mission`, `stations`, `search`, `chat`, `engines`, …), so the
UI is unchanged. There is no network hop and nothing to keep running.

## Client (React + Vite, react-three-fiber)
One route, two 3D layers:
```
Layer 1  System view   Sun, 8 planets, dwarf toggle, orbit rings,
                       hardware clusters per body (one glowing node per hardware kind,
                       sized by count, labelled with the body total)
Layer 2  Body view     the focused body rendered with every piece of its hardware:
                       rovers/landers/helicopters on the surface (golden-angle spiral),
                       orbiters/satellites/telescopes/probes in orbit shells,
                       space stations on dedicated Earth orbit rings
```
Selection anywhere → glass info panel (status, agency, launch, vehicle, current location,
achievement, story, reference link) and it becomes the chat context.

## Removed from the previous build
MongoDB/Mongoose, JWT auth, bcrypt, all login/registration UI, favourites, admin CRUD routes,
multi-page routing, Tailwind-style layout scaffolding. Auth is gone entirely; there is nothing
to sign in to.

## Verification
The client must build with `npm run build`; `npm run smoke` renders every UI component on the
server to catch render-time crashes, and `npm run test:local` serves `public/` and drives the real
data layer and chat guide end-to-end — the static replacement for endpoint checks.
