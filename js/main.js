// Aviario de Chile: PRESS START → menú de regiones (Chile flotando en el vacío) → escena de la
// región (mini-escenas unidas por senderos) con aves reales mes a mes.
/* global THREE */
import { shared, mat, makeTex, makeVary, mulberry32, createRenderer, fitRenderer, texPlain } from './ps1.js';
import { loadWorld, loadRegion, loadJSON, DATA_BASE, MVP, CLASS_COLORS, CLASS_LABEL, birdDialog, welcomeText } from './data.js';
import { buildScene, signpost, WORLD } from './scene.js';
import { buildPoroto } from './poroto.js';
import { Director } from './aviary.js';
import { unlockAudio, setListener, setMuted, blip } from './audio.js';

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
const SCENE_ORDER = ['ciudad', 'matorral', 'rio', 'cordillera'];
const SCENE_LABEL = { ciudad: 'Ciudad', matorral: 'Matorral', rio: 'Río', cordillera: 'Cordillera' };

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
function openDialog(html, actions = [{ label: 'Cerrar' }]) {
  $('dialog-text').innerHTML = html;
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
function labelSprite(text, color = '#eef1f8') {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 32;
  const g = cv.getContext('2d');
  g.font = 'bold 18px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#05060b'; g.fillText(text, 129, 18); g.fillStyle = color; g.fillText(text, 128, 16);
  const t = new THREE.CanvasTexture(cv); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
  s.scale.set(8, 1, 1);
  return s;
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
    const lab = labelSprite(r.name, active ? '#f4d35e' : '#8a90aa');
    lab.position.set(pts[i].x + 3.2 + 5.2, 2, pts[i].z);
    scene.add(lab);
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
  G.hubWorld = buildHub();
  G.world = G.hubWorld.scene;
  applyLight('primavera', 0x05060b, 30, 90);
  poroto.pos.copy(G.hubWorld.rmPoint); poroto.pos.x -= 0.5;
  poroto.drop = 14; poroto.heading = -Math.PI / 2;
  poroto.season = 'primavera';
  G.cam.dist = 20; G.cam.pitch = 0.75; G.cam.yaw = -Math.PI / 2 + 0.5;
  G.cam.target.copy(poroto.pos);
  $('hud').hidden = true;
  await fade(false);
  toast('Elige una región. Por ahora se puede entrar a la <b>Metropolitana</b>.', 5);
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
async function enterRegion(code) {
  await fade(true, 'Cargando la región…');
  G.reg = await loadRegion(G.index, code);
  try { G.props = await loadJSON(DATA_BASE + `props-${code}.json`); } catch { G.props = null; }
  G.regionRoot = new THREE.Scene();
  G.director = new Director({ index: G.index, region: G.reg.region, regionId: G.reg.meta.id, root: null, onSing });
  G.mode = 'scene';
  await loadSceneKey('ciudad', null, false);
  $('hud').hidden = false;
  await fade(false);
  openDialog(welcomeText(G.index, G.reg.meta, G.month), [{ label: '¡Vamos!' }]);
}

async function loadSceneKey(key, fromKey, withFade = true) {
  const data = G.reg.terrain.scenes[key];
  const scene = new THREE.Scene();
  const sc = buildScene(key, data, G.props, 10, SEASON_OF[G.month]);
  scene.add(sc.root, poroto.root, poroto.shadow);
  G.world = scene; G.sc = sc; G.sceneKey = key;
  // senderos hacia los otros cuartos, en la dirección geográfica real
  G.exits = [];
  for (const k of SCENE_ORDER) {
    if (k === key) continue;
    const other = G.reg.terrain.scenes[k];
    const dx = (other.center[0] - data.center[0]) * Math.cos(data.center[1] * Math.PI / 180), dz = -(other.center[1] - data.center[1]);
    const a = Math.atan2(dz, dx);
    const r = sc.half * 0.62;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const sign = signpost(`→ ${SCENE_LABEL[k]}`);
    sign.position.set(x, sc.heightAt(x, z), z);
    sign.rotation.y = -a + Math.PI / 2;
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 1), new THREE.MeshBasicMaterial({ visible: false }));
    proxy.position.set(0, 1.2, 0); proxy.userData.exit = { key: k, sign }; sign.add(proxy);
    scene.add(sign);
    G.exits.push({ key: k, sign, proxy, angle: a });
  }
  // llegada: junto al letrero del cuarto de origen, o al centro
  const back = G.exits.find(e => e.key === fromKey);
  if (back) { poroto.pos.set(back.sign.position.x * 0.8, 0, back.sign.position.z * 0.8); }
  else poroto.pos.set(0, 0, 0);
  poroto.target = null; poroto.state = 'idle'; poroto.drop = 0;
  G.cam.dist = 12; G.cam.pitch = 0.62; G.cam.yaw = -Math.PI / 2;
  G.cam.target.set(poroto.pos.x, sc.heightAt(poroto.pos.x, poroto.pos.z), poroto.pos.z);
  G.director.root = scene;
  G.director.setScene(key, sc, G.month, true);
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
  const fc = fogColor ?? (G.sceneKey === 'cordillera' ? 0x9cb4d8 : L.fog);
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
  $('book-n').textContent = `${[...G.book].filter(id => G.index.byId.has(id)).length}/${Object.keys(MVP).length}`;
  $('b-pause').textContent = G.paused ? '▶' : '⏸';
  $('b-pause').title = G.paused ? 'Reanudar el tiempo' : 'Pausar el tiempo';
}

