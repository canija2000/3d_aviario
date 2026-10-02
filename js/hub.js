// Menú de regiones: Chile como pasillo. Un diorama del relieve real (data/game/chile-relief.json,
// scripts/build_relief.py) flota en el vacío; Poroto camina por el valle central siguiendo la Ruta 5
// y la Carretera Austral, entre la Cordillera de los Andes y la de la Costa, y cada región tiene una
// puerta construida con un material de su zona.
/* global THREE */
import { mat, makeTex, makeVary, mulberry32 } from './ps1.js';
import { buildDoor } from './doors.js';
import { HUB_BIRDS } from './hub_birds.js';
import { buildBird, planFor } from './bird.js';
import { birdScale } from './scale.js';
import { buildCar } from './car.js';

// Escala del diorama: S unidades por grado de latitud (1 unidad ≈ 18,5 km) y V unidades por metro de
// altura (1 unidad = 1 km: el relieve va exagerado ~18 veces para que los Andes se lean como muralla).
export const HUB_SCALE = { S: 6, V: 1 / 1000, latRef: -33.45, lonRef: -70.6 };
const { S, V, latRef, lonRef } = HUB_SCALE;
const D2R = Math.PI / 180;
export const toXZ = (lat, lon) => [(lon - lonRef) * Math.cos(lat * D2R) * S, (latRef - lat) * S];
const toLatLon = (x, z) => { const lat = latRef - z / S; return [lat, lonRef + x / (Math.cos(lat * D2R) * S)]; };

// El pasillo: Ruta 5 de Arica a Puerto Montt (por la Depresión Intermedia y la Pampa del Tamarugal),
// Carretera Austral hasta Villa O'Higgins, el Campo de Hielo Sur a pie, y por Magallanes y Tierra del
// Fuego hasta Puerto Williams. [lat, lon, lugar]
const ROUTE = [
  [-18.15, -70.32, 'Arica (norte)'], [-18.48, -70.31, 'Arica'], [-19.2, -70.0, 'Cuya'], [-19.99, -69.77, 'Huara'],
  [-20.26, -69.79, 'Pozo Almonte'], [-21.65, -69.55, 'Quillagua'], [-22.35, -69.66, 'María Elena'],
  [-23.1, -70.05, 'Carmen Alto'], [-23.75, -70.32, 'La Negra'], [-24.8, -70.15, 'Agua Verde'],
  [-25.6, -70.35, 'Taltal (cruce)'], [-26.35, -70.55, 'Chañaral'], [-27.37, -70.33, 'Copiapó'],
  [-28.57, -70.76, 'Vallenar'], [-29.9, -71.25, 'La Serena'], [-30.6, -71.45, 'Socos'],
  [-31.91, -71.5, 'Los Vilos'], [-32.45, -71.23, 'La Ligua'], [-32.84, -70.96, 'Llay-Llay'],
  [-33.45, -70.67, 'Santiago'], [-34.17, -70.74, 'Rancagua'], [-34.58, -70.99, 'San Fernando'],
  [-34.98, -71.24, 'Curicó'], [-35.43, -71.67, 'Talca'], [-35.85, -71.6, 'Linares'], [-36.61, -72.1, 'Chillán'],
  [-37.47, -72.35, 'Los Ángeles'], [-38.23, -72.33, 'Victoria'], [-38.74, -72.6, 'Temuco'],
  [-39.37, -72.63, 'Loncoche'], [-40.07, -72.87, 'Paillaco'], [-40.57, -73.13, 'Osorno'],
  [-41.32, -72.98, 'Puerto Varas'], [-41.47, -72.94, 'Puerto Montt'], [-41.97, -72.47, 'Hornopirén'],
  [-42.92, -72.71, 'Chaitén'], [-43.97, -72.4, 'La Junta'], [-45.0, -72.2, 'Villa Mañihuales'],
  [-45.57, -72.07, 'Coyhaique'], [-46.06, -72.15, 'Cerro Castillo'], [-46.62, -72.67, 'Puerto Río Tranquilo'],
  [-47.25, -72.57, 'Cochrane'], [-48.47, -72.56, "Villa O'Higgins"], [-49.3, -73.0, 'Campo de Hielo Sur'],
  [-50.4, -73.1, 'Campo de Hielo Sur'], [-51.2, -72.7, 'Torres del Paine'], [-51.73, -72.5, 'Puerto Natales'],
  [-52.3, -71.6, 'Villa Tehuelches'], [-53.16, -70.91, 'Punta Arenas'], [-53.3, -70.37, 'Porvenir'],
  [-53.9, -69.6, 'Pampa Guanaco'], [-54.5, -69.1, 'Lago Fagnano'], [-54.85, -68.8, 'Yendegaia'],
  [-54.93, -67.61, 'Puerto Williams'],
];

