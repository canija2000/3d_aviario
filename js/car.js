// La Citroneta de Poroto (Citroën 2CV, armada en Arica desde 1953): para recorrer el pasillo de Chile
// más rápido que corriendo. Modelo low poly hecho en código, con el techo de lona enrollado para que
// asome el salacot de Poroto. Mide ~2,6 m (un poco más chica que la real, a escala de Poroto).
/* global THREE */
import { mat, makeTex, makeVary, mulberry32 } from './ps1.js';

export const CAR = { maxSpeed: 10, turbo: 1.4, accel: 7, brake: 14, seatY: 0.3 };

export function buildCar(color = [128, 176, 204]) {
  const R = mulberry32(53), vary = makeVary(R);
  const g = new THREE.Group();
  const paint = makeTex(16, 16, (x, y) => vary(y % 8 === 0 ? color.map(v => v * 0.86) : color, 5));
  const hoodRibs = makeTex(16, 16, x => vary(x % 4 === 0 ? color.map(v => v * 0.78) : color, 4)); // capó acanalado
  const dark = makeTex(4, 4, () => vary([34, 34, 38], 4));
  const chrome = makeTex(4, 4, () => vary([208, 212, 216], 6));
  const canvas = makeTex(8, 8, (x, y) => vary(y % 2 ? [196, 188, 168] : [176, 168, 148], 5));
  const lamp = makeTex(4, 4, () => [255, 244, 200]);
  const M = { paint: mat(paint), hood: mat(hoodRibs, { rx: 2 }), dark: mat(dark), chrome: mat(chrome), canvas: mat(canvas), lamp: mat(lamp) };

  // carrocería: silueta lateral extruida (x = adelante), del zócalo a la línea de cintura
  const s = new THREE.Shape();
  s.moveTo(-1.25, 0.26); s.lineTo(1.18, 0.26); s.lineTo(1.3, 0.4);
  s.quadraticCurveTo(1.3, 0.58, 1.12, 0.62); // nariz redonda
  s.quadraticCurveTo(0.7, 0.7, 0.42, 0.8); // capó que sube al parabrisas
  s.lineTo(-0.85, 0.82);
  s.quadraticCurveTo(-1.22, 0.78, -1.3, 0.5); // cola caída
  s.lineTo(-1.25, 0.26);
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 1.2, bevelEnabled: false, curveSegments: 4 }).translate(0, 0, -0.6), M.paint);
  g.add(body);
  // capó acanalado encima de la nariz
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.03, 1.0), M.hood);
  hood.position.set(0.8, 0.705, 0); hood.rotation.z = -0.24; g.add(hood);
  // guardabarros redondos, más anchos que la carrocería
  for (const [x, z] of [[0.82, 0.6], [0.82, -0.6], [-0.86, 0.6], [-0.86, -0.6]]) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.2, 8, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(-Math.PI / 2), M.paint);
    f.position.set(x, 0.32, z + Math.sign(z) * 0.02); g.add(f);
  }
  // ruedas (se guardan para girarlas)
  const wheels = [];
  for (const [x, z] of [[0.82, 0.6], [0.82, -0.6], [-0.86, 0.6], [-0.86, -0.6]]) {
    const w = new THREE.Group(); w.position.set(x, 0.26, z);
    w.add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.16, 10).rotateX(Math.PI / 2), M.dark));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.17, 6).rotateX(Math.PI / 2), M.chrome);
    w.add(cap);
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.172), M.dark); w.add(spoke); // para que se note el giro
    g.add(w); wheels.push(w);
  }
  // focos redondos sobre una barra, parachoques y parrilla
  for (const z of [0.42, -0.42]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 8).rotateZ(Math.PI / 2), M.chrome);
    l.position.set(1.12, 0.74, z); g.add(l);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.085, 8).rotateY(Math.PI / 2), M.lamp);
    lens.position.set(1.195, 0.74, z); g.add(lens);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.84), M.chrome); bar.position.set(1.1, 0.68, 0); g.add(bar);
  for (const x of [1.33, -1.3]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 1.3), M.chrome); b.position.set(x, 0.32, 0); g.add(b);
  }
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.5), M.dark); grille.position.set(1.3, 0.5, 0); g.add(grille);
  // cabina: parabrisas (marco), pilares y lona enrollada atrás (techo abierto)
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.42), mat(makeTex(4, 4, () => [150, 190, 210])));
  glass.rotation.order = 'YXZ'; glass.rotation.set(-0.3, Math.PI / 2, 0); // mira adelante, inclinado hacia atrás
  glass.position.set(0.36, 1.0, 0); g.add(glass);
  for (const z of [0.56, -0.56]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), M.paint); p.position.set(0.36, 1.03, z); p.rotation.z = 0.3; g.add(p);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.05), M.paint); rail.position.set(-0.3, 1.25, z); g.add(rail);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 0.05), M.paint); post.position.set(-0.88, 1.03, z); g.add(post);
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 1.17), M.paint); top.position.set(0.28, 1.25, 0); g.add(top);
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.14, 8).rotateX(Math.PI / 2), M.canvas);
  roll.position.set(-0.8, 1.24, 0); g.add(roll);
  // asientos (se ven desde arriba) y volante
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 1.0), M.canvas); seat.position.set(-0.35, 0.78, 0); g.add(seat);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 4, 10), M.dark);
  wheel.position.set(0.2, 0.95, 0.25); wheel.rotation.y = Math.PI / 2; wheel.rotation.x = 0.5; g.add(wheel);
  // sombra simple
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.5).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
  shadow.position.y = 0.02; g.add(shadow);

  const state = { group: g, wheels, roll: 0, v: 0, bounce: 0 };
  // avanza la animación: ruedas según lo recorrido y un vaivén de suspensión blanda (la 2CV se mece)
  state.animate = (dt, v) => {
    state.roll += v * dt / 0.26;
    for (const w of wheels) w.rotation.z = -state.roll;
    state.bounce += dt * (4 + v * 0.6);
    const amp = Math.min(1, v / CAR.maxSpeed);
    body.position.y = Math.sin(state.bounce) * 0.015 * amp;
    g.rotation.z = Math.sin(state.bounce * 0.5) * 0.02 * amp - (state.accel || 0) * 0.004; // se empina al acelerar
  };
  return state;
}