// ------------------------------------------------------------------ cantos
function onSing(agent, dur) {
  const d = agent.pos.distanceTo(poroto.pos);
  if (d < 30) {
    poroto.setFeather(agent.color, agent.pos);
    clearTimeout(onSing.h);
    onSing.h = setTimeout(() => poroto.setFeather(null, null), dur * 1000);
  }
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
  canvas.classList.toggle('pointer', !!(h && (h.bird || h.exit || h.portal)));
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
  if (G.mode !== 'scene' && G.mode !== 'hub') return;
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
      if (d < 4) poroto.walkTo(p);
    } else {
      const lim = G.sc.half - 2;
      poroto.walkTo(new THREE.Vector3(Math.max(-lim, Math.min(lim, h.ground.x)), 0, Math.max(-lim, Math.min(lim, h.ground.z))));
    }
    blip(990, 0.03);
  }
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  G.cam.dist = Math.min(24, Math.max(6, G.cam.dist * (1 + Math.sign(e.deltaY) * 0.1)));
}, { passive: false });
window.addEventListener('keydown', e => {
  if (G.mode === 'start' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); start(); return; }
  if (e.key === 'Escape') { closeDialog(); $('panel').hidden = true; }
  if (e.key === 'q' || e.key === 'Q' || e.key === 'ArrowLeft') G.cam.yaw -= Math.PI / 8;
  if (e.key === 'e' || e.key === 'E' || e.key === 'ArrowRight') G.cam.yaw += Math.PI / 8;
  if (e.key === 'ArrowUp') G.cam.pitch = Math.min(1.25, G.cam.pitch + 0.08);
  if (e.key === 'ArrowDown') G.cam.pitch = Math.max(0.2, G.cam.pitch - 0.08);
});

function birdClicked(a) {
  blip(880);
  poroto.look = a.pos.clone(); poroto.binoc = 1;
  const isNew = !G.book.has(a.sp.id);
  openDialog(birdDialog(G.index, a.sp, G.reg.meta.id), [
    { label: '♪ Escuchar', keep: true, fn: () => G.director.singNow(a, true) },
    { label: 'Cerrar' },
  ]);
  if (isNew) {
    G.book.add(a.sp.id); saveBook();
    poroto.write();
    const n = [...G.book].filter(id => MVP[G.index.byId.get(id)?.sciName]).length;
    toast(`¡Nueva especie en la libreta! <b>${a.sp.comName}</b> (${n}/${Object.keys(MVP).length})`, 3.5);
    updateHud();
  }
}