// Hitos con nombre (cumbres y lugares que se ven desde el pasillo).
const LANDMARKS = [
  { name: 'Parinacota', lat: -18.166, lon: -69.142, m: 6348 },
  { name: 'Licancabur', lat: -22.833, lon: -67.883, m: 5916 },
  { name: 'Llullaillaco', lat: -24.72, lon: -68.54, m: 6739 },
  { name: 'Ojos del Salado', lat: -27.109, lon: -68.541, m: 6893 },
  { name: 'Aconcagua', lat: -32.653, lon: -70.011, m: 6961, note: 'Argentina' },
  { name: 'Tupungato', lat: -33.36, lon: -69.77, m: 6570 },
  { name: 'Volcán Villarrica', lat: -39.42, lon: -71.93, m: 2847 },
  { name: 'Volcán Osorno', lat: -41.1, lon: -72.49, m: 2652 },
  { name: 'San Valentín', lat: -46.595, lon: -73.345, m: 4058 },
  { name: 'Torres del Paine', lat: -50.98, lon: -73.0, m: 2884 },
  { name: 'Desierto de Atacama', lat: -23.0, lon: -69.4, area: true },
  { name: 'Altiplano', lat: -19.0, lon: -68.9, area: true },
  { name: 'Fosa de Atacama', lat: -23.4, lon: -71.65, area: true, sea: true },
  { name: 'Océano Pacífico', lat: -35.5, lon: -74.4, area: true, sea: true },
  { name: 'Chiloé', lat: -42.6, lon: -73.9, area: true },
  { name: 'Campo de Hielo Norte', lat: -47.0, lon: -73.45, area: true },
  { name: 'Campo de Hielo Sur', lat: -49.9, lon: -73.45, area: true },
  { name: 'Estrecho de Magallanes', lat: -53.5, lon: -70.75, area: true, sea: true },
  { name: 'Cabo de Hornos', lat: -55.98, lon: -67.27, area: true },
];

const SNOWLINE = [[-17, 5600], [-27, 5000], [-33, 3900], [-38, 2400], [-42, 1700], [-47, 1150], [-52, 900], [-57, 650]];
function snowline(lat) {
  for (let i = 1; i < SNOWLINE.length; i++) {
    const [l0, h0] = SNOWLINE[i - 1], [l1, h1] = SNOWLINE[i];
    if (lat >= l1) return h0 + (h1 - h0) * (lat - l0) / (l1 - l0);
  }
  return 650;
}
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// Color del suelo según latitud, altura y vertiente (una lectura simple de los pisos de Chile).
function landColor(lat, lon, h) {
  if (h > snowline(lat)) return [232, 236, 244];
  if (lat > -26.5) return h > 3900 ? [156, 132, 96] : h > 2600 ? [170, 134, 102] : [206, 178, 132]; // desierto y altiplano
  if (lat > -31.5) return h > 3000 ? [150, 126, 106] : [180, 158, 112]; // norte chico
  if (lat > -36.5) return h > 2400 ? [138, 124, 112] : h > 1100 ? [112, 112, 74] : [120, 130, 72]; // matorral y valle
  if (lat > -43.5) return h > 1500 ? [122, 118, 112] : [62, 104, 58]; // bosque templado
  const steppe = (lat > -51 && lon > -71.9) || (lat <= -51 && lat > -53.4 && lon > -71.6) || (lat <= -53.4 && lat > -54.3 && lon > -70.1);
  if (steppe) return h > 1000 ? [130, 124, 112] : [164, 150, 96]; // estepa patagónica
  return h > 900 ? [120, 114, 110] : [44, 86, 58]; // bosque siempreverde y turba
}
function seaColor(depth) {
  if (depth > 6500) return [12, 20, 52]; // fosa
  return mix([84, 140, 176], [20, 40, 86], Math.min(1, Math.pow(depth / 4500, 0.6)));
}
const lin = c => c.map(v => Math.pow(Math.max(0, Math.min(255, v)) / 255, 2.2)); // el shader aplica gamma a vCol

// Puertas (js/doors.js): una distinta por región, a esta escala junto al camino.
const DOOR_SCALE = 0.6;
const HUB_BIRD_SIZE = 1.8; // las aves chicas junto a las puertas, más grandes para que se lean desde la cámara del pasillo

