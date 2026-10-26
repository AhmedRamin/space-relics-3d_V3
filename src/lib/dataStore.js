/**
 * The database — in the browser.
 *
 * This is the same catalogue the Express server used to serve, loaded straight from
 * the static JSON files that ship with the app (`public/data/`). There is no API and
 * no server: the explorer and the guide read these files directly, so the whole site
 * is a static build that can be dropped on Vercel, GitHub Pages or any file host.
 *
 * The public surface mirrors the old server store one-to-one, so the UI components and
 * the answer engine did not need to change.
 */

/**
 * Where the JSON files live. Defaults to `<base>/data/` (shipped with the app), but can
 * be pointed at a CDN or another origin by setting `window.__SPACE_RELICS_DATA_BASE__`
 * before the app boots. Node (used by the data smoke test) resolves the same constant.
 */
const DATA_BASE =
  (typeof globalThis !== 'undefined' && globalThis.__SPACE_RELICS_DATA_BASE__) ||
  `${process.env.NEXT_PUBLIC_BASE_PATH || '/'}data/`;

const EMPTY_COORDINATES = { sites: {}, orbits: {} };
const EMPTY_MEDIA = { images: {} };

let dataset = null;
let maps = null;
let timelineIndex = null;
let coordinates = EMPTY_COORDINATES;
let media = EMPTY_MEDIA;
let loading = null;
let loadError = null;

const SERVER_LIKE = { ok: true };

