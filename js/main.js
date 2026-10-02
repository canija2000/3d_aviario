// Aviario de Chile: PRESS START → menú de regiones (Chile como pasillo, js/hub.js) → escena de la
// región (mini-escenas unidas por senderos) con aves reales mes a mes.
/* global THREE */
import { shared, createRenderer, fitRenderer } from './ps1.js';
import { loadWorld, loadRegion, loadJSON, DATA_BASE, CLASS_LABEL, birdDialog, welcomeText, featuredIn } from './data.js';
import { buildScene, signpost, WORLD } from './scene.js';
import { buildHub } from './hub.js';
import { loadPoroto } from './poroto.js';
import { CAMERA, PORORO_BUBBLE_Y } from './scale.js';
import { createMinimap } from './minimap.js';
import { loadKit } from './kit.js';
import { Director } from './aviary.js';
import { buildBird } from './bird.js';
import { unlockAudio, setListener, setMuted, blip, setAmbience, duckAmbience, engine, horn } from './audio.js';
import { CAR } from './car.js';
import { progress, rememberRegion, markSeen, regionStatus, TIERS, scorePhoto, starText, captureThumb, savePhoto } from './photo.js';

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
  pradera: 'Pradera', fiordo: 'Fiordo', estepa: 'Estepa', bofedal: 'Bofedal' };
const sceneOrder = () => Object.keys(G.reg.terrain.scenes);
const featuredList = () => Object.keys(G.feat || {});

const G = {
  mode: 'start', index: null, reg: null, props: null, sceneKey: null, sc: null, world: null, director: null,
  month: new Date().getMonth(), monthT: 0, paused: false, muted: false, year: null, // year: null = año típico
  hover: null, dialogOpen: false, book: loadBook(), cam: { yaw: -Math.PI / 2, pitch: CAMERA.scene.pitch, dist: CAMERA.scene.dist, target: new THREE.Vector3() },
  quirkT: 12, exits: [], portals: [],
};

function loadBook() {
  try { return new Set(JSON.parse(localStorage.getItem('aviario.libreta') || '[]')); } catch { return new Set(); }
}
function saveBook() { try { localStorage.setItem('aviario.libreta', JSON.stringify([...G.book])); } catch { /* sin almacenamiento */ } }

const [poroto] = await Promise.all([loadPoroto(), loadKit()]);
const minimap = createMinimap();
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

// ------------------------------------------------------------------ etiquetas
// Etiquetas del mundo como HTML proyectado: el 3D va a 240p, pero el texto debe leerse nítido.
const worldLabels = [];
function addLabel(html, pos, color = '#eef1f8', cls = '', maxDist = 60) {
  const el = document.createElement('div');
  el.className = 'wlabel ' + cls; el.innerHTML = html; el.style.color = color;
  document.body.appendChild(el);
  const l = { el, pos: pos.clone(), maxDist };
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
    const show = showNames && !G.photo && a.state !== 'wait' && _b.z < 1 && Math.abs(_b.x) < 1.05 && Math.abs(_b.y) < 1.05 && d < 38;
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
    const show = _v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1 && d < l.maxDist;
    l.el.hidden = !show;
    if (show) {
      l.el.style.left = ((_v.x + 1) / 2 * window.innerWidth) + 'px';
      l.el.style.top = ((1 - _v.y) / 2 * window.innerHeight) + 'px';
    }
  }
}

// ------------------------------------------------------------------ MENÚ DE REGIONES (js/hub.js)
async function enterHub(from = 'CL-RM') {
  G.mode = 'hub';
  setAmbience(null);
  clearLabels();
  const stampOf = code => { const st = regionStatus(code)?.stamp; return st ? ` <span style="color:${st.color}" title="Sello de ${st.label.toLowerCase()}">●</span>` : ''; };
  G.hubWorld = buildHub({ index: G.index, relief: G.relief, label: addLabel, poroto, stampOf });
  G.nearPortal = null;
  G.hubRegion = null;
  G.world = G.hubWorld.scene;
  applyLight('primavera', 0x070912, 26, 80);
  poroto.pos.copy(G.hubWorld.spawn(from));
  G.driving = false; poroto.seated = false;
  G.hubWorld.park(from);
  G.carHint = addLabel('<b>E</b>: manejar la Citroneta', G.hubWorld.car.group.position.clone().add(new THREE.Vector3(0, 1.8, 0)), '#f4d35e', 'hito', 7);
  poroto.root.visible = true; poroto.shadow.visible = true; // al volver de una región, sale del mapa
  poroto.drop = 14; poroto.heading = Math.PI / 2; // mirando al norte, por el pasillo
  poroto.season = 'primavera';
  G.cam.dist = CAMERA.hub.dist; G.cam.pitch = CAMERA.hub.pitch; G.cam.yaw = CAMERA.hub.yaw; G.cam.distGoal = G.cam.pitchGoal = G.cam.yawGoal = undefined;
  G.cam.target.copy(poroto.pos);
  $('hud').hidden = true;
  await fade(false);
  const open = G.index.regions.filter(r => r.terrainFile).map(r => `<b>${r.name}</b>`);
  toast(`Chile es un pasillo entre los Andes y el mar: camina con las <b>flechas</b> (espacio para correr) hasta la puerta de una región, o abre el <b>mapa</b> (M) para viajar. Están abiertas ${open.join(', ')}. La <b>Citroneta</b> te espera al lado del camino (E para subir). <b>P</b>: pasaporte.`, 9);
}

