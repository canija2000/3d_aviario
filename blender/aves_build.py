# Piezas N64 de las aves para js/bird.js: cuerpo, cabeza, ala y cola del ave base (paseriforme y derivados),
# de la paloma, la gaviota, el pingüino y el flamenco.
# Están en el mismo espacio y tamaño que las primitivas que reemplazan (esfera unitaria del cuerpo y la
# cabeza, ala de largo ~2 a lo largo de −X, cola de largo 1), así bird.js mantiene pivotes, animaciones,
# proporciones por especie (AVONET) y la pintura por especie (proyección lateral, sideUV).
# Frente = +X, arriba = +Z (glTF lo pasa a Y-up). Uso en vivo: exec(open('blender/aves_build.py').read())
# Headless: Blender --background --python blender/aves_build.py -- --export models/kit
import bpy, bmesh, math, sys, os
from mathutils import Vector

TAU = math.pi * 2

col = bpy.data.collections.get('Aves')
if not col:
    col = bpy.data.collections.new('Aves'); bpy.context.scene.collection.children.link(col)
for o in list(col.objects): bpy.data.objects.remove(o, do_unlink=True)
for me in list(bpy.data.meshes):
    if me.users == 0: bpy.data.meshes.remove(me)

m_gris = bpy.data.materials.get('ave_gris') or bpy.data.materials.new('ave_gris')
m_gris.use_nodes = True
m_gris.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.6, 0.55, 0.5, 1)
m_ala = bpy.data.materials.get('ave_ala') or bpy.data.materials.new('ave_ala')
m_ala.use_nodes = True; m_ala.use_backface_culling = False
m_ala.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.4, 0.36, 0.32, 1)


def link(name, bm, m, sharp=55):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); col.objects.link(o)
    me.materials.append(m)
    for p in me.polygons: p.use_smooth = True
    me.set_sharp_from_angle(angle=math.radians(sharp))
    return o


def lathe_x(rings, sides, ry=1.0, rz=1.0, zoff=lambda x: 0.0, rot=0.0):
    """Sólido alrededor del eje X: rings = [(x, r)], r=0 en las puntas."""
    bm = bmesh.new(); rows = []
    for x, r in rings:
        if r < 1e-6:
            rows.append([bm.verts.new((x, 0, zoff(x)))])
        else:
            rows.append([bm.verts.new((x, ry * r * math.cos(rot + TAU * k / sides), zoff(x) + rz * r * math.sin(rot + TAU * k / sides))) for k in range(sides)])
    for a, b in zip(rows, rows[1:]):
        for k in range(sides):
            j = (k + 1) % sides
            if len(a) == 1: bm.faces.new((a[0], b[k], b[j]))
            elif len(b) == 1: bm.faces.new((a[k], a[j], b[0]))
            else: bm.faces.new((a[k], a[j], b[j], b[k]))
    return bm


# Cuerpo: gota rechoncha; pecho redondo adelante (+X), se afina hacia la cola (−X); vientre algo más bajo.
cuerpo = lathe_x([(-1.32, 0), (-1.05, 0.38), (-0.55, 0.78), (0.0, 0.97), (0.5, 0.95), (0.85, 0.66), (1.02, 0)],
                 8, ry=0.96, rz=1.0, zoff=lambda x: -0.06 * max(0.0, 1 - abs(x - 0.2)), rot=math.pi / 8)
link('ave_cuerpo', cuerpo, m_gris)

# Cabeza: redonda, con frente marcada y mejillas; el pico se monta en +X (bird.js).
cabeza = lathe_x([(-0.98, 0), (-0.72, 0.68), (-0.22, 0.98), (0.3, 0.95), (0.72, 0.66), (0.98, 0)],
                 7, ry=0.9, rz=0.96, zoff=lambda x: 0.05 * max(0.0, 1 - abs(x - 0.35) * 1.6), rot=math.pi / 2)
link('ave_cabeza', cabeza, m_gris)

# Ala: plano delgado (dos caras). Borde de ataque arriba; primarias en punta hacia −X.
# Espacio igual al ala de antes: x ∈ [−1.35, 0.65], y (alto) ∈ [−0.4, 0.4].
contorno = [(0.65, 0.05), (0.45, 0.32), (0.0, 0.4), (-0.6, 0.3), (-1.05, 0.14), (-1.35, 0.0),
            (-1.12, -0.04), (-1.24, -0.12), (-0.98, -0.12), (-1.06, -0.22), (-0.78, -0.22),
            (-0.4, -0.32), (0.1, -0.3), (0.5, -0.16)]