async function fetchJson(file, { optional = false } = {}) {
  const res = await fetch(`${DATA_BASE}${file}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    if (optional) return null;
    throw new Error(`Could not load ${file} (HTTP ${res.status}).`);
  }
  return res.json();
}

function build(raw, coords, mediaIndex) {
  dataset = {
    meta: raw.meta || {},
    bodies: raw.bodies || [],
    moons: raw.moons || [],
    missions: raw.missions || [],
    stations: raw.stations || [],
    rockets: raw.rockets || [],
    index: raw.index || {},
  };
  coordinates = coords ? { sites: coords.sites || {}, orbits: coords.orbits || {}, meta: coords.meta || {} } : EMPTY_COORDINATES;
  media = mediaIndex ? { images: mediaIndex.images || {}, meta: mediaIndex.meta || {} } : EMPTY_MEDIA;

  const byId = (list) => new Map(list.map((item) => [item.id, item]));
  maps = {
    bodies: byId(dataset.bodies),
    missions: byId(dataset.missions),
    stations: byId(dataset.stations),
    rockets: byId(dataset.rockets),
    moons: byId(dataset.moons),
    missionsByBody: new Map(),
    moonsByParent: new Map(),
  };

  dataset.missions.forEach((mission) => {
    const list = maps.missionsByBody.get(mission.bodyId) || [];
    list.push(mission);
    maps.missionsByBody.set(mission.bodyId, list);
  });
  dataset.moons.forEach((moon) => {
    const list = maps.moonsByParent.get(moon.parentId) || [];
    list.push(moon);
    maps.moonsByParent.set(moon.parentId, list);
  });

  timelineIndex = buildTimeline(dataset);
  return dataset;
}

/** Load the catalogue once; every later call reuses the same promise. */
export function ensureLoaded() {
  if (!loading) {
    loading = Promise.all([
      fetchJson('solar-system-dataset.json'),
      fetchJson('coordinates.json', { optional: true }),
      fetchJson('media.json', { optional: true }),
    ])
      .then(([raw, coords, mediaIndex]) => build(raw, coords, mediaIndex))
      .catch((err) => {
        loadError = err;
        loading = null;
        throw err;
      });
  }
  return loading;
}

function ensure() {
  if (!dataset || !maps) {
    throw new Error('The dataset is still loading. Call ensureLoaded() first.');
  }
  return { dataset, maps };
}

/* ------------------------------ photographs ------------------------------ */

function imageFor(id, own) {
  const entry = media.images[id];
  if (entry && entry.override && entry.imageUrl) {
    return { imageUrl: entry.imageUrl, imageCredit: `Wikipedia · ${entry.title || ''}`.trim(), imageNote: entry.note || null };
  }
  if (own) return { imageUrl: own, imageCredit: 'Wikimedia Commons' };
  if (entry && entry.imageUrl) {
    return { imageUrl: entry.imageUrl, imageCredit: `Wikipedia · ${entry.title || entry.name || ''}`.trim() };
  }
  return { imageUrl: null, imageCredit: null };
}

/* ------------------------------- positions ------------------------------- */

function positionFor(id) {
  const site = coordinates.sites[id];
  const orbit = coordinates.orbits[id];
  if (site) {
    return {
      location: {
        lat: site.lat,
        lng: site.lng,
        label: site.label || null,
        region: site.region || null,
      },
      orbit: orbit || null,
      positionPrecision: site.precision || 'measured',
      coordinateSource: site.source || null,
    };
  }
  if (orbit) {
    return { location: null, orbit, positionPrecision: orbit.precision || 'shell', coordinateSource: orbit.source || null };
  }
  return { location: null, orbit: null, positionPrecision: null, coordinateSource: null };
}

const coordinatesMeta = () => coordinates.meta || null;

/* -------------------------------- records -------------------------------- */

const get = () => ensure().dataset;
const getMaps = () => ensure().maps;
const isWorking = (record) => record.workingNow === true;
const statusOf = (record) => record.statusGroup || 'ended';

const KIND_ORDER = ['rover', 'helicopter', 'lander', 'station', 'orbiter', 'satellite', 'telescope', 'probe', 'impactor'];
const kindRank = (kind) => {
  const i = KIND_ORDER.indexOf(kind);
  return i === -1 ? KIND_ORDER.length : i;
};

function listBodies({ includeDwarf = true } = {}) {
  const { dataset: data, maps: m } = ensure();
  return data.bodies
    .filter((body) => includeDwarf || !body.isDwarf)
    .map((body) => ({
      ...body,
      ...imageFor(body.id, body.imageUrl),
      hardware: m.missionsByBody.get(body.id)?.length || 0,
      stations: body.id === 'earth' ? data.stations.length : 0,
      moonCount: (m.moonsByParent.get(body.id) || []).length,
      counts: (data.index[body.id] || {}).counts || {},
      total: (data.index[body.id] || {}).total || 0,
    }))
    .sort((a, b) => (a.meanDistanceAu || 0) - (b.meanDistanceAu || 0));
}

function getBody(id) {
  return ensure().maps.bodies.get(id) || null;
}

/** Everything drawn around one body, in a stable order. */
function bodyHardware(id) {
  const { dataset: data, maps: m } = ensure();
  const body = m.bodies.get(id);
  if (!body) return null;

  const missions = (m.missionsByBody.get(id) || [])
    .slice()
    .sort((a, b) => kindRank(a.visualKind) - kindRank(b.visualKind) || (a.launchDate || '').localeCompare(b.launchDate || ''))
    .map((mission) => ({
      id: mission.id,
      kind: 'mission',
      visualKind: mission.visualKind,
      name: mission.name,
      agency: mission.agency,
      type: mission.type,
      target: mission.target,
      status: mission.status,
      statusGroup: statusOf(mission),
      workingNow: isWorking(mission),
      launchDate: mission.launchDate,
      launchYear: mission.launchYear || null,
      launchVehicle: mission.launchVehicle,
      currentLocation: mission.currentLocation,
      achievement: mission.achievement,
      story: mission.story,
      nasaInvolved: Boolean(mission.nasaInvolved),
      nasaFilter: mission.nasaFilter || null,
      relicStory: mission.relicStory || null,
      relicRelevance: mission.relicRelevance || null,
      nasaCitationUrl: mission.nasaCitationUrl || null,
      storyCitationUrl: mission.storyCitationUrl || null,
      citationNote: mission.citationNote || null,
      ...imageFor(mission.id, mission.imageUrl),
      referenceUrl: mission.referenceUrl,
      bodyId: mission.bodyId,
      ...positionFor(mission.id),
    }));

  const stations = (id === 'earth' ? data.stations : [])
    .slice()
    .map((station) => ({
      id: station.id,
      kind: 'station',
      visualKind: 'station',
      name: station.name,
      operator: station.operator,
      type: station.type,
      orbit: station.orbit,
      status: station.status,
      statusGroup: statusOf(station),
      workingNow: isWorking(station),
      launchDate: station.firstModuleLaunch,
      launchYear: station.firstModuleYear || null,
      launchVehicle: station.launchVehicle,
      currentLocation: station.orbit ? `${station.orbit}${isWorking(station) ? ' — operational' : ''}` : null,
      achievement: station.achievement,
      story: station.story,
      nasaInvolved: Boolean(station.nasaInvolved),
      nasaFilter: station.nasaFilter || null,
      relicStory: station.relicStory || null,
      nasaCitationUrl: station.nasaCitationUrl || null,
      storyCitationUrl: station.storyCitationUrl || null,
      citationNote: station.citationNote || null,
      ...imageFor(station.id, station.imageUrl),
      referenceUrl: station.referenceUrl,
      bodyId: 'earth',
      ...positionFor(station.id),
    }))
    .sort((a, b) => Number(b.workingNow) - Number(a.workingNow) || (a.launchDate || '').localeCompare(b.launchDate || ''));

  const histogram = {};
  [...missions, ...stations].forEach((item) => {
    histogram[item.visualKind] = (histogram[item.visualKind] || 0) + 1;
  });

  return {
    body,
    hardware: [...missions, ...stations],
    missions,
    stations,
    histogram,
    workingNow: [...missions, ...stations].filter(isWorking).length,
  };
}

function filterMissions(filters = {}) {
  const { dataset: data } = ensure();
  const q = (filters.q || '').toLowerCase().trim();

  return data.missions.filter((mission) => {
    if (filters.body && mission.bodyId !== filters.body) return false;
    if (filters.category && (mission.category || '').toUpperCase() !== filters.category.toUpperCase()) return false;
    if (filters.kind && mission.visualKind !== filters.kind) return false;
    if (filters.status && mission.statusGroup !== filters.status) return false;
    if (filters.agency && !(mission.agency || '').toLowerCase().includes(filters.agency.toLowerCase())) return false;
    if (filters.working === 'true' && !isWorking(mission)) return false;
    if (filters.working === 'false' && isWorking(mission)) return false;
    if (filters.year && mission.launchYear && mission.launchYear > Number(filters.year)) return false;
    if (filters.fromYear && mission.launchYear && mission.launchYear < Number(filters.fromYear)) return false;
    if (filters.toYear && mission.launchYear && mission.launchYear > Number(filters.toYear)) return false;
    if (q) {
      const haystack = [mission.name, mission.agency, mission.type, mission.target, mission.category, mission.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

function facets() {
  const { dataset: data } = ensure();
  const count = (list, key) =>
    list.reduce((acc, item) => {
      const value = item[key];
      if (!value) return acc;
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});

  return {
    bodies: data.bodies
      .map((b) => ({ value: b.id, label: b.name, count: (data.index[b.id] || {}).total || 0 }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count),
    kinds: Object.entries(count(data.missions, 'visualKind'))
      .map(([value, n]) => ({ value, count: n }))
      .sort((a, b) => b.count - a.count),
    categories: Object.entries(count(data.missions, 'category'))
      .map(([value, n]) => ({ value, count: n }))
      .sort((a, b) => b.count - a.count),
    statusGroups: Object.entries(count(data.missions, 'statusGroup'))
      .map(([value, n]) => ({ value, count: n }))
      .sort((a, b) => b.count - a.count),
    stationOperators: Object.entries(count(data.stations, 'operator'))
      .map(([value, n]) => ({ value, count: n }))
      .sort((a, b) => b.count - a.count),
    counts: data.meta.counts || {},
  };
}

/* --------------------------------- search -------------------------------- */

const STOPWORDS = new Set([
  'and', 'the', 'for', 'are', 'was', 'were', 'its', 'it', 'this', 'that', 'with', 'from',
  'how', 'many', 'much', 'did', 'does', 'what', 'which', 'who', 'when', 'where', 'why',
  'tell', 'about', 'still', 'working', 'work', 'works', 'now', 'mission', 'missions',
  'station', 'stations', 'rocket', 'rockets', 'launch', 'launched', 'vehicle', 'vehicles',
  'moon', 'moons', 'body', 'bodies', 'planet', 'planets', 'compare', 'versus', 'more',
  'achieved', 'achieve', 'achievement', 'stop', 'stopped', 'ended', 'end', 'between',
]);

const escapeRe = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const bounded = (haystack, needle) =>
  !needle || needle.length < 2 ? false : new RegExp(`(^|[^a-z0-9])${escapeRe(needle)}([^a-z0-9]|$)`).test(haystack);

/**
 * Very small fuzzy matcher: exact > whole word/phrase > token overlap.
 * Word-bounded rather than substring-based, so "ion" does not resolve to Dione.
 */
function scoreName(name, query) {
  const n = String(name || '').toLowerCase();
  const q = String(query || '').toLowerCase();
  if (!n || !q || q.length < 2) return 0;
  if (n === q) return 1000;

  const digits = (q.match(/\d+/g) || []).join('');
  if (digits && !digits.split('').every((d) => n.includes(d))) return 0;

  if (bounded(n, q)) return 500 - n.length;

  const tokens = q.split(/\s+/).filter((t) => t.length > 2 && !STOPWORDS.has(t));
  if (!tokens.length) return 0;

  const hits = tokens.filter((t) => bounded(n, t)).length;
  if (!hits) return 0;
  return hits === tokens.length ? 200 + hits * 10 : 20 * hits;
}

function findEntity(phrase) {
  const { dataset: data } = ensure();
  if (!phrase) return null;

  const candidates = [];
  const push = (kind, list) => {
    list.forEach((item) => {
      const score = scoreName(item.name, phrase);
      if (score > 0) candidates.push({ kind, id: item.id, name: item.name, record: item, score });
    });
  };

  push('mission', data.missions);
  push('station', data.stations);
  push('rocket', data.rockets);
  push('body', data.bodies);
  push('moon', data.moons);

  candidates.sort((a, b) => b.score - a.score || b.name.length - a.name.length || a.name.localeCompare(b.name));
  return candidates[0] || null;
}

function search(query, limit = 24) {
  const { dataset: data } = ensure();
  const q = String(query || '').trim();
  if (q.length < 2) return [];

  const results = [];
  const collect = (kind, list, extra) => {
    list.forEach((item) => {
      const score = scoreName(item.name, q);
      if (score > 0) results.push({ kind, id: item.id, name: item.name, score, ...extra(item) });
    });
  };

  collect('body', data.bodies, (b) => ({ subtitle: b.type, bodyId: b.id }));
  collect('mission', data.missions, (m) => ({
    subtitle: `${m.type} · ${m.target}`,
    bodyId: m.bodyId,
    status: m.statusGroup,
    workingNow: m.workingNow,
    year: m.launchYear || null,
  }));
  collect('station', data.stations, (s) => ({
    subtitle: `${s.operator} · ${s.orbit || 'orbit'}`,
    status: s.statusGroup,
    workingNow: s.workingNow,
    year: s.firstModuleYear || null,
  }));
  collect('rocket', data.rockets, (r) => ({
    subtitle: `${r.country} · ${r.manufacturer || ''}`.trim(),
    status: r.statusGroup,
    year: r.firstFlightYear || null,
  }));
  collect('moon', data.moons, (m) => ({ subtitle: `Moon of ${m.parentName}`, bodyId: m.parentId, year: m.yearDiscovered || null }));

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}


/* -------------------------------- timeline -------------------------------- */

/**
 * The year axis.
 *
 * Every dated record becomes an event in exactly one year: mission launches, station first
 * modules, rocket first flights, and moon discoveries that fall inside the space age.
 * `byBody` is the compact lookup the 3D scene uses to ask "how many of this body's objects
 * existed in 1969?" without re-filtering the catalogue on every frame.
 */
function buildTimeline(data) {
  const byYear = new Map();
  const byBody = new Map();
  const ensureYear = (year) => {
    if (!byYear.has(year)) byYear.set(year, { year, total: 0, missions: [], stations: [], rockets: [], moons: [] });
    return byYear.get(year);
  };

  const hardwareYears = [];
  data.missions.forEach((m) => m.launchYear && hardwareYears.push(m.launchYear));
  data.stations.forEach((s) => s.firstModuleYear && hardwareYears.push(s.firstModuleYear));
  data.rockets.forEach((r) => r.firstFlightYear && hardwareYears.push(r.firstFlightYear));

  const min = hardwareYears.length ? Math.min(...hardwareYears) : 1957;
  const max = hardwareYears.length ? Math.max(...hardwareYears) : new Date().getFullYear();

  data.missions.forEach((m) => {
    if (!m.launchYear) return;
    const bucket = ensureYear(m.launchYear);
    const event = {
      id: m.id,
      kind: 'mission',
      name: m.name,
      year: m.launchYear,
      subtitle: [m.type, m.target].filter(Boolean).join(' · '),
      bodyId: m.bodyId,
      statusGroup: m.statusGroup,
      workingNow: m.workingNow,
      nasa: Boolean(m.nasaInvolved),
    };
    bucket.missions.push(event);
    bucket.total += 1;
    const list = byBody.get(m.bodyId) || [];
    list.push({ year: m.launchYear, kind: m.visualKind, name: m.name, id: m.id });
    byBody.set(m.bodyId, list);
  });

  data.stations.forEach((s) => {
    if (!s.firstModuleYear) return;
    const bucket = ensureYear(s.firstModuleYear);
    bucket.stations.push({
      id: s.id,
      kind: 'station',
      name: s.name,
      year: s.firstModuleYear,
      subtitle: s.type || s.operator,
      bodyId: 'earth',
      statusGroup: s.statusGroup,
      workingNow: s.workingNow,
      nasa: Boolean(s.nasaInvolved),
    });
    bucket.total += 1;
    const list = byBody.get('earth') || [];
    list.push({ year: s.firstModuleYear, kind: 'station', name: s.name, id: s.id });
    byBody.set('earth', list);
  });

  data.rockets.forEach((r) => {
    if (!r.firstFlightYear) return;
    const bucket = ensureYear(r.firstFlightYear);
    bucket.rockets.push({
      id: r.id,
      kind: 'rocket',
      name: r.name,
      year: r.firstFlightYear,
      subtitle: [r.country, r.manufacturer].filter(Boolean).join(' · '),
      statusGroup: r.statusGroup,
      flyingToday: r.flyingToday,
      nasa: Boolean(r.nasaInvolved),
    });
    bucket.total += 1;
  });

  data.moons.forEach((moon) => {
    const year = moon.yearDiscovered;
    if (!year || year < min || year > max) return;
    const bucket = ensureYear(year);
    bucket.moons.push({
      id: moon.id,
      kind: 'moon',
      name: moon.name,
      year,
      subtitle: `Moon of ${moon.parentName || moon.parentId}`,
      bodyId: moon.parentId,
      discoverer: moon.discoverer,
    });
    bucket.total += 1;
  });

  const years = [...byYear.values()].sort((a, b) => a.year - b.year);
  const counts = years.map((row) => ({ year: row.year, total: row.total }));

  return {
    minYear: min,
    maxYear: max,
    years,
    byYear: new Map(years.map((row) => [row.year, row])),
    byBody,
    counts,
    busiest: counts.slice().sort((a, b) => b.total - a.total).slice(0, 8),
  };
}

/** All events that happened in one year (empty shape when the year has nothing). */
function eventsInYear(year) {
  if (!timelineIndex) ensure();
  return timelineIndex.byYear.get(Number(year)) || { year: Number(year), total: 0, missions: [], stations: [], rockets: [], moons: [] };
}

/** How many of a body's objects existed by a given year (null year → all of them). */
function bodyCountsAtYear(bodyId, year) {
  const list = (timelineIndex && timelineIndex.byBody.get(bodyId)) || [];
  if (!year) return list.length;
  return list.filter((row) => row.year <= Number(year)).length;
}

function getTimeline() {
  if (!timelineIndex) ensure();
  return timelineIndex;
}

function countsFor(kind) {
  const { dataset: data } = ensure();
  const map = {
    missions: data.missions.length,
    stations: data.stations.length,
    rockets: data.rockets.length,
    moons: data.moons.length,
    bodies: data.bodies.length,
    planets: data.bodies.filter((b) => b.isPlanet).length,
    dwarfs: data.bodies.filter((b) => b.isDwarf).length,
    activeMissions: data.missions.filter(isWorking).length,
  };
  return kind ? map[kind] : map;
}

export {
  SERVER_LIKE,
  get,
  getMaps,
  getBody,
  listBodies,
  bodyHardware,
  filterMissions,
  facets,
  findEntity,
  search,
  countsFor,
  positionFor,
  getTimeline as timeline,
  eventsInYear,
  bodyCountsAtYear,
  isWorking,
  statusOf,
  KIND_ORDER,
  imageFor,
  coordinates,
  coordinatesMeta,
  media,
  loadErrorInfo,
};

function loadErrorInfo() {
  return loadError;
}
