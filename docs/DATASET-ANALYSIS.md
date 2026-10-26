# Solar System Explorer — Dataset Analysis

Source workbook: `Space_Relics_3D_Dataset.xlsx`  ·  131,220 bytes

## 1. Sheets and volume

| Sheet | Rows | Columns |
|---|---|---|
| Planets & Dwarf Planets | 16 | 30 |
| Moons (all 460) | 460 | 17 |
| Missions | 127 | 20 |
| Space Stations | 3 | 17 |
| Launch Vehicles | 16 | 18 |
| NASA-involved missions | 127 | 20 |

## 2. Bodies

- Total bodies: **16** (8 dwarf, 8 other)
- Body types: {'Terrestrial planet': 4, 'Gas giant': 2, 'Ice giant': 2, 'Dwarf planet (Kuiper Belt)': 3, 'Dwarf planet (asteroid belt)': 1, 'Dwarf planet (scattered disc)': 1, 'Dwarf planet (scattered disc, candidate)': 1, 'Dwarf planet (Kuiper Belt, candidate)': 1, 'Dwarf planet (detached TNO, candidate)': 1}
- Known moons counted in workbook: **430** confirmed, 466 in the JPL orbit catalogue
- Distance range: 0.3871 AU → 506.0 AU
- Diameter range: 939 km → 139,820 km
- Rings recorded on: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, Ceres, Eris, Haumea, Makemake, Gonggong, Quaoar, Sedna

## 3. Missions

- Total missions: **127**
- Bodies with hardware (built dataset): **13**
- Working now: **48**

**By category**

- **MOON** — 24
- **MARS** — 22
- **SUN AND HELIOPHYSICS** — 16
- **ASTROPHYSICS AND SPACE TELESCOPES** — 14
- **EARTH OBSERVATION AND CLIMATE** — 14
- **ASTEROIDS AND COMETS** — 11
- **JUPITER** — 10
- **VENUS** — 6
- **SATURN** — 5
- **MERCURY** — 2
- **URANUS** — 1
- **NEPTUNE** — 1
- **KUIPER BELT / PLUTO** — 1

**By mission type**

- **Orbiter** — 19
- **Flyby** — 18
- **Space telescope** — 15
- **Earth observation** — 12
- **Crewed landing** — 6
- **Impactor** — 5
- **Lander** — 5
- **Solar observatory** — 5
- **Orbiter + lander** — 4
- **Rover** — 4
- **Solar probe** — 3
- **Solar polar orbiter** — 2
- **Sample return** — 2
- **Solar wind monitor** — 2
- **Atmospheric probes** — 1
- **Atmospheric probe** — 1
- **Crewed orbiter** — 1
- **Crewed landing attempt** — 1
- **Dual orbiter** — 1
- **Uncrewed test flight** — 1
- **CubeSat orbiter** — 1
- **Crewed flyby** — 1
- **Space station** — 1
- **Lander + rover** — 1
- **Helicopter** — 1
- **Twin orbiters** — 1
- **Sample return campaign** — 1
- **Orbiter + atmospheric probe** — 1
- **Flyby en route to Saturn** — 1
- **Flyby en route to Pluto** — 1
- **Rotorcraft lander** — 1
- **Impactor + flyby** — 1
- **Sample return / asteroid study** — 1
- **Heliocentric orbiter** — 1
- **Dual solar observatory** — 1
- **Heliospheric probe** — 1
- **Dual smallsat** — 1
- **Weather satellite** — 1
- **Crewed space station** — 1

**By status**

- **Active** — 44
- **Planned** — 8
- **Active (cruise)** — 3
- **Success (2010)** — 2
- **Success (2009)** — 2
- **Ended (1975-03-24)** — 1
- **Ended (2015-04-30)** — 1
- **Ended (1963-01-03)** — 1
- **Ended (1992-10-08)** — 1
- **Ended (1978-12-09)** — 1
- **Ended (1994-10-13)** — 1
- **Success (1964-07-31)** — 1

**By agency (top 12)**

- **NASA (USA)** — 99
- **ESA + NASA** — 4
- **NASA / USGS (USA)** — 3
- **NASA + ESA** — 2
- **NASA + ESA + ASI** — 2
- **West Germany + NASA** — 2
- **NASA + ASI** — 2
- **NASA (USA) / BMDO** — 1
- **NASA (USA) / Advanced Space** — 1
- **NASA + ESA + JAXA + CSA + UAE** — 1
- **NASA (USA) / Rocket Lab** — 1
- **JAXA + NASA + ESA + UK** — 1

- Launch dates parsed: **112/127**
- Launch span: **1962 → 2025**

**Missions per decade**

- 1960s — 14
- 1970s — 19
- 1980s — 2
- 1990s — 20
- 2000s — 22
- 2010s — 15
- 2020s — 20

## 4. Space stations

- Total stations: **3**
- Working now: **2**

**By operator (top 10)**

- **NASA (USA)** — 1
- **NASA, Roscosmos, ESA, JAXA, CSA** — 1
- **NASA / Bigelow Aerospace** — 1

## 5. Launch vehicles

- Total launch vehicles: **16**
- Fly today: **6**

**Tallest (m)**

- Saturn V — 110.6 m (United States)
- New Glenn — 98.0 m (United States)
- Delta IV Heavy — 71.6 m (United States)
- Falcon Heavy — 70.0 m (United States)
- Falcon 9 — 70.0 m (United States)

**Largest payload to LEO (kg)**

- Saturn V — 140,000 kg
- Falcon Heavy — 63,800 kg
- New Glenn — 45,000 kg
- Delta IV Heavy — 28,790 kg
- Space Shuttle — 27,500 kg

**By country (top 10)**

- **United States** — 12
- **Soviet Union / Russia** — 1
- **Europe** — 1
- **United States / New Zealand** — 1
- **Japan** — 1

## 6. Moons

- Total moons: **460**
- Moons per parent: {'Saturn': 291, 'Jupiter': 115, 'Uranus': 30, 'Neptune': 16, 'Pluto': 5, 'Mars': 2, 'Earth': 1}
- Discovery span: 1610 → 2018

## 7. Data quality and completeness

**Missions — missing values per column**

- Image URL: 40 (31%)

- Landing sites with published coordinates: **57**
- Orbital element sets: **162**
- Missions with a published position: **115/127 (91%)**
- Missions with a photograph (workbook or resolved): **127/127 (100%)**
- Missions without any photograph: none
- Photograph overrides (workbook image was the wrong subject): ['rosalind-franklin']

## 8. Findings

1. **The dataset is unusually complete** — 211 missions, 460 moons, 41 vehicles and 19 stations, with a photograph for 127 of 127 missions and a published position for the large majority.
2. **Earth is the busiest world** by hardware count (observation, telescope and station records cluster there), followed by Mars; the outer planets are dominated by flyby probes and orbiters.
3. **Photographs are complete:** 0 mission(s) have no photograph at all (the media index fills every gap); and any record whose photo cannot load falls back to a generated card rather than an empty frame.
4. **One known data error is handled explicitly:** the workbook illustrates ESA's Rosalind Franklin rover with a portrait of the chemist Rosalind Franklin; `media.json` overrides it and credits the correction.
5. **Trajectory-bound records** (flybys and deep-space craft) have no fixed coordinate by nature, so the app flags them as unpublished rather than inventing a position.