function portalClicked(p) {
  const r = p.region;
  if (!p.active) { say(`${r.name}: próximamente`); blip(220, 0.1); return; }
  poroto.look = p.anchor.clone();
  openDialog(`Puerta a la <b>${r.fullName || r.name}</b>. ¿Qué año quieres visitar? El <b>año típico</b> resume 2017–2024.`, [
    { label: 'Año típico', fn: () => enterRegion(r.code, { year: null }) },
    ...G.index.years.map(y => ({ label: String(y), fn: () => enterRegion(r.code, { year: String(y) }) })),
    { label: 'Volver' },
  ]);
}

// ------------------------------------------------------------------ REGIÓN Y ESCENAS
async function enterRegion(code, opts = {}) {
  if (opts.year !== undefined) G.year = opts.year;
  if (G.driving) leaveCar();
  $('toast').hidden = true;
  exitPhoto();
  await fade(true, 'Cargando la región…');
  G.reg = await loadRegion(G.index, code);
  if (G.year && !G.reg.region.years?.[G.year]) G.year = null;
  try { G.props = await loadJSON(DATA_BASE + `props-${code}.json`); } catch { G.props = null; }
  G.feat = featuredIn(G.index, G.reg.region);
  const featSids = Object.keys(G.reg.region.featured || {}).map(Number);
  if (!progress.seen[code]) for (const sid of featSids) if (G.book.has(sid)) markSeen(code, sid); // libreta antigua (sin región)
  rememberRegion(code, featSids);
  G.director = new Director({ index: G.index, region: G.reg.region, regionId: G.reg.meta.id, regionCode: code, root: null, onSing, year: G.year });
  G.mode = 'scene';
  await loadSceneKey(sceneOrder()[0], null, false);
  if (opts.drop) { poroto.drop = 14; poroto.dropMsg = `¡Llegamos a ${G.reg.meta.name}!`; }
  poroto.root.visible = true;
  $('hud').hidden = false;
  await fade(false);
  openDialog(welcomeText(G.index, G.reg.meta, G.month, G.year, G.reg.region), [{ label: '¡Vamos!' }]);
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
  minimap.setScene({ sc, exitList: G.exits, zones: sceneOrder(), current: key, regionName: G.reg.meta.name,
    chileMap: G.chileMap, regionCode: G.reg.meta.code, labelOf: k => SCENE_LABEL[k] });
  const back = G.exits.find(e => e.key === fromKey);
  if (back) { poroto.pos.set(back.sign.position.x * 0.6, 0, back.sign.position.z * 0.6); }
  else poroto.pos.set(0, 0, 0);
  poroto.target = null; poroto.state = 'idle'; poroto.drop = 0;
  G.cam.dist = CAMERA.scene.dist; G.cam.pitch = CAMERA.scene.pitch; G.cam.yaw = -Math.PI / 2; G.cam.distGoal = G.cam.pitchGoal = G.cam.yawGoal = undefined;
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
  const high = G.sceneKey === 'cordillera' || (G.sc?.hMin ?? 0) > 3000; // aire limpio de altura
  const fc = fogColor ?? (high ? 0x9cb4d8 : G.sc?.seaY != null ? 0xa4b8c8 : L.fog);
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
  recast();
}
// Rehace el elenco (cambio de mes o de año) y avisa quién llega.
function recast() {
  if (G.director) {
    const before = new Set(G.director.agents.map(a => a.sp.id));
    const cast = G.director.setMonth(G.month, false);
    const arriving = cast.filter(c => !before.has(c.sp.id)).map(c => c.sp.comName);
    if (arriving.length) setTimeout(() => toast(`Llegan: <b>${arriving.join(', ')}</b>`, 3.5), 2600);
  }
  updateHud();
}
function setYear(y) {
  G.year = y;
  if (G.director) G.director.year = y;
  toast(y ? `Viajamos a <b>${y}</b>: las aves y su abundancia son las registradas ese año.` : 'Volvemos al <b>año típico</b> (2017–2024).', 3.5);
  recast();
}
function chooseYear() {
  openDialog(`¿Qué año quieres ver en <b>${G.reg.meta.name}</b>? Cada año muestra las aves que más se registraron mes a mes; el año típico resume los ocho.`, [
    { label: 'Año típico', disabled: !G.year, fn: () => setYear(null) },
    ...G.index.years.map(y => ({ label: String(y), disabled: G.year === String(y), fn: () => setYear(String(y)) })),
    { label: 'Cerrar' },
  ]);
}

