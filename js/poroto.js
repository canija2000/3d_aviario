// Poroto: explorador ovalado (modelo N64 hecho en Blender: blender/poroto_n64_build.py → models/poroto.glb).
// Salacot con flor, bigote, mochila con saco de dormir, binoculares (los levanta al pasar el mouse por un ave),
// libreta (anota cada especie nueva), bufanda en invierno, lentes de sol en verano, estornudos en primavera,
// se abanica en verano, parpadea, se duerme si lo dejas quieto y mira hacia el ave que canta.
/* global THREE */
import { mat, makeTex, makeVary, mulberry32, texPlain, steady } from './ps1.js';

const R = mulberry32(77);
const vary = makeVary(R);
const plain = texPlain();
const MODEL = 'models/poroto.glb';
const FACE_CLOSED = 'models/poroto_cara_cerrada.png';
const SCALE = 1; // el modelo viene en metros (≈1 m), igual que el mundo (js/scale.js)

function loadGLTF(url) {
  return new Promise((resolve, reject) => new THREE.GLTFLoader().load(url, resolve, undefined, reject));
}
function loadTexture(url) {
  return new Promise((resolve, reject) => new THREE.TextureLoader().load(url, resolve, undefined, reject));
}

// Materiales del glTF → shader del juego (luz, niebla y trama compartidas), sin temblor ni deformación afín.
function toGameMaterials(scene) {
  const cache = new Map();
  scene.traverse(o => {
    if (!o.isMesh) return;
    const src = o.material;
    const key = src.uuid;
    if (!cache.has(key)) {
      const map = src.map || plain;
      if (src.map) { map.magFilter = THREE.LinearFilter; map.minFilter = THREE.LinearMipmapLinearFilter; } // bilineal + mipmaps, como el N64
      const tint = src.map ? 0xffffff : src.color.clone().convertLinearToSRGB();
      const m = mat(map, { tint, steady: true, perspective: true, vcol: o.geometry.attributes.color ? 0.45 : 0,
        twoSided: src.side === THREE.DoubleSide });
      m.name = src.name;
      cache.set(key, m);
    }
    o.material = cache.get(key);
  });
}

