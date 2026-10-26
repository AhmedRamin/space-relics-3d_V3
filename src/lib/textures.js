import * as THREE from 'three';

/**
 * Planetary surfaces.
 *
 * Two layers:
 *   1. Real imagery for the worlds NASA has mapped — equirectangular JPEGs in
 *      `/public/textures/`, sourced from Solar System Scope (CC BY 4.0) which builds them
 *      from NASA elevation and imagery. Earth gets day, night-lights, clouds, a normal map
 *      and a specular map so the oceans catch the Sun.
 *   2. A procedural generator for everything without a photograph (dwarf planets, most
 *      moons, asteroid anchors). It paints fBm colour, multi-scale impact craters with lit
 *      rims, maria, polar caps and gas-giant turbulence, plus a matching bump map.
 *
 * Every entry is cached per body + resolution and disposed with the scene. Real maps fall
 * back to a low-resolution procedural plate while the JPEG downloads, so a body never
 * flashes white and the app still works offline.
 */

const cache = new Map();
const loader = new THREE.TextureLoader();
const REAL_BASE = `${process.env.NEXT_PUBLIC_BASE_PATH || '/'}textures/`;

const REAL = {
  sun: { day: '2k_sun.jpg' },
  mercury: { day: '2k_mercury.jpg' },
  venus: { day: '2k_venus_atmosphere.jpg' },
  earth: {
    day: '2k_earth_daymap.jpg',
    night: '2k_earth_nightmap.jpg',
    clouds: '2k_earth_clouds.jpg',
    normal: 'earth_normal.jpg',
    specular: 'earth_specular.jpg',
  },
  mars: { day: '2k_mars.jpg' },
  jupiter: { day: '2k_jupiter.jpg' },
  saturn: { day: '2k_saturn.jpg', ring: '2k_saturn_ring_alpha.png' },
  uranus: { day: '2k_uranus.jpg' },
  neptune: { day: '2k_neptune.jpg' },
  moon: { day: '2k_moon.jpg' },
};

/* ----------------------------- value noise ----------------------------- */
function hash2(x, y, seed) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const smooth = (t) => t * t * (3 - 2 * t);

function valueNoise(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  const u = smooth(xf);
  const v = smooth(yf);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function fbm(x, y, seed, octaves = 5, gain = 0.5, lac = 2) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let freq = 1;
  for (let i = 0; i < octaves; i += 1) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 17);
    norm += amp;
    amp *= gain;
    freq *= lac;
  }
  return sum / norm;
}

/** fBm on a cylinder so the left and right edges of the map meet without a seam. */
function fbmWrap(u, v, seed, octaves = 5) {
  const angle = u * Math.PI * 2;
  return fbm(Math.cos(angle) * 2.4 + 8, Math.sin(angle) * 2.4 + 8 + v * 5.2, seed, octaves);
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

/** Push a colour away from grey — the single biggest "not washed out" win. */
function saturate(color, amount) {
  const grey = color[0] * 0.299 + color[1] * 0.587 + color[2] * 0.114;
  return [
    clamp01((grey + (color[0] - grey) * amount) / 255) * 255,
    clamp01((grey + (color[1] - grey) * amount) / 255) * 255,
    clamp01((grey + (color[2] - grey) * amount) / 255) * 255,
  ];
}

const seedOf = (text) =>
  String(text || 'x')
    .split('')
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 7);

/* ----------------------------- world profiles ----------------------------- */
const PROFILES = {
  star: {
    base: [255, 186, 92], hot: [255, 252, 236], cool: [238, 108, 22],
    bump: 0.2, saturate: 1.1, emissive: true, tint: '#ffce8a',
  },
  sunspot: { granulation: true },
  cratered: {
    base: [151, 146, 138], hot: [224, 218, 208], cool: [64, 60, 56],
    bump: 1, saturate: 1.08, tint: '#b6b0a6',
    maria: { count: 8, color: [72, 72, 78], radius: 0.2, strength: 0.7 },
    craters: 1, craterCount: 190,
  },
  lunarHighland: {
    base: [186, 182, 174], hot: [236, 232, 222], cool: [96, 94, 92],
    bump: 1, saturate: 1.04, tint: '#cfc9bd', craters: 1, craterCount: 230,
  },
  rocky: {
    base: [176, 138, 106], hot: [224, 196, 164], cool: [96, 68, 50],
    bump: 0.9, saturate: 1.18, craters: 0.6, craterCount: 110, tint: '#c69a72',
  },
  ocean: {
    base: [16, 62, 118], hot: [180, 210, 235], cool: [6, 28, 62],
    bump: 0.25, saturate: 1.2, tint: '#4f9bd6',
  },
  rust: {
    base: [170, 76, 40], hot: [226, 146, 94], cool: [92, 42, 28],
    bump: 0.85, saturate: 1.18, caps: true, canyons: true, craters: 0.55, craterCount: 120, tint: '#c96a41',
  },
  banded: {
    base: [214, 178, 132], hot: [252, 240, 214], cool: [128, 86, 54],
    bump: 0.12, saturate: 1.15, bands: 20, spot: true, tint: '#e0c39b',
  },
  icy: {
    base: [104, 186, 216], hot: [214, 244, 250], cool: [42, 104, 162],
    bump: 0.1, saturate: 1.2, bands: 9, tint: '#8ed6ea',
  },
  dwarf: {
    base: [156, 138, 124], hot: [212, 198, 184], cool: [74, 62, 58],
    bump: 1, saturate: 1.12, craters: 0.9, craterCount: 200, tint: '#b8a898',
  },
};