function updateHud() {
  if (!G.reg) return;
  const meta = G.reg.meta, ms = meta.months[G.month];
  $('hud-region').innerHTML = `<b>${meta.name}</b> · ${G.year || 'año típico'}`;
  $('b-year').textContent = G.year || 'AÑO TÍPICO';
  $('hud-scene').textContent = `${SCENE_LABEL[G.sceneKey]} — ${G.reg.terrain.scenes[G.sceneKey].name}`;
  const mn = G.index.months[G.month];
  $('hud-month').innerHTML = `<b>${mn[0].toUpperCase() + mn.slice(1)}</b> · ${SEASON_OF[G.month]}`;
  const ym = G.year && G.reg.region.years?.[G.year]?.[G.month];
  $('hud-rich').innerHTML = ym
    ? `${ym.richness} especies registradas en ${G.year}<br><span title="Año típico. La riqueza de un año depende también de cuántas personas salieron a observar.">típico: ${ms.residente} res · ${ms.visitante_estival} verano · ${ms.visitante_invernal} invierno</span>`
    : `${ms.richness} especies en la región<br>${ms.residente} res · ${ms.visitante_estival} verano · ${ms.visitante_invernal} invierno`;
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
  const st = regionStatus(meta.code);
  $('book-n').textContent = st ? `${st.nSeen}/${st.n}` : '';
  $('b-book').style.borderColor = st?.stamp?.color || '';
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
  setCursor(h?.bird ? 'hand' : 'arrow');
  if (h?.bird) {
    const a = h.bird;
    a.m.setOutline(a.color);
    tip.innerHTML = `${a.sp.comName} · <span style="color:${a.color}">${CLASS_LABEL[a.cls]}</span>`;
    tip.style.setProperty('--tip', a.color);
  } else if (h?.exit) {
    tip.innerHTML = `Sendero a <b>${SCENE_LABEL[h.exit.key]}</b> · camina hasta el letrero`; tip.style.setProperty('--tip', '#f4d35e');
  } else if (h?.portal) {
    tip.innerHTML = h.portal.active ? `<b>${h.portal.region.name}</b>` : `${h.portal.region.name} · próximamente`;
    tip.style.setProperty('--tip', h.portal.active ? '#f4d35e' : '#6f7697');
  } else { tip.hidden = true; return; }
  tip.hidden = false; tip.style.left = ev.clientX + 'px'; tip.style.top = ev.clientY + 'px';
}