export async function loadPoroto() {
  const [gltf, faceClosed] = await Promise.all([loadGLTF(MODEL), loadTexture(FACE_CLOSED)]);
  faceClosed.flipY = false; // misma convención que las texturas del glTF
  faceClosed.magFilter = THREE.LinearFilter; faceClosed.minFilter = THREE.LinearMipmapLinearFilter;
  const model = gltf.scene;
  toGameMaterials(model);
  const N = name => model.getObjectByName(name);

  const root = new THREE.Group();
  root.add(model); model.scale.setScalar(SCALE);
  const body = N('cuerpo');
  const core = N('nucleo');
  const arms = [N('brazo_I'), N('brazo_D')];
  const armRest = arms.map(a => a.rotation.x);
  const feet = [N('pata_I'), N('pata_D')];
  const bino = N('binoculares');
  const binoRest = bino.position.clone();
  const notebook = N('libreta'), pencil = N('lapiz'), mapMesh = N('mapa_mano');
  const scarf = N('bufanda'), shades = N('lentes_sol');
  const pencilZ = pencil.position.z;
  notebook.visible = pencil.visible = mapMesh.visible = scarf.visible = shades.visible = false;
  let faceMat = null;
  core.traverse(o => { if (o.isMesh && o.material.name === 'n64_cara') faceMat = o.material; });
  if (!faceMat) model.traverse(o => { if (o.isMesh && o.material.name === 'n64_cara') faceMat = o.material; });
  const faceOpen = faceMat?.uniforms.map.value;

  // mapa de papel en el suelo (portal de viaje), procedural como antes
  const mapTex = makeTex(32, 24, (x, y) => {
    if (x === 0 || y === 0 || x === 31 || y === 23) return [120, 92, 52];
    const cx = 3 + y * 1.1 + Math.sin(y * 0.9) * 1.5; // Chile en miniatura (franja diagonal)
    if (Math.abs(x - cx) < 1.6) return (x + y) % 5 === 0 ? [200, 150, 60] : [150, 110, 60];
    if (x > cx + 1.6) return vary([96, 140, 180], 6); // mar
    return vary([232, 216, 176], 6);
  });
  const groundMap = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8).rotateX(-Math.PI / 2), mat(mapTex, { twoSided: true }));
  groundMap.visible = false;
  const shadowTex = makeTex(16, 16, (x, y) => [18, 22, 14, Math.hypot(x - 7.5, y - 7.5) < 7.5 ? 170 : 0]);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.6).rotateX(-Math.PI / 2), mat(shadowTex, { alpha: 2 }));

  steady(root);
  const P = {
    root, shadow, pos: new THREE.Vector3(), heading: 0, target: null, speed: 2.6,
    state: 'idle', t: 0, idleFor: 0, look: null, binoc: 0, writing: 0, sneeze: 0, fan: 0,
    season: 'verano', featherTarget: null, onArrive: null, blinkT: 3,
  };

  // Antes la pluma del gorro apuntaba al ave que canta; ahora Poroto gira el cuerpo hacia ella.
  P.setFeather = (color, targetPos) => { P.featherTarget = targetPos || null; };
  P.holdMap = on => { P.mapHeld = on; if (on) { P.target = null; P.state = 'idle'; P.idleFor = 0; } };
  // Viaje: deja el mapa en el suelo, salta encima y se "absorbe" en espiral. onDone al terminar.
  P.startTravel = (heightAt, onDone) => {
    const dir = new THREE.Vector3(Math.cos(P.heading), 0, -Math.sin(P.heading));
    const to = P.pos.clone().addScaledVector(dir, 1.0);
    to.y = heightAt(to.x, to.z);
    root.parent?.add(groundMap);
    groundMap.position.set(to.x, to.y + 0.05, to.z); groundMap.rotation.y = P.heading; groundMap.scale.setScalar(0.01);
    groundMap.visible = true; groundMap.material.uniforms.uFlash.value = 0;
    P.mapHeld = false; P.target = null; P.state = 'travel'; P.writing = 0;
    notebook.visible = pencil.visible = mapMesh.visible = false;
    P.travel = { t: 0, from: P.pos.clone(), to, onDone, done: false, heightAt };
  };
  P.walkTo = (v, onArrive) => { P.target = v.clone(); P.onArrive = onArrive || null; P.idleFor = 0; P.state = 'walk'; };
  P.write = () => { P.writing = 2.2; P.idleFor = 0; };

  const setEyes = closed => { if (faceMat) faceMat.uniforms.map.value = closed ? faceClosed : faceOpen; };

  P.update = (dt, heightAt, blocked) => {
    P.t += dt;
    if (P.travel) return travelStep(dt);
    shadow.visible = root.visible;
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
        const dh = ((want - P.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        P.heading += dh * Math.min(1, dt * 5);
      }
    }
    P.pos.y = heightAt(P.pos.x, P.pos.z);
    root.position.copy(P.pos);
    root.rotation.y = P.heading;
    shadow.position.set(P.pos.x, P.pos.y + 0.03, P.pos.z);

    // caminar: balanceo de lado a lado, saltito y pasos
    body.rotation.x = waddle * 0.1;
    body.position.y = Math.abs(waddle) * 0.035;
    feet[0].position.x = waddle * 0.07; feet[1].position.x = -waddle * 0.07;
    // binoculares: de colgar en el pecho a los ojos (girados hacia adelante)
    const wantBino = P.binoc > 0 ? 1 : 0;
    bino.userData.k = (bino.userData.k ?? 0) + (wantBino - (bino.userData.k ?? 0)) * Math.min(1, dt * 8);
    const k = bino.userData.k;
    bino.position.set(binoRest.x + 0.05 * k, binoRest.y + 0.31 * k, binoRest.z);
    bino.rotation.z = (Math.PI / 2) * k;
    arms.forEach((a, i) => {
      const s = i === 0 ? 1 : -1;
      a.rotation.x = armRest[i] + s * 0.9 * k;    // hacia adentro, para sostener los binoculares frente a los ojos
      a.rotation.z = 2.45 * k + (P.fan > 0 && i === 1 ? 1.6 + Math.sin(P.t * 18) * 0.5 : 0);
    });
    // anotar en la libreta
    P.writing = Math.max(0, P.writing - dt);
    notebook.visible = pencil.visible = P.writing > 0;
    if (P.writing > 0) {
      pencil.position.z = pencilZ + Math.sin(P.t * 30) * 0.02; body.rotation.z = -0.08;
      arms.forEach((a, i) => { a.rotation.z = 0.95; a.rotation.x = armRest[i] + (i === 0 ? 1 : -1) * 0.75; }); // sostiene la libreta
    }
    else body.rotation.z = sleep ? -0.2 : 0;
    // mapa en las manos
    mapMesh.visible = !!P.mapHeld;
    if (P.mapHeld) arms.forEach((a, i) => { a.rotation.z = 1.2; a.rotation.x = armRest[i] - (i === 0 ? 1 : -1) * 0.35; });
    // estación: bufanda en invierno (tirita), lentes de sol en verano
    scarf.visible = P.season === 'invierno';
    shades.visible = P.season === 'verano';
    core.position.x = P.season === 'invierno' && P.state === 'idle' ? Math.sin(P.t * 50) * 0.006 : 0;
    P.fan = Math.max(0, P.fan - dt);
    P.sneeze = Math.max(0, P.sneeze - dt);
    const sq = P.sneeze > 0 ? 1 - 0.15 * Math.sin(Math.PI * P.sneeze / 0.6) : 1;
    body.scale.set(1 / sq ** 0.5, sq, 1 / sq ** 0.5);
    // ojos: parpadeo cada pocos segundos; cerrados al dormir (cambio de textura, como en OoT)
    P.blinkT -= dt;
    if (P.blinkT < -0.12) P.blinkT = 2.5 + R() * 3;
    setEyes(sleep || P.blinkT < 0);
    // mira hacia el ave que canta girando el cuerpo (si no está ocupado mirando otra cosa)
    let turn = 0;
    if (P.featherTarget && !P.look && P.state === 'idle') {
      const d = P.featherTarget.clone().sub(P.pos);
      turn = ((Math.atan2(-d.z, d.x) - P.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      turn = Math.max(-0.7, Math.min(0.7, turn));
    }
    body.rotation.y += (turn - body.rotation.y) * Math.min(1, dt * 4);
    return { sleep };
  };

  function travelStep(dt) {
    const T = P.travel;
    T.t += dt;
    const t = T.t;
    const hy = T.heightAt(T.to.x, T.to.z);
    if (t < 0.5) { // el mapa se despliega en el suelo; Poroto se agacha
      groundMap.scale.setScalar(Math.max(0.01, t / 0.5));
      body.scale.set(1.05, 1 - 0.12 * Math.sin(Math.PI * t / 0.5), 1.05);
      root.position.copy(P.pos);
    } else if (t < 1.1) { // salto
      const k = (t - 0.5) / 0.6;
      const p = T.from.clone().lerp(T.to, k);
      root.position.set(p.x, THREE.MathUtils.lerp(T.from.y, hy, k) + Math.sin(Math.PI * k) * 0.9, p.z);
      body.scale.setScalar(1);
    } else if (t < 2.0) { // se absorbe en espiral
      const k = (t - 1.1) / 0.9;
      root.position.set(T.to.x, hy - k * 0.2, T.to.z);
      root.rotation.y += dt * (6 + k * 30);
      root.scale.setScalar(Math.max(0.01, 1 - k));
      groundMap.material.uniforms.uFlash.value = 0.35 * Math.sin(k * Math.PI);
    } else if (t < 2.4) { // el mapa se enrolla y desaparece
      groundMap.scale.setScalar(Math.max(0.01, 1 - (t - 2.0) / 0.4));
    } else if (!T.done) {
      T.done = true;
      groundMap.visible = false; groundMap.parent?.remove(groundMap);
      body.scale.setScalar(1); root.scale.setScalar(1);
      root.visible = false; // sigue "dentro del mapa" hasta aparecer en el destino (main.js lo vuelve a mostrar)
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
