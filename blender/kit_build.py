# Kit de piezas N64 para el mundo (ver blender/KIT.md): roca, árbol de copa, espino, arbusto y pasto.
# Cada pieza se construye en metros a una altura nominal; el juego la escala por especie (js/scale.js)
# y tiñe copas, pasto y rocas con el color de cada especie (las texturas son grises a propósito).
# Uso en vivo (MCP): exec(open('blender/kit_build.py').read())
# Uso headless:      Blender --background --python blender/kit_build.py -- --export models/kit
import bpy, bmesh, math, random, sys, os
from mathutils import Vector

TAU = math.pi * 2
rnd = random.Random(11)
NOMINAL = {'roca': 1.0, 'arbol_copa': 7.0, 'espino': 3.5, 'arbusto': 1.4, 'pasto': 0.7}


def q5(c):
    return [min(248, int(round(v / 8)) * 8) for v in c[:3]] + list(c[3:])


def vary(c, a):
    return [max(0, min(255, v + rnd.uniform(-a, a))) for v in c]


def image(name, w, h, fn, alpha=False):
    img = bpy.data.images.get(name)
    if img: bpy.data.images.remove(img)
    img = bpy.data.images.new(name, w, h, alpha=alpha)
    px = []
    for y in range(h):
        for x in range(w):
            c = q5(fn(x, y))
            a = c[3] / 255 if len(c) > 3 else 1.0
            px += [c[0] / 255, c[1] / 255, c[2] / 255, a]
    img.pixels = px; img.pack()
    return img


def material(name, img, alpha=False, rough=0.85):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    for n in [n for n in nt.nodes if n.type == 'TEX_IMAGE']: nt.nodes.remove(n)
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = img; t.interpolation = 'Linear'; t.location = (-450, 250)
    nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = rough
    if alpha:
        nt.links.new(t.outputs['Alpha'], b.inputs['Alpha'])
        m.use_backface_culling = False
        if hasattr(m, 'blend_method'): m.blend_method = 'CLIP'
        if hasattr(m, 'surface_render_method'): m.surface_render_method = 'DITHERED'
    return m


# ---------- texturas (grises: el juego las tiñe por especie) ----------
LEAF_CLUMPS = [(rnd.uniform(0, 32), rnd.uniform(0, 32), rnd.uniform(3, 6)) for _ in range(14)]


def leaf_px(x, y):
    # racimos: manchas grandes claras sobre fondo más oscuro (se repite sin costuras: distancia toroidal)
    light = 0.0
    for cx, cy, r in LEAF_CLUMPS:
        dx = min(abs(x - cx), 32 - abs(x - cx)); dy = min(abs(y - cy), 32 - abs(y - cy))
        light = max(light, 1 - (dx * dx + dy * dy) / (r * r))
    g = 120 + 120 * max(0.0, light) ** 0.6
    return vary([g, g * 1.04, g * 0.92], 9)


def leaf_card_px(x, y):
    # racimos de hojas redondas; transparente entre ellos (borde irregular de la copa)
    for cx, cy, r in ((8, 9, 7), (21, 8, 7.5), (15, 20, 8), (5, 24, 5), (26, 23, 5.5), (16, 4, 4.5)):
        d2 = (x - cx) ** 2 + (y - cy) ** 2
        if d2 < r * r:
            g = 125 + 105 * (1 - d2 / (r * r)) ** 0.7   # más claro al centro del racimo
            return vary([g, g * 1.04, g * 0.92], 9) + [255]
    return [0, 0, 0, 0]


def grass_px(x, y):
    # hojas de pasto finas y curvas que salen desde abajo
    for k in range(5):
        bx = 2 + k * 3 + int(1.5 * math.sin(y * 0.18 + k))
        top = 22 + (k * 7) % 10
        if abs(x - bx) <= (1 if y < top * 0.6 else 0) and y < top:
            return vary([190, 200, 150], 18) + [255]
    return [0, 0, 0, 0]


def rock_px(x, y):
    vein = (x * 5 + y * 3) % 23 == 0 or (x * 2 - y * 7) % 29 == 0
    return vary([110, 108, 104] if vein else [170, 168, 160], 12)


def bark_px(x, y):
    return vary([84, 64, 44] if x % 4 else [56, 42, 30], 8)


M = {
    'copa': material('kit_copa', image('kit_tx_hojas', 32, 32, leaf_px)),
    'borde': material('kit_hojas_borde', image('kit_tx_hojas_borde', 32, 32, leaf_card_px, True), alpha=True),
    'corteza': material('kit_corteza', image('kit_tx_corteza', 16, 32, bark_px)),
    'roca': material('kit_roca', image('kit_tx_roca', 32, 32, rock_px), rough=0.9),
    'pasto': material('kit_pasto', image('kit_tx_pasto', 16, 32, grass_px, True), alpha=True),
}

# ---------- colección limpia ----------
col = bpy.data.collections.get('Kit')
if not col:
    col = bpy.data.collections.new('Kit'); bpy.context.scene.collection.children.link(col)
for o in list(col.objects): bpy.data.objects.remove(o, do_unlink=True)
for me in list(bpy.data.meshes):
    if me.users == 0: bpy.data.meshes.remove(me)


