# Piezas de pueblo N64 (una sola malla cada una): casas de chapa de Valparaíso/Magallanes (1 y 2 pisos),
# edificio de fondo para Santiago, banca con farol y muelle. Proporciones de referencia: Kenney Fantasy Town
# Kit (CC0, assets/referencias/kits/). Muros y techo con texturas grises que el juego tiñe por color de casa;
# ventanas y puerta en un material aparte que no se tiñe. Exporta a models/kit/<id>.glb.
# Uso en vivo (MCP): exec(open('blender/pueblo_build.py').read())
import bpy, bmesh, math, os, random, sys
from mathutils import Vector

OUT = '/Users/jabac/dev/3d_aviario/models/kit'
rnd = random.Random(21)


def q5(c): return [min(248, int(round(v / 8)) * 8) for v in c]
def vary(c, a): return [max(0, min(255, v + rnd.uniform(-a, a))) for v in c]


def material(name, w, h, fn, rough=0.8):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']; b.inputs['Roughness'].default_value = rough
    for n in [n for n in nt.nodes if n.type == 'TEX_IMAGE' or n.name == 'prev']: nt.nodes.remove(n)
    img = bpy.data.images.get('tx_' + name)
    if img: bpy.data.images.remove(img)
    img = bpy.data.images.new('tx_' + name, w, h)
    px = []
    for y in range(h):
        for x in range(w):
            c = q5(fn(x, y)); px += [c[0] / 255, c[1] / 255, c[2] / 255, 1]
    img.pixels = px; img.pack()
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = img; t.interpolation = 'Linear'
    nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    return m


M = {
    # chapa ondulada vertical (gris claro: el juego la tiñe con el color de la casa)
    'casa': material('kit_casa', 32, 32, lambda x, y: vary([214, 214, 210] if x % 4 < 2 else [180, 180, 176], 5)),
    # techo de calamina, acanalado horizontal
    'techo': material('kit_techo', 32, 32, lambda x, y: vary([200, 196, 190] if y % 4 < 2 else [160, 156, 150], 5)),
    # ventana: marco blanco, vidrio oscuro con reflejo; puerta de madera (no se tiñen)
    'ventana': material('kit_ventana', 16, 16, lambda x, y: [236, 232, 220] if x in (0, 1, 14, 15) or y in (0, 1, 14, 15) or x in (7, 8) or y in (7, 8)
                        else ([150, 176, 196] if x + y < 9 else [52, 66, 84]), 0.3),
    'puerta': material('kit_puerta', 16, 32, lambda x, y: [70, 46, 30] if x in (0, 15) or y in (0, 31) else vary([120, 78, 46] if x % 5 else [96, 62, 38], 4)),
    'madera': material('kit_madera', 16, 16, lambda x, y: vary([128, 92, 58] if y % 4 else [96, 66, 40], 5)),
    'metal': material('kit_metal', 8, 8, lambda x, y: vary([52, 52, 58], 4), 0.4),
    'luz': material('kit_luz', 8, 8, lambda x, y: [248, 232, 176]),
    'muro': material('kit_edificio', 32, 32, lambda x, y: [70, 84, 100] if (x % 8 in (2, 3, 4, 5) and y % 8 in (2, 3, 4, 5)) else vary([196, 190, 180], 4)),
}

col = bpy.data.collections.get('Kit_Pueblo')
if not col:
    col = bpy.data.collections.new('Kit_Pueblo'); bpy.context.scene.collection.children.link(col)
for o in list(col.objects): bpy.data.objects.remove(o, do_unlink=True)


class Builder:
    """Junta cajas, prismas y quads en una sola malla con varios materiales y UV por caja."""
    def __init__(self):
        self.bm = bmesh.new(); self.uv = self.bm.loops.layers.uv.new('UVMap'); self.mats = []

    def mi(self, m):
        if m not in self.mats: self.mats.append(m)
        return self.mats.index(m)

    def face(self, pts, m, uvs=None, scale=0.5):
        vs = [self.bm.verts.new(p) for p in pts]
        f = self.bm.faces.new(vs); f.material_index = self.mi(m)
        if uvs is None:
            n = f.normal; ax = max(range(3), key=lambda i: abs(n[i])); a, b = [(1, 2), (0, 2), (0, 1)][ax]
            uvs = [(v.co[a] * scale, v.co[b] * scale) for v in vs]
        for l, uv in zip(f.loops, uvs): l[self.uv].uv = uv
        return f

    def box(self, x0, y0, z0, x1, y1, z1, m, skip=(), scale=0.5):
        P = lambda x, y, z: Vector((x, y, z))
        faces = {
            '-x': [P(x0, y1, z0), P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1)], '+x': [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)],
            '-y': [P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], '+y': [P(x1, y1, z0), P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1)],
            '+z': [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], '-z': [P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0), P(x0, y0, z0)]}
        for k, pts in faces.items():
            if k not in skip: self.face(pts, m, scale=scale)

    def quad_on(self, center, normal, w, h, m):
        n = Vector(normal).normalized(); up = Vector((0, 0, 1)); u = up.cross(n).normalized()
        c = Vector(center) + n * 0.03
        pts = [c - u * w / 2 - up * h / 2, c + u * w / 2 - up * h / 2, c + u * w / 2 + up * h / 2, c - u * w / 2 + up * h / 2]
        self.face(pts, m, uvs=[(0, 0), (1, 0), (1, 1), (0, 1)])

    def done(self, name, sharp=True):
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-5)
        me = bpy.data.meshes.new(name); self.bm.to_mesh(me); self.bm.free()
        for m in self.mats: me.materials.append(m)
        o = bpy.data.objects.new(name, me); col.objects.link(o)
        return o


