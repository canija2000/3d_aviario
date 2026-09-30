// Aviario de Chile: PRESS START → menú de regiones (Chile flotando en el vacío) → escena de la
// región (mini-escenas unidas por senderos) con aves reales mes a mes.
/* global THREE */
import { shared, mat, makeTex, makeVary, mulberry32, createRenderer, fitRenderer, texPlain } from './ps1.js';
import { loadWorld, loadRegion, loadJSON, DATA_BASE, CLASS_LABEL, birdDialog, welcomeText, featuredIn } from './data.js';
import { buildScene, signpost, WORLD } from './scene.js';
import { buildPoroto } from './poroto.js';
import { Director } from './aviary.js';
import { buildBird } from './bird.js';
import { unlockAudio, setListener, setMuted, blip, setAmbience, duckAmbience } from './audio.js';

const $ = id => document.getElementById(id);
const canvas = $('c');
const renderer = createRenderer(canvas);
const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.3, 200);
const MONTH_SECONDS = 15; // un ciclo de 4 estaciones ≈ 3 minutos
const SEASON_OF = ['verano', 'verano', 'otoño', 'otoño', 'otoño', 'invierno', 'invierno', 'invierno', 'primavera', 'primavera', 'primavera', 'verano'];
const SEASON_COLOR = { verano: '#e8b04a', 'otoño': '#c0703a', invierno: '#6a8ac8', primavera: '#7ab85a' };
const LIGHT = {
  verano: { sun: 0xfff0c8, amb: 0x7c786a, fog: 0xbfc6c4 },
  'otoño': { sun: 0xf0d0a0, amb: 0x72685c, fog: 0xb0a48e },
  invierno: { sun: 0xc8d0e0, amb: 0x5c6270, fog: 0x8e98a8 },
  primavera: { sun: 0xf8f0d0, amb: 0x74806a, fog: 0xacc4b4 },
};
// Etiquetas de los biomas (las escenas de cada región salen de terrain-<CODE>.json).
const SCENE_LABEL = { ciudad: 'Ciudad', matorral: 'Matorral', rio: 'Río', cordillera: 'Cordillera', costa: 'Costa',
  humedal: 'Humedal', desierto: 'Desierto', valle: 'Valle', altiplano: 'Altiplano', bosque: 'Bosque', lago: 'Lago',
  pradera: 'Pradera', fiordo: 'Fiordo', estepa: 'Estepa' };
const sceneOrder = () => Object.keys(G.reg.terrain.scenes);
const featuredList = () => Object.keys(G.feat || {});

const G = {
  mode: 'start', index: null, reg: null, props: null, sceneKey: null, sc: null, world: null, director: null,
  month: new Date().getMonth(), monthT: 0, paused: false, muted: false,
  hover: null, dialogOpen: false, book: loadBook(), cam: { yaw: -Math.PI / 2, pitch: 0.62, dist: 12, target: new THREE.Vector3() },
  quirkT: 12, exits: [], portals: [],
};

function loadBook() {
  try { return new Set(JSON.parse(localStorage.getItem('aviario.libreta') || '[]')); } catch { return new Set(); }
}
function saveBook() { try { localStorage.setItem('aviario.libreta', JSON.stringify([...G.book])); } catch { /* sin almacenamiento */ } }

const poroto = buildPoroto();
const bubble = document.createElement('div');
bubble.className = 'tip'; bubble.style.setProperty('--tip', '#f4d35e'); bubble.hidden = true; document.body.appendChild(bubble);
let bubbleT = 0;
function say(text, secs = 2.5) { bubble.textContent = text; bubble.hidden = false; bubbleT = secs; }

// ------------------------------------------------------------------ UI helpers
function toast(html, secs = 3) {
  const t = $('toast'); t.innerHTML = html; t.hidden = false;
  clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, secs * 1000);
}
// Retrato del ave (estilo RuneScape): renderer propio, pequeño y pixelado, con un modelo nuevo
// de la misma especie girando lento.
const portrait = (() => {
  const cv = document.createElement('canvas');
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: false, alpha: true });
  r.setPixelRatio(1); r.setSize(96, 96, false); r.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  $('dialog-portrait').appendChild(cv);
  let model = null, t = 0, open = 0, raf = 0;
  function loop() {
    if ($('dialog').hidden || !model) { raf = 0; return; }
    t += 1 / 60;
    model.group.rotation.y = Math.sin(t * 0.8) * 0.45 - 0.35;
    model.head.rotation.y = Math.sin(t * 1.7) * 0.2;
    open = Math.max(0, open - 1 / 60);
    const o = open > 0 ? 0.35 * (Math.sin(t * 22) > 0 ? 1 : 0) : 0;
    model.lower.rotation.z = -0.18 - o; model.upper.rotation.z = -0.12 + o * 0.3;
    r.render(scene, cam);
    raf = requestAnimationFrame(loop);
  }
  return {
    show(agent) {
      if (model) scene.remove(model.group);
      model = buildBird(agent.sp, agent.plan);
      scene.add(model.group);
      model.group.updateMatrixWorld(true);
      const head = new THREE.Vector3(); model.head.getWorldPosition(head);
      const look = head.clone().add(new THREE.Vector3(-0.15, -0.35, 0));
      cam.position.copy(look).add(new THREE.Vector3(2.6, 0.5, 2.2));
      cam.lookAt(look);
      $('dialog-portrait').style.setProperty('--tip', agent.color);
      $('dialog-portrait').hidden = false;
      if (!raf) raf = requestAnimationFrame(loop);
    },
    hide() { $('dialog-portrait').hidden = true; },
    sing(secs) { open = secs; },
  };
})();

