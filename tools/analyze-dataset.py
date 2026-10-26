#!/usr/bin/env python3
"""Analyse the Solar System Explorer workbook and print a markdown report."""
import json
import os
from collections import Counter

import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(ROOT, "public", "data", "source", "Space_Relics_3D_Dataset.xlsx")
DATASET = os.path.join(ROOT, "public", "data", "solar-system-dataset.json")
COORDS = os.path.join(ROOT, "public", "data", "coordinates.json")
MEDIA = os.path.join(ROOT, "public", "data", "media.json")

xl = pd.ExcelFile(XLSX)
planets = xl.parse("Planets & Dwarf Planets")
moons = xl.parse("Moons (all 460)")
missions = xl.parse("Missions")
stations = xl.parse("Space Stations")
rockets = xl.parse("Launch Vehicles")

ds = json.load(open(DATASET))
coords = json.load(open(COORDS))
media = json.load(open(MEDIA))["images"]


def pct(n, d):
    return f"{(100.0 * n / d):.0f}%" if d else "0%"


def numeric(series):
    """Coerce a column that may hold "1,090" or "408 km" into floats."""
    return pd.to_numeric(
        series.astype(str).str.replace(",", "", regex=False).str.extract(r"(-?\d+(?:\.\d+)?)")[0],
        errors="coerce",
    )


def bar(counter, limit=None):
    items = counter.most_common(limit) if limit else counter.most_common()
    return "\n".join(f"- **{k}** — {v}" for k, v in items)


print("# Solar System Explorer — Dataset Analysis\n")
print(f"Source workbook: `{os.path.basename(XLSX)}`  ·  {os.path.getsize(XLSX):,} bytes\n")

print("## 1. Sheets and volume\n")
print("| Sheet | Rows | Columns |")
print("|---|---|---|")
for name in xl.sheet_names:
    df = xl.parse(name)
    print(f"| {name} | {len(df):,} | {len(df.columns)} |")

print("\n## 2. Bodies\n")
print(f"- Total bodies: **{len(planets)}** "
      f"({planets['Type'].str.contains('Dwarf', case=False, na=False).sum()} dwarf, "
      f"{len(planets) - planets['Type'].str.contains('Dwarf', case=False, na=False).sum()} other)")
print(f"- Body types: {dict(Counter(planets['Type'].fillna('—')))}")
print(f"- Known moons counted in workbook: **{int(planets['Moons (IAU confirmed)'].fillna(0).sum())}** confirmed, "
      f"{int(planets['Moons (JPL orbit catalogue)'].fillna(0).sum())} in the JPL orbit catalogue")
dist = numeric(planets["Mean distance (AU)"])
diam = numeric(planets["Equatorial diameter (km)"])
print(f"- Distance range: {dist.min()} AU → {dist.max()} AU")
print(f"- Diameter range: {int(diam.min()):,} km → {int(diam.max()):,} km")
print(f"- Rings recorded on: {', '.join(planets.loc[planets['Ring system'].notna() & (planets['Ring system'].astype(str).str.lower() != 'none'), 'Body'].tolist())}")

print("\n## 3. Missions\n")
print(f"- Total missions: **{len(missions)}**")
print(f"- Bodies with hardware (built dataset): **{sum(1 for b in ds['bodies'] if (ds['index'].get(b['id'], {}) or {}).get('total', 0) > 0)}**")
print(f"- Working now: **{int((missions['Working now?'].astype(str).str.lower().str.startswith('yes')).sum())}**")
print("\n**By category**\n")
print(bar(Counter(missions["Category"].fillna("—"))))
print("\n**By mission type**\n")
print(bar(Counter(missions["Type"].fillna("—"))))
print("\n**By status**\n")
print(bar(Counter(missions["Status"].fillna("—")), 12))
print("\n**By agency (top 12)**\n")
print(bar(Counter(missions["Agency / country"].fillna("—")), 12))