def link(name, bm, parent, m, smooth=True):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); col.objects.link(o); o.parent = parent
    me.materials.append(m)
    for p in me.polygons: p.use_smooth = smooth
    if smooth: me.set_sharp_from_angle(angle=math.radians(60))
    return o


def empty(name, loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None); col.objects.link(e); e.location = loc; e.empty_display_size = 0.3
    return e


def uv_cylinder(bm, z0, z1, center=Vector((0, 0, 0))):
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        us = []
        for l in f.loops:
            d = l.vert.co - center
            us.append((math.atan2(d.y, d.x) / TAU) % 1.0)
        if max(us) - min(us) > 0.5: us = [u + 1 if u < 0.5 else u for u in us]
        for l, u in zip(f.loops, us):
            l[uvl].uv = (u * 2, (l.vert.co.z - z0) / max(1e-6, z1 - z0))


def uv_sphere_proj(bm, center, scale=1.0):
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        for l in f.loops:
            d = (l.vert.co - center)
            l[uvl].uv = (d.x * scale + d.y * 0.5 * scale + 0.5, d.z * scale + 0.5)


def blob(center, rx, ry, rz, jitter=0.12, subdiv=0):
    """Masa de hojas o roca: icosaedro (20 caras) con vértices movidos al azar."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    for v in bm.verts:
        k = 1 + rnd.uniform(-jitter, jitter)
        v.co = Vector((v.co.x * rx * k, v.co.y * ry * k, v.co.z * rz * k)) + center
    return bm


def trunk(path, radii, sides=6):
    """Tronco/rama: prisma de `sides` lados a lo largo de una polilínea."""
    bm = bmesh.new(); rings = []
    for i, (p, r) in enumerate(zip(path, radii)):
        p = Vector(p)
        t = (Vector(path[min(i + 1, len(path) - 1)]) - Vector(path[max(i - 1, 0)])).normalized()
        a = t.orthogonal().normalized(); b = t.cross(a)
        rings.append([bm.verts.new(p + (a * math.cos(TAU * k / sides) + b * math.sin(TAU * k / sides)) * r) for k in range(sides)])
    for ra, rb in zip(rings, rings[1:]):
        for k in range(sides):
            bm.faces.new((ra[k], ra[(k + 1) % sides], rb[(k + 1) % sides], rb[k]))
    bm.faces.new(list(reversed(rings[-1])))   # tapa de arriba (se ve desde lejos en las ramas)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    z = [p[2] for p in path]; uv_cylinder(bm, min(z), max(z), Vector(path[0]))
    return bm


def card(center, normal, w, h, up=Vector((0, 0, 1))):
    """Tarjeta cuadrada con textura transparente (borde de copa, pasto)."""
    n = Vector(normal).normalized(); u = up.cross(n)
    if u.length < 1e-3: u = Vector((1, 0, 0))
    u.normalize(); v = n.cross(u)
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap')
    c = Vector(center)
    vs = [bm.verts.new(c + u * sx * w / 2 + v * sy * h / 2) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    f = bm.faces.new(vs)
    for l, uv in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))): l[uvl].uv = uv
    return bm


def merge(*bms):
    out = bmesh.new()
    for b in bms:
        me = bpy.data.meshes.new('_tmp'); b.to_mesh(me); b.free()
        out.from_mesh(me); bpy.data.meshes.remove(me)
    return out


# ---------- piezas ----------
X = [0.0]


def piece(name):
    root = empty(name, (X[0], 0, 0)); X[0] += 6
    return root


# Rocas: 3 formas facetadas (envolvente convexa de puntos al azar), base plana a ras de suelo.
root = piece('roca')
for i, (sx, sy, sz) in enumerate(((1.3, 1.0, 0.8), (1.0, 1.1, 1.0), (1.6, 1.0, 0.6))):
    bm = bmesh.new()
    pts = []
    for k in range(13):
        a, e = rnd.uniform(0, TAU), rnd.uniform(-0.2, 1.0)
        pts.append(bm.verts.new((math.cos(a) * math.cos(e) * sx * 0.55, math.sin(a) * math.cos(e) * sy * 0.55, max(0.0, math.sin(e)) * sz)))
    bmesh.ops.convex_hull(bm, input=pts)
    for v in [v for v in bm.verts if not v.link_faces]: bm.verts.remove(v)
    for f in [f for f in bm.faces if f.calc_center_median().z < 0.02 and f.normal.z < -0.9]: bm.faces.remove(f)  # sin base
    uv_sphere_proj(bm, Vector((0, 0, 0.4)), 0.8)
    o = link(f'roca_{"abc"[i]}', bm, root, M['roca'], smooth=False)
    o.location = (0, i * 2.2 - 2.2, 0)

# Árbol de copa (quillay, peumo, litre, pimiento, plátano, maitén): tronco que se abre en dos ramas
# y tres masas de hojas; tarjetas transparentes en el borde para romper la silueta.
root = piece('arbol_copa')
tr = trunk([(0, 0, 0), (0.05, 0, 1.4), (0.1, 0.05, 2.6)], [0.3, 0.24, 0.2])
b1 = trunk([(0.1, 0.05, 2.4), (0.9, 0.5, 3.5)], [0.13, 0.08], 5)
b2 = trunk([(0.1, 0.05, 2.4), (-0.8, -0.6, 3.4)], [0.12, 0.07], 5)
link('arbol_copa_tronco', merge(tr, b1, b2), root, M['corteza'])
blobs = [(Vector((0.1, 0, 4.9)), 2.0, 1.9, 1.6), (Vector((1.2, 0.7, 4.0)), 1.5, 1.4, 1.2), (Vector((-1.1, -0.8, 4.1)), 1.5, 1.4, 1.2)]
bms = []
for c, rx, ry, rz in blobs:
    b = blob(c, rx, ry, rz, 0.2); uv_sphere_proj(b, c, 0.22); bms.append(b)
link('arbol_copa_copa', merge(*bms), root, M['copa'])
cards = []
for c, rx, ry, rz in blobs:
    for k in range(3):
        a = TAU * k / 3 + rnd.uniform(-0.5, 0.5); n = Vector((math.cos(a), math.sin(a), rnd.uniform(-0.2, 0.8)))
        cards.append(card(c + n.normalized() * rx * 0.75, n, rx * 1.5, rz * 1.5))
link('arbol_copa_borde', merge(*cards), root, M['borde'])

# Espino (acacia): tronco corto que se abre en tres ramas y copa plana en dos capas.
root = piece('espino')
tr = trunk([(0, 0, 0), (0.08, 0, 0.6), (0.05, 0.05, 1.1)], [0.13, 0.11, 0.1], 5)
br = []
for a in (0.3, 2.4, 4.4):
    tip = (math.cos(a) * 1.0, math.sin(a) * 1.0, 2.5)
    br.append(trunk([(0.05, 0.05, 1.0), (math.cos(a) * 0.5, math.sin(a) * 0.5, 1.8), tip], [0.08, 0.06, 0.04], 4))
link('espino_tronco', merge(tr, *br), root, M['corteza'])
c1, c2 = Vector((0, 0, 2.75)), Vector((0.2, 0.1, 3.15))
b = merge(blob(c1, 1.7, 1.6, 0.42, 0.15), blob(c2, 1.1, 1.0, 0.3, 0.15))
uv_sphere_proj(b, c1, 0.3)
link('espino_copa', b, root, M['copa'])
cards = []
for k in range(6):
    a = TAU * k / 6 + rnd.uniform(-0.3, 0.3)
    n = Vector((math.cos(a), math.sin(a), 0.9))
    cards.append(card(c1 + Vector((math.cos(a) * 1.4, math.sin(a) * 1.3, 0.05)), n, 1.3, 0.9))
link('espino_borde', merge(*cards), root, M['borde'])

# Arbusto (boldo, zarzamora, mata negra, calafate, hierba blanca): tres bultos bajos con borde de hojas.
root = piece('arbusto')
blobs = [(Vector((0, 0, 0.62)), 0.8, 0.75, 0.62), (Vector((0.55, 0.3, 0.42)), 0.55, 0.5, 0.42), (Vector((-0.5, -0.35, 0.4)), 0.5, 0.5, 0.4)]
bms = []
for c, rx, ry, rz in blobs:
    b = blob(c, rx, ry, rz, 0.15)
    for v in b.verts: v.co.z = max(v.co.z, 0.0)
    uv_sphere_proj(b, c, 0.8); bms.append(b)
link('arbusto_copa', merge(*bms), root, M['copa'])
cards = []
for k in range(4):
    a = TAU * k / 4 + 0.4
    n = Vector((math.cos(a), math.sin(a), 0.5))
    cards.append(card(Vector((math.cos(a) * 0.65, math.sin(a) * 0.6, 0.7)), n, 0.9, 0.8))
link('arbusto_borde', merge(*cards), root, M['borde'])

# Pasto (coirón, césped, pradera): tres tarjetas cruzadas.
root = piece('pasto')
cards = []
for k in range(3):
    a = math.pi * k / 3
    n = Vector((math.cos(a), math.sin(a), 0))
    cards.append(card(Vector((0, 0, 0.35)), n, 0.8, 0.7))
link('pasto_hojas', merge(*cards), root, M['pasto'], smooth=False)


# ---------- utilidades ----------
def tri_count(name):
    root = bpy.data.objects[name]
    return sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in root.children)


def export_piece(name, folder):
    root = bpy.data.objects[name]
    loc = root.location.copy(); root.location = (0, 0, 0)
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for o in root.children: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(folder, name + '.glb'), export_format='GLB', use_selection=True,
                              export_apply=True, export_yup=True, export_cameras=False, export_lights=False,
                              export_vertex_color='ACTIVE')
    root.location = loc


PIECES = list(NOMINAL)
bpy.context.view_layer.update()

if '--' in sys.argv and '--export' in sys.argv:
    folder = sys.argv[sys.argv.index('--export') + 1]
    os.makedirs(folder, exist_ok=True)
    for p in PIECES: export_piece(p, folder)
