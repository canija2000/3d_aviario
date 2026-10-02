// Puertas del pasillo: una distinta por región, con algo propio de su zona. Todas tienen el mismo vano
// (1,45 × 2,45 m, centrado) para el portal o las tablas clavadas, y miran hacia +z (el camino).
// Hechas con primitivas y texturas chicas pintadas en código, como el resto del mundo.
/* global THREE */
import { mat, makeTex, makeVary, mulberry32 } from './ps1.js';

let R = mulberry32(1), vary = makeVary(R);
const tex = (w, h, fn, o) => mat(makeTex(w, h, fn), o);
const solid = (c, n = 8) => tex(8, 8, () => vary(c, n));

// texturas de la zona
const TX = {
  adobe: c => tex(16, 16, () => vary(R() < 0.06 ? c.map(v => v * 0.86) : c, 6)),
  stone: (c, moss) => tex(16, 16, (x, y) => (y % 4 === 0 || (x + (y >> 2) * 3) % 8 === 0) ? vary(c.map(v => v * 0.7), 6)
    : moss && R() < 0.12 ? vary([70, 96, 52], 10) : vary(c, 10)),
  planks: c => tex(16, 16, x => vary(x % 4 === 0 ? c.map(v => v * 0.6) : c, 8)),
  shingle: c => tex(16, 16, (x, y) => vary(y % 4 === 3 || (y % 4 === 2 && (x + (y >> 2) * 2) % 4 === 0) ? c.map(v => v * 0.7) : c, 6)),
  zinc: c => tex(16, 8, x => vary(x % 4 < 2 ? c : c.map(v => v * 0.75), 4)),
  tile: c => tex(16, 8, (x, y) => vary(y % 4 < 2 ? c : c.map(v => v * 0.78), 6)),
  layered: () => tex(16, 16, (x, y) => vary([[176, 132, 92], [150, 108, 76], [196, 156, 112], [128, 92, 68]][((y + (x >> 3)) >> 2) % 4], 8)),
  marble: () => tex(16, 16, (x, y) => { const k = Math.sin(x * 0.7 + Math.sin(y * 0.45) * 3); return vary(k > 0.55 ? [96, 132, 168] : k > 0 ? [214, 220, 226] : [176, 186, 196], 6); }),
  thatch: () => tex(16, 16, (x, y) => vary((x + y * 3) % 5 === 0 ? [124, 100, 56] : [176, 148, 88], 10)),
  clay: () => tex(16, 16, (x, y) => (Math.abs(((x + y) % 8) - 4) === 2 && y % 8 > 1 && y % 8 < 6) || y % 8 === 0 ? [214, 206, 192] : vary([30, 26, 26], 4)),
  granite: () => tex(16, 16, () => vary(R() < 0.15 ? [96, 92, 92] : [176, 172, 168], 10)),
  rust: () => tex(8, 8, () => vary(R() < 0.3 ? [120, 56, 32] : [150, 84, 48], 10)),
  brick: () => tex(16, 16, (x, y) => (y % 4 === 0 || (x + (y >> 2) * 4) % 8 === 0) ? vary([90, 80, 72], 4) : vary([150, 64, 44], 8)),
  flag: o => tex(12, 8, (x, y) => y < 4 ? (x < 4 ? (x === 1 && y === 1 ? [255, 255, 255] : [32, 64, 168]) : [244, 244, 244]) : [208, 40, 40]),
  steel: () => tex(8, 8, (x, y) => vary(x % 4 === 0 && y % 4 === 0 ? [140, 140, 148] : [64, 66, 72], 6)),
};

function add(g, geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); g.add(o); return o;
}
const box = (g, w, h, d, m, x, y, z, rx, ry, rz) => add(g, new THREE.BoxGeometry(w, h, d), m, x, y, z, rx, ry, rz);
const cyl = (g, rt, rb, h, seg, m, x, y, z, rx, ry, rz) => add(g, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z, rx, ry, rz);
const roof = (g, w, h, d, m, x, y, z) => { // techo a dos aguas: prisma con la cumbrera a lo ancho; y = base
  const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.lineTo(-0.5, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5).rotateY(Math.PI / 2).scale(w, h, d);
  return add(g, geo, m, x, y, z);
};
const pyramid = (g, r, h, m, x, y, z) => add(g, new THREE.ConeGeometry(r, h, 4).rotateY(Math.PI / 4), m, x, y, z);
// pilares y dintel alrededor del vano
function frame(g, mPil, mTop, { w = 0.6, h = 2.75, d = 0.7, top = 0.5, span = 2.9, x = 1.05 } = {}) {
  for (const s of [-1, 1]) box(g, w, h, d, mPil, s * x, h / 2, 0);
  box(g, span, top, d + 0.05, mTop || mPil, 0, h + top / 2, 0);
}