function openDialog(html, actions = [{ label: 'Cerrar' }], opts = {}) {
  $('dialog-text').innerHTML = html;
  if (opts.bird) portrait.show(opts.bird); else portrait.hide();
  const box = $('dialog-actions'); box.innerHTML = '';
  for (const a of actions) {
    const b = document.createElement('button'); b.className = 'btn'; b.textContent = a.label;
    if (a.disabled) { b.disabled = true; b.title = a.title || ''; }
    b.onclick = () => { blip(660); if (!a.keep) closeDialog(); a.fn?.(); };
    box.appendChild(b);
  }
  $('dialog').hidden = false; G.dialogOpen = true;
  box.querySelector('button:not([disabled])')?.focus();
}
function closeDialog() { $('dialog').hidden = true; G.dialogOpen = false; }
function openPanel(html) { $('panel-body').innerHTML = html; $('panel').hidden = false; }
$('panel-close').onclick = () => { $('panel').hidden = true; };
function fade(on, html = '') { $('fade-text').innerHTML = html; $('fade').classList.toggle('on', on); return new Promise(r => setTimeout(r, 650)); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ------------------------------------------------------------------ PS1 world helpers
const R = mulberry32(3);
const vary = makeVary(R);
function starfield() {
  const g = new THREE.BufferGeometry();
  const pts = [];
  for (let i = 0; i < 600; i++) {
    const a = R() * Math.PI * 2, b = (R() - 0.3) * Math.PI, r = 120;
    pts.push(Math.cos(a) * Math.cos(b) * r, Math.sin(b) * r, Math.sin(a) * Math.cos(b) * r);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xc8d0ff, size: 1.2, sizeAttenuation: false, fog: false }));
}
// Etiquetas del mundo como HTML proyectado: el 3D va a 240p, pero el texto debe leerse nítido.
const worldLabels = [];
function addLabel(html, pos, color = '#eef1f8', cls = '') {
  const el = document.createElement('div');
  el.className = 'wlabel ' + cls; el.innerHTML = html; el.style.color = color;
  document.body.appendChild(el);
  const l = { el, pos: pos.clone() };
  worldLabels.push(l);
  return l;
}
function clearLabels() { for (const l of worldLabels) l.el.remove(); worldLabels.length = 0; clearBirdLabels(); }

// Nombre de cada ave siempre visible (se atenúa con la distancia; N o el botón NOMBRES lo apagan).
const birdLabels = new Map(); // agente → elemento
let showNames = true;
function clearBirdLabels() { for (const el of birdLabels.values()) el.remove(); birdLabels.clear(); }
const _b = new THREE.Vector3();
function updateBirdLabels() {
  if (G.mode !== 'scene' || !G.director) { clearBirdLabels(); return; }
  const alive = new Set(G.director.agents);
  for (const [a, el] of birdLabels) if (!alive.has(a)) { el.remove(); birdLabels.delete(a); }
  for (const a of G.director.agents) {
    let el = birdLabels.get(a);
    if (!el) {
      el = document.createElement('div'); el.className = 'blabel';
      el.textContent = a.sp.comName; el.style.color = a.color;
      document.body.appendChild(el); birdLabels.set(a, el);
    }
    _b.copy(a.m.group.position); _b.y += (a.m.height ?? 2.5) * a.s + 0.25;
    const d = camera.position.distanceTo(_b);
    _b.project(camera);
    const show = showNames && a.state !== 'wait' && _b.z < 1 && Math.abs(_b.x) < 1.05 && Math.abs(_b.y) < 1.05 && d < 38;
    el.hidden = !show;
    if (!show) continue;
    el.style.left = ((_b.x + 1) / 2 * window.innerWidth) + 'px';
    el.style.top = ((1 - _b.y) / 2 * window.innerHeight) + 'px';
    el.style.opacity = String(Math.max(0.35, Math.min(1, 1.35 - d / 30)));
    el.classList.toggle('sing', !!a.singing);
  }
}
const _v = new THREE.Vector3();
function updateLabels() {
  for (const l of worldLabels) {
    _v.copy(l.pos).project(camera);
    const d = camera.position.distanceTo(l.pos);
    const show = _v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1 && d < 60;
    l.el.hidden = !show;
    if (show) {
      l.el.style.left = ((_v.x + 1) / 2 * window.innerWidth) + 'px';
      l.el.style.top = ((1 - _v.y) / 2 * window.innerHeight) + 'px';
    }
  }
}

// ------------------------------------------------------------------ MENÚ DE REGIONES
function buildHub() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060b);
  scene.add(starfield());
  const rm = G.index.regions.find(r => r.code === 'CL-RM');
  const zOf = lat => -(lat - rm.lat) * 2.0;
  const xOf = lon => (lon - rm.lon) * 1.5;
  const stone = makeTex(16, 16, () => vary(R() < 0.3 ? [90, 84, 100] : [110, 104, 120], 10));
  const mStone = mat(stone, { rx: 1, ry: 6 });
  const regs = G.index.regions;
  // la franja de Chile: tramos entre regiones consecutivas
  const pts = regs.map(r => new THREE.Vector3(xOf(r.lon), 0, zOf(r.lat)));
  const first = pts[0].clone(); first.z -= 3; const last = pts[pts.length - 1].clone(); last.z += 3;
  const path = [first, ...pts, last];
  const walk = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const len = a.distanceTo(b);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, len + 0.6).translate(0, -0.6, 0), mStone);
    seg.position.copy(a).lerp(b, 0.5);
    seg.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    scene.add(seg);
    walk.push([a, b]);
  }
  const portals = [];
  regs.forEach((r, i) => {
    const active = !!r.terrainFile;
    const color = active ? 0xf4d35e : 0x505670;
    const glow = makeTex(8, 8, () => vary(active ? [240, 200, 90] : [80, 86, 112], 12));
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0).scale(1, 1.5, 1), mat(glow, { tint: color }));
    gem.position.set(pts[i].x + 3.2, 2, pts[i].z);
    scene.add(gem);
    addLabel(r.name, new THREE.Vector3(pts[i].x + 4.4, 2.2, pts[i].z), active ? '#f4d35e' : '#aab0c8', 'left' + (active ? ' big' : ''));
    const proxy = new THREE.Mesh(new THREE.SphereGeometry(1.1, 6, 4), new THREE.MeshBasicMaterial({ visible: false }));
    proxy.position.copy(gem.position); proxy.userData.portal = { region: r, active, gem };
    scene.add(proxy);
    portals.push(proxy);
  });
  scene.add(poroto.root, poroto.shadow);
  // posición sobre la franja más cercana
  const snap = (x, z) => {
    let best = null, bd = 1e9;
    for (const [a, b] of walk) {
      const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, ((x - a.x) * ab.x + (z - a.z) * ab.z) / ab.lengthSq()));
      const p = a.clone().addScaledVector(ab, t);
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return { p: best, d: bd };
  };
  return { scene, portals, snap, rmPoint: pts[regs.indexOf(rm)], heightAt: () => 0 };
}

