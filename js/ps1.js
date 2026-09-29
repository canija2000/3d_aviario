// Núcleo estilo PS1, extraído de ref/chucao.html: shader (vértices que tiemblan, texturas afines,
// color de 15 bits con trama, niebla), texturas pintadas píxel a píxel y RNG con semilla.
/* global THREE */

export const shared = {
  uSnap: { value: new THREE.Vector2(160, 120) },
  uJitter: { value: 1 }, uAffine: { value: 1 }, uDither: { value: 1 },
  uLightDir: { value: new THREE.Vector3(0.4, 1, 0.3).normalize() },
  uLightCol: { value: new THREE.Color(0xe8d8b0) },
  uAmb: { value: new THREE.Color(0x6a7466) },
  uFogColor: { value: new THREE.Color(0x2b3527) },
  uFogNear: { value: 14 }, uFogFar: { value: 46 },
  uSnow: { value: 0 },
};

const VS = `
  uniform vec2 uSnap; uniform float uJitter; uniform float uAffine;
  uniform vec3 uLightDir; uniform vec3 uLightCol; uniform vec3 uAmb;
  uniform float uFogNear; uniform float uFogFar; uniform vec2 uRepeat; uniform float uTwoSided;
  varying vec3 vUvw; varying vec3 vLight; varying float vFog; varying float vUp;
  void main() {
    vec4 local = vec4(position, 1.0);
    vec3 nrm = normal;
    #ifdef USE_INSTANCING
      local = instanceMatrix * local;
      nrm = mat3(instanceMatrix) * nrm;
    #endif
    vec4 mv = modelViewMatrix * local;
    vec4 p = projectionMatrix * mv;
    if (uJitter > 0.5) {
      vec2 ndc = p.xy / p.w;
      ndc = floor(ndc * uSnap + 0.5) / uSnap;
      p.xy = ndc * p.w;
    }
    vec3 n = normalize(normalMatrix * nrm);
    vUp = normalize(mat3(modelMatrix) * nrm).y;
    float d = dot(n, uLightDir);
    d = uTwoSided > 0.5 ? abs(d) : max(d, 0.0);
    vLight = uAmb + uLightCol * d;
    float w = uAffine > 0.5 ? p.w : 1.0;
    vUvw = vec3(uv * uRepeat * w, w);
    vFog = clamp((-mv.z - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
    gl_Position = p;
  }`;
const FS = `
  uniform sampler2D map; uniform vec3 uTint; uniform float uDither; uniform vec3 uFogColor;
  uniform float uAlphaMode; uniform float uSnow; uniform float uSnowable; uniform float uFlash;
  varying vec3 vUvw; varying vec3 vLight; varying float vFog; varying float vUp;
  float b2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
  float bayer(vec2 a) { return b2(0.5 * a) * 0.25 + b2(a); }
  void main() {
    vec4 t = texture2D(map, vUvw.xy / vUvw.z);
    float th = bayer(gl_FragCoord.xy);
    if (uAlphaMode > 1.5) { if (t.a < th * 0.94 + 0.03) discard; }
    else if (uAlphaMode > 0.5) { if (t.a < 0.5) discard; }
    vec3 base = t.rgb * uTint;
    if (uSnowable > 0.5) base = mix(base, vec3(0.93, 0.95, 1.0), uSnow * smoothstep(0.55, 0.9, vUp) * step(th, 0.85));
    vec3 c = base * vLight + uFlash;
    c = mix(c, uFogColor, vFog);
    if (uDither > 0.5) { c += (th - 0.47) / 20.0; c = floor(c * 31.0 + 0.5) / 31.0; }
    gl_FragColor = vec4(c, 1.0);
  }`;

export function mat(tex, o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      map: { value: tex },
      uTint: { value: new THREE.Color(o.tint ?? 0xffffff) },
      uRepeat: { value: new THREE.Vector2(o.rx ?? 1, o.ry ?? 1) },
      uAlphaMode: { value: o.alpha ?? 0 },
      uTwoSided: { value: o.twoSided ? 1 : 0 },
      uSnowable: { value: o.snowable ? 1 : 0 },
      uFlash: { value: 0 },
    },
    vertexShader: VS, fragmentShader: FS,
    side: o.twoSided ? THREE.DoubleSide : THREE.FrontSide,
  });
}

export function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function makeVary(R) {
  return (c, n) => { const k = (R() * 2 - 1) * n; return [c[0] + k, c[1] + k * 0.9, c[2] + k * 0.75]; };
}

export function makeTex(w, h, fn) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'); const im = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = fn(x, y); const i = (y * w + x) * 4;
    for (let k = 0; k < 3; k++) im.data[i + k] = Math.max(0, Math.min(248, Math.round(c[k] / 8) * 8)); // 5 bits por canal
    im.data[i + 3] = c[3] ?? 255;
  }
  g.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export const texPlain = () => makeTex(4, 4, () => [255, 255, 255]);

// Proyección lateral de UV (u = eje x, v = eje y), como en el prototipo.
export function sideUV(geo) {
  geo.computeBoundingBox();
  const b = geo.boundingBox, p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - b.min.x) / (b.max.x - b.min.x), (p.getY(i) - b.min.y) / (b.max.y - b.min.y));
  uv.needsUpdate = true;
  return geo;
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);
  return renderer;
}

// Resolución interna baja (≈240 líneas) escalada a pantalla completa con pixelated.
export function fitRenderer(renderer, camera, lines = 240) {
  const aspect = window.innerWidth / window.innerHeight;
  const h = lines, w = Math.round(h * aspect);
  renderer.setSize(w, h, false);
  shared.uSnap.value.set(w / 2, h / 2);
  camera.aspect = aspect; camera.updateProjectionMatrix();
}
