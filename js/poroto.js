// Poroto: explorador de campo con forma de poroto. Gorro de lana con una pluma-brújula (apunta al
// ave que canta y toma el color de su clase), binoculares (los levanta al pasar el mouse por un ave),
// libreta (anota cada especie nueva), bufanda en invierno, estornudos en primavera, se abanica en
// verano y se duerme si lo dejas quieto.
/* global THREE */
import { mat, makeTex, makeVary, mulberry32, texPlain, steady } from './ps1.js';

const R = mulberry32(77);
const vary = makeVary(R);
const plain = texPlain();

export function buildPoroto() {
  const skin = makeTex(16, 16, () => vary([196, 150, 96], 8)); // color poroto
  const wool = makeTex(16, 16, (x, y) => vary(y % 4 < 2 ? [176, 56, 48] : [200, 80, 60], 8));
  const scarfTex = makeTex(16, 8, (x) => vary(x % 6 < 3 ? [60, 110, 180] : [230, 220, 200], 6));
  const eyeTex = makeTex(8, 8, (x, y) => (x >= 4 && x <= 5 && y >= 2 && y <= 3) ? [250, 250, 250] : [20, 18, 22]);
  const book = makeTex(8, 8, (x) => x === 0 ? [60, 40, 30] : vary([90, 140, 90], 6));
  const featherTex = makeTex(8, 24, (x, y) => {
    const w = 3.5 * Math.sin(Math.PI * y / 24);
    if (Math.abs(x - 3.5) > w) return [0, 0, 0, 0];
    return x === 3 || x === 4 ? [230, 230, 230] : [255, 255, 255];
  });

  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const mSkin = mat(skin);
  // cuerpo cápsula (poroto ligeramente curvo)
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6).scale(0.9, 1.25, 0.8).translate(0, 0.95, 0), mSkin);
  body.add(core);
  // ojos grandes
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 4).scale(1, 1.2, 0.5), mat(eyeTex));
    e.position.set(0.44, 1.25, s * 0.17); e.rotation.y = Math.PI / 2; body.add(e); eyes.push(e);
  }
  // gorro de lana + pompón
  const hat = new THREE.Group(); hat.position.set(0, 1.58, 0); body.add(hat);
  hat.add(new THREE.Mesh(new THREE.SphereGeometry(0.47, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 0.9), mat(wool)));
  const pom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0).translate(0, 0.42, 0), mat(plain, { tint: 0xf0e8d8 }));
  hat.add(pom);
  // pluma-brújula
  const featherPivot = new THREE.Group(); featherPivot.position.set(-0.2, 0.2, 0.2); hat.add(featherPivot);
  const featherMat = mat(featherTex, { alpha: 1, twoSided: true });
  const feather = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.7).translate(0, 0.35, 0), featherMat);
  feather.rotation.z = 0.5; featherPivot.add(feather);
  // brazos
  const arms = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(0.05, 1.05, s * 0.48); body.add(a);
    a.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.45, 4).translate(0, -0.22, 0), mSkin));
    arms.push(a);
  }
  // binoculares (cuelgan en el pecho; se levantan a los ojos)
  const bino = new THREE.Group(); bino.position.set(0.48, 0.85, 0); body.add(bino);
  const mBino = mat(plain, { tint: 0x2a2a30 });
  for (const s of [-1, 1]) bino.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.22, 5).rotateZ(Math.PI / 2).translate(0.05, 0, s * 0.09), mBino));
  // libreta (en la mano izquierda cuando anota)
  const notebook = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.22), mat(book));
  notebook.position.set(0.45, 0.7, -0.2); notebook.visible = false; body.add(notebook);
  const pencil = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 3), mat(plain, { tint: 0xe0c040 }));
  pencil.position.set(0.5, 0.78, -0.12); pencil.visible = false; body.add(pencil);
  // bufanda (invierno)
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.08, 4, 10).rotateX(Math.PI / 2).scale(1, 1, 0.9), mat(scarfTex));
  scarf.position.y = 1.08; body.add(scarf);
  // patitas
  const feet = [];
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.18).translate(0.06, 0.06, 0), mat(plain, { tint: 0x5a3a28 }));
    f.position.set(0, 0, s * 0.2); root.add(f); feet.push(f);
  }
  // mapa de papel: en las manos al consultarlo, y en el suelo como portal de viaje
  const mapTex = makeTex(32, 24, (x, y) => {
    if (x === 0 || y === 0 || x === 31 || y === 23) return [120, 92, 52];
    const cx = 3 + y * 1.1 + Math.sin(y * 0.9) * 1.5; // Chile en miniatura (franja diagonal)
    if (Math.abs(x - cx) < 1.6) return (x + y) % 5 === 0 ? [200, 150, 60] : [150, 110, 60];
    if (x > cx + 1.6) return vary([96, 140, 180], 6); // mar
    return vary([232, 216, 176], 6);
  });
  const mapMat = mat(mapTex, { twoSided: true });
  const mapMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.55), mapMat);
  mapMesh.position.set(0.62, 1.05, 0); mapMesh.rotation.y = Math.PI / 2; mapMesh.visible = false; body.add(mapMesh);
  const groundMap = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.2).rotateX(-Math.PI / 2), mat(mapTex, { twoSided: true }));
  groundMap.visible = false;
  const shadowTex = makeTex(16, 16, (x, y) => [18, 22, 14, Math.hypot(x - 7.5, y - 7.5) < 7.5 ? 170 : 0]);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.0).rotateX(-Math.PI / 2), mat(shadowTex, { alpha: 2 }));

  steady(root);
  body.scale.setScalar(1.1);
  const P = {
    root, shadow, pos: new THREE.Vector3(), heading: 0, target: null, speed: 3.2,
    state: 'idle', t: 0, idleFor: 0, look: null, binoc: 0, writing: 0, sneeze: 0, fan: 0,
    season: 'verano', featherTarget: null, onArrive: null,
  };

  P.setFeather = (color, targetPos) => {
    featherMat.uniforms.uTint.value.set(color || 0xffffff);
    P.featherTarget = targetPos || null;
  };
  P.holdMap = on => { P.mapHeld = on; if (on) { P.target = null; P.state = 'idle'; P.idleFor = 0; } };
  // Viaje: deja el mapa en el suelo, salta encima y se "absorbe" en espiral. onDone al terminar.
  P.startTravel = (heightAt, onDone) => {
    const dir = new THREE.Vector3(Math.cos(P.heading), 0, -Math.sin(P.heading));
    const to = P.pos.clone().addScaledVector(dir, 1.5);
    to.y = heightAt(to.x, to.z);
    root.parent?.add(groundMap);
    groundMap.position.set(to.x, to.y + 0.05, to.z); groundMap.rotation.y = P.heading; groundMap.scale.setScalar(0.01);
    groundMap.visible = true; groundMap.material.uniforms.uFlash.value = 0;
    P.mapHeld = false; P.target = null; P.state = 'travel';
    P.travel = { t: 0, from: P.pos.clone(), to, onDone, done: false, heightAt };
  };
  P.walkTo = (v, onArrive) => { P.target = v.clone(); P.onArrive = onArrive || null; P.idleFor = 0; P.state = 'walk'; };
  P.write = () => { P.writing = 2.2; P.idleFor = 0; };

  P.update = (dt, heightAt, blocked) => {
    P.t += dt;
    if (P.travel) return travelStep(dt);
    shadow.visible = true;
    const bob = Math.sin(P.t * 12);
    let waddle = 0, sleep = false;
    if (P.state === 'walk' && P.target) {
      const d = P.target.clone().sub(P.pos); d.y = 0;
      const len = d.length();
      if (len < 0.1) {
        P.state = 'idle'; P.target = null;
        const cb = P.onArrive; P.onArrive = null; if (cb) cb();
      } else {
        d.multiplyScalar(Math.min(len, P.speed * dt) / len);
        const nx = P.pos.x + d.x, nz = P.pos.z + d.z;
        if (!blocked || !blocked(nx, nz)) { P.pos.x = nx; P.pos.z = nz; } else { P.state = 'idle'; P.target = null; }
        P.heading = Math.atan2(-d.z, d.x);
        waddle = bob;
      }
    } else {
      P.idleFor += dt;
      if (P.idleFor > 25 && P.writing <= 0) sleep = true;
      if (P.look) {
        const d = P.look.clone().sub(P.pos);
        const want = Math.atan2(-d.z, d.x);
        let dh = ((want - P.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        P.heading += dh * Math.min(1, dt * 5);
      }
    }
    P.pos.y = heightAt(P.pos.x, P.pos.z);
    root.position.copy(P.pos);
    root.rotation.y = P.heading;
    shadow.position.set(P.pos.x, P.pos.y + 0.03, P.pos.z);

    // animaciones
    body.rotation.x = waddle * 0.12;
    body.position.y = Math.abs(waddle) * 0.08;
    feet[0].position.x = waddle * 0.15; feet[1].position.x = -waddle * 0.15;
    const wantBino = P.binoc > 0 ? 1 : 0;
    bino.userData.k = (bino.userData.k ?? 0) + (wantBino - (bino.userData.k ?? 0)) * Math.min(1, dt * 8);
    const k = bino.userData.k;
    bino.position.set(0.48 + 0.08 * k, 0.85 + 0.42 * k, 0);
    arms.forEach((a, i) => { a.rotation.z = -1.3 * k - (P.fan > 0 && i === 1 ? 1.8 + Math.sin(P.t * 18) * 0.5 : 0); a.rotation.x = (i ? -1 : 1) * (0.15 + 0.4 * k); });
    // anotar
    P.writing = Math.max(0, P.writing - dt);
    notebook.visible = pencil.visible = P.writing > 0;
    if (P.writing > 0) { pencil.position.x = 0.5 + Math.sin(P.t * 30) * 0.05; body.rotation.z = -0.15; }
    else body.rotation.z = sleep ? -0.25 : 0;
    // mapa en las manos
    mapMesh.visible = !!P.mapHeld;
    if (P.mapHeld) { arms.forEach((a, i) => { a.rotation.z = -1.25; a.rotation.x = (i ? -1 : 1) * 0.5; }); mapMesh.rotation.z = Math.sin(P.t * 2) * 0.05; }
    // estación
    scarf.visible = P.season === 'invierno';
    const shiver = P.season === 'invierno' && P.state === 'idle' ? Math.sin(P.t * 50) * 0.015 : 0;
    core.position.x = shiver;
    P.fan = Math.max(0, P.fan - dt);
    P.sneeze = Math.max(0, P.sneeze - dt);
    const sq = P.sneeze > 0 ? 1 - 0.15 * Math.sin(Math.PI * P.sneeze / 0.6) : 1;
    body.scale.set(1.1 / sq ** 0.5, 1.1 * sq, 1.1 / sq ** 0.5);
    // ojos cerrados al dormir
    eyes.forEach(e => { e.scale.y = sleep ? 0.15 : 1; });
    // pluma: apunta hacia el ave que canta
    if (P.featherTarget) {
      const d = P.featherTarget.clone().sub(P.pos);
      const local = Math.atan2(-d.z, d.x) - P.heading;
      featherPivot.rotation.y = local; feather.rotation.z = 0.9 + Math.sin(P.t * 10) * 0.08;
    } else { featherPivot.rotation.y *= 0.9; feather.rotation.z = 0.5 + Math.sin(P.t * 2) * 0.05; }
    return { sleep };
  };

  function travelStep(dt) {
    const T = P.travel;
    T.t += dt;
    const t = T.t;
    const hy = T.heightAt(T.to.x, T.to.z);
    if (t < 0.5) { // el mapa se despliega en el suelo; Poroto se agacha
      groundMap.scale.setScalar(Math.max(0.01, t / 0.5));
      body.scale.set(1.15, 1.1 * (1 - 0.12 * Math.sin(Math.PI * t / 0.5)), 1.15);
      root.position.copy(P.pos);
    } else if (t < 1.1) { // salto
      const k = (t - 0.5) / 0.6;
      const p = T.from.clone().lerp(T.to, k);
      root.position.set(p.x, THREE.MathUtils.lerp(T.from.y, hy, k) + Math.sin(Math.PI * k) * 1.6, p.z);
      body.scale.setScalar(1.1);
    } else if (t < 2.0) { // se absorbe en espiral
      const k = (t - 1.1) / 0.9;
      root.position.set(T.to.x, hy - k * 0.2, T.to.z);
      root.rotation.y += dt * (6 + k * 30);
      body.scale.setScalar(Math.max(0.01, 1.1 * (1 - k)));
      groundMap.material.uniforms.uFlash.value = 0.35 * Math.sin(k * Math.PI);
    } else if (t < 2.4) { // el mapa se enrolla y desaparece
      groundMap.scale.setScalar(Math.max(0.01, 1 - (t - 2.0) / 0.4));
    } else if (!T.done) {
      T.done = true;
      groundMap.visible = false; groundMap.parent?.remove(groundMap);
      body.scale.setScalar(1.1);
      P.travel = null; P.state = 'idle';
      T.onDone?.();
    }
    shadow.visible = t < 1.1;
    shadow.position.set(root.position.x, (T.from.y) + 0.03, root.position.z);
    return { sleep: false };
  }

  // Rutinas de estación que el juego dispara de vez en cuando.
  P.seasonQuirk = () => {
    if (P.state !== 'idle' || P.writing > 0) return null;
    if (P.season === 'primavera') { P.sneeze = 0.6; return '¡Achís! (polen de primavera)'; }
    if (P.season === 'verano') { P.fan = 2; return 'Uf, qué calor…'; }
    if (P.season === 'invierno') return 'Brrr…';
    if (P.season === 'otoño') return 'Crunch, crunch: hojas secas.';
    return null;
  };

  return P;
}