/**
 * Moons: real albedo families rather than one grey sphere. The palette is keyed on the
 * moon's name first (Io's sulphur yellows, Europa's ice, Titan's orange haze) and falls
 * back to its parent's family.
 */
const MOON_PROFILES = {
  moon: { base: [150, 148, 142], hot: [226, 222, 212], cool: [64, 62, 60], bump: 1, saturate: 1.05, maria: { count: 9, color: [66, 66, 72], radius: 0.2, strength: 0.75 }, craters: 1, craterCount: 210, tint: '#b8b5ad' },
  io: { base: [214, 186, 84], hot: [250, 236, 168], cool: [140, 92, 34], bump: 0.55, saturate: 1.35, craters: 0.15, tint: '#e8cf72' },
  europa: { base: [206, 198, 182], hot: [244, 240, 230], cool: [142, 136, 132], bump: 0.45, saturate: 1.05, craters: 0.1, lineae: true, tint: '#ded7c8' },
  ganymede: { base: [130, 122, 110], hot: [200, 194, 180], cool: [70, 66, 60], bump: 0.8, saturate: 1.08, craters: 0.8, craterCount: 160, tint: '#a9a294' },
  callisto: { base: [96, 88, 80], hot: [172, 162, 148], cool: [46, 42, 38], bump: 0.95, saturate: 1.05, craters: 1, craterCount: 260, tint: '#8a8175' },
  titan: { base: [196, 138, 62], hot: [232, 192, 116], cool: [140, 86, 36], bump: 0.08, saturate: 1.15, bands: 6, haze: true, tint: '#d8a253' },
  enceladus: { base: [224, 232, 238], hot: [252, 254, 255], cool: [172, 188, 202], bump: 0.2, saturate: 1.02, craters: 0.25, tint: '#e8f0f5' },
  triton: { base: [198, 178, 176], hot: [240, 228, 226], cool: [116, 104, 112], bump: 0.5, saturate: 1.1, craters: 0.5, tint: '#d6c3c1' },
  phobos: { base: [96, 88, 80], hot: [150, 140, 128], cool: [42, 38, 34], bump: 1, saturate: 1.02, craters: 1, craterCount: 150, tint: '#7d746a' },
  deimos: { base: [130, 120, 108], hot: [180, 170, 156], cool: [64, 58, 52], bump: 1, saturate: 1.02, craters: 1, tint: '#9a8f80' },
  charon: { base: [156, 150, 148], hot: [214, 208, 204], cool: [80, 76, 78], bump: 0.8, saturate: 1.03, craters: 0.9, tint: '#b3adaa' },
};

function profileFor(body) {
  const id = String(body.id || '').toLowerCase();
  const type = String(body.type || '').toLowerCase();
  if (id === 'sun') return PROFILES.star;
  if (type.includes('gas giant')) return PROFILES.banded;
  if (type.includes('ice giant')) return PROFILES.icy;
  if (id === 'earth') return PROFILES.ocean;
  if (id === 'mars') return PROFILES.rust;
  if (id === 'moon') return MOON_PROFILES.moon;
  if (id === 'mercury' || id === 'ceres') return PROFILES.cratered;
  if (body.isDwarf) return PROFILES.dwarf;
  return PROFILES.rocky;
}