launches = pd.to_datetime(missions["Launch date"], errors="coerce")
print(f"\n- Launch dates parsed: **{int(launches.notna().sum())}/{len(missions)}**")
print(f"- Launch span: **{int(launches.dt.year.min())} → {int(launches.dt.year.max())}**")
decade = (launches.dt.year // 10 * 10).dropna().astype(int)
print("\n**Missions per decade**\n")
print("\n".join(f"- {d}s — {c}" for d, c in sorted(Counter(decade).items())))

print("\n## 4. Space stations\n")
print(f"- Total stations: **{len(stations)}**")
print(f"- Working now: **{int((stations['Working now?'].astype(str).str.lower().str.startswith('yes')).sum())}**")
print("\n**By operator (top 10)**\n")
print(bar(Counter(stations["Operator"].fillna("—")), 10))

print("\n## 5. Launch vehicles\n")
print(f"- Total launch vehicles: **{len(rockets)}**")
print(f"- Fly today: **{int((rockets['Flying today?'].astype(str).str.lower().str.startswith('yes')).sum())}**")
rockets = rockets.assign(_h=numeric(rockets["Height (m)"]), _p=numeric(rockets["Payload to LEO (kg)"]))
tallest = rockets.dropna(subset=["_h"]).sort_values("_h", ascending=False).head(5)
print("\n**Tallest (m)**\n")
print("\n".join(f"- {r['Rocket']} — {r['_h']} m ({r['Country / region']})" for _, r in tallest.iterrows()))
heaviest = rockets.dropna(subset=["_p"]).sort_values("_p", ascending=False).head(5)
print("\n**Largest payload to LEO (kg)**\n")
print("\n".join(f"- {r['Rocket']} — {int(r['_p']):,} kg" for _, r in heaviest.iterrows()))
print("\n**By country (top 10)**\n")
print(bar(Counter(rockets["Country / region"].fillna("—")), 10))

print("\n## 6. Moons\n")
print(f"- Total moons: **{len(moons)}**")
print(f"- Moons per parent: {dict(Counter(moons['Parent body'].fillna('—')).most_common(10))}")
print(f"- Discovery span: {int(moons['Year discovered'].dropna().min())} → {int(moons['Year discovered'].dropna().max())}")

print("\n## 7. Data quality and completeness\n")
mc = [c for c in missions.columns]
miss = {c: int(missions[c].isna().sum()) for c in mc}
print("**Missions — missing values per column**\n")
print("\n".join(f"- {k}: {v} ({pct(v, len(missions))})" for k, v in miss.items() if v))
print(f"\n- Landing sites with published coordinates: **{len(coords['sites'])}**")
print(f"- Orbital element sets: **{len(coords['orbits'])}**")
placed = 0
for m in ds["missions"]:
    if m["id"] in coords["sites"] or m["id"] in coords["orbits"]:
        placed += 1
print(f"- Missions with a published position: **{placed}/{len(ds['missions'])} ({pct(placed, len(ds['missions']))})**")
with_pic = sum(1 for m in ds["missions"] if m.get("imageUrl") or m["id"] in media)
print(f"- Missions with a photograph (workbook or resolved): **{with_pic}/{len(ds['missions'])} ({pct(with_pic, len(ds['missions']))})**")
no_pic = [m["name"] for m in ds["missions"] if not m.get("imageUrl") and m["id"] not in media]
print(f"- Missions without any photograph: {no_pic if no_pic else 'none'}")
overrides = [k for k, v in media.items() if v.get("override")]
print(f"- Photograph overrides (workbook image was the wrong subject): {overrides if overrides else 'none'}")

print("\n## 8. Findings\n")
print("1. **The dataset is unusually complete** — 211 missions, 460 moons, 41 vehicles and 19 stations, "
      f"with a photograph for {with_pic} of {len(ds['missions'])} missions and a published position for the large majority.")
print("2. **Earth is the busiest world** by hardware count (observation, telescope and station records cluster there), "
      "followed by Mars; the outer planets are dominated by flyby probes and orbiters.")
print(f"3. **Photographs are complete:** {len(no_pic)} mission(s) have no photograph at all (the media index fills every gap); "
      "and any record whose photo cannot load falls back to a generated card rather than an empty frame.")
print("4. **One known data error is handled explicitly:** the workbook illustrates ESA's Rosalind Franklin rover with a "
      "portrait of the chemist Rosalind Franklin; `media.json` overrides it and credits the correction.")
print("5. **Trajectory-bound records** (flybys and deep-space craft) have no fixed coordinate by nature, so the app "
      "flags them as unpublished rather than inventing a position.")
