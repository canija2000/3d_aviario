// Carga de datos (generados por infovis_2026-2/python_scripts/build_game_data.py) y textos
// derivados: diálogo en primera persona de cada ave y cartel de bienvenida de la región.
// Nunca se comparan reportDays crudos entre años o regiones (ver SET_UP §4): se usan share,
// bestYear, topRegions y el perfil estacional.

// Copia local (scripts/sync_data.py). Cuando el repo principal publique los datos en Pages:
// 'https://canija2000.github.io/infovis_2026-2/data/game/' (y audio desde .../infovis_2026-2/).
export const DATA_BASE = 'data/game/';
export const AUDIO_BASE = '';

export const CLASS_COLORS = {
  residente: '#288665', visitante_estival: '#ee9b45', visitante_invernal: '#4a7fd0', ocasional: '#9a9aa6',
};
const CLASS_LABEL = {
  residente: 'residente', visitante_estival: 'visitante de verano',
  visitante_invernal: 'visitante de invierno', ocasional: 'ocasional',
};

// Voz de las especies destacadas: artículo y onomatopeya del saludo (el resto usa "¡Pío!").
// Qué especies aparecen en cada escena lo dice species.habitat.scenes = {región: escena}.
export const VOICE = {
  'Turdus falcklandii': { art: 'el', hi: '¡Chiuit chiuit!' },
  'Zonotrichia capensis': { art: 'el', hi: '¡Tiu tiu tiriú!' },
  'Troglodytes musculus': { art: 'el', hi: '¡Trrr-tiriri!' },
  'Zenaida auriculata': { art: 'la', hi: '¡Cu-cuuu!' },
  'Pteroptochos megapodius': { art: 'la', hi: '¡Hu-hu-hu-huuu!' },
  'Mimus thenca': { art: 'la', hi: '¡Chirivirí chirí!' },
  'Scelorchilus albicollis': { art: 'el', hi: '¡Tapa-tapa-culo!' },
  'Diuca diuca': { art: 'la', hi: '¡Diu-diu-diuca!' },
  'Vanellus chilensis': { art: 'el', hi: '¡Tero-tero-teru!' },
  'Sturnella loyca': { art: 'la', hi: '¡Tsi-trriii!' },
  'Oreotrochilus leucopleurus': { art: 'el', hi: '¡Tsip! ¡Tsip!' },
  'Muscisaxicola frontalis': { art: 'la', hi: '¡Tic… tic!' },
  'Pelecanus thagus': { art: 'el', hi: '(…silencio de pelícano…) ¡Gruac!' },
  'Larus dominicanus': { art: 'la', hi: '¡Kiau-kiau-kiau!' },
  'Haematopus palliatus': { art: 'el', hi: '¡Pli-pli-pilpilén!' },
  'Leucophaeus modestus': { art: 'la', hi: '¡Kruu-kruu!' },
  'Phalacrocorax brasilianus': { art: 'el', hi: '¡Groc!' },
  'Egretta thula': { art: 'la', hi: '¡Graaak!' },
  'Himantopus mexicanus': { art: 'el', hi: '¡Kek-kek-kek!' },
  'Anas georgica': { art: 'el', hi: '¡Cuac-cuac!' },
  'Phytotoma rara': { art: 'la', hi: '¡Rrraaa-ra!' },
  'Patagona gigas': { art: 'el', hi: '¡Tsuiip!' },
  'Callipepla californica': { art: 'la', hi: '¡Cu-cá-cou!' },
  'Anairetes parulus': { art: 'el', hi: '¡Tri-tri-tri!' },
  'Cathartes aura': { art: 'el', hi: '(los jotes no cantan: solo sisean) ¡Shhh!' },
  'Columbina picui': { art: 'la', hi: '¡Cuú-cuú!' },
  'Sephanoides sephaniodes': { art: 'el', hi: '¡Tsi-tsi-tsi!' },
  'Columba livia': { art: 'la', hi: '¡Gru-gruu!' },
};
export const MVP = VOICE; // compatibilidad

// Especies destacadas de una región: {sciName: escena}.
export function featuredIn(index, code) {
  const out = {};
  for (const sp of index.species) { const sc = sp.habitat?.scenes?.[code]; if (sc) out[sp.sciName] = sc; }
  return out;
}

export async function loadJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

export async function loadWorld() {
  const index = await loadJSON(DATA_BASE + 'index.json');
  index.byId = new Map(index.species.map(s => [s.id, s]));
  index.bySci = new Map(index.species.map(s => [s.sciName, s]));
  return index;
}