// Cada función arma la decoración y devuelve la altura total (para el nombre encima).
const BUILD = {
  'CL-AP'(g) { // iglesia de Parinacota: adobe encalado, espadaña escalonada y campanario aparte
    const white = TX.adobe([232, 226, 212]), base = TX.stone([150, 144, 136]), thatch = TX.thatch();
    box(g, 3.4, 0.3, 1.0, base, 0, 0.15, 0);
    frame(g, white, white, { w: 0.85, d: 0.9, span: 3.2 });
    box(g, 2.2, 0.55, 0.6, white, 0, 3.5, 0); box(g, 1.3, 0.5, 0.6, white, 0, 4.0, 0); box(g, 0.6, 0.4, 0.6, white, 0, 4.45, 0);
    box(g, 0.06, 0.5, 0.06, solid([60, 50, 44]), 0, 4.9, 0); box(g, 0.3, 0.06, 0.06, solid([60, 50, 44]), 0, 4.95, 0);
    box(g, 0.45, 0.4, 0.62, solid([40, 32, 30]), 0, 3.5, 0.01); cyl(g, 0.08, 0.16, 0.24, 6, solid([150, 112, 52]), 0, 3.5, 0.2);
    box(g, 0.9, 3.3, 0.9, white, 2.35, 1.65, -0.3); box(g, 0.94, 0.6, 0.94, solid([60, 50, 44]), 2.35, 3.5, -0.3);
    box(g, 1.0, 0.15, 1.0, white, 2.35, 3.85, -0.3); pyramid(g, 0.7, 0.8, thatch, 2.35, 4.33, -0.3);
    return 5.1;
  },
  'CL-TA'(g) { // oficina salitrera de Humberstone: madera, calamina oxidada y chimenea
    const wood = TX.planks([92, 70, 52]), zinc = TX.zinc([150, 112, 80]), rust = TX.rust();
    box(g, 3.2, 0.2, 1.0, solid([120, 112, 100]), 0, 0.1, 0);
    frame(g, wood, zinc, { w: 0.35, d: 0.35, top: 0.75, span: 3.2 });
    for (const s of [-1, 1]) box(g, 0.12, 1.6, 0.12, wood, s * 1.05, 1.4, 0.25, 0, 0, s * 0.5);
    cyl(g, 0.2, 0.3, 5.2, 8, rust, -2.2, 2.6, -0.5);
    for (const y of [1.2, 2.6, 4.0, 5.1]) add(g, new THREE.TorusGeometry(0.27 - y * 0.012, 0.04, 4, 8).rotateX(Math.PI / 2), solid([60, 40, 30]), -2.2, y, -0.5);
    const gear = new THREE.Group(); gear.position.set(2.0, 0.75, 0.2); gear.rotation.z = 0.2; g.add(gear);
    add(gear, new THREE.TorusGeometry(0.62, 0.08, 4, 12), rust);
    for (let i = 0; i < 3; i++) box(gear, 1.2, 0.08, 0.08, rust, 0, 0, 0, 0, 0, i * Math.PI / 3);
    return 5.4;
  },
  'CL-AN'(g) { // La Portada: arco de roca sedimentaria que sale del mar
    const rock = TX.layered();
    const chunk = (r, x, y, z, sx = 1, sy = 1, sz = 1) => add(g, new THREE.DodecahedronGeometry(r, 0).scale(sx, sy, sz), rock, x, y, z, R() * 3, R() * 3, 0);
    for (const s of [-1, 1]) { // patas: bloques apilados, más anchas abajo
      chunk(0.85, s * 1.35, 0.5, 0, 1, 0.8, 1.1); chunk(0.7, s * 1.3, 1.4, 0.05, 1, 0.9, 1); chunk(0.62, s * 1.22, 2.25, 0, 1, 0.9, 1);
    }
    chunk(0.75, -0.8, 3.05, 0, 1.4, 0.75, 1.1); chunk(0.75, 0.75, 3.1, 0, 1.4, 0.75, 1.1); chunk(0.55, 0, 3.2, 0.05, 1.5, 0.7, 1); // el arco
    chunk(0.7, -0.3, 3.75, -0.1, 1.6, 0.6, 1); chunk(0.45, 0.6, 4.05, -0.05, 1.2, 0.6, 1); // la cima, plana como una meseta
    for (const [x, z, r] of [[-2.2, 0.6, 0.45], [2.2, 0.5, 0.35], [1.9, 1.0, 0.25], [-1.8, 1.1, 0.3]]) chunk(r, x, r * 0.6, z);
    add(g, new THREE.CircleGeometry(1.2, 10).rotateX(-Math.PI / 2), solid([60, 110, 150], 6), 0, 0.03, -1.0); // poza de mar detrás
    return 4.6;
  },
  'CL-AT'(g) { // bocamina en un cerro rojizo, carro minero y desierto florido
    const rock = TX.stone([150, 96, 72]), wood = TX.planks([110, 82, 54]), rust = TX.rust();
    add(g, new THREE.SphereGeometry(2.3, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.1, 1.3, 0.8), rock, 0, 0, -1.2);
    frame(g, wood, wood, { w: 0.32, d: 0.4, top: 0.35, span: 2.4, x: 0.9 });
    for (const x of [-0.35, 0.35]) box(g, 0.05, 0.05, 2.0, solid([80, 80, 88]), x, 0.03, 0.9);
    for (let z = 0.1; z < 1.9; z += 0.35) box(g, 0.95, 0.05, 0.12, wood, 0, 0.02, z);
    const cart = new THREE.Group(); cart.position.set(1.7, 0, 0.9); g.add(cart);
    box(cart, 0.8, 0.45, 0.6, rust, 0, 0.45, 0);
    for (const [x, z] of [[-0.25, 0.3], [0.25, 0.3], [-0.25, -0.3], [0.25, -0.3]]) cyl(cart, 0.12, 0.12, 0.06, 8, solid([40, 40, 44]), x, 0.14, z, Math.PI / 2);
    const cols = [[224, 96, 176], [176, 104, 216], [240, 208, 72], [240, 240, 236]];
    for (let i = 0; i < 26; i++) {
      const x = (R() < 0.5 ? -1 : 1) * (1.0 + R() * 1.8), z = 0.3 + R() * 1.6;
      add(g, new THREE.ConeGeometry(0.09, 0.14, 5).rotateX(Math.PI), solid(cols[i % 4], 6), x, 0.12, z);
    }
    return 3.4;
  },
  'CL-CO'(g) { // observatorio: muros blancos y cúpula con su ranura
    const white = TX.adobe([236, 236, 232]), dome = solid([214, 218, 224], 4);
    box(g, 3.2, 0.2, 1.0, solid([160, 156, 150]), 0, 0.1, 0);
    frame(g, white, white, { span: 3.0 });
    cyl(g, 1.35, 1.35, 0.8, 12, white, 0, 3.6, -0.4);
    add(g, new THREE.SphereGeometry(1.35, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), dome, 0, 4.0, -0.4);
    box(g, 0.4, 1.4, 0.2, solid([30, 34, 44]), 0, 4.75, 0.55, -0.75);
    return 5.6;
  },
  'CL-VS'(g) { // cerros de Valparaíso: casas de calamina de colores y un ascensor
    box(g, 1.0, 2.9, 1.0, TX.zinc([232, 192, 72]), -1.25, 1.45, 0); box(g, 1.0, 3.3, 1.0, TX.zinc([200, 72, 120]), 1.25, 1.65, 0);
    box(g, 3.4, 1.0, 1.1, TX.zinc([96, 176, 196]), 0, 3.4, 0); roof(g, 3.6, 0.7, 1.3, TX.zinc([176, 64, 48]), 0, 3.9, 0);
    for (const [x, y] of [[-1.25, 2.2], [1.25, 2.6], [-0.8, 3.4], [0.8, 3.4]]) box(g, 0.32, 0.4, 0.04, solid([40, 48, 64]), x, y, 0.56);
    box(g, 0.14, 5.0, 0.14, solid([70, 70, 76]), 2.5, 2.0, -0.4, 0, 0, 0.55);
    box(g, 0.75, 0.75, 0.65, TX.planks([200, 168, 64]), 2.3, 1.4, -0.4); // carro del ascensor
    box(g, 0.5, 0.25, 0.66, solid([50, 60, 76]), 2.3, 1.52, -0.4);
    return 4.9;
  },
  'CL-RM'(g) { // Castillo Hidalgo del cerro Santa Lucía: torreones almenados y bandera
    const stone = TX.stone([176, 156, 128]);
    for (const s of [-1, 1]) {
      cyl(g, 0.62, 0.68, 3.4, 8, stone, s * 1.3, 1.7, 0);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; box(g, 0.24, 0.3, 0.24, stone, s * 1.3 + Math.cos(a) * 0.55, 3.55, Math.sin(a) * 0.55, 0, -a); }
    }
    box(g, 2.0, 0.9, 0.8, stone, 0, 3.0, 0);
    for (let i = -2; i <= 2; i++) box(g, 0.24, 0.3, 0.8, stone, i * 0.42, 3.6, 0);
    box(g, 0.05, 1.5, 0.05, solid([60, 56, 52]), -1.3, 4.35, 0);
    add(g, new THREE.PlaneGeometry(0.75, 0.5), TX.flag({ twoSided: true }), -0.9, 4.85, 0);
    return 5.3;
  },
  'CL-LI'(g) { // casa de hacienda: corredor de tejas y barricas de vino
    const white = TX.adobe([236, 228, 210]), wood = TX.planks([104, 72, 48]);
    frame(g, white, wood, { top: 0.35 });
    box(g, 4.2, 0.12, 1.9, TX.tile([168, 72, 52]), 0, 3.3, 0.35, 0.2);
    for (const x of [-1.9, 1.9]) box(g, 0.16, 3.0, 0.16, wood, x, 1.5, 1.1);
    const barrel = TX.planks([120, 80, 48]);
    for (const [x, y, z] of [[2.5, 0.38, -0.2], [2.5, 0.38, 0.6], [2.5, 1.06, 0.2]]) {
      cyl(g, 0.36, 0.36, 0.75, 8, barrel, x, y, z, Math.PI / 2, 0, 0);
      for (const dz of [-0.25, 0.25]) add(g, new THREE.TorusGeometry(0.37, 0.025, 3, 8), solid([50, 50, 54]), x, y, z + dz);
    }
    return 3.9;
  },
  'CL-ML'(g) { // Maule: adobe con zócalo, rueda de carreta y parrón con uvas
    const wall = TX.adobe([226, 214, 186]), ochre = TX.adobe([176, 112, 64]), wood = TX.planks([110, 80, 52]);
    frame(g, wall, wood, { top: 0.35 });
    for (const s of [-1, 1]) box(g, 0.64, 0.6, 0.74, ochre, s * 1.05, 0.3, 0);
    for (const [x, z] of [[-1.7, 1.0], [1.7, 1.0], [-1.7, -0.6], [1.7, -0.6]]) box(g, 0.1, 3.3, 0.1, wood, x, 1.65, z);
    for (let x = -1.7; x <= 1.71; x += 0.42) box(g, 0.05, 0.05, 1.7, wood, x, 3.3, 0.2);
    for (let i = 0; i < 18; i++) box(g, 0.4, 0.14, 0.4, solid([72, 120, 52], 12), -1.6 + R() * 3.2, 3.38, -0.5 + R() * 1.4, 0, R() * 3);
    for (let i = 0; i < 8; i++) add(g, new THREE.SphereGeometry(0.09, 5, 3), solid([88, 40, 96]), -1.5 + R() * 3, 3.18, -0.4 + R() * 1.2);
    const wheel = new THREE.Group(); wheel.position.set(-2.2, 0.7, 0.3); wheel.rotation.set(0, 0.3, 0.25); g.add(wheel);
    add(wheel, new THREE.TorusGeometry(0.65, 0.07, 4, 12), wood);
    for (let i = 0; i < 4; i++) box(wheel, 1.3, 0.07, 0.07, wood, 0, 0, 0, 0, 0, i * Math.PI / 4);
    return 3.8;
  },
  'CL-NB'(g) { // cerámica de Quinchamalí: tinajas negras con dibujos blancos incisos
    const clay = TX.clay();
    const pts = [[0, 0], [0.42, 0.05], [0.66, 0.6], [0.7, 1.2], [0.52, 1.9], [0.3, 2.3], [0.34, 2.6], [0, 2.6]].map(([r, y]) => new THREE.Vector2(r, y));
    for (const s of [-1, 1]) add(g, new THREE.LatheGeometry(pts, 10), clay, s * 1.3, 0, 0);
    box(g, 3.3, 0.4, 0.7, clay, 0, 2.8, 0);
    const small = pts.map(p => p.clone().multiplyScalar(0.35));
    add(g, new THREE.LatheGeometry(small, 8), clay, 0, 3.0, 0);
    add(g, new THREE.LatheGeometry(small, 8), clay, 1.3, 2.6, 0);
    return 4.0;
  },
  'CL-BI'(g) { // pique carbonífero de Lota: castillete de acero con rueda y pila de carbón
    const brick = TX.brick(), steel = TX.steel();
    frame(g, brick, steel, { top: 0.35 });
    for (const s of [-1, 1]) {
      box(g, 0.1, 3.0, 0.1, steel, s * 0.8, 4.3, -0.3, 0, 0, s * 0.18);
      box(g, 0.08, 1.7, 0.08, steel, s * 0.55, 4.0, -0.3, 0, 0, -s * 0.6);
    }
    box(g, 1.2, 0.08, 0.08, steel, 0, 4.4, -0.3); box(g, 0.8, 0.08, 0.08, steel, 0, 5.3, -0.3);
    const w = add(g, new THREE.TorusGeometry(0.55, 0.06, 4, 12), steel, 0, 5.7, -0.3);
    for (let i = 0; i < 3; i++) box(w, 1.1, 0.05, 0.05, steel, 0, 0, 0, 0, 0, i * Math.PI / 3);
    add(g, new THREE.ConeGeometry(0.8, 0.8, 6), solid([28, 28, 30], 6), 2.2, 0.4, 0.2);
    return 6.4;
  },
  'CL-AR'(g) { // ruka mapuche de paja y un rewe con ramas de canelo
    const thatch = TX.thatch(), wood = TX.planks([96, 72, 48]);
    add(g, new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(2.2, 2.9, 1.5), thatch, 0, 0, -1.7);
    frame(g, wood, wood, { w: 0.28, d: 0.3, top: 0.28, span: 2.0, x: 0.86 });
    const rewe = new THREE.Group(); rewe.position.set(2.1, 0, 0.3); g.add(rewe);
    cyl(rewe, 0.16, 0.2, 3.0, 6, wood, 0, 1.5, 0);
    for (let y = 0.4; y < 2.8; y += 0.4) box(rewe, 0.3, 0.06, 0.18, wood, 0, y, 0.14);
    for (const s of [-1, 1]) add(rewe, new THREE.ConeGeometry(0.25, 0.8, 5), solid([60, 112, 56], 10), s * 0.25, 3.0, 0, 0, 0, -s * 0.5);
    return 3.6;
  },
  'CL-LR'(g) { // fuerte español de Niebla: muralla de piedra con musgo, cañón y garita
    const stone = TX.stone([150, 146, 132], true);
    frame(g, stone, stone, { w: 0.8, d: 1.0, top: 0.7, span: 3.4, x: 1.3 });
    for (let i = -1; i <= 1; i += 2) box(g, 0.6, 0.4, 1.0, stone, i * 1.2, 3.65, 0);
    cyl(g, 0.11, 0.16, 1.3, 8, solid([36, 36, 40], 4), 0, 3.6, 0.3, Math.PI / 2 - 0.1);
    cyl(g, 0.38, 0.38, 0.95, 8, stone, -1.75, 3.9, 0.15);
    add(g, new THREE.SphereGeometry(0.4, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), stone, -1.75, 4.37, 0.15);
    box(g, 0.08, 0.3, 0.05, solid([30, 30, 34]), -1.75, 3.95, 0.54);
    return 5.0;
  },
  'CL-LL'(g) { // iglesia de Chiloé: fachada de tejuelas, pórtico y torre escalonada
    const shingle = TX.shingle([224, 190, 104]), white = TX.planks([236, 236, 230]), tower = TX.shingle([150, 186, 210]);
    frame(g, shingle, shingle, { w: 0.75, d: 0.8, top: 0.65, span: 3.3, x: 1.25 });
    roof(g, 3.5, 0.9, 0.9, shingle, 0, 3.4, 0);
    box(g, 3.7, 0.12, 1.1, white, 0, 2.95, 0.75);
    for (const x of [-1.6, -0.9, 0.9, 1.6]) box(g, 0.14, 2.9, 0.14, white, x, 1.45, 1.2);
    box(g, 1.0, 0.85, 1.0, tower, 0, 4.7, -0.2); box(g, 0.74, 0.7, 0.74, white, 0, 5.45, -0.2);
    pyramid(g, 0.6, 1.3, tower, 0, 6.45, -0.2);
    box(g, 0.05, 0.4, 0.05, solid([60, 60, 64]), 0, 7.25, -0.2); box(g, 0.24, 0.05, 0.05, solid([60, 60, 64]), 0, 7.3, -0.2);
    return 7.6;
  },
  'CL-AI'(g) { // capillas de mármol del lago General Carrera: arco de mármol sobre agua turquesa
    const marble = TX.marble();
    add(g, new THREE.TorusGeometry(1.6, 0.55, 5, 10, Math.PI), marble, 0, 1.5, 0);
    for (const s of [-1, 1]) box(g, 1.1, 1.6, 1.1, marble, s * 1.6, 0.8, 0);
    for (const [x, z, r] of [[-1.0, -0.6, 0.7], [1.2, -0.7, 0.8], [0, -0.9, 0.9]]) add(g, new THREE.DodecahedronGeometry(r, 0), marble, x, 2.6 + r * 0.4, z);
    add(g, new THREE.CircleGeometry(1.3, 10).rotateX(-Math.PI / 2), solid([64, 176, 196], 6), -2.6, 0.04, 0.6);
    add(g, new THREE.CircleGeometry(1.0, 10).rotateX(-Math.PI / 2), solid([64, 176, 196], 6), 2.6, 0.04, 0.4);
    return 4.2;
  },
  'CL-MA'(g) { // Torres del Paine detrás de una portada de estancia con techo de zinc rojo
    const granite = TX.granite(), snow = solid([236, 240, 246], 4), white = TX.planks([232, 228, 220]);
    for (const [x, h] of [[-1.2, 4.6], [0, 5.6], [1.2, 4.9]]) {
      add(g, new THREE.CylinderGeometry(0.22, 0.6, h, 5), granite, x, h / 2, -1.6);
      add(g, new THREE.ConeGeometry(0.24, 0.5, 5), snow, x, h + 0.2, -1.6);
    }
    frame(g, white, white, { w: 0.3, d: 0.3, top: 0.3, span: 3.0 });
    roof(g, 3.4, 0.7, 1.2, TX.zinc([184, 56, 48]), 0, 3.05, 0);
    box(g, 1.4, 0.35, 0.06, TX.planks([120, 84, 56]), 0, 2.85, 0.18);
    return 6.2;
  },
};