async function enterHub() {
  G.mode = 'hub';
  setAmbience(null);
  clearLabels();
  G.hubWorld = buildHub();
  G.world = G.hubWorld.scene;
  applyLight('primavera', 0x05060b, 30, 90);
  poroto.pos.copy(G.hubWorld.rmPoint); poroto.pos.x -= 0.5;
  poroto.drop = 14; poroto.heading = -Math.PI / 2;
  poroto.season = 'primavera';
  G.cam.dist = 20; G.cam.pitch = 0.75; G.cam.yaw = -Math.PI / 2 + 0.5; G.cam.distGoal = G.cam.pitchGoal = G.cam.yawGoal = undefined;
  G.cam.target.copy(poroto.pos);
  $('hud').hidden = true;
  await fade(false);
  const open = G.index.regions.filter(r => r.terrainFile).map(r => `<b>${r.name}</b>`);
  toast(`Camina hasta un portal o abre el <b>mapa</b> (M) para viajar. Se puede entrar a ${open.join(', ')}.`, 6);
}

function portalClicked(p) {
  const r = p.region;
  if (!p.active) { say(`${r.name}: próximamente`); blip(220, 0.1); return; }
  const target = p.gem.position.clone(); target.x -= 3.2; target.y = 0;
  poroto.walkTo(target, () => {
    poroto.look = p.gem.position.clone();
    openDialog(`Portal a la <b>${r.fullName || r.name}</b>. ¿Qué año quieres visitar?`, [
      { label: 'Año típico', fn: () => enterRegion(r.code) },
      ...G.index.years.slice(-3).map(y => ({ label: String(y), disabled: true, title: 'Selector de año: después del MVP' })),
      { label: 'Volver' },
    ]);
  });
}

// ------------------------------------------------------------------ REGIÓN Y ESCENAS
async function enterRegion(code, opts = {}) {
  await fade(true, 'Cargando la región…');
  G.reg = await loadRegion(G.index, code);
  try { G.props = await loadJSON(DATA_BASE + `props-${code}.json`); } catch { G.props = null; }
  G.feat = featuredIn(G.index, G.reg.region);
  G.director = new Director({ index: G.index, region: G.reg.region, regionId: G.reg.meta.id, regionCode: code, root: null, onSing });
  G.mode = 'scene';
  await loadSceneKey(sceneOrder()[0], null, false);
  if (opts.drop) { poroto.drop = 14; poroto.dropMsg = `¡Llegamos a ${G.reg.meta.name}!`; }
  poroto.root.visible = true;
  $('hud').hidden = false;
  await fade(false);
  openDialog(welcomeText(G.index, G.reg.meta, G.month), [{ label: '¡Vamos!' }]);
}

async function loadSceneKey(key, fromKey, withFade = true) {
  const data = G.reg.terrain.scenes[key];
  // senderos hacia los otros cuartos, en la dirección geográfica real
  const dirs = sceneOrder().filter(k => k !== key).map(k => {
    const other = G.reg.terrain.scenes[k];
    const dx = (other.center[0] - data.center[0]) * Math.cos(data.center[1] * Math.PI / 180), dz = -(other.center[1] - data.center[1]);
    return { k, a: Math.atan2(dz, dx) };
  });
  // separar senderos que apuntan casi igual (p. ej. matorral y cordillera desde la ciudad)
  dirs.sort((p, q) => p.a - q.a);
  for (let i = 1; i < dirs.length; i++) if (dirs[i].a - dirs[i - 1].a < 0.6) dirs[i].a = dirs[i - 1].a + 0.6;
  const EXIT_R = WORLD / 2 * 0.62;
  const scene = new THREE.Scene();
  const sc = buildScene(key, data, G.props, dirs.map(d => d.a), EXIT_R, G.reg.meta.lat < -44); // Aysén y Magallanes: inviernos con nieve
  scene.add(sc.root, poroto.root, poroto.shadow);
  G.world = scene; G.sc = sc; G.sceneKey = key;
  clearLabels();
  G.exits = [];
  for (const [i, { k, a }] of dirs.entries()) {
    const [x, z] = sc.exitPts[i];
    const sign = signpost(`→ ${SCENE_LABEL[k]}`);
    sign.position.set(x, sc.heightAt(x, z), z);
    sign.rotation.y = -a + Math.PI / 2;
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 1), new THREE.MeshBasicMaterial({ visible: false }));
    proxy.position.set(0, 1.2, 0); proxy.userData.exit = { key: k, sign }; sign.add(proxy);
    scene.add(sign);
    addLabel(`→ ${SCENE_LABEL[k]}`, sign.position.clone().add(new THREE.Vector3(0, 2.4, 0)), '#f4d35e');
    G.exits.push({ key: k, sign, proxy, angle: a });
  }
  // llegada: junto al letrero del cuarto de origen, o al centro
  const back = G.exits.find(e => e.key === fromKey);
  if (back) { poroto.pos.set(back.sign.position.x * 0.6, 0, back.sign.position.z * 0.6); }
  else poroto.pos.set(0, 0, 0);
  poroto.target = null; poroto.state = 'idle'; poroto.drop = 0;
  G.cam.dist = 13; G.cam.pitch = 0.72; G.cam.yaw = -Math.PI / 2; G.cam.distGoal = G.cam.pitchGoal = G.cam.yawGoal = undefined;
  G.cam.target.set(poroto.pos.x, sc.heightAt(poroto.pos.x, poroto.pos.z), poroto.pos.z);
  G.director.root = scene;
  G.director.setScene(key, sc, G.month, true);
  setAmbience(key);
  applySeason(true);
  updateHud();
  if (withFade) await fade(false);
}

