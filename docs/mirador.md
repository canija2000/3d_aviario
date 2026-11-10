# Mirador (binoculares de cartón)

`mirador.html` es el Aviario para la instalación de los binoculares: un teléfono dentro de dos tubos de
cartón y un Arduino Leonardo que hace de teclado USB. No se camina. Se elige una región y una de sus zonas
ya modeladas, uno queda de pie en el centro y gira.

## Qué muestra

- Datos de **un solo año** (`YEAR = '2024'` en `js/mirador.js`), mes a mes.
- Las aves destacadas de la zona están **fijas en un círculo** alrededor. Cada especie tiene su sector todo
  el año (las que nadan donde hay agua, las que se posan donde hay perchas); si ese mes no se registra, su
  lugar queda vacío.
- La **mira** toma el ave cuyo rumbo queda más cerca del centro: se marca con su color, canta y aparece su
  nombre y su clase (residente, visitante de verano, visitante de invierno).
- La **ficha** agrega nombre científico, región y lugar, en cuántos días de ese mes de 2024 se registró y
  la franja de los 12 meses.
- La **foto** se puntúa igual que en el Aviario y se guarda en el mismo álbum (`localStorage`), así que la
  libreta es compartida con `index.html`.
- La **brújula** muestra un punto por ave presente (relleno si ya está fotografiada) y hacia dónde quedan
  las otras zonas de la región.
- El mes avanza solo cada 75 s (`CFG.monthSeconds`), salvo mientras hay un ave en la mira.

## Controles

| Acción | Arduino | Teclado |
| --- | --- | --- |
| Girar / mirar arriba y abajo | mover los binoculares (giroscopio del teléfono) | flechas o arrastrar |
| Zoom; en el menú, mover la selección | rueda | Z / X (o rueda del mouse) |
| Foto; en el menú, elegir | FOTO, toque corto | Espacio (o clic) |
| Ficha del ave | INFO, toque corto | Enter |
| Mes siguiente (anterior) | INFO, mantener | M (N) |
| Volver al menú de zonas | FOTO, mantener | Esc |
| Libreta de la zona | mirar al suelo | L |
| Recentrar | | C |
| Uno o dos lentes | | B |
| Separación / tamaño de los lentes | | `[` `]` / `-` `=` |

El sketch está en el repositorio del curso: `arduino/binoculares_teclado/`.

## Montaje

- El Leonardo se conecta al teléfono con un cable OTG; el teléfono lo alimenta y recibe las teclas.
- El giroscopio solo funciona si la página se sirve por **HTTPS** (GitHub Pages sirve). En iPhone el
  permiso se pide al tocar EMPEZAR.
- En la pantalla de inicio se ajustan la separación y el tamaño de los lentes (en % del ancho de la
  pantalla) hasta que cada círculo quede centrado en su tubo. Queda guardado en el teléfono.
- Sin giroscopio (computador) la vista sube o baja sola hasta el ave elegida.

## Para probar

`mirador.html?auto&r=CL-LR&z=bosque&m=9` entra directo a una zona y un mes (0 = enero). `&mono` fuerza un
solo lente y `&bino` dos. En la consola, `M` es el estado y `dbg` trae `setMonth`, `enterZone`, etc.
