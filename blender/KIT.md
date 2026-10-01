# Kit de piezas para Blender (estilo N64)

Piezas que JS reparte sobre el terreno de cada escena (`js/scene.js`, catálogos `data/game/props-*.json`).
Cada pieza se hace una vez con script (como `poroto_n64_build.py`) y se exporta a `models/kit/<id>.glb`;
las variantes salen de recolorear o escalar la misma malla. Medidas en metros (ver `js/scale.js`).

**Presupuesto por pieza** (referencia: árboles de HP/Re-Volt 63–138 tris, aves de Zelda/Mario & Luigi 80–120):
árbol 80–160 · arbusto 30–80 · roca 12–40 · pasto/junco 4–16 (tarjetas con transparencia) · casa 60–150 · ave 80–200.

Referencias disponibles: `assets/referencias/` (índice en `assets/referencias/INDEX.md`, solo local).

## Prioridad 1 — sirven en las 3 regiones jugables

| id | qué es | dónde | alto | tris | cómo construirlo | referencia que tenemos |
|---|---|---|---|---|---|---|
| `roca` (+ `roca_cerro`, `roca_andina`, `roca_costa`, `bolones`) | roca facetada, 3 variantes de forma | todas | 0,6–1,6 | 12–40 | icoesfera deformada a mano, textura 32×32 con vetas | — (falta) |
| `arbol_copa` → `quillay`, `peumo`, `litre`, `pimiento`, `platano_oriental`, `maiten` | árbol de copa redonda: tronco 6 lados + 2–3 masas de hojas | RM, VS | 4,5–11 | 100–160 | masas de hojas = poliedros bajos con textura de hojas con transparencia en los bordes; recolor por especie | HP Maple Tree (71), Re-Volt Trees (129–138) |
| `espino` | acacia de copa plana y ramas en abanico | RM, VS | 3,5 | 80–120 | tronco torcido + copa aplanada en capas | **FeralHeart Acacia Tree** (948, reducir) |
| `arbusto` → `boldo`, `zarzamora`, `mata_negra`, `calafate`, `hierba_blanca` | mata redonda | todas | 0,8–2,4 | 30–80 | 1–3 bultos bajos; calafate con bayas pintadas | Swamp Bush (64), FeralHeart Bush (414) |
| `pasto` → `coiron`, `cesped`, `pradera` | mechón de pasto | todas | 0,3–0,8 | 4–12 | 2–3 tarjetas cruzadas con transparencia | HP Grass (4) |
| `letrero` | letrero de sendero (ya existe en JS) | todas | 1,8 | 20–30 | poste + tablero, texto en textura | — (falta: letreros de OoT) |

## Prioridad 2 — una o dos regiones

| id | qué es | dónde | alto | tris | cómo construirlo | referencia que tenemos |
|---|---|---|---|---|---|---|
| `palma_chilena` | tronco grueso abombado + corona de hojas | RM, VS | 9 | 80–140 | tronco 6 lados con barriga; 8–10 hojas planas curvas | — (falta: palmeras low-poly) |
| `eucalipto` | árbol alto y esbelto, copa rala | VS | 15 | 100–160 | tronco claro + 3 masas alargadas | LBP Tall Tree (724, reducir) |
| `sauce_chileno` | copa columnar | RM, VS | 8 | 80–120 | cono de hojas sobre tronco | — (falta) |
| `lenga`, `nirre` | Nothofagus: copas en capas horizontales; rojo en otoño | MA | 4–11 | 100–160 | capas aplanadas de hojas | HP Birch Trees (63–90) |
| `quisco` | cactus columnar con brazos | RM, VS | 2,2 | 30–60 | prismas de 6–8 lados con espinas pintadas | — (falta: cactus) |
| `chagual` | roseta de hojas duras + vara floral turquesa | VS | 2,8 | 40–80 | roseta de tarjetas + vara | — (falta: puya / agave) |
| `totora` | juncos de humedal | RM, VS | 2,0 | 8–16 | tarjetas cruzadas | HP Grass (como base) |
| `doca`, `llareta` | cojín rastrero (doca con flor fucsia, llareta verde compacta) | VS, RM, MA | 0,25–0,5 | 20–40 | domo bajo con textura | Pikmin 2 Clover (276, como idea de cubresuelo) |
| `flores_altura` | flores sueltas (añañuca, azulillo) | RM | 0,35 | 8–16 | tarjetas con flor pintada | Sims 4 Pink Azalea (289, reducir) |
| `casa_color` | casa de chapa de colores de Valparaíso / casa austral | VS, MA | 6 ancho | 60–150 | caja + techo a dos aguas; puerta y ventanas pintadas; 4–6 colores | — (falta: casas de Kakariko/OoT) |
| `edificio` | bloque urbano de fondo | RM | 9 ancho | 12–30 | caja con ventanas pintadas (solo se ve de lejos) | — |
| `banca_farol` | banca de plaza + farol | RM, VS | 3,2 | 40–70 | piezas simples | — (falta: mobiliario de Hyrule Market) |
| `muelle` | muelle de madera con pilotes | MA | 1,6 | 40–80 | tablones + pilotes 4 lados | — |
| `tronco_caido`, `madriguera` | tronco de lenga en el suelo; cueva de pingüino | MA | 0,4–0,8 | 20–40 | prisma / domo con hueco pintado | — |

