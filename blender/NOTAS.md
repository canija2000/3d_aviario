# Notas para modelar en Blender (agente + MCP)

Cómo trabajamos los modelos del Aviario 3D y qué aprendimos. Estilo objetivo: N64 / Ocarina of Time.

## Flujo

- Cada modelo es un **script reproducible** (`blender/<modelo>_build.py`) que se ejecuta en vivo por el MCP
  (`exec(open(...).read())`) o headless (`Blender --background --python ... -- --export models/x.glb`).
  El `.blend` es un resultado, no la fuente.
- **Verificar con imágenes después de cada paso**: `render_hoja.py` genera 4 vistas (frente, frente con
  lentes, lado, espalda). Ejecutar código sin mirar deriva en errores a los 3–4 pasos.
- **Medir, no suponer**: dimensiones de cada pieza, triángulos por objeto (`tri_count()`), simetría (p. ej.
  que ambos ojos midan lo mismo).
- **Antes de reconstruir, inspeccionar la escena**: si el usuario editó algo a mano (colores, piezas nuevas),
  llevarlo al script. `mat()` respeta el color de un material que ya existe.

## Presupuesto y forma (referencia N64)

- Personajes N64: ~300–800 triángulos (Mario 64 ≈ 750). Poroto lleva casco, mochila y binoculares:
  apuntar a ≤ ~1.800 visibles.
- **Piezas rígidas separadas por articulación** (brazo, mano, pata, gorro…): sin deformación de malla,
  cada pieza la mueve un solo "hueso". Coincide con cómo anima `js/poroto.js`.
- **Detalles pegados a la superficie** con perfil ">" (bigote, tirantes, correas): dos caras que se juntan
  en una arista hacia afuera, sin tubos flotantes ni geometría escondida.
- **Nada de caras escondidas**: omitir la cara de una caja pegada al cuerpo o tapada por otra pieza;
  fusionar volúmenes que se intersectan (unión booleana, como los cachetes con el cuerpo).
- Los detalles planos (cinturón, hebilla, flor del casco) van **pintados en la textura**, no modelados.

- **Volúmenes fundidos, no pegados**: el cuerpo es un campo de distancia (cápsula + cachetes + rostro +
  hombros) unido con *smooth-min*, y la malla es una grilla esférica proyectada sobre esa superficie.
  Así no quedan valles ni pliegues donde se juntan las bolas (la unión booleana dura sí los dejaba), y la
  misma función sirve para apoyar bigote, correas y ojos exactamente sobre la piel.

## Referencia: Darunia (OoT, ripeado, en el repo sin versionar)

- 414 triángulos en total; pocas caras grandes y planas: la silueta manda.
- La cara es un plano frontal con ojos, cejas y boca **pintados** (textura de 64×32).
- Hombros enormes que nacen arriba del torso; antebrazo más grueso que el brazo, que se abre hacia la mano
  sin articulación visible; pantorrillas anchas que se afinan al tobillo y pie casi plano.
- Texturas mínimas: la piel es una de 8×16 repetida en la mitad del modelo; hay 11 texturas de 8×8 a 64×32.
- El .obj no trae rig ni colores por vértice (se pierden al exportar desde el juego).

## Poroto N64 (blender/poroto_n64_build.py) — versión vigente

- 562 triángulos visibles. Cuerpo = octógono de 9 anillos (frente/costado/espalda por anillo), girado 22.5°
  para que el frente sea una cara plana con textura propia (64×32) y ojos pintados.
- Parpadeo/dormir: el juego cambia la textura de la cara por `models/poroto_cara_cerrada.png` (como OoT).
- Pintado en texturas (5 bits por canal, bilineal): cinturón y hebilla, tirantes, correa de binoculares,
  cinta y flor del casco, bolsillo de la mochila, tiras de la sandalia, lentes de los binoculares.
- Sombra horneada en colores por vértice (`Col`, AO de Cycles) → `COLOR_0` en el glb; en three.js usar
  `vertexColors: true` y multiplicar por la textura.

## Texturas y sombreado

- Texturas chicas: ideal ≤ 32×32 (la TMEM del N64 era de 4 KB), con **filtro bilineal**
  (`interpolation='Linear'`; lo opuesto al pixelado PS1).
- Sombreado Gouraud (smooth shading). Pendiente probar **colores por vértice** para sombras horneadas
  (bajo el ala del casco, bajo los cachetes) en vez de depender de la luz en tiempo real.
- Atlas de texturas cuando haya muchas piezas chicas.

## Fuentes

- Lecciones de un sistema multiagente sobre el MCP de Blender (verificación visual, tareas acotadas):
  https://devtalk.blender.org/t/3d-agent-blender-ai-assistant-built-a-multi-agent-system-on-top-of-blenders-mcp-and-python-api-and-sharing-architecture-learnings-for-the-lab-discussion/44260
- Guía de low poly estilo N64 (presupuesto, texturas 32–64 px, colores por vértice, piezas segmentadas):
  https://www.themorphicstudio.com/how-to-create-low-poly-n64-esque-art-in-blender/
- TMEM y formatos de textura del N64: https://www.moria.us/blog/2020/11/n64-part20-tmem-format-and-mip-maps
- Colores por vértice en SM64: https://www.smwcentral.net/?p=viewthread&t=70685
- Fast64 (exportador para decomps de SM64/OoT; referencia de cómo se preparan modelos N64 reales):
  https://github.com/Fast-64/fast64
- Qué hace bien y mal el MCP de Blender (bloqueos y low poly sí; topología de producción no):
  https://www.strayspark.studio/blog/blender-mcp-ai-assisted-3d-modeling-step-by-step-2026

## Aves: de ensamble a una sola pieza (acordado y hecho el 2026-10-01: js/bird1.js, todos los planes)

Diagnóstico (medido en Blender sobre las referencias): las aves de Poly Pizza y Half-Life 2 son **1 malla
continua con 1 textura**; las nuestras (PR #10) son ~12 piezas con 5–6 materiales: cabeza = otra esfera
encajada (pliegue y silueta de muñeco de nieve), pico = cono pegado, alas y cola = placas que sobresalen.
Mejorar las piezas sin cambiar la construcción no alcanza (mismo error que Poroto v1–v5).

Plan (igual que Poroto N64):
1. Una malla por especie generada en JS: loft desde la punta de la cola → cuerpo → cuello → cabeza → pico,
   secciones de 6–8 lados con ancho/alto por anillo según el plan; cabeza y cuello = anillos del mismo loft;
   pico = punta del loft (mandíbula inferior aparte, chica, para cantar).
2. Proporciones por especie desde AVONET (pico, cola, tarso) como hoy.
3. Una textura de 64×64 por especie pintada sobre esa malla: ojo, máscara, garganta y ala plegada pintados.
4. Animación sin cortar la pieza: cabeza y cola mueven solo sus vértices (pesos con mezcla en el cuello).
5. Alas: plegadas = pintadas en la textura; en vuelo aparecen planos de ala (solo al volar). Patas aparte.
6. ~120–180 triángulos por ave, sombra horneada (colores por vértice) como Poroto.
Orden: prototipo del plan paseriforme (chincol, zorzal, loica, diuca) comparado en docs/registro/aves.html
contra la versión actual; si se aprueba, extender a los otros planes con las siluetas ya estudiadas.