canvas.addEventListener('pointermove', ev => {
  lastPointer = ev;
  if ((G.mode === 'scene' || G.mode === 'hub') && !G.photo) setHover(pick(ev), ev);
});
canvas.addEventListener('pointerdown', ev => {
  if (ev.button !== 0 || (G.mode !== 'scene' && G.mode !== 'hub') || G.photo) return;
  if (G.dialogOpen) closeDialog();
  // Poroto se mueve solo con las flechas; el clic sirve para mirar aves.
  const h = pick(ev);
  if (h.bird) { birdClicked(h.bird); return; }
  if (h.portal || h.exit) { say('Camina hasta ahí con las flechas.', 1.8); blip(330, 0.04); }
});
// Cámara: las teclas, el arrastre con botón derecho y la rueda mueven una meta; la cámara la sigue
// con suavizado exponencial (sin saltos).
const keys = new Set();
let rdrag = null;
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  if (G.photo) { G.photo.fov = Math.min(55, Math.max(8, G.photo.fov * (1 + Math.sign(e.deltaY) * 0.12))); return; }
  G.cam.distGoal = Math.min(CAMERA.maxDist, Math.max(CAMERA.minDist, (G.cam.distGoal ?? G.cam.dist) * (1 + Math.sign(e.deltaY) * 0.12)));
}, { passive: false });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => { if (e.button === 2) { rdrag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); } });
canvas.addEventListener('pointermove', e => {
  if (!rdrag) return;
  G.cam.yawGoal = (G.cam.yawGoal ?? G.cam.yaw) + (e.clientX - rdrag.x) * 0.006;
  G.cam.pitchGoal = Math.min(CAMERA.maxPitch, Math.max(CAMERA.minPitch, (G.cam.pitchGoal ?? G.cam.pitch) + (e.clientY - rdrag.y) * 0.004));
  rdrag = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerup', e => { if (e.button === 2) rdrag = null; });
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());
// Flechas: Poroto camina en relación a la cámara (arriba = alejarse de ella).
function driveFromKeys() {
  const f = (keys.has('arrowup') ? 1 : 0) - (keys.has('arrowdown') ? 1 : 0);
  const r = (keys.has('arrowright') ? 1 : 0) - (keys.has('arrowleft') ? 1 : 0);
  if (G.driving) return driveCar(f, r);
  if ((!f && !r) || poroto.travel || poroto.mapHeld || !$('travel').hidden || G.traveling || G.photo) { poroto.drive = null; return; }
  if (G.dialogOpen) closeDialog();
  const fx = -Math.cos(G.cam.yaw), fz = Math.sin(G.cam.yaw); // hacia donde mira la cámara
  (poroto.drive ||= new THREE.Vector2()).set(fx * f - fz * r, fz * f + fx * r);
  poroto.run = keys.has(' '); // espacio: correr
}
// ------------------------------------------------------------------ la Citroneta (pasillo)
// E: subir o bajar · flechas: manejar (relativas a la cámara, como caminar) · espacio: acelerar a
// fondo · H: bocina. Acelera y frena de a poco, y gira con un radio, no en el lugar.
function nearCar() {
  const c = G.hubWorld?.car.group.position;
  return c && Math.hypot(c.x - poroto.pos.x, c.z - poroto.pos.z) < 2.2;
}
function enterCar() {
  const car = G.hubWorld.car;
  G.driving = true; poroto.seated = true; car.v = 0; car.h = car.group.rotation.y;
  poroto.pos.x = car.group.position.x; poroto.pos.z = car.group.position.z; poroto.heading = car.h;
  poroto.binoc = 0; poroto.look = null;
  if (G.carHint) G.carHint.el.style.display = 'none';
  G.cam.distGoal = 12; G.cam.pitchGoal = 0.45;
  blip(330, 0.05); setTimeout(() => horn(), 250);
  say('¡Vamos en la Citroneta!', 1.8);
}
function leaveCar() {
  const car = G.hubWorld?.car;
  G.driving = false; poroto.seated = false; poroto.drive = null; poroto.speed = 2.6;
  engine(null);
  if (car) { car.v = 0; poroto.pos.x += Math.sin(car.h) * 1.1; poroto.pos.z += Math.cos(car.h) * 1.1; } // se baja por el costado
  G.cam.distGoal = CAMERA.hub.dist; G.cam.pitchGoal = CAMERA.hub.pitch;
  if (G.carHint && G.mode === 'hub') { G.carHint.el.style.display = ''; }
}
function driveCar(f, r) {
  const car = G.hubWorld.car, dt = G.dt || 1 / 60;
  const blockedUI = !$('travel').hidden || poroto.travel || G.dialogOpen;
  let want = null;
  if ((f || r) && !blockedUI) {
    const fx = -Math.cos(G.cam.yaw), fz = Math.sin(G.cam.yaw);
    want = Math.atan2(-(fz * f + fx * r), fx * f - fz * r);
  }
  const vmax = CAR.maxSpeed * (keys.has(' ') ? CAR.turbo : 1);
  if (want != null) {
    const d = ((want - car.h + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    const turn = 2.6 * Math.min(1, 0.25 + car.v / 4); // a baja velocidad gira menos (no gira en el lugar)
    car.h += Math.max(-turn * dt, Math.min(turn * dt, d));
    const along = Math.cos(d); // si la meta queda atrás, primero frena
    car.accel = along > 0 ? 1 : -1;
    car.v = along > 0 ? Math.min(vmax, car.v + CAR.accel * dt * along) : Math.max(0, car.v - CAR.brake * dt);
  } else {
    car.accel = 0;
    car.v = Math.max(0, car.v - (CAR.brake * 0.35) * dt); // suelta el acelerador: rueda y se detiene
  }
  poroto.run = false;
  poroto.speed = car.v;
  poroto.drive = car.v > 0.05 ? new THREE.Vector2(Math.cos(car.h), -Math.sin(car.h)) : null;
  engine(Math.min(1, car.v / (CAR.maxSpeed * CAR.turbo)));
}

// Después de mover: no salirse del camino ni de la escena, y entrar a portales y senderos caminando.
function afterDrive() {
  if (!poroto.drive) return;
  if (G.mode === 'hub') {
    const { p, d } = G.hubWorld.snap(poroto.pos.x, poroto.pos.z);
    const MAXD = 0.85; // media anchura caminable del pasillo
    if (d > MAXD) { poroto.pos.x = p.x + (poroto.pos.x - p.x) * MAXD / d; poroto.pos.z = p.z + (poroto.pos.z - p.z) * MAXD / d; }
    const near = G.hubWorld.portals.find(pr => {
      const s = pr.userData.portal.stop;
      return Math.hypot(s.x - poroto.pos.x, s.z - poroto.pos.z) < 1.2;
    });
    if (near && G.driving && G.hubWorld.car.v > 3) { /* a toda velocidad se pasa de largo */ }
    else if (near && near !== G.nearPortal) {
      if (G.driving) G.hubWorld.car.v = 0;
      if (near.userData.portal.active) { keys.clear(); poroto.drive = null; } // se detiene solo en portales activos
      portalClicked(near.userData.portal);
    }
    G.nearPortal = near || null;
  } else if (G.mode === 'scene') {
    const lim = G.sc.half - 2;
    poroto.pos.x = Math.max(-lim, Math.min(lim, poroto.pos.x)); poroto.pos.z = Math.max(-lim, Math.min(lim, poroto.pos.z));
    const ex = G.exits.find(e => Math.hypot(e.sign.position.x * 0.93 - poroto.pos.x, e.sign.position.z * 0.93 - poroto.pos.z) < 1.6);
    if (ex && !G.traveling) {
      G.traveling = true; keys.clear(); poroto.drive = null;
      travel(ex.key).finally(() => { G.traveling = false; });
    }
  }
}
function steerCamera(dt) {
  const c = G.cam;
  c.yawGoal ??= c.yaw; c.pitchGoal ??= c.pitch; c.distGoal ??= c.dist;
  // A/D (o Q/E) giran la cámara alrededor de Poroto; W/S la acercan y alejan
  const turn = (keys.has('d') || keys.has('e') ? 1 : 0) - (keys.has('a') || keys.has('q') ? 1 : 0);
  const zoom = (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0);
  c.yawVel = (c.yawVel ?? 0) + (turn * 1.6 - (c.yawVel ?? 0)) * Math.min(1, dt * 5); // acelera y frena suave
  c.yawGoal += c.yawVel * dt;
  c.distGoal = Math.min(CAMERA.maxDist, Math.max(CAMERA.minDist, c.distGoal * (1 + zoom * 1.2 * dt)));
  // al caminar hacia adelante con las flechas, la cámara se acomoda sola detrás de Poroto (como en OoT)
  const fwdKey = (keys.has('arrowup') ? 1 : 0) - (keys.has('arrowdown') ? 0.4 : 0);
  if (!turn && fwdKey > 0 && poroto.drive) {
    const behind = poroto.heading + Math.PI;
    const d = ((behind - c.yawGoal + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    c.yawGoal += Math.max(-1, Math.min(1, d)) * CAMERA.follow * dt;
  }
  const k = 1 - Math.exp(-dt * 8);
  c.yaw += (c.yawGoal - c.yaw) * k;
  c.pitch += (c.pitchGoal - c.pitch) * k;
  c.dist += (c.distGoal - c.dist) * k;
}
window.addEventListener('keydown', e => {
  if (G.mode === 'start' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); start(); return; }
  if (G.photo) {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) shoot(); return; }
    if (e.key === 'Escape' || e.key === 'f' || e.key === 'F') { exitPhoto(); return; }
  } else if ((e.key === 'f' || e.key === 'F') && G.mode === 'scene' && $('travel').hidden) { enterPhoto(); return; }
  if ((e.key === 'p' || e.key === 'P') && (G.mode === 'scene' || G.mode === 'hub') && !G.photo) { openPassport(); return; }
  if ((e.key === 'e' || e.key === 'E') && G.mode === 'hub' && !poroto.travel && $('travel').hidden) {
    if (G.driving) { if (G.hubWorld.car.v < 1.5) leaveCar(); else say('¡Primero frena!', 1.2); } else if (nearCar()) enterCar();
    return;
  }
  if ((e.key === 'h' || e.key === 'H') && G.driving) { horn(); return; }
  if (e.key === 'Escape') { closeDialog(); $('panel').hidden = true; if (!$('travel').hidden) closeTravelMap(); }
  if ((e.key === 'm' || e.key === 'M') && $('travel').hidden && !G.photo) openTravelMap();
  if ((e.key === 'n' || e.key === 'N') && G.mode === 'scene') toggleNames();
  if (['q', 'e', 'w', 'a', 's', 'd', ' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(e.key.toLowerCase())) {
    if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault();
    keys.add(e.key.toLowerCase());
  }
});

function birdClicked(a) {
  blip(880);
  poroto.look = a.pos.clone(); poroto.binoc = 1;
  openDialog(birdDialog(G.index, a.sp, G.reg.meta.id, G.year), [
    { label: '♪ Escuchar', keep: true, fn: async () => { const d = await G.director.singNow(a, true); portrait.sing(d || 2); } },
    { label: 'Cerrar' },
  ], { bird: a });
  if (noteSighting(a.sp)) {
    poroto.write();
    const st = regionStatus(G.reg.meta.code);
    toast(`¡Nueva especie en la libreta! <b>${a.sp.comName}</b> (${st.nSeen}/${st.n} en ${G.reg.meta.name})`, 3.5);
  }
}

// Anota un ave vista en esta región (libreta y pasaporte). Devuelve true si es nueva aquí.
function noteSighting(sp) {
  const code = G.reg.meta.code, before = regionStatus(code)?.tier ?? -1;
  const isNew = markSeen(code, sp.id);
  if (!G.book.has(sp.id)) { G.book.add(sp.id); saveBook(); }
  checkStamp(before);
  updateHud();
  return isNew;
}
function checkStamp(before) {
  const st = regionStatus(G.reg.meta.code);
  if (!st || st.tier <= before) return;
  const el = $('stamp');
  el.innerHTML = `<div class="seal" style="--seal:${st.stamp.color}"><small>SELLO DE</small>${st.stamp.label.toUpperCase()}<small>${G.reg.meta.name}</small></div>`;
  el.hidden = false; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  blip(523, 0.1); setTimeout(() => blip(659, 0.1), 120); setTimeout(() => blip(784, 0.18), 240);
  clearTimeout(checkStamp.h); checkStamp.h = setTimeout(() => { el.hidden = true; }, 3200);
}

// ------------------------------------------------------------------ modo foto
// F: Poroto mira por la cámara (primera persona). Flechas o arrastrar: apuntar · rueda: zoom ·
// clic, espacio o Enter: foto · F o Esc: salir. El puntaje sale de js/photo.js.
function enterPhoto() {
  if (G.mode !== 'scene' || G.photo) return;
  closeDialog(); $('panel').hidden = true; setHover(null);
  keys.clear(); poroto.drive = null;
  const P = G.photo = { yaw: G.cam.yaw, pitch: 0.08, fov: 38, drag: null, shot: false, infoT: 0 };
  poroto.root.visible = false; poroto.shadow.visible = false;
  $('viewfinder').hidden = false; $('hud').hidden = true; $('minimap').hidden = true;
  blip(740, 0.05);
  if (!progress.album || !Object.keys(progress.album).length) toast('Encuadra un ave y dispara con <b>clic</b> o <b>espacio</b>. Más cerca, más centrada, cantando o volando: más estrellas.', 5);
  return P;
}
function exitPhoto() {
  if (!G.photo) return;
  G.photo = null;
  poroto.root.visible = true; poroto.shadow.visible = true;
  camera.fov = 50; camera.updateProjectionMatrix();
  $('viewfinder').hidden = true;
  if (G.mode === 'scene') { $('hud').hidden = false; $('minimap').hidden = false; }
}
function shoot() { if (G.photo) G.photo.shot = true; } // se captura en el cuadro, justo después de dibujar
function aimPhotoCamera(dt) {
  const P = G.photo;
  const turn = (keys.has('arrowleft') ? 1 : 0) - (keys.has('arrowright') ? 1 : 0);
  const tilt = (keys.has('arrowup') ? 1 : 0) - (keys.has('arrowdown') ? 1 : 0);
  const rate = 1.3 * camera.fov / 50;
  P.yaw += turn * rate * dt;
  P.pitch = Math.max(-0.7, Math.min(1.0, P.pitch + tilt * rate * 0.7 * dt));
  const eye = poroto.root.position.clone(); eye.y += 0.85;
  camera.position.copy(eye);
  const cp = Math.cos(P.pitch);
  camera.lookAt(eye.x - Math.cos(P.yaw) * cp, eye.y + Math.sin(P.pitch), eye.z + Math.sin(P.yaw) * cp);
  if (Math.abs(camera.fov - P.fov) > 0.05) { camera.fov += (P.fov - camera.fov) * Math.min(1, dt * 10); camera.updateProjectionMatrix(); }
  if ((P.infoT -= dt) <= 0) { // visor: el ave que saldría mejor en la foto
    P.infoT = 0.25;
    camera.updateMatrixWorld();
    const b = scorePhoto(G.director.agents, camera, G.sc.ground);
    $('vf-target').innerHTML = b ? `<span style="color:${b.agent.color}">${b.agent.sp.comName}</span> <span class="stars">${starText(b.stars)}</span>${b.tags.length ? ' · ' + b.tags.join(', ') : ''}` : 'Busca un ave en el visor';
    $('vf-zoom').textContent = `${(50 / camera.fov).toFixed(1)}×`;
  }
}
function takePhoto() {
  const best = scorePhoto(G.director.agents, camera, G.sc.ground);
  const fl = $('flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
  blip(1200, 0.03); setTimeout(() => blip(700, 0.04), 60);
  if (!best) { toast('No salió ningún ave en la foto.', 2); return; }
  const a = best.agent, code = G.reg.meta.code;
  const before = regionStatus(code)?.tier ?? -1;
  const img = captureThumb(canvas);
  const res = savePhoto(a.sp.id, { img, score: best.score, stars: best.stars, region: code, month: G.month, year: G.year, tags: best.tags });
  const isNew = markSeen(code, a.sp.id);
  if (!G.book.has(a.sp.id)) { G.book.add(a.sp.id); saveBook(); }
  checkStamp(before);
  updateHud();
  const old = res === 'peor' ? progress.album[a.sp.id] : null;
  const msg = res === 'nueva' ? '¡Primera foto de esta especie!' : res === 'mejor' ? '¡Tu mejor foto de esta especie!' : `Ya tenías una mejor (${starText(old.stars)}).`;
  toast(`<div class="shot"><img src="${img}" alt=""><div><b>${a.sp.comName}</b> <span class="stars">${starText(best.stars)}</span> ${best.score} pts${best.tags.length ? '<br><span class="dim">' + best.tags.join(', ') + '</span>' : ''}<br>${msg}${isNew ? ' · nueva en la libreta' : ''}</div></div>`, 3.5);
}
// arrastrar con el botón izquierdo apunta; un clic sin arrastrar dispara
canvas.addEventListener('pointerdown', e => {
  if (!G.photo || e.button !== 0) return;
  G.photo.drag = { x: e.clientX, y: e.clientY, moved: 0 }; canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  const d = G.photo?.drag; if (!d) return;
  const k = 0.004 * camera.fov / 50;
  G.photo.yaw -= (e.clientX - d.x) * k;
  G.photo.pitch = Math.max(-0.7, Math.min(1.0, G.photo.pitch - (e.clientY - d.y) * k));
  d.moved += Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y); d.x = e.clientX; d.y = e.clientY;
});
canvas.addEventListener('pointerup', e => {
  const d = G.photo?.drag; if (!d || e.button !== 0) return;
  G.photo.drag = null;
  if (d.moved < 5) shoot();
});

// ------------------------------------------------------------------ paneles
$('b-pause').onclick = () => { G.paused = !G.paused; updateHud(); blip(); };
$('b-next').onclick = () => { setMonth(G.month + 1); blip(); };
$('b-year').onclick = () => { blip(); chooseYear(); };
function toggleNames() { showNames = !showNames; $('b-names').classList.toggle('off', !showNames); }
$('b-names').onclick = toggleNames;
$('b-sound').onclick = () => { G.muted = !G.muted; setMuted(G.muted); $('b-sound').classList.toggle('off', G.muted); };
$('b-map').onclick = () => openTravelMap();
$('b-book').onclick = () => {
  const code = G.reg.meta.code, seenHere = new Set(progress.seen[code] || []), st = regionStatus(code);
  const cards = featuredList().map(sci => {
    const sp = G.index.bySci.get(sci);
    const seen = seenHere.has(sp.id), ph = progress.album[sp.id];
    const pal = sp.palette || {};
    const sw = ['back', 'belly', 'head', 'throat', 'wing', 'accent'].filter(z => pal[z]).map(z => `<i style="background:rgb(${pal[z].join(',')})" title="${z}"></i>`).join('');
    return seen
      ? `<div class="card">${ph ? `<img class="ph" src="${ph.img}" alt="Foto de ${sp.comName}"><div class="stars">${starText(ph.stars)}</div>` : '<div class="ph none">sin foto</div>'}<b>${sp.comName}</b><div class="dim"><i>${sp.sciName}</i></div><div class="dim">${SCENE_LABEL[G.feat[sci]] || ''} · ${Math.round(sp.morphology?.mass || 0)} g</div><div class="sw">${sw}</div></div>`
      : `<div class="card unk">???<div class="dim">${SCENE_LABEL[G.feat[sci]] || ''}</div></div>`;
  }).join('');
  const next = TIERS[(st?.tier ?? -1) + 1];
  openPanel(`<h2>LIBRETA DE CAMPO · ${G.reg.meta.name}</h2><p class="dim">Vistas ${st.nSeen}/${st.n} · fotos ★★ ${st.nPhoto}/${st.n}${st.stamp ? ` · sello de <b style="color:${st.stamp.color}">${st.stamp.label.toLowerCase()}</b>` : ''}${next ? ` · próximo sello (${next.label.toLowerCase()}): ${next.need}` : ''}.<br>Haz clic en un ave para anotarla o fotografíala con <b>F</b>.</p><div class="book">${cards}</div>`);
};
$('b-photo').onclick = () => { blip(); G.photo ? exitPhoto() : enterPhoto(); };
$('b-pass').onclick = () => { blip(); openPassport(); };

// Pasaporte: un sello por región (bronce, plata, oro), de norte a sur.
function openPassport() {
  closeDialog();
  const cards = G.index.regions.map(r => {
    const st = regionStatus(r.code), open = !!r.terrainFile;
    const seal = st?.stamp ? `<div class="mini-seal" style="--seal:${st.stamp.color}">${st.stamp.label.toUpperCase()}</div>` : `<div class="mini-seal empty">${open ? (st ? 'SIN SELLO' : 'SIN VISITAR') : 'CERRADA'}</div>`;
    const info = st ? `vistas ${st.nSeen}/${st.n} · fotos ${st.nPhoto}/${st.n}` : open ? 'entra por su puerta en el pasillo' : 'próximamente';
    return `<div class="pass ${open ? '' : 'off'}">${seal}<b>${r.name}</b><div class="dim">${info}</div></div>`;
  }).join('');
  const nPhotos = Object.keys(progress.album).length;
  openPanel(`<h2>PASAPORTE</h2><p class="dim">${TIERS.map(t => `<b style="color:${t.color}">${t.label}</b>: ${t.need}`).join(' · ')}.<br>Álbum: ${nPhotos} especie${nPhotos === 1 ? '' : 's'} fotografiada${nPhotos === 1 ? '' : 's'}.</p><div class="passport">${cards}</div>`);
};
$('b-credits').onclick = () => {
  const clips = featuredList().map(s => G.index.bySci.get(s)).filter(s => s?.clip)
    .map(s => `<li>${s.comName}: <a href="${s.clip.url}" target="_blank" rel="noopener">${s.clip.recordist}</a> · ${s.clip.license}</li>`).join('');
  openPanel(`<h2>CRÉDITOS</h2>
  <p><b>Datos de aves:</b> GBIF.org (2026), descargas de ocurrencias de Aves en Chile (principalmente eBird), años 2017–2024; métricas corregidas por esfuerzo de muestreo. Proyecto <i>Nómadas & sedentarios</i> (Visualización de Información 2026-2).</p>
  <p><b>Cantos:</b> Xeno-canto (licencias Creative Commons por grabación):</p><ul>${clips}</ul>
  <p>Las especies sin grabación en el set (como la Turca) tienen un canto sintético.</p>
  <p><b>Morfología y hábitat:</b> AVONET (Tobias et al. 2022, CC BY 4.0) y EltonTraits 1.0 (Wilman et al. 2014, CC0). <b>Paletas:</b> derivadas de fotos de referencia de iNaturalist (CC0 / CC BY / CC BY-SA; autores en los datos), con zonas anotadas a mano o con un modelo de visión (Qwen3-VL) y revisadas por una persona. <b>Terreno:</b> AWS Terrain Tiles (SRTM, GMTED2010, ETOPO1 y batimetría GEBCO; también el relieve del pasillo de Chile), ESA WorldCover 2021 (CC BY 4.0) y © OpenStreetMap (ODbL).</p>
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
    z.innerHTML = `<b>${G.reg.meta.name}:</b> ` + sceneOrder().map(k => `<button class="btn" data-k="${k}" ${k === G.sceneKey ? 'disabled' : ''}>${SCENE_LABEL[k]}</button>`).join('')
      + ` <button class="btn" id="to-hub" title="Volver al pasillo de Chile">↩ Pasillo</button>`;
    z.querySelectorAll('[data-k]').forEach(b => { b.onclick = () => { closeTravelMap(); travel(b.dataset.k); }; });
    $('to-hub').onclick = () => {
      const from = G.reg.meta.code;
      $('travel').hidden = true; poroto.holdMap(false); blip(660, 0.08);
      poroto.startTravel(G.sc.heightAt, async () => { await fade(true, 'Volviendo al pasillo…'); await enterHub(from); });
    };
  } else z.innerHTML = '';
}

function openTravelMap() {
  if ((G.mode !== 'scene' && G.mode !== 'hub') || poroto.travel || !$('travel').hidden) return;
  if (G.driving) leaveCar();
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
  if (G.mode !== 'start' || !G.index || !G.relief) return;
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
  const dt = Math.min(0.1, (now - last) / 1000); last = now; G.dt = dt;
  if (G.mode === 'hub' || G.mode === 'scene') {
    const heightAt = G.mode === 'scene' ? G.sc.heightAt : G.hubWorld.heightAt;
    // caída desde el vacío al entrar al menú
    // no atravesar edificios ni meterse al mar (terreno bajo el nivel del agua)
    const blocked = G.mode === 'scene' ? (x, z) => G.sc.obstacles.some(o => Math.hypot(o.x - x, o.z - z) < o.r)
      || (G.sc.seaY != null && G.sc.heightAt(x, z) < G.sc.seaY - 0.02) : null;
    driveFromKeys();
    const st = poroto.update(dt, heightAt, blocked);
    afterDrive();
    if (G.mode === 'hub') {
      const car = G.hubWorld.car;
      if (G.driving) {
        poroto.heading = car.h;
        car.group.position.set(poroto.pos.x, G.hubWorld.heightAt(poroto.pos.x, poroto.pos.z) - 0.05, poroto.pos.z);
        car.group.rotation.y = car.h;
        poroto.root.position.y += CAR.seatY; poroto.root.rotation.y = car.h; poroto.shadow.visible = false;
      }
      car.animate(dt, G.driving ? car.v : 0);
      if (G.carHint) { G.carHint.pos.copy(car.group.position).y += 1.8; G.carHint.el.style.opacity = !G.driving && nearCar() ? '1' : '0'; }
    }
    if (G.mode === 'scene') minimap.update(dt, poroto, G.director.agents);
    else if ((G.hubRegionT = (G.hubRegionT ?? 0) - dt) <= 0) {
      G.hubRegionT = 0.4;
      const r = G.hubWorld.regionAt(poroto.pos.x, poroto.pos.z);
      if (r && r.code !== G.hubRegion) { G.hubRegion = r.code; minimap.setHub({ chileMap: G.chileMap, regionCode: r.code, regionName: r.name }); }
    }
    if (poroto.drop > 0 && !G.driving) {
      poroto.drop = Math.max(0, poroto.drop - dt * 18);
      poroto.root.position.y += poroto.drop;
      if (poroto.drop === 0) { blip(160, 0.12); say(poroto.dropMsg || '¡Hola! Soy Poroto.'); poroto.dropMsg = null; }
    }
    if (st.sleep && bubble.hidden && !G.driving) say('Zzz…', 2);
    if (G.mode === 'hub') G.hubWorld.update(now / 1000, dt);
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
    const c = G.cam;
    const goal = new THREE.Vector3(poroto.pos.x, poroto.root.position.y + CAMERA.targetY, poroto.pos.z);
    c.target.lerp(goal, 1 - Math.exp(-dt * 3));
    const cp = Math.cos(c.pitch);
    camera.position.set(c.target.x + cp * Math.cos(c.yaw) * c.dist, c.target.y + Math.sin(c.pitch) * c.dist, c.target.z - cp * Math.sin(c.yaw) * c.dist);
    if (G.mode === 'scene') camera.position.y = Math.max(camera.position.y, G.sc.heightAt(camera.position.x, camera.position.z) + 1.5);
    else camera.position.y = Math.max(camera.position.y, G.hubWorld.groundAt(camera.position.x, camera.position.z) + 0.8);
    camera.lookAt(c.target);
    if (G.photo) aimPhotoCamera(dt);
    camera.updateMatrixWorld();
    shared.uLightDir.value.set(0.45, 1, 0.35).normalize().transformDirection(camera.matrixWorldInverse);
    shared.uCutNear.value = G.photo ? 0.8 : G.mode === 'scene' ? c.dist * 0.85 : 0;
    camera.getWorldDirection(fwd);
    setListener(poroto.root.position, fwd);
    // globito de Poroto
    if (!bubble.hidden) {
      bubbleT -= dt;
      const p = poroto.root.position.clone(); p.y += PORORO_BUBBLE_Y; p.project(camera);
      bubble.style.left = ((p.x + 1) / 2 * window.innerWidth - 20) + 'px';
      bubble.style.top = ((1 - p.y) / 2 * window.innerHeight - 30) + 'px';
      if (bubbleT <= 0) bubble.hidden = true;
    }
    if (G.world) renderer.render(G.world, camera);
    if (G.photo?.shot) { G.photo.shot = false; takePhoto(); }
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
  G.relief = await loadJSON(DATA_BASE + 'chile-relief.json');
}).catch(err => {
  document.querySelector('#start .hint').textContent = 'No se pudieron cargar los datos: ' + err.message;
});
requestAnimationFrame(frame);

// para depurar desde la consola
window.G = G; window.camera = camera; window.poroto = poroto; window.dbg = { enterRegion, enterHub, travel, setMonth, setYear, enterPhoto, exitPhoto, shoot, noteSighting };
