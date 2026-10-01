// Mini-mapa al estilo de Ocarina of Time (abajo a la izquierda):
// - mapa local de la escena, norte arriba: cobertura del suelo, senderos, salidas a las otras zonas
//   (con su nombre), aves (puntos del color de su clase) y Poroto (flecha);
// - las zonas de la región, con la actual resaltada;
// - una franja de Chile con la región donde está Poroto (en el menú de regiones, la más cercana).
/* global THREE */
import { COVER_RGB, WORLD } from './scene.js';

const SIZE = 150; // px del mapa local

export function createMinimap() {
  const box = document.createElement('div');
  box.id = 'minimap'; box.className = 'win minimap'; box.hidden = true;
  box.innerHTML = `<button class="mm-head" aria-expanded="true"><span id="mm-title"></span><span class="chev">▾</span></button>
    <div class="mm-body"><canvas id="mm-local" width="${SIZE}" height="${SIZE}" aria-label="Mapa de la zona"></canvas>
    <div id="mm-zones"></div><svg id="mm-chile" role="img" aria-label="Región en el mapa de Chile"></svg></div>`;
  document.body.appendChild(box);
  const head = box.querySelector('.mm-head');
  head.addEventListener('click', () => {
    box.classList.toggle('closed');
    head.setAttribute('aria-expanded', String(!box.classList.contains('closed')));
  });
  const cv = box.querySelector('#mm-local'), g = cv.getContext('2d');
  const base = document.createElement('canvas'); base.width = base.height = SIZE;
  let scene = null, exits = [], label = k => k, t = 0;

  const toPx = (x, z) => [(x + WORLD / 2) / WORLD * SIZE, (z + WORLD / 2) / WORLD * SIZE];

  function drawChile(chileMap, code, dot) {
    const svg = box.querySelector('#mm-chile');
    if (!chileMap) { svg.innerHTML = ''; return; }
    const [x0, y0, w, h] = chileMap.viewBox;
    svg.setAttribute('viewBox', `${x0 - 2} ${y0 - 2} ${w + 4} ${h + 4}`);
    let out = '';
    for (const r of chileMap.regions) out += `<path class="${r.code === code ? 'here' : r.active ? 'on' : ''}" d="${r.d}"><title>${r.name}</title></path>`;
    const cur = chileMap.regions.find(r => r.code === code);
    if (cur?.label && dot) out += `<circle cx="${cur.label[0]}" cy="${cur.label[1]}" r="5"/>`;
    svg.innerHTML = out;
  }

  return {
    el: box,
    // Escena de una región: se pinta una vez la base (cobertura + senderos).
    setScene({ sc, exitList, zones, current, regionName, chileMap, regionCode, labelOf }) {
      scene = sc; exits = exitList; label = labelOf;
      box.querySelector('#mm-title').textContent = `${regionName} · ${labelOf(current)}`;
      cv.hidden = false;
      const b = base.getContext('2d'), n = sc.n, px = SIZE / n;
      for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) {
        const c = sc.coverAt((q + 0.5) * sc.cell - sc.half, (r + 0.5) * sc.cell - sc.half);
        const rgb = (COVER_RGB[c] || COVER_RGB[5])[0].map(v => Math.min(255, v * 1.15));
        b.fillStyle = `rgb(${rgb})`; b.fillRect(Math.floor(q * px), Math.floor(r * px), Math.ceil(px), Math.ceil(px));
      }
      b.strokeStyle = '#e8d6a0'; b.lineWidth = 3; b.lineCap = 'round';
      for (const [x, z] of sc.exitPts) {
        b.beginPath(); b.moveTo(...toPx(0, 0)); b.lineTo(...toPx(x, z)); b.stroke();
      }
      const zl = box.querySelector('#mm-zones');
      zl.hidden = false;
      zl.innerHTML = zones.map(k => `<span class="${k === current ? 'here' : ''}">${labelOf(k)}</span>`).join('');
      drawChile(chileMap, regionCode, true);
      box.hidden = false;
    },
    // Menú de regiones: sin mapa local; la franja marca la región más cercana a Poroto.
    setHub({ chileMap, regionCode, regionName }) {
      scene = null;
      cv.hidden = true; box.querySelector('#mm-zones').hidden = true;
      box.querySelector('#mm-title').textContent = regionName;
      drawChile(chileMap, regionCode, true);
      box.hidden = false;
    },
    hide() { box.hidden = true; },
    update(dt, poroto, agents) {
      if (!scene || box.hidden || box.classList.contains('closed')) return;
      t += dt;
      if (t < 0.08) return; // ~12 cuadros por segundo bastan
      t = 0;
      g.imageSmoothingEnabled = false;
      g.drawImage(base, 0, 0);
      // salidas a otras zonas: marcador + nombre (como las entradas del mapa de OoT)
      g.font = '10px "Pixelify Sans", monospace'; g.textBaseline = 'middle';
      for (const e of exits) {
        const [x, y] = toPx(e.sign.position.x, e.sign.position.z);
        g.fillStyle = '#f4d35e'; g.strokeStyle = '#3a2612'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x + 5, y); g.lineTo(x, y + 5); g.lineTo(x - 5, y); g.closePath(); g.fill(); g.stroke();
        const txt = label(e.key), w = g.measureText(txt).width;
        const tx = Math.max(2, Math.min(SIZE - w - 2, x - w / 2)), ty = y < 16 ? y + 12 : y - 11;
        g.lineWidth = 3; g.strokeStyle = 'rgba(8,10,16,.85)'; g.strokeText(txt, tx, ty);
        g.fillStyle = '#f4d35e'; g.fillText(txt, tx, ty);
      }
      // aves presentes
      for (const a of agents) {
        if (a.state === 'wait' || a.gone || !a.m.group.parent) continue;
        const [x, y] = toPx(a.pos.x, a.pos.z);
        g.fillStyle = a.color; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
      }
      // Poroto: flecha hacia donde mira
      const [px, py] = toPx(poroto.pos.x, poroto.pos.z);
      const h = poroto.heading, fx = Math.cos(h), fz = -Math.sin(h);
      g.fillStyle = '#ffe680'; g.strokeStyle = '#3a2612'; g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(px + fx * 7, py + fz * 7);
      g.lineTo(px - fx * 4 - fz * 4.5, py - fz * 4 + fx * 4.5);
      g.lineTo(px - fx * 1.5, py - fz * 1.5);
      g.lineTo(px - fx * 4 + fz * 4.5, py - fz * 4 - fx * 4.5);
      g.closePath(); g.fill(); g.stroke();
    },
  };
}
