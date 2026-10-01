# Piezas N64 del ave base (plan paseriforme y derivados) para js/bird.js: cuerpo, cabeza, ala y cola.
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

# vista ordenada en la escena
for i, n in enumerate(('ave_cuerpo', 'ave_cabeza', 'ave_ala', 'ave_cola')):
    bpy.data.objects[n].location = (i * 3.2, 0, 0)


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