bm = bmesh.new()
vs = [bm.verts.new((x, 0, z)) for x, z in contorno]
f = bm.faces.new(vs)
bmesh.ops.triangulate(bm, faces=[f])
for v in bm.verts:   # leve curvatura: el ala abraza el cuerpo
    v.co.y = 0.06 * (1 - (v.co.z / 0.4) ** 2) * max(0.0, (v.co.x + 1.35) / 2)
link('ave_ala', bm, m_ala, sharp=80)

# Cola: abanico en cuña que se abre hacia la punta, con muesca central; leve V.
# Espacio: x ∈ [−1, 0] (bird.js la escala por el largo de cola), ancho (y) de 0.3 a 0.5.
pts = [(0.0, 0.15), (-1.0, 0.25), (-0.92, 0.0), (-1.0, -0.25), (0.0, -0.15)]
bm = bmesh.new()
vs = [bm.verts.new((x, y, 0.035 * abs(y) / 0.25)) for x, y in pts]
f = bm.faces.new(vs)
bmesh.ops.triangulate(bm, faces=[f])
bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.05)
link('ave_cola', bm, m_ala, sharp=40)


def flat_part(name, outline, curve=0.0, thick=0.0, sharp=80):
    """Pieza plana (ala/cola) desde un contorno en el plano X-Z (ala) o X-Y (cola, con thick)."""
    bm = bmesh.new()
    if thick:   # cola: plano horizontal con leve V y grosor
        vs = [bm.verts.new((x, y, 0.035 * abs(y) / 0.25)) for x, y in outline]
        bmesh.ops.triangulate(bm, faces=[bm.faces.new(vs)])
        bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=thick)
        return link(name, bm, m_ala, sharp=40)
    vs = [bm.verts.new((x, 0, z)) for x, z in outline]
    bmesh.ops.triangulate(bm, faces=[bm.faces.new(vs)])
    for v in bm.verts:
        v.co.y = curve * (1 - (v.co.z / 0.45) ** 2) * max(0.0, (v.co.x + 1.35) / 2)
    return link(name, bm, m_ala, sharp=sharp)


# ---------- paloma (tórtolas, torcazas): pecho profundo y alto, cabeza chica, cola ancha y cuadrada ----------
link('paloma_cuerpo', lathe_x([(-1.3, 0), (-1.0, 0.4), (-0.45, 0.8), (0.1, 1.0), (0.55, 1.02), (0.88, 0.76), (1.06, 0)],
                             8, ry=0.94, rz=1.0, zoff=lambda x: 0.12 * max(0.0, 1 - abs(x - 0.45) * 1.2) - 0.05, rot=math.pi / 8), m_gris)
link('paloma_cabeza', lathe_x([(-0.95, 0), (-0.7, 0.7), (-0.15, 0.98), (0.4, 0.9), (0.8, 0.55), (1.0, 0)],
                             7, ry=0.88, rz=0.95, zoff=lambda x: 0.04, rot=math.pi / 2), m_gris)
# ala plegada ancha, punta redondeada (sin primarias sueltas)
flat_part('paloma_ala', [(0.65, 0.05), (0.42, 0.38), (-0.1, 0.45), (-0.8, 0.34), (-1.25, 0.14), (-1.38, -0.02),
                         (-1.22, -0.18), (-0.8, -0.3), (-0.2, -0.36), (0.35, -0.2)], curve=0.07)
flat_part('paloma_cola', [(0.0, 0.18), (-0.95, 0.3), (-1.0, 0.12), (-1.0, -0.12), (-0.95, -0.3), (0.0, -0.18)], thick=0.05)

# ---------- gaviota (gaviotas, petreles, albatros, salteadores): torpedo, frente plana, ala larga y angosta ----------
link('gaviota_cuerpo', lathe_x([(-1.45, 0), (-1.15, 0.32), (-0.6, 0.7), (0.0, 0.92), (0.55, 0.9), (0.92, 0.6), (1.1, 0)],
                              8, ry=0.86, rz=0.95, rot=math.pi / 8), m_gris)
