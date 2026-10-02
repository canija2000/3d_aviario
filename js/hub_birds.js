// Aves que esperan junto a cada puerta del pasillo: dos especies emblemáticas de cada región (de su
// zona y hábitat, no necesariamente las más frecuentes). Las paletas son aproximadas, hechas a mano
// para estas especies (las de las regiones jugables siguen las paletas revisadas de sus escenas).
// Colores RGB por zona, como species.palette (ver js/bird.js).

export const HUB_BIRDS = {
  'CL-AP': [
    { sci: 'Eulidia yarrellii', palette: { head: [72, 104, 64], back: [80, 112, 64], back_dark: [48, 72, 40], belly: [232, 228, 216], flank: [200, 200, 184], throat: [200, 40, 120], wing: [72, 64, 72], tail: [56, 48, 56], beak: [24, 24, 24], legs: [40, 32, 32], eye: [16, 16, 16], accent: [216, 48, 136], accentWhere: 'gorguera' } },
    { sci: 'Fulica gigantea', palette: { head: [24, 24, 28], back: [40, 40, 44], back_dark: [24, 24, 28], belly: [56, 56, 60], flank: [40, 40, 44], throat: [32, 32, 36], wing: [36, 36, 40], tail: [24, 24, 28], beak: [200, 40, 40], legs: [200, 64, 48], eye: [180, 40, 40], accent: [232, 200, 120], accentWhere: 'frente' } },
  ],
  'CL-TA': [
    { sci: 'Conirostrum tamarugense', palette: { head: [104, 108, 116], back: [112, 116, 120], back_dark: [72, 76, 84], belly: [176, 176, 172], flank: [160, 156, 152], throat: [200, 120, 64], wing: [80, 84, 92], tail: [72, 76, 84], beak: [40, 40, 44], legs: [56, 56, 60], eye: [16, 16, 16], accent: [208, 128, 64], accentWhere: 'frente' } },
    { sci: 'Phoenicoparrus jamesi', palette: { head: [248, 216, 216], back: [248, 208, 208], back_dark: [24, 24, 24], belly: [248, 216, 216], flank: [240, 120, 140], throat: [248, 200, 200], wing: [232, 96, 112], tail: [24, 24, 24], beak: [232, 200, 64], legs: [208, 64, 72], eye: [64, 32, 32], accent: [224, 72, 96], accentWhere: 'pecho' } },
  ],
  'CL-AN': [
    { sci: 'Phoenicoparrus andinus', palette: { head: [240, 184, 192], back: [240, 176, 184], back_dark: [16, 16, 16], belly: [240, 192, 200], flank: [216, 88, 120], throat: [240, 176, 184], wing: [208, 64, 96], tail: [16, 16, 16], beak: [232, 208, 72], legs: [232, 200, 64], eye: [64, 40, 32], accent: [16, 16, 16], accentWhere: 'ala y cola' } },
    { sci: 'Sternula lorata', palette: { head: [32, 32, 36], back: [176, 184, 192], back_dark: [120, 128, 136], belly: [232, 232, 236], flank: [208, 212, 216], throat: [232, 232, 236], wing: [160, 168, 176], tail: [208, 212, 216], beak: [232, 192, 64], legs: [208, 160, 64], eye: [16, 16, 16], accent: [240, 240, 240], accentWhere: 'frente' } },
  ],
  'CL-AT': [
    { sci: 'Spheniscus humboldti', palette: { head: [40, 40, 44], back: [48, 52, 56], back_dark: [32, 32, 36], belly: [232, 232, 228], flank: [232, 232, 228], throat: [32, 32, 36], wing: [56, 60, 64], tail: [40, 40, 44], beak: [56, 48, 48], legs: [72, 56, 56], eye: [64, 48, 40], accent: [232, 232, 228], accentWhere: 'collar' } },
    { sci: 'Geositta maritima', palette: { head: [168, 152, 136], back: [176, 160, 140], back_dark: [128, 112, 96], belly: [224, 216, 200], flank: [208, 196, 176], throat: [232, 224, 212], wing: [160, 144, 124], tail: [72, 64, 56], beak: [48, 44, 40], legs: [56, 52, 48], eye: [16, 16, 16] } },
  ],
  'CL-CO': [
    { sci: 'Cyanoliseus patagonus', palette: { head: [96, 104, 72], back: [104, 112, 72], back_dark: [72, 80, 56], belly: [216, 184, 64], flank: [208, 168, 56], throat: [120, 120, 96], wing: [72, 104, 128], tail: [88, 104, 72], beak: [56, 56, 60], legs: [200, 188, 176], eye: [232, 232, 232], accent: [200, 56, 40], accentWhere: 'pecho' } },
    { sci: 'Rhodopis vesper', palette: { head: [104, 112, 88], back: [120, 128, 96], back_dark: [72, 80, 56], belly: [216, 208, 192], flank: [192, 160, 128], throat: [200, 56, 168], wing: [72, 64, 72], tail: [168, 104, 72], beak: [24, 24, 24], legs: [40, 32, 32], eye: [16, 16, 16], accent: [208, 64, 176], accentWhere: 'gorguera' } },
  ],
  'CL-VS': [
    { sci: 'Pelecanus thagus', palette: { head: [216, 216, 208], back: [48, 48, 48], back_dark: [32, 32, 32], belly: [72, 72, 80], flank: [40, 40, 48], throat: [24, 24, 24], wing: [104, 104, 112], tail: [16, 16, 16], beak: [136, 64, 16], legs: [128, 128, 136], eye: [88, 80, 88], pattern: { flank: 'barred', wing: 'barred' } } },
    { sci: 'Patagona gigas', palette: { head: [56, 56, 56], back: [48, 56, 48], back_dark: [32, 40, 32], belly: [168, 128, 96], flank: [144, 112, 104], throat: [144, 128, 104], wing: [88, 72, 64], tail: [40, 48, 48], beak: [96, 112, 96], legs: [104, 72, 56], eye: [40, 40, 32] } },
  ],
  'CL-RM': [
    { sci: 'Pteroptochos megapodius', palette: { head: [96, 80, 72], back: [80, 72, 64], back_dark: [104, 64, 48], belly: [104, 72, 64], flank: [56, 24, 24], throat: [120, 80, 64], wing: [136, 88, 64], tail: [32, 16, 16], beak: [56, 48, 40], legs: [72, 56, 64], eye: [16, 16, 16], accent: [224, 160, 128], accentWhere: 'bigote', pattern: { belly: 'barred', flank: 'barred' } } },
    { sci: 'Sturnella loyca', palette: { head: [72, 72, 88], back: [24, 24, 24], back_dark: [8, 8, 8], belly: [128, 16, 0], flank: [0, 0, 0], throat: [248, 112, 48], wing: [32, 24, 16], tail: [80, 64, 56], beak: [168, 160, 160], legs: [96, 88, 88], eye: [40, 32, 32], accent: [224, 64, 24], accentWhere: 'pecho', pattern: { back: 'streaked', wing: 'streaked' } } },
  ],
  'CL-LI': [
    { sci: 'Vanellus chilensis', palette: { head: [64, 64, 72], back: [56, 48, 48], back_dark: [24, 24, 24], belly: [112, 112, 112], throat: [88, 88, 88], wing: [40, 40, 32], tail: [24, 24, 24], beak: [168, 120, 136], legs: [176, 112, 120], eye: [176, 40, 40], accent: [16, 16, 16], accentWhere: 'pecho' } },
    { sci: 'Phytotoma rara', palette: { head: [160, 64, 40], back: [104, 96, 72], back_dark: [56, 48, 40], belly: [176, 88, 56], flank: [152, 112, 80], throat: [184, 96, 64], wing: [64, 56, 48], tail: [80, 64, 48], beak: [56, 56, 56], legs: [56, 52, 48], eye: [200, 40, 32], pattern: { back: 'streaked' } } },
  ],
  'CL-ML': [
    { sci: 'Pteroptochos castaneus', palette: { head: [88, 72, 64], back: [80, 64, 56], back_dark: [56, 40, 32], belly: [160, 72, 40], flank: [120, 56, 40], throat: [168, 80, 48], wing: [96, 72, 56], tail: [48, 32, 24], beak: [48, 40, 36], legs: [64, 56, 56], eye: [16, 16, 16], accent: [168, 80, 48], accentWhere: 'frente', pattern: { belly: 'barred' } } },
    { sci: 'Enicognathus leptorhynchus', palette: { head: [72, 120, 56], back: [64, 112, 48], back_dark: [40, 80, 32], belly: [88, 128, 64], flank: [72, 112, 56], throat: [88, 128, 64], wing: [56, 104, 56], tail: [152, 48, 40], beak: [72, 64, 64], legs: [104, 96, 96], eye: [200, 120, 64], accent: [176, 48, 40], accentWhere: 'frente', pattern: { back: 'barred' } } },
  ],
  'CL-NB': [
    { sci: 'Campephilus magellanicus', palette: { head: [200, 32, 24], back: [24, 24, 28], back_dark: [12, 12, 16], belly: [24, 24, 28], flank: [24, 24, 28], throat: [200, 32, 24], wing: [24, 24, 28], tail: [16, 16, 20], beak: [96, 96, 104], legs: [64, 64, 72], eye: [232, 200, 64], accent: [232, 232, 232], accentWhere: 'ala y cola' } },
    { sci: 'Strix rufipes', palette: { head: [120, 80, 48], back: [104, 72, 48], back_dark: [56, 40, 28], belly: [200, 168, 128], flank: [176, 136, 96], throat: [168, 128, 88], wing: [112, 80, 56], tail: [96, 64, 40], beak: [208, 192, 120], legs: [200, 152, 96], eye: [24, 16, 16], pattern: { belly: 'barred', back: 'spotted', wing: 'barred' } } },
  ],
  'CL-BI': [
    { sci: 'Colaptes pitius', palette: { head: [72, 64, 64], back: [112, 96, 72], back_dark: [56, 48, 40], belly: [216, 208, 184], flank: [200, 192, 168], throat: [216, 200, 160], wing: [104, 88, 64], tail: [72, 64, 56], beak: [48, 44, 44], legs: [96, 96, 88], eye: [216, 200, 96], pattern: { back: 'barred', belly: 'spotted', flank: 'barred' } } },
    { sci: 'Theristicus melanopis', palette: { head: [184, 128, 72], back: [128, 128, 120], back_dark: [72, 72, 72], belly: [56, 56, 60], flank: [104, 104, 100], throat: [24, 24, 24], wing: [88, 96, 96], tail: [40, 40, 44], beak: [40, 40, 44], legs: [208, 64, 72], eye: [200, 48, 40], accent: [216, 168, 104], accentWhere: 'pecho' } },
  ],
  'CL-AR': [
    { sci: 'Sephanoides sephaniodes', palette: { head: [216, 64, 40], back: [72, 112, 72], back_dark: [48, 72, 48], belly: [200, 192, 176], flank: [168, 160, 136], throat: [184, 176, 168], wing: [72, 64, 72], tail: [48, 64, 48], beak: [24, 24, 24], legs: [40, 32, 32], eye: [16, 16, 16], accent: [232, 80, 40], accentWhere: 'frente', pattern: { throat: 'spotted' } } },
    { sci: 'Aphrastura spinicauda', palette: { head: [32, 24, 24], back: [128, 88, 56], back_dark: [72, 48, 32], belly: [232, 228, 216], flank: [208, 200, 184], throat: [240, 236, 228], wing: [56, 40, 32], tail: [160, 96, 56], beak: [48, 44, 40], legs: [88, 80, 72], eye: [16, 16, 16], accent: [232, 200, 136], accentWhere: 'bigote' } },
  ],
  'CL-LR': [
    { sci: 'Scelorchilus rubecula', palette: { head: [104, 72, 48], back: [96, 72, 48], back_dark: [64, 48, 32], belly: [216, 216, 208], flank: [88, 72, 56], throat: [200, 88, 48], wing: [88, 64, 48], tail: [64, 48, 32], beak: [40, 36, 32], legs: [72, 64, 56], eye: [16, 16, 16], accent: [208, 96, 48], accentWhere: 'pecho', pattern: { belly: 'barred' } } },
    { sci: 'Cygnus melancoryphus', palette: { head: [16, 16, 16], back: [240, 240, 236], back_dark: [200, 200, 196], belly: [240, 240, 236], flank: [236, 236, 232], throat: [16, 16, 16], wing: [236, 236, 232], tail: [232, 232, 228], beak: [72, 80, 104], legs: [216, 160, 160], eye: [24, 24, 24], accent: [216, 40, 40], accentWhere: 'frente' } },
  ],
  'CL-LL': [
    { sci: 'Megaceryle torquata', palette: { head: [72, 104, 136], back: [88, 120, 152], back_dark: [48, 72, 96], belly: [176, 80, 48], flank: [168, 72, 40], throat: [240, 240, 236], wing: [72, 104, 136], tail: [64, 88, 112], beak: [40, 40, 44], legs: [56, 52, 52], eye: [16, 16, 16], accent: [240, 240, 236], accentWhere: 'collar' } },
    { sci: 'Tachyeres pteneres', palette: { head: [120, 120, 124], back: [96, 96, 104], back_dark: [64, 64, 72], belly: [224, 224, 224], flank: [104, 104, 112], throat: [128, 128, 132], wing: [88, 88, 96], tail: [64, 64, 72], beak: [232, 160, 48], legs: [216, 160, 64], eye: [120, 72, 40], pattern: { flank: 'barred' } } },
  ],
  'CL-AI': [
    { sci: 'Chloephaga picta', palette: { head: [216, 208, 160], back: [128, 120, 112], back_dark: [80, 72, 64], belly: [224, 220, 208], flank: [64, 64, 56], throat: [224, 220, 208], wing: [72, 72, 64], tail: [40, 40, 40], beak: [176, 184, 168], legs: [232, 208, 96], eye: [216, 208, 184], pattern: { flank: 'barred' } } },
    { sci: 'Vultur gryphus', palette: { head: [136, 88, 88], back: [32, 40, 40], back_dark: [24, 24, 24], belly: [32, 24, 32], flank: [24, 24, 32], throat: [120, 88, 80], wing: [208, 200, 192], tail: [24, 32, 32], beak: [216, 208, 192], legs: [16, 24, 24], eye: [56, 64, 80], accent: [240, 240, 232], accentWhere: 'collar', pattern: { wing: 'barred' } } },
  ],
  'CL-MA': [
    { sci: 'Spheniscus magellanicus', palette: { head: [152, 152, 152], back: [56, 56, 56], back_dark: [40, 40, 40], belly: [232, 232, 232], flank: [232, 232, 232], throat: [32, 32, 40], wing: [96, 96, 96], tail: [120, 112, 88], beak: [48, 44, 44], legs: [80, 64, 64], eye: [64, 56, 56], accent: [232, 232, 232], accentWhere: 'collar' } },
    { sci: 'Rhea pennata', palette: { head: [120, 120, 120], back: [112, 112, 112], back_dark: [80, 80, 80], belly: [120, 120, 120], flank: [80, 72, 64], throat: [144, 144, 128], wing: [104, 96, 96], tail: [104, 104, 104], beak: [168, 160, 128], legs: [104, 96, 96], eye: [104, 104, 104], pattern: { back: 'spotted', flank: 'spotted' } } },
  ],
};