export function buildHub({ index, relief, label, poroto, stampOf = () => '' }) {
  const R = mulberry32(7), vary = makeVary(R);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060b);
  scene.add(starfield(R));
  const regs = index.regions;
  const regById = new Map(regs.map(r => [r.id, r]));

  // ---- grilla de alturas
  const { rows, cols, step, lat0, lon0 } = relief;
  const raw = new Int16Array(Uint8Array.from(atob(relief.h), ch => ch.charCodeAt(0)).buffer);
  const ridAt = (r, c) => { const ch = relief.region.charCodeAt(r * cols + c); return ch === 46 ? 0 : ch - 96; };
  const hRaw = (lat, lon) => { // bilineal, en metros
    const fr = Math.max(0, Math.min(rows - 1.001, (lat0 - lat) / step)), fc = Math.max(0, Math.min(cols - 1.001, (lon - lon0) / step));
    const r = Math.floor(fr), c = Math.floor(fc), tr = fr - r, tc = fc - c;
    const g = (i, j) => raw[(r + i) * cols + c + j];
    return (g(0, 0) * (1 - tc) + g(0, 1) * tc) * (1 - tr) + (g(1, 0) * (1 - tc) + g(1, 1) * tc) * tr;
  };
  const ridLL = (lat, lon) => {
    const r = Math.round((lat0 - lat) / step), c = Math.round((lon - lon0) / step);
    return r < 0 || c < 0 || r >= rows || c >= cols ? 0 : ridAt(r, c);
  };
  const yOf = h => h > 0 ? 0.04 + h * V : 0;
  const Y = new Float32Array(rows * cols);
  for (let i = 0; i < rows * cols; i++) Y[i] = yOf(raw[i]);

  // ---- el pasillo: ruta suavizada (Chaikin) y muestreada cada 0,25 unidades
  let pts = ROUTE.map(([lat, lon]) => toXZ(lat, lon));
  for (let k = 0; k < 2; k++) {
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [a, b] = [pts[i], pts[i + 1]];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    out.push(pts[pts.length - 1]); pts = out;
  }
  const path = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]], n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.25));
    for (let s = 0; s < n; s++) path.push({ x: a[0] + (b[0] - a[0]) * s / n, z: a[1] + (b[1] - a[1]) * s / n });
  }
  path.push({ x: pts[pts.length - 1][0], z: pts[pts.length - 1][1] });
  for (const p of path) {
    [p.lat, p.lon] = toLatLon(p.x, p.z);
    p.h = hRaw(p.lat, p.lon);
    p.rid = ridLL(p.lat, p.lon);
    p.type = p.h < 5 ? 'agua' : p.lat < -48.9 && p.lat > -50.9 && p.h > 600 ? 'hielo' : 'tierra';
  }
  const W = 10; // media ventana del suavizado (2,5 unidades)
  path.forEach((p, i) => {
    let s = 0, n = 0;
    for (let j = Math.max(0, i - W); j <= Math.min(path.length - 1, i + W); j++) { s += yOf(path[j].h); n++; }
    p.y = Math.max(s / n, p.type === 'agua' ? 0.35 : 0.12);
  });
  for (const p of path) if (!p.rid) p.rid = null;
  for (let i = 1; i < path.length; i++) path[i].rid ??= path[i - 1].rid; // puentes: región del tramo anterior

  // el valle se excava donde el pasillo pasa más bajo que el terreno
  const HALF = 1.1; // media anchura del camino
  for (const p of path) {
    const r0 = Math.round((lat0 - p.lat) / step), c0 = Math.round((p.lon - lon0) / step);
    for (let r = r0 - 7; r <= r0 + 7; r++) for (let c = c0 - 9; c <= c0 + 9; c++) {
      if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
      const [x, z] = toXZ(lat0 - r * step, lon0 + c * step);
      const d = Math.hypot(x - p.x, z - p.z);
      if (d > 3) continue;
      const w = 1 - Math.max(0, Math.min(1, (d - HALF - 0.2) / 1.7));
      const target = p.y - 0.12, i = r * cols + c;
      if (Y[i] > target) Y[i] += (target - Y[i]) * w;
    }
  }

  // ---- malla del relieve con colores por vértice
  const pos = new Float32Array(rows * cols * 3), col = new Float32Array(rows * cols * 3), uv = new Float32Array(rows * cols * 2);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c, lat = lat0 - r * step, lon = lon0 + c * step;
    const [x, z] = toXZ(lat, lon);
    pos.set([x, Y[i], z], i * 3);
    uv.set([c * 0.25, r * 0.25], i * 2);
    const h = raw[i], rid = ridAt(r, c);
    let cc = h > 0 ? landColor(lat, lon, h) : seaColor(-h);
    if (h > 0 && !rid) { const g = (cc[0] + cc[1] + cc[2]) / 3; cc = mix(cc, [g, g, g + 6], 0.7).map(v => v * 0.62); } // fuera de Chile
    const k = 1 + (R() - 0.5) * 0.1;
    col.set(lin(cc.map(v => v * k)), i * 3);
  }
  const idx = [];
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
    const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
    idx.push(a, d, b, b, d, e);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  const grain = makeTex(16, 16, () => vary([236, 236, 236], 14));
  const ground = new THREE.Mesh(geo, mat(grain, { vcol: 1 }));
  scene.add(ground);

  // borde del diorama: un corte de tierra hasta abajo
  const ring = [];
  for (let c = 0; c < cols; c++) ring.push(c);
  for (let r = 1; r < rows; r++) ring.push(r * cols + cols - 1);
  for (let c = cols - 2; c >= 0; c--) ring.push((rows - 1) * cols + c);
  for (let r = rows - 2; r > 0; r--) ring.push(r * cols);
  ring.push(0);
  const sp = [], sc = [], sIdx = [];
  ring.forEach((i, k) => {
    sp.push(pos[i * 3], Y[i], pos[i * 3 + 2], pos[i * 3], -2.5, pos[i * 3 + 2]);
    const top = raw[i] > 0 ? [96, 74, 56] : [30, 56, 96];
    sc.push(...lin(top), ...lin([22, 18, 20]));
    if (k) { const a = (k - 1) * 2; sIdx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
  });
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  sGeo.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
  sGeo.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(sp.length / 3 * 2).fill(0), 2));
  sGeo.setIndex(sIdx); sGeo.computeVertexNormals();
  scene.add(new THREE.Mesh(sGeo, mat(grain, { vcol: 1, twoSided: true })));

  // ---- el camino: cinta con faldones (tierra, tablas sobre el agua, hielo)
  const rp = [], rc = [], ru = [], rIdx = [];
  const ROAD = { tierra: [156, 132, 98], agua: [124, 86, 52], hielo: [206, 222, 236] };
  path.forEach((p, i) => {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    const tx = b.x - a.x, tz = b.z - a.z, tl = Math.hypot(tx, tz) || 1;
    const nx = -tz / tl, nz = tx / tl;
    p.nx = nx; p.nz = nz;
    const y = p.y + 0.05;
    rp.push(p.x + nx * HALF, y, p.z + nz * HALF, p.x - nx * HALF, y, p.z - nz * HALF,
      p.x + nx * HALF, y - 1.4, p.z + nz * HALF, p.x - nx * HALF, y - 1.4, p.z - nz * HALF);
    let c = ROAD[p.type];
    if (p.type === 'agua' && i % 2) c = c.map(v => v * 0.8); // tablas
    if (p.type === 'tierra' && i % 8 < 1) c = c.map(v => v * 0.92);
    const top = lin(c), side = lin(c.map(v => v * 0.55));
    rc.push(...top, ...top, ...side, ...side);
    ru.push(0, i * 0.25, 1, i * 0.25, 0, i * 0.25, 1, i * 0.25);
    if (i) {
      const o = (i - 1) * 4, q = i * 4;
      rIdx.push(o, q, o + 1, o + 1, q, q + 1); // superficie
      rIdx.push(o, o + 2, q, q, o + 2, q + 2); // faldón izquierdo
      rIdx.push(o + 1, q + 1, o + 3, o + 3, q + 1, q + 3); // faldón derecho
    }
  });
  const rGeo = new THREE.BufferGeometry();
  rGeo.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
  rGeo.setAttribute('color', new THREE.Float32BufferAttribute(rc, 3));
  rGeo.setAttribute('uv', new THREE.Float32BufferAttribute(ru, 2));
  rGeo.setIndex(rIdx); rGeo.computeVertexNormals();
  const cobble = makeTex(16, 16, (x, y) => vary(((x >> 2) + (y >> 2)) % 2 ? [236, 230, 222] : [212, 206, 198], 10));
  scene.add(new THREE.Mesh(rGeo, mat(cobble, { vcol: 1, twoSided: true })));

  // ---- puertas: una por región, al lado cordillerano del camino, en la mitad de su tramo
  const portals = [], swirls = [], doors = [];
  for (const r of regs) {
    const inReg = path.map((p, i) => (p.rid === r.id ? i : -1)).filter(i => i >= 0);
    let i = inReg.length ? inReg[Math.floor(inReg.length / 2)] : 0;
    if (!inReg.length) { // sin tramo propio: el punto del camino más cercano a la región
      const [rx, rz] = toXZ(r.lat, r.lon);
      i = path.reduce((bi, p, k) => (Math.hypot(p.x - rx, p.z - rz) < Math.hypot(path[bi].x - rx, path[bi].z - rz) ? k : bi), 0);
    }
    const p = path[i];
    const east = p.nx > 0 ? 1 : -1; // normal hacia el este (los Andes)
    const ox = p.nx * east, oz = p.nz * east;
    const active = !!r.terrainFile;
    const door = buildDoor(r.code, active);
    door.scale.setScalar(DOOR_SCALE);
    door.position.set(p.x + ox * (HALF + 0.7), p.y, p.z + oz * (HALF + 0.7));
    door.rotation.y = Math.atan2(-ox, -oz); // el frente mira al camino
    scene.add(door);
    if (door.userData.swirl) swirls.push(door.userData.swirl);
    const anchor = door.position.clone().add(new THREE.Vector3(0, 1.3 * DOOR_SCALE, 0));
    label(r.name + stampOf(r.code), door.position.clone().add(new THREE.Vector3(0, (door.userData.top + 0.3) * DOOR_SCALE, 0)), active ? '#f4d35e' : '#aab0c8', active ? 'big' : '', 32);
    doors.push({ door, r });
    const proxy = new THREE.Mesh(new THREE.SphereGeometry(1.0, 6, 4), new THREE.MeshBasicMaterial({ visible: false }));
    proxy.position.copy(anchor);
    proxy.userData.portal = { region: r, active, anchor, stop: new THREE.Vector3(p.x, p.y, p.z), pathIndex: i };
    scene.add(proxy);
    portals.push(proxy);
  }

  // ---- hitos
  for (const L of LANDMARKS) {
    const [x, z] = toXZ(L.lat, L.lon);
    let y = L.sea ? 0.6 : 0;
    if (!L.sea) { // la cumbre más alta en un radio chico (la grilla es más gruesa que el volcán)
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) y = Math.max(y, yOf(hRaw(L.lat + dr * step, L.lon + dc * step)));
      y += L.area ? 1.2 : 0.4;
    }
    const html = L.area ? `<i>${L.name}</i>` : `▲ ${L.name}<small> ${L.m.toLocaleString('es-CL')} m${L.note ? ' · ' + L.note : ''}</small>`;
    label(html, new THREE.Vector3(x, y, z), L.area ? (L.sea ? '#8fb4dc' : '#d8cfb8') : '#eef1f8', 'hito', 45);
  }

  scene.add(poroto.root, poroto.shadow);

  // ---- consultas
  let hint = 0;
  function nearest(x, z) {
    const search = (a, b) => {
      let best = null;
      for (let i = Math.max(0, a); i < Math.min(path.length - 1, b); i++) {
        const p = path[i], q = path[i + 1];
        const ax = q.x - p.x, az = q.z - p.z, L2 = ax * ax + az * az || 1e-9;
        const t = Math.max(0, Math.min(1, ((x - p.x) * ax + (z - p.z) * az) / L2));
        const px = p.x + ax * t, pz = p.z + az * t, d = Math.hypot(px - x, pz - z);
        if (!best || d < best.d) best = { i, t, x: px, z: pz, y: p.y + (q.y - p.y) * t, d };
      }
      return best;
    };
    let b = search(hint - 60, hint + 60);
    if (b.d > 3) b = search(0, path.length);
    hint = b.i;
    return b;
  }
  const snap = (x, z) => { const b = nearest(x, z); return { p: new THREE.Vector3(b.x, b.y, b.z), d: b.d }; };
  const heightAt = (x, z) => nearest(x, z).y + 0.05;
  const groundAt = (x, z) => {
    const [lat, lon] = toLatLon(x, z);
    const fr = (lat0 - lat) / step, fc = (lon - lon0) / step;
    if (fr < 0 || fc < 0 || fr >= rows - 1 || fc >= cols - 1) return -3;
    const r = Math.floor(fr), c = Math.floor(fc), tr = fr - r, tc = fc - c;
    const g = (i, j) => Y[(r + i) * cols + c + j];
    return (g(0, 0) * (1 - tc) + g(0, 1) * tc) * (1 - tr) + (g(1, 0) * (1 - tc) + g(1, 1) * tc) * tr;
  };
  const regionAt = (x, z) => regById.get(path[nearest(x, z).i].rid) || null;
  const spawn = code => {
    const pr = portals.find(p => p.userData.portal.region.code === code) || portals[0];
    const p = path[Math.max(0, pr.userData.portal.pathIndex - 6)];
    return new THREE.Vector3(p.x, p.y, p.z);
  };
  // ---- aves de cada zona, a los lados de su puerta
  const birds = [];
  for (const { door, r } of doors) {
    door.updateMatrixWorld(true);
    (HUB_BIRDS[r.code] || []).forEach((hb, k) => {
      const base = index.bySci.get(hb.sci);
      if (!base) return;
      const sp = { ...base, id: base.id + 100000, palette: base.palette || hb.palette }; // copia: no toca la caché de texturas de las escenas
      const plan = planFor(base);
      const m = buildBird(sp, plan);
      const big = base.morphology?.scale ?? 1;
      const s = birdScale(base) * (big > 4 ? 0.7 : big > 2 ? 1 : HUB_BIRD_SIZE); // las chicas se agrandan para leerse; las muy grandes se achican
      m.group.scale.setScalar(s);
      const side = k ? 1 : -1;
      const pos = door.localToWorld(new THREE.Vector3(side * (2.6 + R() * 0.6), 0, 1.3 + R() * 0.8));
      pos.y = groundAt(pos.x, pos.z);
      m.group.position.copy(pos);
      m.group.rotation.y = door.rotation.y + Math.PI / 2 + side * 0.6 + (R() - 0.5) * 0.6;
      scene.add(m.group);
      label(base.comName, pos.clone().add(new THREE.Vector3(0, (m.height ?? 2.5) * s + 0.25, 0)), '#cfe8c8', 'hito', 10);
      birds.push({ m, y: pos.y, ph: R() * 10, hover: plan === 'picaflor' });
    });
  }

  // ---- la Citroneta, estacionada junto al camino (lado del mar) cerca de la puerta de llegada
  const car = buildCar();
  scene.add(car.group);
  const park = code => {
    const pr = portals.find(p => p.userData.portal.region.code === code) || portals[0];
    const p = path[Math.max(0, pr.userData.portal.pathIndex - 14)];
    const west = p.nx > 0 ? -1 : 1;
    const x = p.x + p.nx * west * (HALF + 0.6), z = p.z + p.nz * west * (HALF + 0.6);
    car.group.position.set(x, Math.max(groundAt(x, z), p.y - 0.3), z);
    car.group.rotation.set(0, Math.atan2(p.nx, p.nz) + (west > 0 ? 0 : Math.PI), 0); // paralela al camino
    car.v = 0;
  };

  const update = (t, dt = 0) => {
    for (const m of swirls) m.uniforms.uOffset.value.set(Math.sin(t * 0.7) * 0.1, -t * 0.35);
    const q = Math.floor(t * 15) / 15; // 15 Hz, como las aves de las escenas
    for (const b of birds) {
      const k = q + b.ph;
      if (b.m.head) b.m.head.rotation.y = Math.sin(k * 0.9) * 0.5 * (Math.sin(k * 0.23) > 0 ? 1 : 0.2);
      if (b.m.bodyPivot) b.m.bodyPivot.rotation.z = Math.max(0, Math.sin(k * 0.7)) > 0.93 ? -0.5 : 0; // picotea de vez en cuando
      b.m.group.position.y = b.y + (b.hover ? 0.35 + Math.sin(k * 3) * 0.05 : Math.max(0, Math.sin(k * 0.5)) > 0.97 ? 0.05 : 0);
    }
  };
  return { scene, portals, snap, heightAt, groundAt, regionAt, spawn, update, car, park };
}

function starfield(R) {
  const g = new THREE.BufferGeometry();
  const pts = [];
  for (let i = 0; i < 900; i++) {
    const a = R() * Math.PI * 2, b = (R() - 0.3) * Math.PI, r = 150;
    pts.push(Math.cos(a) * Math.cos(b) * r, Math.sin(b) * r, Math.sin(a) * Math.cos(b) * r);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xc8d0ff, size: 1.2, sizeAttenuation: false, fog: false }));
  stars.onBeforeRender = (r, s, cam) => stars.position.copy(cam.position); // el cielo acompaña a la cámara
  return stars;
}
