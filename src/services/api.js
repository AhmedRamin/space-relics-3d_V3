/**
 * The local API.
 *
 * There is no server in this build: every "endpoint" is a small function over the JSON
 * catalogue that ships in `public/data/`. The shapes deliberately match the old Express
 * API (including the `{ ok, data }` envelope), so no component had to be rewritten — and
 * the whole site can be hosted as static files.
 */
import * as store from '../lib/dataStore.js';
import { answer } from './guide/aiService.js';
import * as models from './guide/modelProviders.js';
import * as web from './guide/webKnowledge.js';

/** Resolve once, then every call below is synchronous work behind a resolved promise. */
const ready = () => store.ensureLoaded();

function paginate(list, query = {}, defaultLimit = 24) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  const start = (page - 1) * limit;
  return {
    page,
    limit,
    total: list.length,
    pages: Math.max(1, Math.ceil(list.length / limit)),
    slice: list.slice(start, start + limit),
  };
}

/** One call that boots the whole 3D scene. */
async function catalog() {
  const data = await ready();
  return {
    ok: true,
    data: {
      meta: data.meta,
      bodies: store.listBodies().map((body) => ({
        id: body.id,
        name: body.name,
        type: body.type,
        isPlanet: body.isPlanet,
        isDwarf: body.isDwarf,
        meanDistanceAu: body.meanDistanceAu,
        diameterKm: body.diameterKm,
        ringSystem: body.ringSystem,
        orderFromSun: body.orderFromSun,
        axialTiltDeg: body.axialTiltDeg,
        moonsConfirmed: body.moonsConfirmed,
        imageUrl: body.imageUrl || null,
        parentId: body.parentId || null,
        color: body.color || null,
        hardware: body.hardware,
        stations: body.stations,
        moonCount: body.moonCount,
        counts: body.counts,
        total: body.total,
      })),
      index: data.index,
      counts: data.meta.counts,
      facets: store.facets(),
      coordinateMeta: store.coordinatesMeta(),
      timeline: store.timeline(),
      yearRange: (data.meta && data.meta.yearRange) || { min: 1957, max: new Date().getFullYear() },
    },
  };
}

async function bodies(params = {}) {
  await ready();
  return { ok: true, data: store.listBodies({ includeDwarf: params.dwarf !== 'false' }) };
}

async function body(id) {
  await ready();
  const detailed = store.bodyHardware(String(id).toLowerCase());
  if (!detailed) {
    const error = new Error(`No body with id "${id}"`);
    error.status = 404;
    throw error;
  }
  const moons = store.getMaps().moonsByParent.get(String(id).toLowerCase()) || [];
  return {
    ok: true,
    data: {
      ...detailed,
      moonCount: moons.length,
      moons: moons.slice().sort((a, b) => (b.meanRadiusKm || 0) - (a.meanRadiusKm || 0)).slice(0, 24),
    },
  };
}

async function hardware(id, params = {}) {
  await ready();
  const detailed = store.bodyHardware(String(id).toLowerCase());
  if (!detailed) {
    const error = new Error(`No body with id "${id}"`);
    error.status = 404;
    throw error;
  }
  const filtered = params.working === 'true' ? detailed.hardware.filter((h) => h.workingNow) : detailed.hardware;
  return {
    ok: true,
    body: detailed.body,
    histogram: detailed.histogram,
    workingNow: detailed.workingNow,
    count: filtered.length,
    data: filtered,
  };
}

async function missions(params = {}) {
  await ready();
  const filtered = store.filterMissions(params);
  const page = paginate(filtered, params);
  return { ok: true, count: page.slice.length, total: page.total, page: page.page, pages: page.pages, data: page.slice };
}

async function mission(id) {
  await ready();
  const record = store.getMaps().missions.get(String(id).toLowerCase());
  if (!record) {
    const error = new Error(`No mission with id "${id}"`);
    error.status = 404;
    throw error;
  }
  return {
    ok: true,
    data: {
      mission: { ...record, ...store.positionFor(record.id), ...store.imageFor(record.id, record.imageUrl) },
      body: store.getBody(record.bodyId) || null,
    },
  };
}

async function stations(params = {}) {
  await ready();
  let list = store.get().stations.slice();
  if (params.operator) list = list.filter((s) => (s.operator || '').toLowerCase().includes(String(params.operator).toLowerCase()));
  if (params.status) list = list.filter((s) => s.statusGroup === params.status);
  if (params.working === 'true') list = list.filter((s) => s.workingNow);
  list = list.map((s) => ({ ...s, ...store.positionFor(s.id), ...store.imageFor(s.id, s.imageUrl) }));
  const page = paginate(list, params, 40);
  return { ok: true, count: page.slice.length, total: page.total, page: page.page, pages: page.pages, data: page.slice };
}