async function travel(toKey) {
  const a = G.reg.terrain.scenes[G.sceneKey], b = G.reg.terrain.scenes[toKey];
  const km = haversine(a.center, b.center);
  const dh = Math.round((b.hMin + b.hMax) / 2 - (a.hMin + a.hMax) / 2);
  closeDialog();
  blip(440, 0.12);
  await fade(true, `${a.name} → ${b.name}<small>${km.toFixed(0)} km · ${dh >= 0 ? '+' : '−'}${Math.abs(dh).toLocaleString('es-CL')} m de altura</small>`);
  await sleep(1600);
  const from = G.sceneKey;
  await loadSceneKey(toKey, from, true);
  toast(`<b>${SCENE_LABEL[toKey]}</b> · ${b.name}`, 3);
}

function haversine([lo1, la1], [lo2, la2]) {
  const r = Math.PI / 180, dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

// ------------------------------------------------------------------ estación y tiempo
function applyLight(season, fogColor, near, far) {
  const L = LIGHT[season];
  shared.uLightCol.value.set(L.sun);
  shared.uAmb.value.set(L.amb);
  const fc = fogColor ?? (G.sceneKey === 'cordillera' ? 0x9cb4d8 : G.sc?.seaY != null ? 0xa4b8c8 : L.fog);
  shared.uFogColor.value.set(fc);
  renderer.setClearColor(fc);
  shared.uFogNear.value = near ?? 18; shared.uFogFar.value = far ?? 62;
}
function applySeason(silent = false) {
  const season = SEASON_OF[G.month];
  applyLight(season);
  if (G.sc) shared.uSnow.value = G.sc.setSeason(season, G.month);
  poroto.season = season;
  if (!silent) toast(`${G.index.months[G.month][0].toUpperCase() + G.index.months[G.month].slice(1)} · ${season}`, 2.5);
}
function setMonth(m) {
  G.month = (m + 12) % 12;
  G.monthT = 0;
  applySeason();
  if (G.director) {
    const before = new Set(G.director.agents.map(a => a.sp.id));
    const cast = G.director.setMonth(G.month, false);
    const arriving = cast.filter(c => !before.has(c.sp.id)).map(c => c.sp.comName);
    if (arriving.length) setTimeout(() => toast(`Llegan: <b>${arriving.join(', ')}</b>`, 3.5), 2600);
  }
  updateHud();
}

function updateHud() {
  if (!G.reg) return;
  const meta = G.reg.meta, ms = meta.months[G.month];
  $('hud-region').innerHTML = `<b>${meta.name}</b> · año típico`;
  $('hud-scene').textContent = `${SCENE_LABEL[G.sceneKey]} — ${G.reg.terrain.scenes[G.sceneKey].name}`;
  const mn = G.index.months[G.month];
  $('hud-month').innerHTML = `<b>${mn[0].toUpperCase() + mn.slice(1)}</b> · ${SEASON_OF[G.month]}`;
  $('hud-rich').innerHTML = `${ms.richness} especies en la región<br>${ms.residente} res · ${ms.visitante_estival} verano · ${ms.visitante_invernal} invierno`;
  // rueda de estaciones
  const w = $('wheel'); let svg = '';
  for (let m = 0; m < 12; m++) {
    const a0 = (m / 12) * Math.PI * 2 - Math.PI / 2, a1 = ((m + 1) / 12) * Math.PI * 2 - Math.PI / 2;
    const r0 = 11, r1 = m === G.month ? 21 : 18;
    const p = (a, r) => `${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`;
    svg += `<path d="M${p(a0, r0)} L${p(a0, r1)} A${r1},${r1} 0 0 1 ${p(a1, r1)} L${p(a1, r0)} A${r0},${r0} 0 0 0 ${p(a0, r0)}Z" fill="${SEASON_COLOR[SEASON_OF[m]]}" opacity="${m === G.month ? 1 : 0.45}" stroke="#05060b" stroke-width="0.8"/>`;
  }
  svg += `<text x="0" y="3" text-anchor="middle" font-size="8" fill="#eef1f8" font-family="monospace">${G.month + 1}</text>`;
  w.innerHTML = svg;
  $('book-n').textContent = `${featuredList().filter(sci => G.book.has(G.index.bySci.get(sci)?.id)).length}/${featuredList().length}`;
  $('b-pause').textContent = G.paused ? '▶' : '⏸';
  $('b-pause').title = G.paused ? 'Reanudar el tiempo' : 'Pausar el tiempo';
}

// ------------------------------------------------------------------ estadísticas en vivo del cuarto
$('live-toggle').onclick = () => {
  const c = $('live').classList.toggle('closed');
  $('live-toggle').setAttribute('aria-expanded', String(!c));
};
let liveT = 0;
function updateLive(dt) {
  liveT -= dt;
  if (liveT > 0 || !G.director) return;
  liveT = 0.5;
  const groups = new Map();
  for (const a of G.director.agents) {
    const g = groups.get(a.sp.id) || { a, n: 0, sing: false, arriving: 0, leaving: 0 };
    g.n++; g.sing ||= !!a.singing;
    if (a.leaving) g.leaving++; else if (a.state === 'wait' || (a.state === 'fly' && a.pos.y > a.to.y + 3)) g.arriving++;
    groups.set(a.sp.id, g);
  }
  const rows = [...groups.values()].sort((p, q) => q.a.freq - p.a.freq);
  const here = rows.reduce((s, g) => s + g.n - g.leaving, 0);
  $('live-n').textContent = `· ${here} aves`;
  $('live-body').innerHTML = rows.map(g => {
    const pct = Math.round(g.a.freq / 10);
    const st = g.sing ? '<span class="sing">♪</span> ' : '';
    const mv = g.leaving ? ' · se va' : g.arriving ? ' · llegando' : '';
    return `<div class="live-row" title="${CLASS_LABEL[g.a.cls]} · registrada ${pct}% de los días de ${G.index.months[G.month]} en la región (año típico)">
      <span class="dot" style="background:${g.a.color}"></span><span class="name">${st}${g.a.sp.comName}</span><span class="meta">×${g.n}${mv}</span>
      <span class="bar"><i style="width:${Math.min(100, pct)}%;background:${g.a.color}"></i></span></div>`;
  }).join('') + `<div class="live-foot">Barra: % de días de ${G.index.months[G.month]} con registro en la región · color: clase regional</div>`;
}

// ------------------------------------------------------------------ cantos
function onSing(agent, dur) {
  duckAmbience(dur);
  const d = agent.pos.distanceTo(poroto.pos);
  if (d < 30) {
    poroto.setFeather(agent.color, agent.pos);
    clearTimeout(onSing.h);
    onSing.h = setTimeout(() => poroto.setFeather(null, null), dur * 1000);
  }
}

// ------------------------------------------------------------------ puntero y marca de destino
// Cursores pixel art dibujados en un canvas (2× para que se vean nítidos).
function pixelCursor(rows, colors, scale = 2) {
  const h = rows.length, w = rows[0].length;
  const cv = document.createElement('canvas'); cv.width = w * scale; cv.height = h * scale;
  const g = cv.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (colors[ch]) { g.fillStyle = colors[ch]; g.fillRect(x * scale, y * scale, scale, scale); }
  }));
  return cv.toDataURL();
}
const CUR_COLORS = { k: '#05060b', w: '#f4ecd0', y: '#f4d35e', r: '#d04a3a' };
const ARROW = [
  'k...........', 'kk..........', 'kwk.........', 'kwwk........', 'kwwwk.......', 'kwwwwk......', 'kwwwwwk.....',
  'kwwwwwwk....', 'kwwwwwwwk...', 'kwwwwwwwwk..', 'kwwwwwkkkkk.', 'kwwkwwk.....', 'kwk.kwwk....', 'kk..kwwk....',
  'k....kwwk...', '.....kwwk...', '......kk....'];