## Aves — planes de cuerpo (`js/bird.js`), una malla por plan y la paleta por especie

Una malla base por plan; la especie cambia paleta (textura), proporciones (pico, cola, patas) y escala.

| plan | especies típicas (familias con más especies en los datos) | tris | referencia que tenemos |
|---|---|---|---|
| `paseriforme` | fíos-fíos, chincol, zorzal, diucas (Tyrannidae 49, Thraupidae 36, Furnariidae 33) | 80–120 | **Four Swords Bird (120)**, Mario & Luigi Birds (80), Window Bird (81), MK8 Sparrow (230) |
| `cola_alta` | chucao, turca, chercán | 80–120 | (base paseriforme) |
| `paloma` | tórtola, torcaza | 100–160 | HL2 Pigeon (540, reducir) |
| `gaviota` | gaviotas, petreles, albatros (Laridae 29, Procellariidae 31) | 100–160 | HL2 Seagull (470, reducir) |
| `pinguino` | pingüinos | 100–160 | Zoo Tycoon 2 Emperor Penguin (1154) y cría (780) |
| `flamenco` | flamencos | 120–180 | Zoo Tycoon 2 Greater Flamingo (1027) |
| `garza` | garzas | 120–180 | Secretary Bird (940, patas y cuello) |
| `pato`, `cisne` | patos, cisnes (Anatidae 43) | 100–160 | — (falta) |
| `playero` | playeros, chorlos, queltehue (Scolopacidae 34, Charadriidae 13) | 80–120 | — (falta) |
| `rapaz` | aguilucho, tiuque, cernícalo, búhos (Accipitridae 15, Falconidae 7, Strigidae 7) | 120–180 | — (falta: Kaepora Gaebora de OoT sirve) |
| `pelicano`, `cormoran` | pelícano, yeco | 120–180 | — (falta) |
| `picaflor` | picaflores (Trochilidae 10) | 60–100 | — (falta) |
| `loro`, `carpintero`, `codorniz`, `nandu` | choroy, carpintero negro, codorniz, ñandú | 80–180 | — (falta) |

## Qué conviene buscar

Lo que más se repite y no tiene referencia todavía, en orden:

1. **Rocas** estilo N64 (OoT: Campo de Hyrule, Montaña de la Muerte).
2. **Casas** low-poly de pueblo (OoT: Kakariko; Majora's Mask: Ciudad Reloj) → casas de Valparaíso.
3. **Palmera** y **cactus columnar** low-poly.
4. **Letrero**, **banca** y **farol** (OoT: Mercado de Hyrule).
5. Aves: **pato**, **playero**, **rapaz/búho** (Kaepora Gaebora), **picaflor**, **pelícano**.
6. Juncos o **totora**, y una **puya/agave** para el chagual.

Fuentes útiles: The Models Resource (secciones N64/GameCube), que es de donde salieron las actuales.