async function station(id) {
  await ready();
  const record = store.getMaps().stations.get(String(id).toLowerCase());
  if (!record) {
    const error = new Error(`No station with id "${id}"`);
    error.status = 404;
    throw error;
  }
  return { ok: true, data: { ...record, ...store.positionFor(record.id), ...store.imageFor(record.id, record.imageUrl) } };
}

async function rockets(params = {}) {
  await ready();
  let list = store.get().rockets.slice();
  if (params.country) list = list.filter((r) => (r.country || '').toLowerCase().includes(String(params.country).toLowerCase()));
  if (params.status) list = list.filter((r) => r.statusGroup === params.status);
  if (params.flying === 'true') list = list.filter((r) => r.flyingToday);
  list.sort((a, b) => (b.heightM || 0) - (a.heightM || 0));
  list = list.map((r) => ({ ...r, ...store.imageFor(r.id, r.imageUrl) }));
  const page = paginate(list, params, 40);
  return { ok: true, count: page.slice.length, total: page.total, page: page.page, pages: page.pages, data: page.slice };
}

async function rocket(id) {
  await ready();
  const record = store.getMaps().rockets.get(String(id).toLowerCase());
  if (!record) {
    const error = new Error(`No launch vehicle with id "${id}"`);
    error.status = 404;
    throw error;
  }
  return { ok: true, data: { ...record, ...store.imageFor(record.id, record.imageUrl) } };
}

async function moons(params = {}) {
  await ready();
  let list = store.get().moons.slice();
  if (params.parent) list = list.filter((m) => m.parentId === String(params.parent).toLowerCase());
  if (params.q) {
    const q = String(params.q).toLowerCase();
    list = list.filter((m) => (m.name || '').toLowerCase().includes(q) || (m.parentName || '').toLowerCase().includes(q));
  }
  list.sort((a, b) => (b.meanRadiusKm || 0) - (a.meanRadiusKm || 0));
  const page = paginate(list, params, 40);
  return { ok: true, count: page.slice.length, total: page.total, page: page.page, pages: page.pages, data: page.slice };
}

async function moon(id) {
  await ready();
  const record = store.getMaps().moons.get(String(id).toLowerCase());
  if (!record) {
    const error = new Error(`No moon with id "${id}"`);
    error.status = 404;
    throw error;
  }
  return { ok: true, data: record };
}

async function search(q) {
  await ready();
  const query = String(q || '').trim();
  if (query.length < 2) {
    const error = new Error('Provide at least two characters with ?q=');
    error.status = 400;
    throw error;
  }
  const data = store.search(query, 24);
  return { ok: true, query, count: data.length, data };
}

async function facets() {
  await ready();
  return { ok: true, data: store.facets() };
}

/** The year axis: every dated event, grouped by year. */
async function timeline() {
  await ready();
  return { ok: true, data: store.timeline() };
}

/** Everything that happened in one year. */
async function yearEvents(year) {
  await ready();
  return { ok: true, data: store.eventsInYear(year) };
}

/** The guide: dataset first, then Wikipedia, then an optional keyless reword pass. */
async function chat(payload = {}) {
  await ready();
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  if (message.length < 2) {
    const error = new Error('"message" is required');
    error.status = 400;
    throw error;
  }
  const context =
    payload.context && payload.context.id
      ? {
          kind: ['mission', 'station', 'rocket', 'body', 'moon'].includes(payload.context.kind) ? payload.context.kind : 'mission',
          id: String(payload.context.id).slice(0, 120),
          name: payload.context.name ? String(payload.context.name).slice(0, 120) : undefined,
        }
      : null;
  const history = Array.isArray(payload.history)
    ? payload.history
        .slice(-6)
        .filter((entry) => entry && typeof entry.content === 'string')
        .map((entry) => ({ role: entry.role === 'assistant' ? 'assistant' : 'user', content: String(entry.content).slice(0, 1200) }))
    : [];
  return answer({ message, context, history, useWeb: payload.useWeb !== false });
}

/** What the guide can reach, for the status badge in the chat header. */
async function engines() {
  await ready();
  return {
    ok: true,
    data: {
      dataset: { available: true, missions: store.countsFor('missions') },
      web: { available: web.enabled(), provider: 'Wikipedia REST API', keyRequired: false },
      models: models.describe(),
    },
  };
}

export const api = {
  catalog,
  bodies,
  body,
  hardware,
  missions,
  mission,
  stations,
  station,
  rockets,
  rocket,
  moons,
  moon,
  search,
  facets,
  timeline,
  yearEvents,
  chat,
  engines,
};

export default api;