export async function loadRegion(index, code) {
  const meta = index.regions.find(r => r.code === code);
  const [region, terrain] = await Promise.all([
    loadJSON(DATA_BASE + meta.file),
    meta.terrainFile ? loadJSON(DATA_BASE + meta.terrainFile) : null,
  ]);
  return { meta, region, terrain };
}

export const presentIn = (sp, m) => ((sp.monthsPresent >> m) & 1) === 1;

// Frecuencia (‰ de días con registro) del año típico en la región; si la especie no está entre
// las 40 más frecuentes del mes se usa un valor bajo, para que igual aparezca a veces.
export function freqOf(region, sid, m) {
  const e = region.typical[m].find(r => r[0] === sid);
  return e ? e[2] : 120;
}

function monthsRange(sp, months) {
  const on = [...Array(12).keys()].filter(m => presentIn(sp, m));
  if (on.length >= 12) return null;
  // primer mes de la racha (circular) y último
  const start = on.find(m => !presentIn(sp, (m + 11) % 12));
  let end = start;
  while (presentIn(sp, (end + 1) % 12)) end = (end + 1) % 12;
  return [months[start], months[end]];
}

const DIET = {
  'invertebrados': 'bichitos: insectos, arañas y larvas', 'semillas': 'semillas', 'fruta/néctar': 'néctar de flores y algún insecto',
  'omnívoro': 'de todo un poco', 'vertebrados/peces/carroña': 'animalitos más grandes',
};

export function birdDialog(index, sp, regionId) {
  const mv = VOICE[sp.sciName] || { art: '', hi: '¡Pío!' };
  const months = index.months;
  const cls = sp.regionalClass[String(regionId)] || sp.class;
  const lines = [];
  lines.push(`${mv.hi} Soy ${mv.art ? mv.art + ' ' : ''}<b>${sp.comName}</b>.`);
  if (cls === 'residente') lines.push('Aquí vivo todo el año: soy <b>residente</b>.');
  else {
    const r = monthsRange(sp, months);
    lines.push(`Soy <b>${CLASS_LABEL[cls]}</b>${r ? `: vuelvo cada año entre ${r[0]} y ${r[1]}` : ''}.`);
  }
  lines.push(`Mi mes favorito es <b>${months[sp.peakMonth]}</b>.`);
  const top = index.regions.find(r => r.id === sp.topRegions[0]);
  if (top) lines.push(top.id === regionId ? 'Y donde más me registran en Chile es justo aquí.'
    : `Donde más me registran es en <b>${top.name}</b>.`);
  if (sp.bestYear) lines.push(`En ${sp.bestYear} me registraron más que nunca en relación con las demás aves.`);
  const mo = sp.morphology;
  if (mo) {
    const bits = [];
    if (mo.mass) bits.push(`peso unos ${Math.round(mo.mass)} gramos`);
    if (mo.diet) bits.push(`como ${DIET[mo.diet] || mo.diet}`);
    if (bits.length) lines.push(`Por si te lo preguntabas: ${bits.join(' y ')}.`);
  }
  return lines.join(' ');
}

export function welcomeText(index, meta, month, yearLabel = 'año típico') {
  const name = id => index.byId.get(id)?.comName;
  const ms = meta.months[month];
  const res = meta.topResidents.slice(0, 3).map(name).filter(Boolean);
  const vis = (ms.visitante_estival >= ms.visitante_invernal ? meta.topSummer : meta.topWinter)
    .map(id => index.byId.get(id)).filter(s => s && presentIn(s, month)).slice(0, 3).map(s => s.comName);
  const car = meta.characteristic.slice(0, 2).map(name).filter(Boolean);
  const art = /^Metropolitana$/.test(meta.name) ? 'la ' : ''; // "la Metropolitana", pero "Valparaíso"
  let t = `Bienvenido a ${art}<b>${meta.name}</b>, ${yearLabel}. En ${index.months[month]} se registran unas <b>${ms.richness}</b> especies. `;
  t += `Nuestros residentes más vistos son ${list(res)}. `;
  if (vis.length) t += `Este mes nos visitan ${list(vis)}. `;
  if (car.length) t += `Y si tienes suerte, verás a ${list(car)}, más propios de aquí que del resto del país.`;
  return t;
}

const list = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1];

export { CLASS_LABEL };