const HAND = [
  '....kk......', '...kyyk.....', '...kyyk.....', '...kyyk.....', '...kyykkk...', '...kyykyykk.', '.kkkyykyykyk',
  'kyykyyyyyyyk', 'kyyyyyyyyyyk', '.kyyyyyyyyyk', '.kyyyyyyyyk.', '..kyyyyyyyk.', '..kyyyyyyk..', '...kyyyyyk..', '...kkkkkkk..'];
const TRAIL = ARROW.map((r, i) => i >= 12 ? r.slice(0, 7) + ['.....', '..r.r', '.r.r.', '..r.r', '.....'][i - 12] : r);
const CURSORS = {
  arrow: `url(${pixelCursor(ARROW, CUR_COLORS)}) 0 0, auto`,
  hand: `url(${pixelCursor(HAND, CUR_COLORS)}) 8 0, pointer`,
  trail: `url(${pixelCursor(TRAIL, CUR_COLORS)}) 0 0, pointer`,
};
function setCursor(kind) { canvas.style.cursor = CURSORS[kind] || CURSORS.arrow; }
setCursor('arrow');

// X roja donde se hizo clic (estilo RuneScape): aparece, late y se desvanece.
const marker = new THREE.Group();
{
  const m = new THREE.MeshBasicMaterial({ color: 0xd8342a, depthTest: false, transparent: true });
  const o = new THREE.MeshBasicMaterial({ color: 0x05060b, depthTest: false, transparent: true });
  for (const a of [Math.PI / 4, -Math.PI / 4]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.02, 0.2), m); bar.rotation.y = a; bar.renderOrder = 11; marker.add(bar);
    const out = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.01, 0.34), o); out.rotation.y = a; out.renderOrder = 10; marker.add(out);
  }
  marker.visible = false; marker.userData.t = 0;
}
function showMarker(p) { marker.position.set(p.x, p.y + 0.08, p.z); marker.visible = true; marker.userData.t = 0; G.world?.add(marker); }
function updateMarker(dt) {
  if (!marker.visible) return;
  const t = (marker.userData.t += dt);
  const pop = t < 0.15 ? t / 0.15 * 1.3 : 1 + 0.12 * Math.sin(t * 10);
  marker.scale.setScalar(pop);
  const fadeOut = poroto.state !== 'walk' ? Math.max(0, 1 - (t - 0.3) * 3) : 1;
  marker.children.forEach(c => { c.material.opacity = fadeOut; });
  if (fadeOut <= 0 || t > 8) marker.visible = false;
}

// ------------------------------------------------------------------ interacción
const ray = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let lastPointer = null;
function pick(ev) {
  const r = canvas.getBoundingClientRect();
  mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  if (G.mode === 'hub') {
    // el portal cuyo centro queda más cerca del rayo (las esferas pueden solaparse en perspectiva)
    const hits = ray.intersectObjects(G.hubWorld.portals, false);
    if (hits.length) {
      const best = hits.reduce((a, h) => (ray.ray.distanceToPoint(h.object.position) < ray.ray.distanceToPoint(a.object.position) ? h : a));
      return { portal: best.object.userData.portal };
    }
    const pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const p = new THREE.Vector3();
    if (ray.ray.intersectPlane(pl, p)) return { ground: p };
    return {};
  }
  if (G.mode !== 'scene') return {};
  const proxies = G.director.agents.filter(a => a.state !== 'wait').map(a => a.proxy);
  const hb = ray.intersectObjects(proxies, false)[0];
  const he = ray.intersectObjects(G.exits.map(e => e.proxy), false)[0];
  const hg = ray.intersectObject(G.sc.ground, false)[0];
  if (hb && (!hg || hb.distance < hg.distance + 2)) return { bird: hb.object.userData.agent };
  if (he && (!hg || he.distance < hg.distance + 1)) return { exit: he.object.userData.exit };
  if (hg) return { ground: hg.point };
  return {};
}