link('gaviota_cabeza', lathe_x([(-0.98, 0), (-0.7, 0.68), (-0.2, 0.96), (0.35, 0.92), (0.75, 0.6), (1.0, 0)],
                              7, ry=0.86, rz=0.9, zoff=lambda x: 0.08 * max(0.0, x), rot=math.pi / 2), m_gris)
# ala angosta que termina en punta aguda (las puntas oscuras salen de la textura del ala)
flat_part('gaviota_ala', [(0.65, 0.04), (0.4, 0.26), (-0.2, 0.3), (-0.8, 0.2), (-1.35, 0.02),
                          (-0.9, -0.1), (-0.3, -0.22), (0.3, -0.16)], curve=0.04)
flat_part('gaviota_cola', [(0.0, 0.15), (-1.0, 0.24), (-1.0, -0.24), (0.0, -0.15)], thick=0.045)

# ---------- pingüino: huso erguido (bird.js lo para con tilt), aletas planas y angostas, cola mínima ----------
# El eje X del cuerpo queda vertical en el juego: −X = abajo (patas/cola), +X = arriba (cabeza).
link('pinguino_cuerpo', lathe_x([(-1.3, 0), (-1.12, 0.55), (-0.65, 0.95), (-0.1, 1.0), (0.45, 0.85), (0.85, 0.58), (1.08, 0)],
                               8, ry=0.9, rz=0.95, rot=math.pi / 8), m_gris)
link('pinguino_cabeza', lathe_x([(-0.95, 0), (-0.7, 0.72), (-0.15, 0.96), (0.4, 0.86), (0.82, 0.5), (1.02, 0)],
                               7, ry=0.85, rz=0.92, rot=math.pi / 2), m_gris)
flat_part('pinguino_ala', [(0.6, 0.1), (0.2, 0.2), (-0.6, 0.17), (-1.2, 0.08), (-1.35, -0.02), (-1.1, -0.12),
                           (-0.4, -0.16), (0.3, -0.12)], curve=0.03)
flat_part('pinguino_cola', [(0.0, 0.12), (-1.0, 0.14), (-1.0, -0.14), (0.0, -0.12)], thick=0.05)

# ---------- flamenco: cuerpo chico y ovalado; ala plegada en punta (primarias negras desde la textura) ----------
link('flamenco_cuerpo', lathe_x([(-1.15, 0), (-0.92, 0.45), (-0.42, 0.86), (0.18, 0.98), (0.68, 0.8), (1.0, 0)],
                               8, ry=0.82, rz=0.92, zoff=lambda x: 0.05 * max(0.0, 1 - abs(x)), rot=math.pi / 8), m_gris)
link('flamenco_cabeza', lathe_x([(-0.9, 0), (-0.65, 0.66), (-0.15, 0.92), (0.4, 0.84), (0.82, 0.48), (1.0, 0)],
                               7, ry=0.8, rz=0.9, rot=math.pi / 2), m_gris)
flat_part('flamenco_ala', [(0.65, 0.05), (0.4, 0.3), (-0.3, 0.34), (-0.9, 0.2), (-1.35, 0.0),
                           (-0.95, -0.14), (-0.3, -0.26), (0.35, -0.18)], curve=0.06)
flat_part('flamenco_cola', [(0.0, 0.14), (-1.0, 0.2), (-1.0, -0.2), (0.0, -0.14)], thick=0.04)

# vista ordenada en la escena: una fila por juego de piezas
for row, pre in enumerate(('ave', 'paloma', 'gaviota', 'pinguino', 'flamenco')):
    for i, n in enumerate(('cuerpo', 'cabeza', 'ala', 'cola')):
        bpy.data.objects[f'{pre}_{n}'].location = (i * 3.2, row * 3.0, 0)


def tri_count():
    return {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in col.objects}


def export_glb(folder):
    locs = {}
    bpy.ops.object.select_all(action='DESELECT')
    for o in col.objects:
        locs[o.name] = o.location.copy(); o.location = (0, 0, 0); o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(folder, 'ave_partes.glb'), export_format='GLB', use_selection=True,
                              export_apply=True, export_yup=True, export_cameras=False, export_lights=False, export_materials='NONE')
    for o in col.objects: o.location = locs[o.name]


bpy.context.view_layer.update()
if '--' in sys.argv and '--export' in sys.argv:
    export_glb(sys.argv[sys.argv.index('--export') + 1])
