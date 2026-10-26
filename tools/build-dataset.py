#!/usr/bin/env python3
"""
Rebuilds client/public/data/solar-system-dataset.json from a Space Relics workbook.

Usage:
    python3 tools/build-dataset.py [path/to/workbook.xlsx]

Requires: pandas, openpyxl.

The workbook ships as `client/public/data/source/Space_Relics_3D_Dataset.xlsx`.
Every sheet is optional-tolerant: if a column is missing the field is simply null, so an
older workbook still builds. Extra NASA columns (NASA involvement filter, Relic panel story,
citations, surface relic relevance) are carried straight through to the JSON — the UI reads
them for the relic panel, and the timeline uses the parsed year columns.
"""
import json
import math
import os
import re
import sys

import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "public", "data")
DEFAULT_SRC = os.path.join(DATA_DIR, "source", "Space_Relics_3D_Dataset.xlsx")
SRC = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SRC
OUT = os.path.join(DATA_DIR, "solar-system-dataset.json")


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", str(text).lower()).strip("-") or "unknown"


def num(value):
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    m = re.search(r"-?\d+(\.\d+)?", str(value).replace(",", ""))
    return float(m.group(0)) if m else None


def text(value):
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    if hasattr(value, "strftime"):
        return value.strftime("%Y-%m-%d")
    s = str(value).strip()
    return s or None


def year_of(value):
    """The year a date-ish cell falls in. Handles datetimes, ISO strings and prose."""
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    if hasattr(value, "year"):
        return int(value.year)
    m = re.search(r"(1[6-9]\d{2}|20\d{2}|21\d{2})", str(value))
    return int(m.group(1)) if m else None


def col(row, name):
    """A column that may not exist in an older workbook."""
    try:
        return row[name]
    except (KeyError, IndexError):
        return None


TARGET_RULES = [
    ("moon", ["moon", "lunar", "luna", "apollo", "surveyor"]),
    ("mars", ["mars", "phobos", "deimos"]),
    ("mercury", ["mercury"]),
    ("venus", ["venus"]),
    ("jupiter", ["jupiter", "europa", "io ", "ganymede", "callisto", "trojan"]),
    ("saturn", ["saturn", "titan", "enceladus", "huygens"]),
    ("uranus", ["uranus"]),
    ("neptune", ["neptune"]),
    ("pluto", ["pluto", "kuiper"]),
    ("ceres", ["ceres", "vesta"]),
    ("asteroids", ["asteroid", "comet", "bennu", "ryugu", "itokawa", "eros", "dimorphos", "psyche", "didymos", "apophis", "halley"]),
    ("earth", ["earth", "exoplanet", "universe", "galaxy", "milky way", "dark matter", "dark energy", "cosmic microwave", "near-earth"]),
    ("sun", ["sun", "solar", "heliospher", "heliocentric"]),
]
CATEGORY_BODY = {
    "MOON": "moon", "MARS": "mars", "VENUS": "venus", "MERCURY": "mercury",
    "JUPITER": "jupiter", "SATURN": "saturn", "URANUS": "uranus", "NEPTUNE": "neptune",
    "KUIPER BELT / PLUTO": "pluto", "ASTEROIDS AND COMETS": "asteroids",
    "ASTROPHYSICS AND SPACE TELESCOPES": "earth", "EARTH OBSERVATION AND CLIMATE": "earth",
    "SUN AND HELIOPHYSICS": "sun",
}
TYPE_RULES = [
    ("rover", ["rover"]),
    ("helicopter", ["helicopter", "rotorcraft"]),
    ("station", ["space station"]),
    ("telescope", ["space telescope"]),
    ("impactor", ["impactor"]),
    ("lander", ["lander", "crewed landing", "circumlunar"]),
    ("orbiter", ["orbiter", "orbiting"]),
    ("satellite", ["earth observation", "weather satellite"]),
    ("probe", ["probe", "observatory", "sampler", "constellation", "smallsat", "test flight", "flyby", "sample return", "atmospheric"]),
]


def status_group(status):
    s = (status or "").strip().lower()
    if s.startswith("active"):
        return "active"
    if s.startswith("planned"):
        return "planned"
    if s.startswith("lost"):
        return "lost"
    if s.startswith("partial"):
        return "partial"
    if "fail" in s:
        return "fail"
    return "ended"