function setHover(h, ev) {
  const tip = $('tip');
  if (G.hover && G.hover !== h?.bird) G.hover.m.setOutline(null);
  G.hover = h?.bird || null;
  poroto.binoc = G.hover ? 1 : 0;
  poroto.look = G.hover ? G.hover.pos.clone() : null;
  setCursor(h?.bird || h?.portal ? 'hand' : h?.exit ? 'trail' : 'arrow');
  if (h?.bird) {
    const a = h.bird;
    a.m.setOutline(a.color);
    tip.innerHTML = `${a.sp.comName} · <span style="color:${a.color}">${CLASS_LABEL[a.cls]}</span>`;
    tip.style.setProperty('--tip', a.color);
  } else if (h?.exit) {
    tip.innerHTML = `Sendero a <b>${SCENE_LABEL[h.exit.key]}</b>`; tip.style.setProperty('--tip', '#f4d35e');
  } else if (h?.portal) {
    tip.innerHTML = h.portal.active ? `<b>${h.portal.region.name}</b>` : `${h.portal.region.name} · próximamente`;
    tip.style.setProperty('--tip', h.portal.active ? '#f4d35e' : '#6f7697');
  } else { tip.hidden = true; return; }
  tip.hidden = false; tip.style.left = ev.clientX + 'px'; tip.style.top = ev.clientY + 'px';
}