// Vano: portal que gira (región abierta) o tablas clavadas con candado (cerrada).
function opening(g, active) {
  if (active) {
    const swirl = tex(16, 16, (x, y) => vary(Math.floor(Math.hypot(x - 7.5, y - 7.5) * 0.9) % 2 ? [250, 214, 96] : [255, 244, 196], 10));
    add(g, new THREE.PlaneGeometry(1.45, 2.45), swirl, 0, 1.42, 0.02);
    return swirl;
  }
  const planks = TX.planks([96, 70, 48]);
  box(g, 1.45, 2.45, 0.12, planks, 0, 1.42, 0);
  for (const yb of [0.8, 2.0]) box(g, 1.5, 0.18, 0.16, planks, 0, yb, 0.08, 0, 0, yb > 1 ? 0.3 : -0.3);
  box(g, 0.22, 0.26, 0.1, solid([200, 168, 60]), 0.3, 1.3, 0.16);
  return null;
}

export function buildDoor(code, active) {
  R = mulberry32([...code].reduce((s, c) => s * 31 + c.charCodeAt(0), 7)); vary = makeVary(R);
  const g = new THREE.Group();
  const top = (BUILD[code] || BUILD['CL-RM'])(g);
  const swirl = opening(g, active);
  g.userData = { swirl, top };
  return g;
}