function moonProfile(moon) {
  const id = String(moon.id || moon.name || '').toLowerCase();
  const name = String(moon.name || '').toLowerCase().replace(/[^a-z]/g, '');
  if (MOON_PROFILES[name]) return MOON_PROFILES[name];
  if (MOON_PROFILES[id]) return MOON_PROFILES[id];
  if (name.startsWith('s/')) return { ...PROFILES.cratered, base: [104, 100, 96], tint: '#8b867e', craterCount: 90, maria: null };
  const parent = String(moon.parentId || '').toLowerCase();
  if (parent === 'jupiter') return { ...PROFILES.cratered, base: [140, 132, 120], cool: [64, 60, 56], tint: '#a29a8c' };
  if (parent === 'saturn') return { ...PROFILES.cratered, base: [190, 186, 178], cool: [110, 108, 104], tint: '#c9c4b8', craters: 0.8 };
  if (parent === 'uranus' || parent === 'neptune') return { ...PROFILES.cratered, base: [120, 126, 130], cool: [58, 62, 68], tint: '#98a0a6' };
  if (parent === 'mars') return { ...PROFILES.cratered, base: [128, 106, 88], cool: [60, 48, 40], tint: '#9c8168' };
  if (parent === 'pluto') return { ...PROFILES.dwarf, base: [170, 156, 146], tint: '#c0ae9e' };
  return { ...PROFILES.cratered, base: [148, 142, 134], tint: '#b0aaa0' };
}

