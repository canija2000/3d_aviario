// Tabla de escala del mundo (estilo Ocarina of Time): 1 unidad = 1 metro.
// Poroto mide ~1 m (models/poroto.glb ya viene en metros). Las aves y la vegetación siguen proporciones
// reales, con dos licencias de diseño: las aves se exageran con un mismo factor para que se lean junto a
// Poroto, y los árboles se estilizan un poco más bajos que en la realidad para que quepan en cámara.

// Aves: largo real estimado desde la masa (morphology.scale = raíz cúbica de la masa relativa al chucao,
// cuyo largo es ~0,26 m) × exageración. El modelo de bird.js mide ~3,6 unidades de pico a cola a escala 1.
export const BIRD_REF_LENGTH = 0.26;
export const BIRD_EXAGGERATION = 1.75;
export const BIRD_MODEL_LENGTH = 3.6;
export const BIRD_PICK_RADIUS = 0.35; // radio mínimo (m) del área para hacer clic en un ave

export function birdScale(sp) {
  const len = BIRD_REF_LENGTH * (sp.morphology?.scale ?? 1) * BIRD_EXAGGERATION;
  return Math.max(0.05, Math.min(0.8, len / BIRD_MODEL_LENGTH));
}

// Altura objetivo (m) de cada prop de scene.js. El factor de escala se calcula contra su altura actual
// (el valor `perch` del catálogo, o `natural` si no tiene percha). Edificios: ancho objetivo en `width`.
export const PROP_SIZE = {
  platano_oriental: 11, palma_chilena: 9, pimiento: 6.5, quillay: 8, litre: 4.5, peumo: 8, maiten: 7,
  sauce_chileno: 8, espino: 3.5, boldo: 2.4, zarzamora: 1.3, quisco: 2.2, eucalipto: 15, lenga: 11, nirre: 4,
  calafate: 1.5, mata_negra: 0.9, hierba_blanca: 0.8, chagual: 2.8,
  roca: 1.0, roca_cerro: 1.6, bolones: 0.6, roca_andina: 1.4, roca_costa: 1.6, llareta: 0.5,
  coiron: { natural: 0.8, h: 0.7 }, totora: { natural: 1.8, h: 2.0 }, flores_altura: { natural: 0.5, h: 0.35 },
  doca: { natural: 0.2, h: 0.25 }, madriguera: { natural: 0.25, h: 0.4 }, tronco_caido: { natural: 0.55, h: 0.8 },
  banca_farol: 3.2, muelle: 1.6,
  edificio: { width: 9 }, casa_color: { width: 6 },
};

export function propFactor(id, kind) {
  const t = PROP_SIZE[id];
  if (t == null) return 1;
  if (typeof t === 'number') return kind.perch ? t / kind.perch : 1;
  if (t.width) return t.width / (id === 'edificio' ? 1.8 : 1.6);
  return t.h / t.natural;
}

// Relieve máximo de una escena (m): colinas caminables, no cerros.
export const MAX_RELIEF = 8;

// Cámara en tercera persona, cercana a Poroto.
export const CAMERA = {
  scene: { dist: 6.5, pitch: 0.55 }, hub: { dist: 12, pitch: 0.7 },
  minDist: 3, maxDist: 16, targetY: 0.55,
};
export const PORORO_BUBBLE_Y = 1.45; // altura del globito de diálogo sobre los pies