def casa(name, W, D, H, pisos):
    """Casa de chapa: muros, techo a dos aguas con alero, ventanas por piso y puerta al frente (−Y)."""
    b = Builder()
    b.box(-W / 2, -D / 2, 0, W / 2, D / 2, H, M['casa'], skip=('-z', '+z'))
    # frontones (triángulos del techo) en los lados cortos
    R = 1.6 if pisos == 1 else 1.9
    for x in (-W / 2, W / 2):
        sgn = 1 if x > 0 else -1
        pts = [Vector((x, -D / 2, H)), Vector((x, D / 2, H)), Vector((x, 0, H + R))]
        if sgn < 0: pts = list(reversed(pts))
        b.face(pts, M['casa'])
    # techo: dos aguas con alero de 0.35 m
    o = 0.35
    for s in (-1, 1):
        a = Vector((-W / 2 - o, s * (D / 2 + o), H - o * R / (D / 2))); bb = Vector((W / 2 + o, s * (D / 2 + o), H - o * R / (D / 2)))
        c = Vector((W / 2 + o, 0, H + R)); d = Vector((-W / 2 - o, 0, H + R))
        pts = [a, bb, c, d] if s < 0 else [bb, a, d, c]
        b.face(pts, M['techo'], scale=0.6)
        b.face(list(reversed(pts)), M['techo'], scale=0.6)   # cara de abajo del alero
    # ventanas y puerta
    for p in range(pisos):
        z = 1.5 + p * 2.8
        for x in ((-W * 0.28, W * 0.28) if p == 0 else (-W * 0.3, 0.0, W * 0.3)):
            if p == 0 and abs(x) < 0.1: continue
            b.quad_on((x, -D / 2, z), (0, -1, 0), 1.0, 1.1, M['ventana'])
            b.quad_on((x, D / 2, z), (0, 1, 0), 1.0, 1.1, M['ventana'])
        for y in (-D * 0.2, D * 0.2):
            b.quad_on((W / 2, y, z), (1, 0, 0), 0.9, 1.0, M['ventana'])
            b.quad_on((-W / 2, y, z), (-1, 0, 0), 0.9, 1.0, M['ventana'])
    b.quad_on((0, -D / 2, 1.05), (0, -1, 0), 1.0, 2.1, M['puerta'])
    return b.done(name)


def edificio(name, W, H):
    b = Builder()
    b.box(-W / 2, -W / 2, 0, W / 2, W / 2, H, M['muro'], skip=('-z',), scale=0.25)
    b.box(-W / 2 - 0.2, -W / 2 - 0.2, H, W / 2 + 0.2, W / 2 + 0.2, H + 0.4, M['metal'], skip=('-z',))   # cornisa
    return b.done(name)


def banca_farol(name):
    b = Builder()
    # banca: asiento, respaldo y patas
    b.box(-0.8, -0.2, 0.42, 0.8, 0.2, 0.5, M['madera'])
    b.box(-0.8, 0.16, 0.5, 0.8, 0.22, 0.9, M['madera'])
    for x in (-0.7, 0.7):
        b.box(x - 0.04, -0.18, 0, x + 0.04, 0.18, 0.42, M['metal'], skip=('-z',))
    # farol: poste, brazo y linterna
    fx = 1.4
    b.box(fx - 0.06, -0.06, 0, fx + 0.06, 0.06, 3.0, M['metal'], skip=('-z',))
    b.box(fx - 0.22, -0.22, 3.0, fx + 0.22, 0.22, 3.4, M['luz'])
    b.box(fx - 0.28, -0.28, 3.4, fx + 0.28, 0.28, 3.5, M['metal'])
    return b.done(name)


def muelle(name, L=10.0, Wd=2.4, hdeck=1.0):
    b = Builder()
    b.box(-Wd / 2, -L / 2, hdeck - 0.15, Wd / 2, L / 2, hdeck, M['madera'], scale=1.0)
    for y in [-L / 2 + 0.4 + i * (L - 0.8) / 4 for i in range(5)]:
        for x in (-Wd / 2 + 0.15, Wd / 2 - 0.15):
            b.box(x - 0.12, y - 0.12, -1.5, x + 0.12, y + 0.12, hdeck + 0.6, M['madera'], skip=('-z',))
    return b.done(name)


piezas = [casa('casa_1piso', 6.0, 5.0, 3.2, 1), casa('casa_2pisos', 6.0, 5.0, 6.0, 2),
          edificio('edificio', 9.0, 12.0), banca_farol('banca_farol'), muelle('muelle')]
for i, o in enumerate(piezas):
    o.location = (i * 12.0, 40.0, 0)
    for p in o.data.polygons: p.use_smooth = False


def tri_count():
    return {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in col.objects}


def export_all(folder=OUT):
    os.makedirs(folder, exist_ok=True)
    # las dos casas van en un solo archivo (variantes de forma); el resto, uno por pieza
    groups = {'casa_color': ['casa_1piso', 'casa_2pisos'], 'edificio': ['edificio'], 'banca_farol': ['banca_farol'], 'muelle': ['muelle']}
    for fname, names in groups.items():
        locs = {}
        bpy.ops.object.select_all(action='DESELECT')
        for n in names:
            o = bpy.data.objects[n]; locs[n] = o.location.copy(); o.location = (0, 0, 0); o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=os.path.join(folder, fname + '.glb'), export_format='GLB', use_selection=True,
                                  export_apply=True, export_yup=True, export_cameras=False, export_lights=False)
        for n in names: bpy.data.objects[n].location = locs[n]


bpy.context.view_layer.update()
if '--' in sys.argv and '--export' in sys.argv:
    export_all(sys.argv[sys.argv.index('--export') + 1])