/* ----------------------------- helpers ----------------------------- */
function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function softBlob(ctx, x, y, radius, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, `rgba(${color[0]},${color[1]},${color[2]},${alpha})`);
  g.addColorStop(0.72, `rgba(${color[0]},${color[1]},${color[2]},${alpha * 0.55})`);
  g.addColorStop(1, `rgba(${color[0]},${color[1]},${color[2]},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function blobList(seed, count, radius) {
  return Array.from({ length: count }, (_, i) => ({
    u: hash2(i * 7 + 1, 3, seed),
    v: 0.14 + hash2(i * 5 + 2, 11, seed) * 0.72,
    r: radius * (0.45 + hash2(i * 9 + 3, 17, seed) * 0.95),
    depth: 0.55 + hash2(i * 3 + 4, 23, seed) * 0.45,
  }));
}

/**
 * Craters are drawn, not sampled: a floor, a bright rim and a darker shadow arc. At 200+
 * craters this reads as an impact-saturated surface instead of a blurry noise field.
 */
function drawCraters(ctx, width, height, seed, count, { strength = 1, monochrome = false } = {}) {
  for (let i = 0; i < count; i += 1) {
    const u = hash2(i * 13 + 5, 7, seed);
    const v = 0.06 + hash2(i * 17 + 9, 19, seed) * 0.88;
    const lat = (v - 0.5) * Math.PI;
    const xScale = Math.max(0.18, Math.cos(lat));
    const r = (2 + Math.pow(hash2(i * 29 + 11, 31, seed), 3.2) * width * 0.045) * strength;
    const x = u * width;
    const y = v * height;
    const ry = r * (0.55 + hash2(i * 37 + 3, 41, seed) * 0.5);
    const dark = monochrome ? [58, 58, 58] : [56, 52, 48];
    const light = monochrome ? [208, 208, 208] : [214, 208, 198];

    // shadowed/ejecta halo
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / r);
    const halo = ctx.createRadialGradient(0, 0, r * 0.62, 0, 0, r * 1.9);
    halo.addColorStop(0, `rgba(${light[0]},${light[1]},${light[2]},${0.16 * strength})`);
    halo.addColorStop(1, `rgba(${light[0]},${light[1]},${light[2]},0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // interior
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / r);
    const inner = ctx.createRadialGradient(-r * 0.22, -r * 0.22, r * 0.05, 0, 0, r);
    inner.addColorStop(0, `rgba(${dark[0]},${dark[1]},${dark[2]},${0.55 * strength})`);
    inner.addColorStop(0.65, `rgba(${dark[0]},${dark[1]},${dark[2]},${0.3 * strength})`);
    inner.addColorStop(0.86, `rgba(${light[0]},${light[1]},${light[2]},${0.5 * strength})`);
    inner.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* ----------------------------- procedural painter ----------------------------- */
function paintSurface(body, width, height, profile, seed, { bumpOnly = false } = {}) {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, height);
  const data = image.data;
  const bands = profile.bands || 0;
  const maria = profile.maria ? blobList(seed + 31, profile.maria.count, profile.maria.radius) : null;
  const spot = profile.spot ? { u: 0.68, v: 0.61, r: 0.075 } : null;

  for (let y = 0; y < height; y += 1) {
    const v = y / height;
    const lat = (v - 0.5) * Math.PI;
    const cosLat = Math.cos(lat);

    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      const i = (y * width + x) * 4;

      let t;
      if (bands) {
        const warp = (fbmWrap(u, v, seed + 91, 4) - 0.5) * 0.1;
        const turbulence = Math.abs(fbmWrap(u, v, seed + 5, 5) - 0.5) * 0.35;
        const band = Math.sin((v + warp + turbulence) * Math.PI * bands);
        t = clamp01(0.5 + band * 0.38 + (fbmWrap(u, v, seed + 61, 4) - 0.5) * 0.28);
      } else if (profile.land) {
        const continents = fbmWrap(u, v, seed + 3, 6);
        t = continents;
      } else {
        t = fbmWrap(u, v, seed, 6);
      }

      let color = mix(profile.cool, profile.hot, clamp01(t));

      if (profile.canyons) {
        const streak = clamp01((fbmWrap(u, v, seed + 41, 4) - 0.62) * 5) * (1 - clamp01(Math.abs(lat) - 0.4));
        color = mix(color, [104, 44, 28], streak * 0.7);
      }

      if (profile.caps) {
        const cap = clamp01((Math.abs(lat) - 1.16) * 6);
        color = mix(color, [244, 246, 250], cap * 0.95);
      }

      if (spot) {
        let du = u - spot.u;
        if (du > 0.5) du -= 1;
        const d2 = (du * du + ((v - spot.v) * (width / height) * 0.8) ** 2) / (spot.r * spot.r);
        if (d2 < 1) color = mix(color, [186, 92, 58], (1 - d2) * 0.85);
      }

      if (profile.land) {
        // Earth-like fallback: ocean, shelf, vegetation, desert, ice.
        const landMask = clamp01((t - 0.505) * 7);
        const terrain = fbmWrap(u, v, seed + 11, 5);
        const landColor = mix([42, 92, 52], [176, 158, 108], terrain);
        const desert = clamp01((fbmWrap(u, v, seed + 23, 3) - 0.58) * 4.5) * (1 - clamp01(Math.abs(lat) - 0.55));
        const shelf = clamp01((t - 0.47) * 12) * (1 - landMask);
        color = mix(color, mix(landColor, [200, 168, 104], desert), landMask);
        color = mix(color, [28, 92, 128], shelf * 0.6);
        const ice = clamp01((Math.abs(lat) - 1.24) * 4.2);
        color = mix(color, [240, 246, 252], ice);
      }

      color = saturate(color, profile.saturate);
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);

  // Maria / large dark basins (soft, oblique, wrapped at the seam).
  if (maria) {
    maria.forEach((b) => {
      const x = b.u * width;
      const y = b.v * height;
      const r = b.r * width;
      softBlob(ctx, x, y, r, profile.maria.color, profile.maria.strength * 0.75);
      if (x < r) softBlob(ctx, x + width, y, r, profile.maria.color, profile.maria.strength * 0.75);
      if (x > width - r) softBlob(ctx, x - width, y, r, profile.maria.color, profile.maria.strength * 0.75);
    });
  }

  if (profile.lineae) {
    // Europa's fractures: long, thin, reddish-brown lines.
    ctx.strokeStyle = 'rgba(128, 82, 64, 0.55)';
    for (let i = 0; i < 90; i += 1) {
      const y0 = hash2(i * 3, 5, seed) * height;
      ctx.lineWidth = 0.6 + hash2(i * 7, 9, seed) * 2.2;
      ctx.beginPath();
      const phase = hash2(i * 11, 13, seed) * Math.PI * 2;
      for (let x = 0; x <= width; x += width / 48) {
        const yy = y0 + Math.sin(x / width * Math.PI * 2 * (2 + (i % 4)) + phase) * height * 0.035;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  }

  if (profile.craters) {
    drawCraters(ctx, width, height, seed + 71, profile.craterCount || 140, { strength: profile.craters });
  }

  return canvas;
}

function paintBump(body, width, height, profile, seed) {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, height);
  const data = image.data;
  const bands = profile.bands || 0;

  for (let y = 0; y < height; y += 1) {
    const v = y / height;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      let h;
      if (bands) {
        const warp = (fbmWrap(x / width, v, seed + 91, 3) - 0.5) * 0.1;
        h = 0.5 + Math.sin((v + warp) * Math.PI * bands) * 0.18 + (fbmWrap(x / width, v, seed + 5, 4) - 0.5) * 0.25;
      } else {
        h = fbmWrap(x / width, v, seed, 5);
        if (profile.land) h = fbmWrap(x / width, v, seed + 3, 6) > 0.5 ? h * 0.6 + 0.4 : 0.45;
      }
      const value = 128 + (h - 0.5) * 255 * profile.bump;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  if (profile.craters) {
    drawCraters(ctx, width, height, seed + 71, Math.round((profile.craterCount || 140) * 0.8), {
      strength: profile.craters,
      monochrome: true,
    });
  }
  return canvas;
}

function paintClouds(width, height, seed) {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, height);
  const data = image.data;

  for (let y = 0; y < height; y += 1) {
    const v = y / height;
    const lat = (v - 0.5) * Math.PI;
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      const i = (y * width + x) * 4;
      const swirl = fbmWrap(u * 1.1, v * 1.45, seed, 6);
      const streaks = 0.5 + 0.5 * Math.sin(((v * 9 + swirl * 1.6) * Math.PI * 2));
      const belt = 0.55 + 0.45 * Math.cos(lat * 3.4);
      const alpha = clamp01((swirl - 0.48) * 3.6) * (0.35 + streaks * 0.65) * belt;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = clamp01(alpha) * 235;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/** A soft band of light for the far background — the Milky Way, cheaply. */
function paintGalaxyTexture(width, height) {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, height);
  const data = image.data;

  for (let y = 0; y < height; y += 1) {
    const v = y / height;
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      const i = (y * width + x) * 4;
      const band = Math.exp(-((v - 0.5) ** 2) / 0.014);
      const dust = fbmWrap(u * 2.2, v * 4, 4242, 5);
      const glow = band * (0.3 + dust * 0.7);
      data[i] = 110 + glow * 130;
      data[i + 1] = 126 + glow * 138;
      data[i + 2] = 186 + glow * 69;
      data[i + 3] = clamp01(glow * 0.5) * 205;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/**
 * Solar arrays: a grid of dark monocrystalline cells with silver busbars, a thin frame and
 * a gold Kapton backing, rendered once and shared by every spacecraft.
 */
export function solarPanelTexture() {
  if (cache.has('solar-panel')) return cache.get('solar-panel');
  const size = 512;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0a1730';
  ctx.fillRect(0, 0, size, size);

  const cols = 8;
  const rows = 12;
  const cw = size / cols;
  const ch = size / rows;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const shade = 18 + Math.round(hash2(x, y, 77) * 14);
      const g = ctx.createLinearGradient(x * cw, y * ch, x * cw + cw, y * ch + ch);
      g.addColorStop(0, `rgb(${12 + shade}, ${30 + shade}, ${66 + shade * 1.6})`);
      g.addColorStop(0.55, `rgb(${8 + shade}, ${22 + shade}, ${52 + shade * 1.5})`);
      g.addColorStop(1, `rgb(${16 + shade}, ${36 + shade}, ${78 + shade * 1.7})`);
      ctx.fillStyle = g;
      ctx.fillRect(x * cw + 2, y * ch + 2, cw - 4, ch - 4);
      // cell busbars
      ctx.strokeStyle = 'rgba(196, 208, 226, 0.55)';
      ctx.lineWidth = 1.2;
      for (let k = 1; k < 4; k += 1) {
        ctx.beginPath();
        ctx.moveTo(x * cw + 2, y * ch + (ch * k) / 4);
        ctx.lineTo(x * cw + cw - 2, y * ch + (ch * k) / 4);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(228, 236, 248, 0.28)';
      ctx.strokeRect(x * cw + 2.5, y * ch + 2.5, cw - 5, ch - 5);
    }
  }

  // panel frame + hinges
  ctx.strokeStyle = '#b9c6d8';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, size - 8, size - 8);
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(0, size / 2 - 3, size, 6);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  cache.set('solar-panel', tex);
  return tex;
}

/** MLI / gold-foil blanket: crinkled metal used on spacecraft buses and landers. */
export function foilTexture() {
  if (cache.has('foil')) return cache.get('foil');
  const size = 256;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  const data = image.data;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const n = fbm(x / 26, y / 26, 613, 4);
      const crease = Math.abs(fbm(x / 9, y / 60, 731, 3) - 0.5) * 2;
      const v = 120 + n * 95 + crease * 34;
      data[i] = Math.min(255, v + 22);
      data[i + 1] = Math.min(255, v + 4);
      data[i + 2] = Math.max(0, v - 58);
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  cache.set('foil', tex);
  return tex;
}

/* ----------------------------- real imagery ----------------------------- */
function loadRealTexture(file, { srgb = true, transform = null } = {}) {
  const url = `${REAL_BASE}${file}`;
  const cacheKey = `real:${file}:${transform ? transform.name || 'x' : 'raw'}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const tex = new THREE.Texture();
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;

  // The texture is uploaded once, with its final dimensions. Swapping a small placeholder
  // canvas for a 1800px JPEG later makes the driver resize the same texture in place, which
  // some GPUs reject ("Offset overflows texture dimensions") and can lose the whole context.
  loader.load(
    url,
    (loaded) => {
      tex.image = transform ? transform(loaded.image) : loaded.image;
      tex.needsUpdate = true;
    },
    undefined,
    () => {
      // eslint-disable-next-line no-console
      console.warn(`[textures] ${file} unavailable — the surface keeps its tint colour`);
    }
  );
  cache.set(cacheKey, tex);
  return tex;
}

function invertToCanvas(image) {
  const w = image.width || 1024;
  const h = image.height || 512;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 255 - data.data[i];
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

/* ----------------------------- public API ----------------------------- */
export function bodyTextures(body, size = 512) {
  const key = `${body.id}-${size}`;
  if (cache.has(key)) return cache.get(key);

  const profile = profileFor(body);
  const real = REAL[String(body.id).toLowerCase()];
  const height = Math.round(size / 2);

  let map;
  let bumpMap = null;
  let normalMap = null;
  let roughnessMap = null;
  let clouds = null;
  let night = null;

  if (real) {
    map = loadRealTexture(real.day);
    if (real.normal) normalMap = loadRealTexture(real.normal, { srgb: false });
    if (real.clouds) clouds = loadRealTexture(real.clouds);
    if (real.night) night = loadRealTexture(real.night);
    if (real.specular) {
      roughnessMap = loadRealTexture(real.specular, {
        srgb: false,
        transform: (image) => invertToCanvas(image),
      });
    }
  } else {
    const seed = seedOf(body.id);
    const canvas = paintSurface(body, size, height, profile, seed);
    map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.RepeatWrapping;
    map.anisotropy = 4;
    map.needsUpdate = true;

    const bumpCanvas = paintBump(body, size, height, profile, seed + 13);
    bumpMap = new THREE.CanvasTexture(bumpCanvas);
    bumpMap.wrapS = THREE.RepeatWrapping;
    bumpMap.needsUpdate = true;
  }

  const entry = { map, bumpMap, normalMap, roughnessMap, clouds, night, profile, isReal: Boolean(real) };
  cache.set(key, entry);
  return entry;
}

export function moonTextures(moon, size = 512) {
  const key = `moon-${moon.id}-${size}`;
  if (cache.has(key)) return cache.get(key);

  const profile = moonProfile(moon);
  const height = Math.round(size / 2);
  const seed = seedOf(moon.id || moon.name);

  const canvas = paintSurface(moon, size, height, profile, seed);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.anisotropy = 4;
  map.needsUpdate = true;

  const bumpMap = new THREE.CanvasTexture(paintBump(moon, size, height, profile, seed + 13));
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.needsUpdate = true;

  const entry = { map, bumpMap, normalMap: null, roughnessMap: null, clouds: null, night: null, profile };
  cache.set(key, entry);
  return entry;
}

/** Saturn's ring strip, with a tinted fallback so the ring never disappears offline. */
export function ringTexture() {
  if (cache.has('ring-saturn')) return cache.get('ring-saturn');
  const tex = loadRealTexture(REAL.saturn.ring);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  cache.set('ring-saturn', tex);
  return tex;
}

export function ringPalette() {
  return {
    color: '#d8c9a8',
    opacity: 0.92,
  };
}

/** Background galaxy band, cached at module scope. */
export function galaxyTexture(width = 2048, height = 1024) {
  if (cache.has('galaxy')) return cache.get('galaxy');
  const tex = new THREE.CanvasTexture(paintGalaxyTexture(width, height));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  cache.set('galaxy', tex);
  return tex;
}

export function disposeTextures() {
  cache.forEach((entry) => {
    if (entry && typeof entry.dispose === 'function') entry.dispose();
    else if (entry && typeof entry === 'object') {
      ['map', 'bumpMap', 'normalMap', 'roughnessMap', 'clouds', 'night'].forEach((slot) => {
        if (entry[slot] && entry[slot].dispose) entry[slot].dispose();
      });
    }
  });
  cache.clear();
}