def main():
    if not os.path.exists(SRC):
        raise SystemExit(f"workbook not found: {SRC}")

    xl = pd.ExcelFile(SRC)
    sheets = xl.sheet_names

    sun = {
        "id": "sun", "name": "Sun", "type": "Star (G2V)", "isDwarf": False, "isPlanet": False,
        "orderFromSun": 0, "meanDistanceAu": 0.0, "diameterKm": 1392700.0,
        "axialTiltDeg": 7.25, "massEarth": 332946.0, "densityGCm3": 1.41,
        "surfaceGravity": 274.0, "escapeVelocityKms": 617.7,
        "atmosphere": "Plasma photosphere, chromosphere and corona",
        "explorationHistory": "Parker Solar Probe, SOHO, SDO, Ulysses, Solar Orbiter, Helios.",
        "notes": "Added for the 3D scene; not present in the workbook.",
    }

    bodies = [sun]
    for _, row in xl.parse("Planets & Dwarf Planets").iterrows():
        t = text(col(row, "Type")) or "Body"
        bodies.append({
            "id": slug(col(row, "Body")), "name": text(col(row, "Body")), "type": t,
            "isDwarf": "dwarf" in t.lower(),
            "isPlanet": ("planet" in t.lower() or "giant" in t.lower()) and "dwarf" not in t.lower(),
            "orderFromSun": int(num(col(row, "Order from Sun"))) if num(col(row, "Order from Sun")) is not None else None,
            "meanDistanceAu": num(col(row, "Mean distance (AU)")),
            "meanDistanceKm": num(col(row, "Mean distance (km)")),
            "perihelionAu": num(col(row, "Perihelion (AU)")),
            "aphelionAu": num(col(row, "Aphelion (AU)")),
            "orbitalPeriodYears": num(col(row, "Orbital period (years)")),
            "orbitPeriodDays": num(col(row, "Orbital period (days)")),
            "rotationPeriodHours": num(col(row, "Rotation period (hours)")),
            "axialTiltDeg": num(col(row, "Axial tilt (deg)")),
            "diameterKm": num(col(row, "Equatorial diameter (km)")),
            "massEarth": num(col(row, "Mass (Earth = 1)")),
            "densityGCm3": num(col(row, "Density (g/cm3)")),
            "surfaceGravity": num(col(row, "Surface gravity (m/s2)")),
            "escapeVelocityKms": num(col(row, "Escape velocity (km/s)")),
            "meanTemperatureC": text(col(row, "Mean surface temperature (C)")),
            "atmosphere": text(col(row, "Main atmosphere")),
            "ringSystem": text(col(row, "Ring system")),
            "moonsConfirmed": int(num(col(row, "Moons (IAU confirmed)")) or 0),
            "moonsJpl": int(num(col(row, "Moons (JPL orbit catalogue)")) or 0),
            "notableMoons": text(col(row, "Notable moons")),
            "heliocentricLongitudeDeg": num(col(row, "Current heliocentric longitude (deg)")),
            "currentDistanceFromSunAu": num(col(row, "Current distance from Sun (AU)")),
            "currentDistanceFromEarthAu": num(col(row, "Current distance from Earth (AU)")),
            "positionSummary": text(col(row, "Approximate current position")),
            "explorationHistory": text(col(row, "Exploration history")),
            "notes": text(col(row, "Notes")),
            "imageUrl": text(col(row, "Image URL")),
        })

    # Earth's Moon is a mission destination in its own right, so it needs a body entry.
    bodies.append({
        "id": "moon", "name": "Moon", "type": "Natural satellite of Earth", "parentId": "earth",
        "isDwarf": False, "isPlanet": False, "meanDistanceAu": 1.00257,
        "meanDistanceKm": 384400.0, "orbitPeriodDays": 27.322, "rotationPeriodHours": 655.7,
        "diameterKm": 3474.8, "axialTiltDeg": 6.68, "surfaceGravity": 1.62,
        "escapeVelocityKms": 2.38, "moonsConfirmed": 0,
        "meanTemperatureC": "-20 (range -173 to 127)",
        "atmosphere": "Almost none — a thin exosphere of helium, neon, hydrogen and argon",
        "ringSystem": "No",
        "positionSummary": "Orbits Earth every 27.3 days, 384,400 km away; the only other world humans have walked on.",
        "explorationHistory": "Luna program, Ranger and Surveyor, Apollo 11-17, Lunokhod, Chang'e, Chandrayaan, LRO, LCROSS, SLIM, Artemis.",
        "notes": "Added as a first-class body so Moon-targeted missions have a destination in the 3D scene.",
    })
    bodies.append({
        "id": "asteroids", "name": "Asteroids & Comets", "type": "Small bodies (main belt, NEOs, comets)",
        "isDwarf": False, "isPlanet": False, "meanDistanceAu": 2.5, "diameterKm": None,
        "meanTemperatureC": None, "atmosphere": "Not applicable — these are small bodies",
        "explorationHistory": "Dawn, Hayabusa2, OSIRIS-REx, Rosetta, Deep Impact, Stardust, NEAR Shoemaker, DART, Lucy, Psyche.",
        "notes": "Synthetic scene anchor for asteroid and comet targets.",
    })

    moons = []
    for _, row in xl.parse("Moons (all 460)").iterrows():
        parent = text(col(row, "Parent body"))
        moons.append({
            "id": slug(f"{col(row, 'Moon / satellite name')}-{parent}"),
            "name": text(col(row, "Moon / satellite name")),
            "parentId": slug(parent) if parent else None,
            "parentName": parent,
            "class": text(col(row, "Class")), "jplCode": text(col(row, "JPL code")),
            "semiMajorAxisKm": num(col(row, "Semi-major axis (km)")),
            "orbitalPeriodDays": num(col(row, "Orbital period (days)")),
            "eccentricity": num(col(row, "Eccentricity")),
            "inclinationDeg": num(col(row, "Inclination (deg)")),
            "meanRadiusKm": num(col(row, "Mean radius (km)")),
            "densityGCm3": num(col(row, "Mean density (g/cm3)")),
            "yearDiscovered": year_of(col(row, "Year discovered")),
            "discoverer": text(col(row, "Discoverer")),
            "provisionalDesignation": text(col(row, "Provisional designation")),
            "imageUrl": text(col(row, "Image URL")),
            "referenceUrl": text(col(row, "Reference URL")),
        })

    # NASA membership: the NASA-involved sheet is a filtered subset of Missions.
    def mission_key(name, launch):
        return (slug(name), year_of(launch))

    nasa_keys = set()
    if "NASA-involved missions" in sheets:
        for _, row in xl.parse("NASA-involved missions").iterrows():
            nasa_keys.add(mission_key(col(row, "Mission"), col(row, "Launch date")))

    missions = []
    seen = {}
    for _, row in xl.parse("Missions").iterrows():
        category = text(col(row, "Category"))
        mtype = text(col(row, "Type"))
        target = text(col(row, "Target"))
        status = text(col(row, "Status"))
        working = text(col(row, "Working now?")) or ""
        launch_year = year_of(col(row, "Launch date"))
        launch = text(col(row, "Launch date"))
        name = text(col(row, "Mission"))

        body_id = "earth"
        t = (target or "").lower()
        for candidate, keys in TARGET_RULES:
            if any(k in t for k in keys):
                body_id = candidate
                break
        else:
            body_id = CATEGORY_BODY.get((category or "").upper().strip(), "earth")

        kind = "probe"
        v = (mtype or "").lower()
        for candidate, keys in TYPE_RULES:
            if any(k in v for k in keys):
                kind = candidate
                break

        mid = slug(name)
        if mid in seen:
            seen[mid] += 1
            mid = f"{mid}-{seen[mid]}"
        else:
            seen[mid] = 0

        nasa_flag = text(col(row, "NASA involvement filter"))
        missions.append({
            "id": mid, "name": name, "category": category,
            "agency": text(col(row, "Agency / country")), "type": mtype, "target": target,
            "bodyId": body_id, "visualKind": kind,
            "launchDate": launch, "launchYear": launch_year,
            "launchVehicle": text(col(row, "Launch vehicle")), "status": status,
            "statusGroup": status_group(status),
            "workingNow": working.lower().startswith("yes") or "lineage still flies" in working.lower(),
            "workingNowText": working, "currentLocation": text(col(row, "Approximate current location")),
            "story": text(col(row, "Mission story")), "achievement": text(col(row, "What it achieved")),
            "imageUrl": text(col(row, "Image URL")), "referenceUrl": text(col(row, "Reference URL")),
            # NASA filtered dataset columns
            "nasaInvolved": bool(nasa_flag) or mission_key(name, launch) in nasa_keys,
            "nasaFilter": nasa_flag,
            "relicStory": text(col(row, "Relic panel story")),
            "nasaCitationUrl": text(col(row, "NASA citation URL")),
            "storyCitationUrl": text(col(row, "Story citation URL")),
            "citationNote": text(col(row, "Citation note")),
            "relicRelevance": text(col(row, "Surface relic relevance")),
        })

    stations = []
    for _, row in xl.parse("Space Stations").iterrows():
        status = text(col(row, "Status"))
        working = text(col(row, "Working now?")) or ""
        stations.append({
            "id": slug(col(row, "Station")), "name": text(col(row, "Station")),
            "operator": text(col(row, "Operator")), "type": text(col(row, "Type")),
            "firstModuleLaunch": text(col(row, "First module launch")),
            "firstModuleYear": year_of(col(row, "First module launch")),
            "launchVehicle": text(col(row, "Launch vehicle")), "status": status,
            "statusGroup": status_group(status), "workingNow": working.lower().startswith("yes"),
            "workingNowText": working, "orbit": text(col(row, "Orbit")),
            "story": text(col(row, "Story")), "achievement": text(col(row, "What it achieved")),
            "imageUrl": text(col(row, "Image URL")), "referenceUrl": text(col(row, "Reference URL")),
            "nasaInvolved": bool(text(col(row, "NASA involvement filter"))),
            "nasaFilter": text(col(row, "NASA involvement filter")),
            "relicStory": text(col(row, "Relic panel story")),
            "nasaCitationUrl": text(col(row, "NASA citation URL")),
            "storyCitationUrl": text(col(row, "Story citation URL")),
            "citationNote": text(col(row, "Citation note")),
        })

    rockets = []
    for _, row in xl.parse("Launch Vehicles").iterrows():
        status = text(col(row, "Status"))
        flying = text(col(row, "Flying today?")) or ""
        rockets.append({
            "id": slug(col(row, "Rocket")), "name": text(col(row, "Rocket")),
            "country": text(col(row, "Country / region")),
            "manufacturer": text(col(row, "Manufacturer")),
            "firstFlight": text(col(row, "First flight")),
            "firstFlightYear": year_of(col(row, "First flight")),
            "heightM": num(col(row, "Height (m)")),
            "payloadLeoKg": num(col(row, "Payload to LEO (kg)")),
            "payloadGtoKg": num(col(row, "Payload to GTO (kg)")), "status": status,
            "statusGroup": status_group(status), "flyingToday": flying.lower().startswith("yes"),
            "flyingTodayText": flying, "story": text(col(row, "Story")),
            "notableMissions": text(col(row, "Notable missions")),
            "imageUrl": text(col(row, "Image URL")), "referenceUrl": text(col(row, "Reference URL")),
            "nasaInvolved": bool(text(col(row, "NASA involvement filter"))),
            "nasaFilter": text(col(row, "NASA involvement filter")),
            "relicStory": text(col(row, "Relic panel story")),
            "nasaCitationUrl": text(col(row, "NASA citation URL")),
            "storyCitationUrl": text(col(row, "Story citation URL")),
            "citationNote": text(col(row, "Citation note")),
        })

    index = {}
    for m in missions:
        group = index.setdefault(m["bodyId"], {"missions": [], "stations": [], "counts": {}, "firstYear": None, "lastYear": None})
        group["missions"].append(m["id"])
        if m["launchYear"]:
            group["firstYear"] = min(group["firstYear"] or m["launchYear"], m["launchYear"])
            group["lastYear"] = max(group["lastYear"] or m["launchYear"], m["launchYear"])
    for s in stations:
        group = index.setdefault("earth", {"missions": [], "stations": [], "counts": {}, "firstYear": None, "lastYear": None})
        group["stations"].append(s["id"])
        if s["firstModuleYear"]:
            group["firstYear"] = min(group["firstYear"] or s["firstModuleYear"], s["firstModuleYear"])
            group["lastYear"] = max(group["lastYear"] or s["firstModuleYear"], s["firstModuleYear"])

    kind_of = {m["id"]: m["visualKind"] for m in missions}
    for body_id, group in index.items():
        counts = {}
        for mid in group["missions"]:
            counts[kind_of[mid]] = counts.get(kind_of[mid], 0) + 1
        if group["stations"]:
            counts["station"] = len(group["stations"])
        group["counts"] = counts
        group["total"] = len(group["missions"]) + len(group["stations"])

    hardware_years = (
        [m["launchYear"] for m in missions]
        + [s["firstModuleYear"] for s in stations]
        + [r["firstFlightYear"] for r in rockets]
    )
    hardware_years = [y for y in hardware_years if y]
    year_range = (
        {"min": min(hardware_years), "max": max(hardware_years)}
        if hardware_years
        else {"min": 1957, "max": 2030}
    )

    dataset = {
        "meta": {
            "name": "Space Relics 3D dataset (NASA filtered)",
            "sourceWorkbook": os.path.basename(SRC),
            "builtUtc": pd.Timestamp.now("UTC").strftime("%Y-%m-%dT%H:%M:%SZ"),
            "sheets": sheets,
            "yearRange": year_range,
            "counts": {
                "bodies": len(bodies), "moons": len(moons), "missions": len(missions),
                "stations": len(stations), "rockets": len(rockets),
                "nasaMissions": len([m for m in missions if m["nasaInvolved"]]),
            },
            "notes": "Rebuild with tools/build-dataset.py after replacing the workbook.",
        },
        "bodies": bodies, "moons": moons, "missions": missions,
        "stations": stations, "rockets": rockets, "index": index,
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(dataset, fh, ensure_ascii=False, indent=1)

    print("wrote", OUT)
    print("counts", dataset["meta"]["counts"])
    print("years", year_range)
    print("hardware per body", {k: v["total"] for k, v in sorted(index.items(), key=lambda kv: -kv[1]["total"])})


if __name__ == "__main__":
    main()