// ------------------------------------------------------------------ paneles
$('b-pause').onclick = () => { G.paused = !G.paused; updateHud(); blip(); };
$('b-next').onclick = () => { setMonth(G.month + 1); blip(); };
$('b-sound').onclick = () => { G.muted = !G.muted; setMuted(G.muted); $('b-sound').classList.toggle('off', G.muted); };
$('b-map').onclick = () => {
  const sc = G.reg.terrain.scenes;
  openPanel(`<h2>MAPA · ${G.reg.meta.name}</h2><p class="dim">Cuatro rincones reales de la región, unidos por senderos.</p><div class="scenes">${
    SCENE_ORDER.map(k => `<button class="btn" data-k="${k}" ${k === G.sceneKey ? 'disabled' : ''}>${SCENE_LABEL[k]} — ${sc[k].name} · ${sc[k].hMin}–${sc[k].hMax} m</button>`).join('')
  }</div><p class="dim" style="margin-top:10px"><button class="btn" id="to-hub">← Volver al mapa de Chile</button></p>`);
  $('panel-body').querySelectorAll('[data-k]').forEach(b => { b.onclick = () => { $('panel').hidden = true; travel(b.dataset.k); }; });
  $('to-hub').onclick = async () => { $('panel').hidden = true; await fade(true, 'Volviendo al mapa de Chile…'); G.reg = null; enterHub(); };
};
$('b-book').onclick = () => {
  const cards = Object.keys(MVP).map(sci => {
    const sp = G.index.bySci.get(sci);
    const seen = G.book.has(sp.id);
    const pal = sp.palette || {};
    const sw = ['back', 'belly', 'head', 'throat', 'wing', 'accent'].filter(z => pal[z]).map(z => `<i style="background:rgb(${pal[z].join(',')})" title="${z}"></i>`).join('');
    return seen
      ? `<div class="card"><b>${sp.comName}</b><div class="dim"><i>${sp.sciName}</i></div><div class="dim">${SCENE_LABEL[sp.habitat?.rm] || ''} · ${Math.round(sp.morphology?.mass || 0)} g</div><div class="sw">${sw}</div></div>`
      : `<div class="card unk">???<div class="dim">${SCENE_LABEL[sp.habitat?.rm] || ''}</div></div>`;
  }).join('');
  openPanel(`<h2>LIBRETA DE CAMPO</h2><p class="dim">Haz clic en un ave para anotarla. Colores sacados de fotos de referencia.</p><div class="book">${cards}</div>`);
};
$('b-credits').onclick = () => {
  const clips = Object.keys(MVP).map(s => G.index.bySci.get(s)).filter(s => s?.clip)
    .map(s => `<li>${s.comName}: <a href="${s.clip.url}" target="_blank" rel="noopener">${s.clip.recordist}</a> · ${s.clip.license}</li>`).join('');
  openPanel(`<h2>CRÉDITOS</h2>
  <p><b>Datos de aves:</b> GBIF.org (2026), descargas de ocurrencias de Aves en Chile (principalmente eBird), años 2017–2024; métricas corregidas por esfuerzo de muestreo. Proyecto <i>Nómadas & sedentarios</i> (Visualización de Información 2026-2).</p>
  <p><b>Cantos:</b> Xeno-canto (licencias Creative Commons por grabación):</p><ul>${clips}</ul>
  <p>La Turca no tiene grabación en el set: su canto es sintético.</p>
  <p><b>Morfología y hábitat:</b> AVONET (Tobias et al. 2022, CC BY 4.0) y EltonTraits 1.0 (Wilman et al. 2014, CC0). <b>Paletas:</b> derivadas de fotos de referencia de iNaturalist (CC0 / CC BY / CC BY-SA; autores en los datos). <b>Terreno:</b> AWS Terrain Tiles, ESA WorldCover 2021 (CC BY 4.0) y © OpenStreetMap (ODbL).</p>
  <p class="dim">Clic para caminar · clic en un ave para conocerla · rueda: zoom · Q/E o ←/→: girar la cámara.</p>`);
};

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
    const blocked = G.mode === 'scene' ? (x, z) => G.sc.obstacles.some(o => Math.hypot(o.x - x, o.z - z) < o.r) : null;
    const st = poroto.update(dt, heightAt, blocked);
    if (poroto.drop > 0) {
      poroto.drop = Math.max(0, poroto.drop - dt * 18);
      poroto.root.position.y += poroto.drop;
      if (poroto.drop === 0) { blip(160, 0.12); say('¡Hola! Soy Poroto.'); }
    }
    if (st.sleep && bubble.hidden) say('Zzz…', 2);
    if (G.mode === 'scene') {
      G.director.update(dt, G.paused);
      if (!G.paused && !G.dialogOpen) {
        G.monthT += dt;
        if (G.monthT >= MONTH_SECONDS) setMonth(G.month + 1);
      }
      G.quirkT -= dt;
      if (G.quirkT <= 0) { G.quirkT = 18 + Math.random() * 15; const q = poroto.seasonQuirk(); if (q) say(q, 2.2); }
      if (G.hover && !G.hover.m.group.parent) setHover(null, lastPointer);
    }
    // cámara semifija que sigue a Poroto
    const c = G.cam;
    const goal = new THREE.Vector3(poroto.pos.x, poroto.root.position.y + 0.8, poroto.pos.z);
    c.target.lerp(goal, 1 - Math.exp(-dt * 3));
    const cp = Math.cos(c.pitch);
    camera.position.set(c.target.x + cp * Math.cos(c.yaw) * c.dist, c.target.y + Math.sin(c.pitch) * c.dist, c.target.z - cp * Math.sin(c.yaw) * c.dist);
    if (G.mode === 'scene') camera.position.y = Math.max(camera.position.y, G.sc.heightAt(camera.position.x, camera.position.z) + 1.5);
    camera.lookAt(c.target);
    camera.updateMatrixWorld();
    shared.uLightDir.value.set(0.45, 1, 0.35).normalize().transformDirection(camera.matrixWorldInverse);
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
  }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => fitRenderer(renderer, camera));
fitRenderer(renderer, camera);
renderer.setClearColor(0x05060b);
loadWorld().then(idx => { G.index = idx; }).catch(err => {
  document.querySelector('#start .hint').textContent = 'No se pudieron cargar los datos: ' + err.message;
});
requestAnimationFrame(frame);

// para depurar desde la consola
window.G = G; window.camera = camera; window.poroto = poroto;