canvas.addEventListener('pointermove', ev => {
  lastPointer = ev;
  if (G.mode === 'scene' || G.mode === 'hub') setHover(pick(ev), ev);
});
canvas.addEventListener('pointerdown', ev => {
  if (ev.button !== 0 || (G.mode !== 'scene' && G.mode !== 'hub')) return;
  if (G.dialogOpen) closeDialog();
  const h = pick(ev);
  if (h.portal) { portalClicked(h.portal); return; }
  if (h.bird) { birdClicked(h.bird); return; }
  if (h.exit) {
    const s = h.exit.sign.position;
    poroto.walkTo(new THREE.Vector3(s.x * 0.93, 0, s.z * 0.93), () => travel(h.exit.key));
    return;
  }
  if (h.ground) {
    if (G.mode === 'hub') {
      const { p, d } = G.hubWorld.snap(h.ground.x, h.ground.z);
      if (d < 4) { poroto.walkTo(p); showMarker(p); }
    } else {
      const lim = G.sc.half - 2;
      const x = Math.max(-lim, Math.min(lim, h.ground.x)), z = Math.max(-lim, Math.min(lim, h.ground.z));
      poroto.walkTo(new THREE.Vector3(x, 0, z));
      showMarker(new THREE.Vector3(x, G.sc.heightAt(x, z), z));
    }
    blip(990, 0.03);
  }
});
// Cámara: las teclas, el arrastre con botón derecho y la rueda mueven una meta; la cámara la sigue
// con suavizado exponencial (sin saltos).
const keys = new Set();
let rdrag = null;
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  G.cam.distGoal = Math.min(24, Math.max(6, (G.cam.distGoal ?? G.cam.dist) * (1 + Math.sign(e.deltaY) * 0.12)));
}, { passive: false });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => { if (e.button === 2) { rdrag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); } });
canvas.addEventListener('pointermove', e => {
  if (!rdrag) return;
  G.cam.yawGoal = (G.cam.yawGoal ?? G.cam.yaw) + (e.clientX - rdrag.x) * 0.006;
  G.cam.pitchGoal = Math.min(1.25, Math.max(0.2, (G.cam.pitchGoal ?? G.cam.pitch) + (e.clientY - rdrag.y) * 0.004));
  rdrag = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerup', e => { if (e.button === 2) rdrag = null; });
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());
function steerCamera(dt) {
  const c = G.cam;
  c.yawGoal ??= c.yaw; c.pitchGoal ??= c.pitch; c.distGoal ??= c.dist;
  const turn = (keys.has('e') || keys.has('arrowright') ? 1 : 0) - (keys.has('q') || keys.has('arrowleft') ? 1 : 0);
  const tilt = (keys.has('arrowup') ? 1 : 0) - (keys.has('arrowdown') ? 1 : 0);
  c.yawVel = (c.yawVel ?? 0) + (turn * 1.6 - (c.yawVel ?? 0)) * Math.min(1, dt * 5); // acelera y frena suave
  c.yawGoal += c.yawVel * dt;
  c.pitchGoal = Math.min(1.25, Math.max(0.2, c.pitchGoal + tilt * 0.8 * dt));
  const k = 1 - Math.exp(-dt * 8);
  c.yaw += (c.yawGoal - c.yaw) * k;
  c.pitch += (c.pitchGoal - c.pitch) * k;
  c.dist += (c.distGoal - c.dist) * k;
}
window.addEventListener('keydown', e => {
  if (G.mode === 'start' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); start(); return; }
  if (e.key === 'Escape') { closeDialog(); $('panel').hidden = true; if (!$('travel').hidden) closeTravelMap(); }
  if ((e.key === 'm' || e.key === 'M') && $('travel').hidden) openTravelMap();
  if ((e.key === 'n' || e.key === 'N') && G.mode === 'scene') toggleNames();
  if (['q', 'e', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(e.key.toLowerCase())) {
    if (e.key.startsWith('Arrow')) e.preventDefault();
    keys.add(e.key.toLowerCase());
  }
});

function birdClicked(a) {
  blip(880);
  poroto.look = a.pos.clone(); poroto.binoc = 1;
  const isNew = !G.book.has(a.sp.id);
  openDialog(birdDialog(G.index, a.sp, G.reg.meta.id), [
    { label: '♪ Escuchar', keep: true, fn: async () => { const d = await G.director.singNow(a, true); portrait.sing(d || 2); } },
    { label: 'Cerrar' },
  ], { bird: a });
  if (isNew) {
    G.book.add(a.sp.id); saveBook();
    poroto.write();
    const n = featuredList().filter(sci => G.book.has(G.index.bySci.get(sci)?.id)).length;
    toast(`¡Nueva especie en la libreta! <b>${a.sp.comName}</b> (${n}/${featuredList().length} en ${G.reg.meta.name})`, 3.5);
    updateHud();
  }
}

// ------------------------------------------------------------------ paneles
$('b-pause').onclick = () => { G.paused = !G.paused; updateHud(); blip(); };
$('b-next').onclick = () => { setMonth(G.month + 1); blip(); };
function toggleNames() { showNames = !showNames; $('b-names').classList.toggle('off', !showNames); }
$('b-names').onclick = toggleNames;
$('b-sound').onclick = () => { G.muted = !G.muted; setMuted(G.muted); $('b-sound').classList.toggle('off', G.muted); };
$('b-map').onclick = () => openTravelMap();
$('b-book').onclick = () => {
  const cards = featuredList().map(sci => {
    const sp = G.index.bySci.get(sci);
    const seen = G.book.has(sp.id);
    const pal = sp.palette || {};
    const sw = ['back', 'belly', 'head', 'throat', 'wing', 'accent'].filter(z => pal[z]).map(z => `<i style="background:rgb(${pal[z].join(',')})" title="${z}"></i>`).join('');
    return seen
      ? `<div class="card"><b>${sp.comName}</b><div class="dim"><i>${sp.sciName}</i></div><div class="dim">${SCENE_LABEL[G.feat[sci]] || ''} · ${Math.round(sp.morphology?.mass || 0)} g</div><div class="sw">${sw}</div></div>`
      : `<div class="card unk">???<div class="dim">${SCENE_LABEL[G.feat[sci]] || ''}</div></div>`;
  }).join('');
  openPanel(`<h2>LIBRETA DE CAMPO · ${G.reg.meta.name}</h2><p class="dim">Haz clic en un ave para anotarla. Colores sacados de fotos de referencia.</p><div class="book">${cards}</div>`);
};
$('b-credits').onclick = () => {
  const clips = featuredList().map(s => G.index.bySci.get(s)).filter(s => s?.clip)
    .map(s => `<li>${s.comName}: <a href="${s.clip.url}" target="_blank" rel="noopener">${s.clip.recordist}</a> · ${s.clip.license}</li>`).join('');
  openPanel(`<h2>CRÉDITOS</h2>
  <p><b>Datos de aves:</b> GBIF.org (2026), descargas de ocurrencias de Aves en Chile (principalmente eBird), años 2017–2024; métricas corregidas por esfuerzo de muestreo. Proyecto <i>Nómadas & sedentarios</i> (Visualización de Información 2026-2).</p>
  <p><b>Cantos:</b> Xeno-canto (licencias Creative Commons por grabación):</p><ul>${clips}</ul>
  <p>Las especies sin grabación en el set (como la Turca) tienen un canto sintético.</p>
  <p><b>Morfología y hábitat:</b> AVONET (Tobias et al. 2022, CC BY 4.0) y EltonTraits 1.0 (Wilman et al. 2014, CC0). <b>Paletas:</b> derivadas de fotos de referencia de iNaturalist (CC0 / CC BY / CC BY-SA; autores en los datos), con zonas anotadas a mano o con un modelo de visión (Qwen3-VL) y revisadas por una persona. <b>Terreno:</b> AWS Terrain Tiles, ESA WorldCover 2021 (CC BY 4.0) y © OpenStreetMap (ODbL).</p>
  <p class="dim">Clic para caminar · clic en un ave para conocerla · rueda: zoom · Q/E o ←/→: girar la cámara · N: nombres de las aves.</p>`);
};

// ------------------------------------------------------------------ mapa de viaje
// Poroto saca el mapa de la mochila; al elegir una región lo deja en el suelo, salta dentro y
// aparece cayendo en la región elegida.
function renderTravelMap() {
  const M = G.chileMap;
  const svg = $('chile');
  if (!M) { svg.innerHTML = ''; return; }
  const [x0, y0, w, h] = M.viewBox;
  const top = y0 - 16, H = h + 32;
  svg.setAttribute('viewBox', `${x0 - 4} ${top} ${w + 8} ${H}`);
  const here = G.mode === 'scene' ? G.reg?.meta.code : null;
  let out = `<text class="off" x="${x0 + w * 0.5}" y="${y0 + h - 2}" text-anchor="middle" font-style="italic">Océano Pacífico</text>`;
  M.regions.forEach(r => {
    const cls = `reg${r.active ? ' on' : ''}${r.code === here ? ' here' : ''}`;
    out += `<path class="${cls}" d="${r.d}" data-code="${r.code}" ${r.active ? 'tabindex="0" role="button"' : ''}><title>${r.name}${r.active ? '' : ' · próximamente'}</title></path>`;
  });
  // Nombres alternados arriba (cordillera) y abajo (mar); en cada fila se separan para no montarse,
  // con una línea guía hasta su región.
  const rows = [[], []];
  M.regions.forEach((r, i) => { if (r.label) rows[i % 2].push({ r, w: r.name.length * 2.75 + 2, x: r.label[0] }); });
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    for (let i = 0; i < row.length; i++) {
      row[i].x = Math.max(row[i].x, x0 + row[i].w / 2);
      if (i) row[i].x = Math.max(row[i].x, row[i - 1].x + (row[i - 1].w + row[i].w) / 2);
    }
    for (let i = row.length - 1; i >= 0; i--) { // si se salió por la derecha, devolver hacia la izquierda
      const lim = i === row.length - 1 ? x0 + w - row[i].w / 2 : row[i + 1].x - (row[i + 1].w + row[i].w) / 2;
      row[i].x = Math.min(row[i].x, lim);
    }
  }
  rows.forEach((row, up) => row.forEach(({ r, x }) => {
    const [lx, ly] = r.label, ty = up === 0 ? top + 6 : top + H - 3;
    out += `<line x1="${lx}" y1="${ly}" x2="${x}" y2="${up === 0 ? ty + 1.5 : ty - 5}"/>`;
    out += `<text class="${r.active ? 'on' : 'off'}" x="${x}" y="${ty}" text-anchor="middle">${r.name}</text>`;
  }));
  const cur = M.regions.find(r => r.code === here);
  if (cur?.label) out += `<circle class="poroto" cx="${cur.label[0]}" cy="${cur.label[1]}" r="2.6"><title>Aquí está Poroto</title></circle>`;
  svg.innerHTML = out;
  svg.querySelectorAll('.reg').forEach(p => {
    const go = () => chooseRegion(p.dataset.code);
    p.addEventListener('click', go);
    p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
  // zonas de la región actual (moverse dentro de la región sin viajar)
  const z = $('travel-zones');
  if (here && G.reg) {
    const sc = G.reg.terrain.scenes;
    z.innerHTML = `<b>${G.reg.meta.name}:</b> ` + sceneOrder().map(k => `<button class="btn" data-k="${k}" ${k === G.sceneKey ? 'disabled' : ''}>${SCENE_LABEL[k]}</button>`).join('');
    z.querySelectorAll('[data-k]').forEach(b => { b.onclick = () => { closeTravelMap(); travel(b.dataset.k); }; });
  } else z.innerHTML = '';
}

function openTravelMap() {
  if ((G.mode !== 'scene' && G.mode !== 'hub') || poroto.travel || !$('travel').hidden) return;
  closeDialog(); $('panel').hidden = true;
  poroto.holdMap(true);
  say('¿A dónde vamos?', 1.5);
  blip(520, 0.06);
  setTimeout(() => { if (!poroto.mapHeld) return; renderTravelMap(); $('travel').hidden = false; $('chile').querySelector('.reg.on')?.focus(); }, 450);
}
function closeTravelMap() { $('travel').hidden = true; poroto.holdMap(false); }
$('travel-close').onclick = closeTravelMap;
$('travel').addEventListener('click', e => { if (e.target.id === 'travel') closeTravelMap(); });

function chooseRegion(code) {
  const r = G.chileMap.regions.find(x => x.code === code);
  if (!r?.active) { toast(`${r?.name || code}: próximamente`, 2); blip(220, 0.1); return; }
  $('travel').hidden = true;
  poroto.holdMap(false);
  blip(660, 0.08);
  const heightAt = G.mode === 'scene' ? G.sc.heightAt : G.hubWorld.heightAt;
  poroto.startTravel(heightAt, async () => {
    blip(990, 0.12);
    if (G.mode === 'scene' && G.reg?.meta.code === code) { poroto.drop = 14; poroto.root.visible = true; return; }
    await enterRegion(code, { drop: true });
  });
}

// ------------------------------------------------------------------ inicio
async function start() {
  if (G.mode !== 'start' || !G.index) return;
  unlockAudio(); blip(660, 0.08); setTimeout(() => blip(990, 0.1), 90);
  $('start').hidden = true;
  await fade(true, '');
  await enterHub();
}
$('start').addEventListener('click', start);

// ------------------------------------------------------------------ bucle
let last = performance.now();
const fwd = new THREE.Vector3();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (G.mode === 'hub' || G.mode === 'scene') {
    const heightAt = G.mode === 'scene' ? G.sc.heightAt : G.hubWorld.heightAt;
    // caída desde el vacío al entrar al menú
    // no atravesar edificios ni meterse al mar (terreno bajo el nivel del agua)
    const blocked = G.mode === 'scene' ? (x, z) => G.sc.obstacles.some(o => Math.hypot(o.x - x, o.z - z) < o.r)
      || (G.sc.seaY != null && G.sc.heightAt(x, z) < G.sc.seaY - 0.02) : null;
    const st = poroto.update(dt, heightAt, blocked);
    if (poroto.drop > 0) {
      poroto.drop = Math.max(0, poroto.drop - dt * 18);
      poroto.root.position.y += poroto.drop;
      if (poroto.drop === 0) { blip(160, 0.12); say(poroto.dropMsg || '¡Hola! Soy Poroto.'); poroto.dropMsg = null; }
    }
    if (st.sleep && bubble.hidden) say('Zzz…', 2);
    if (G.mode === 'scene') {
      G.director.update(dt, G.paused);
      G.sc.animate?.(now / 1000);
      updateLive(dt);
      if (!G.paused && !G.dialogOpen) {
        G.monthT += dt;
        if (G.monthT >= MONTH_SECONDS) setMonth(G.month + 1);
      }
      G.quirkT -= dt;
      if (G.quirkT <= 0) { G.quirkT = 18 + Math.random() * 15; const q = poroto.seasonQuirk(); if (q) say(q, 2.2); }
      if (G.hover && !G.hover.m.group.parent) setHover(null, lastPointer);
    }
    // cámara semifija que sigue a Poroto
    steerCamera(dt);
    updateMarker(dt);
    const c = G.cam;
    const goal = new THREE.Vector3(poroto.pos.x, poroto.root.position.y + 0.8, poroto.pos.z);
    c.target.lerp(goal, 1 - Math.exp(-dt * 3));
    const cp = Math.cos(c.pitch);
    camera.position.set(c.target.x + cp * Math.cos(c.yaw) * c.dist, c.target.y + Math.sin(c.pitch) * c.dist, c.target.z - cp * Math.sin(c.yaw) * c.dist);
    if (G.mode === 'scene') camera.position.y = Math.max(camera.position.y, G.sc.heightAt(camera.position.x, camera.position.z) + 1.5);
    camera.lookAt(c.target);
    camera.updateMatrixWorld();
    shared.uLightDir.value.set(0.45, 1, 0.35).normalize().transformDirection(camera.matrixWorldInverse);
    shared.uCutNear.value = G.mode === 'scene' ? c.dist * 0.85 : 0;
    camera.getWorldDirection(fwd);
    setListener(poroto.root.position, fwd);
    // globito de Poroto
    if (!bubble.hidden) {
      bubbleT -= dt;
      const p = poroto.root.position.clone(); p.y += 2.4; p.project(camera);
      bubble.style.left = ((p.x + 1) / 2 * window.innerWidth - 20) + 'px';
      bubble.style.top = ((1 - p.y) / 2 * window.innerHeight - 30) + 'px';
      if (bubbleT <= 0) bubble.hidden = true;
    }
    if (G.world) renderer.render(G.world, camera);
    updateLabels();
    updateBirdLabels();
  }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => fitRenderer(renderer, camera));
fitRenderer(renderer, camera);
renderer.setClearColor(0x05060b);
loadWorld().then(async idx => {
  G.index = idx;
  try { G.chileMap = await loadJSON(DATA_BASE + 'chile-map.json'); } catch { G.chileMap = null; }
}).catch(err => {
  document.querySelector('#start .hint').textContent = 'No se pudieron cargar los datos: ' + err.message;
});
requestAnimationFrame(frame);

// para depurar desde la consola
window.G = G; window.camera = camera; window.poroto = poroto; window.dbg = { enterRegion, travel, setMonth };
