# Poroto N64: versión "tosca" construida como los personajes de Ocarina of Time (ver blender/NOTAS.md, Darunia).
# ~500 triángulos: secciones octogonales/hexagonales, cara plana con ojos pintados, y todo lo plano
# (cinturón, tirantes, correa, bolsillo, sandalias, cinta del casco) pintado en texturas chicas de 5 bits.
# Uso en vivo (MCP): exec(open('blender/poroto_n64_build.py').read())
# Uso headless:      Blender --background --python blender/poroto_n64_build.py -- --export models/poroto.glb
# Convención: frente = +X, arriba = +Z (glTF lo pasa a Y-up; frente sigue en +X como en el juego).
import bpy, bmesh, math, random, sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree

rnd = random.Random(7)
TAU = math.pi * 2

# ---------- cuerpo: anillos (z, frente, costado, espalda) en un octógono girado 22.5° (cara plana al frente) ----------
BODY = [
    (0.120, 0.000, 0.000, 0.000),
    (0.150, 0.130, 0.150, 0.120),
    (0.240, 0.200, 0.230, 0.190),
    (0.340, 0.215, 0.250, 0.200),   # cintura / cinturón
    (0.450, 0.225, 0.310, 0.215),   # hombros
    (0.560, 0.235, 0.300, 0.215),   # cachetes (lo más ancho)
    (0.700, 0.215, 0.240, 0.200),   # ojos
    (0.800, 0.160, 0.170, 0.150),   # coronilla (bajo el casco)
    (0.870, 0.000, 0.000, 0.000),
]
ZMIN, ZMAX = BODY[0][0], BODY[-1][0]
BELT = (0.300, 0.338)
FACE_Z = (BODY[5][0], BODY[7][0])     # la columna frontal entre estos anillos lleva la textura de la cara
SHOULDER = (0.0, 0.30, 0.45)          # centro del hombro (y = costado)


def srgb(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def q5(c):   # 5 bits por canal, como las texturas RGBA5551 del N64
    return [min(248, int(round(v / 8)) * 8) for v in c]


def vary(c, a):
    return [max(0, min(255, v + rnd.uniform(-a, a))) for v in c]


def skin_rgb(z):
    t = min(max((z - BELT[1]) / (ZMAX - BELT[1]), 0), 1)
    return [188 + 20 * t, 142 + 18 * t, 90 + 14 * t]


# ---------- materiales ----------
def mat(name, rgb=(200, 200, 200), rough=0.8, keep=True):
    m = bpy.data.materials.get(name)
    fresh = m is None
    if fresh: m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    if fresh or not keep:
        b.inputs['Base Color'].default_value = (*[srgb(c) for c in rgb], 1)
    b.inputs['Roughness'].default_value = rough
    for n in [n for n in m.node_tree.nodes if n.type == 'TEX_IMAGE']:
        m.node_tree.nodes.remove(n)
    return m


def tex(m, imgname, w, h, fn):
    """Pinta una textura w×h con fn(x, y) (y=0 abajo) cuantizada a 5 bits y la conecta al material."""
    img = bpy.data.images.get(imgname)
    if img: bpy.data.images.remove(img)
    img = bpy.data.images.new(imgname, w, h)
    px = []
    for y in range(h):
        for x in range(w):
            c = q5(fn(x, y)); px += [c[0] / 255, c[1] / 255, c[2] / 255, 1]
    img.pixels = px; img.pack()
    nt = m.node_tree
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = img; t.interpolation = 'Linear'; t.location = (-500, 300)
    nt.links.new(t.outputs['Color'], nt.nodes['Principled BSDF'].inputs['Base Color'])
    return img


P = 'n64_'
M = {
    'body': mat(P + 'cuerpo', rough=0.6), 'face': mat(P + 'cara', rough=0.6),
    'skin': mat(P + 'piel', rough=0.6), 'foot': mat(P + 'pie', rough=0.6),
    'stache': mat(P + 'bigote', (62, 40, 28), 0.7), 'helmet': mat(P + 'casco', rough=0.75),
    'glove': mat(P + 'guante', rough=0.7), 'sole': mat(P + 'suela', (42, 15, 12), 0.8),
    'pack': mat(P + 'mochila', rough=0.8), 'roll': mat(P + 'saco', rough=0.9),
    'bino': mat(P + 'binocular', rough=0.5), 'shades': mat(P + 'lentes_sol', (18, 18, 24), 0.15),
    'frame': mat(P + 'lentes_marco', (40, 32, 28), 0.4), 'scarf': mat(P + 'bufanda', rough=0.9),
    'book': mat(P + 'libreta', rough=0.8), 'pencil': mat(P + 'lapiz', (224, 192, 64), 0.6), 'map': mat(P + 'mapa', rough=0.9),
}
for k in ('helmet', 'frame', 'map'):
    M[k].use_backface_culling = False

# colores del diseño (los elegidos a mano en v4/v5)
C = {
    'shorts': (140, 132, 86), 'shorts_d': (128, 120, 78), 'belt': (84, 56, 36), 'buckle': (214, 176, 70),
    'strap': (115, 63, 77), 'binostrap': (95, 111, 231), 'eye': (22, 18, 20), 'glove': (112, 76, 50),
    'sole': (42, 15, 12), 'helmet': (212, 192, 140), 'helmet_d': (204, 184, 134), 'band': (110, 78, 48),
    'petal': (238, 128, 168), 'petal_l': (248, 160, 192), 'center': (250, 206, 60),
    'pack': (122, 98, 62), 'pack_d': (96, 74, 46), 'roll': (176, 60, 50), 'roll_l': (232, 220, 196),
    'bino': (92, 103, 51), 'lens': (110, 150, 170),
}


def bino_z(a):   # correa terciada de los binoculares: altura según el ángulo (0 = frente, +90° = izquierda)
    return 0.455 + 0.135 * math.sin(a) - 0.025 * math.cos(a)


# textura del cuerpo: u = ángulo (0.5 = frente), v = altura. Short, cinturón, piel, tirantes y correa pintados.
BW, BH = 64, 64


def body_px(x, y):
    a = ((x + 0.5) / BW - 0.5) * TAU
    z = ZMIN + (y + 0.5) / BH * (ZMAX - ZMIN)
    # correa de los binoculares
    if abs(z - bino_z(a)) < 0.011:
        return C['binostrap']
    # tirantes de la mochila: anillo alrededor de cada hombro
    # tirantes de la mochila: anillo ceñido a la base del brazo + dos tramos que siguen hacia la mochila
    for s in (1, -1):
        da = (a - s * math.pi / 2) / 0.36; dz = (z - SHOULDER[2] - 0.01) / 0.1
        if abs(math.hypot(da, dz) - 1) < 0.17:
            return C['strap']
        if s * a > math.pi / 2 + 0.25 and (abs(z - 0.555) < 0.011 or abs(z - 0.365) < 0.011):
            return C['strap']
    if z < BELT[0]:
        return vary(C['shorts'] if x % 2 else C['shorts_d'], 3)
    if z < BELT[1]:
        if abs(a) < 0.16:
            edge = abs(a) > 0.1 or z < BELT[0] + 0.008 or z > BELT[1] - 0.008
            return C['buckle'] if edge else C['belt']
        return vary(C['belt'], 3)
    return vary(skin_rgb(z), 2)


tex(M['body'], 'n64_tx_cuerpo', BW, BH, body_px)
tex(M['skin'], 'n64_tx_piel', 8, 8, lambda x, y: vary(skin_rgb(0.5), 3))
tex(M['foot'], 'n64_tx_pie', 16, 16, lambda x, y: C['sole'] if x in (5, 6, 10, 11) else vary(skin_rgb(0.5), 3))
tex(M['glove'], 'n64_tx_guante', 8, 8, lambda x, y: [v + 16 for v in C['glove']] if y >= 6 else vary(C['glove'], 3))

# cara: columna frontal plana. Proyección: u = y en [-FW/2, FW/2], v = z en FACE_Z.
FW = 0.24
FACE_W, FACE_H = 64, 32
EYE_Y, EYE_Z, EYE_RY, EYE_RZ = 0.057, 0.668, 0.0135, 0.018


def face_px(closed):
    def fn(x, y):
        yy = ((x + 0.5) / FACE_W - 0.5) * FW
        z = FACE_Z[0] + (y + 0.5) / FACE_H * (FACE_Z[1] - FACE_Z[0])
        for s in (1, -1):
            dy, dz = (yy - s * EYE_Y) / EYE_RY, (z - EYE_Z) / EYE_RZ
            if closed:
                if abs(dy) < 1 and abs(z - (EYE_Z - 0.004 + 0.006 * dy * dy)) < 0.0035:
                    return C['eye']
            elif dy * dy + dz * dz < 1:
                hl = ((yy - s * EYE_Y - 0.004) / 0.0045) ** 2 + ((z - EYE_Z - 0.006) / 0.005) ** 2 < 1
                return [250, 250, 250] if hl else C['eye']
        return vary(skin_rgb(z), 2)
    return fn


tex(M['face'], 'n64_tx_cara', FACE_W, FACE_H, face_px(False))
closed = bpy.data.images.get('n64_tx_cara_cerrada')
if closed: bpy.data.images.remove(closed)
_img = bpy.data.images.new('n64_tx_cara_cerrada', FACE_W, FACE_H)
_px = []
_fn = face_px(True)
for y in range(FACE_H):
    for x in range(FACE_W):
        c = q5(_fn(x, y)); _px += [c[0] / 255, c[1] / 255, c[2] / 255, 1]
_img.pixels = _px; _img.pack(); _img.use_fake_user = True   # el juego la usa para parpadear y dormir

# casco: trama + cinta (abajo) + flor al frente. u = ángulo (0.5 = frente), v = altura del domo.
HW, HH = 64, 32


def helmet_px(x, y):
    if y < 5:
        return vary(C['band'], 3)
    fx, fy = HW / 2, 15.5
    dx, dy = x + 0.5 - fx, y + 0.5 - fy
    if dx * dx + dy * dy <= 1.6 ** 2:
        return C['center']
    for k in range(5):
        a = math.pi / 2 + TAU * k / 5
        px, py = fx + 2.8 * math.cos(a), fy + 2.8 * math.sin(a)
        d = (x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2
        if d <= 1.9 ** 2:
            return C['petal'] if d > 0.8 else C['petal_l']
    return vary(C['helmet'] if (x // 3 + y // 3) % 2 else C['helmet_d'], 3)


tex(M['helmet'], 'n64_tx_casco', HW, HH, helmet_px)


# mochila: la cara trasera tiene bolsillo y hebilla; el resto es lona lisa (u < 0.25)
def pack_px(x, y):
    if x < 8:
        return vary(C['pack'], 3)
    u, v = (x - 8) / 24, y / 32
    if 0.2 < u < 0.8 and 0.12 < v < 0.5:
        edge = u < 0.25 or u > 0.75 or v < 0.17 or v > 0.45
        return C['pack_d'] if not edge else [70, 54, 34]
    if 0.44 < u < 0.56 and 0.66 < v < 0.78:
        return C['buckle']
    if v > 0.62:
        return vary(C['pack_d'], 3)   # tapa
    return vary(C['pack'], 3)


tex(M['pack'], 'n64_tx_mochila', 32, 32, pack_px)
tex(M['roll'], 'n64_tx_saco', 8, 32, lambda x, y: C['belt'] if y in (7, 8, 23, 24) else vary(C['roll'] if (y // 4) % 2 == 0 else C['roll_l'], 4))
tex(M['bino'], 'n64_tx_binocular', 8, 16, lambda x, y: C['lens'] if y < 2 else vary(C['bino'], 3))
tex(M['scarf'], 'n64_tx_bufanda', 16, 8, lambda x, y: (60, 110, 180) if x % 8 < 4 else (230, 220, 200))
tex(M['book'], 'n64_tx_libreta', 16, 16, lambda x, y: (60, 40, 30) if x < 2 else vary((90, 140, 90), 5))


def mapa(x, y):
    y = 23 - y
    if x == 0 or y == 0 or x == 31 or y == 23: return (120, 92, 52)
    cx = 3 + y * 1.1 + math.sin(y * 0.9) * 1.5
    if abs(x - cx) < 1.6: return (200, 150, 60) if (x + y) % 5 == 0 else (150, 110, 60)
    if x > cx + 1.6: return vary((96, 140, 180), 5)
    return vary((232, 216, 176), 5)


tex(M['map'], 'n64_tx_mapa', 32, 24, mapa)

# ---------- colección limpia ----------
col = bpy.data.collections.get('Poroto_N64')
if not col:
    col = bpy.data.collections.new('Poroto_N64'); bpy.context.scene.collection.children.link(col)
for o in list(col.objects):
    bpy.data.objects.remove(o, do_unlink=True)
for me in list(bpy.data.meshes):
    if me.users == 0: bpy.data.meshes.remove(me)


# ---------- utilidades ----------
def link(name, me, parent=None, m=None):
    o = bpy.data.objects.new(name, me); col.objects.link(o)
    if parent: o.parent = parent
    if m: me.materials.append(m)
    return o


def empty(name, loc, parent=None):
    e = bpy.data.objects.new(name, None); col.objects.link(e); e.empty_display_size = 0.05
    e.parent = parent; e.location = loc
    return e


def shade(o, sharp_deg=None):
    for p in o.data.polygons: p.use_smooth = True
    if sharp_deg is not None:
        o.data.set_sharp_from_angle(angle=math.radians(sharp_deg))
    return o


def loft(name, rings, sides, rot=0.0, uv_v=None, sy=1.0):
    """Sección poligonal a lo largo de Z. rings: (z, frente, costado, espalda) o (z, r).
    Radio 0 = polo. Costura duplicada atrás para UV limpias: u = 0.5 al frente, v = altura (o uv_v(z))."""
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap'); rows = []
    zs = [r[0] for r in rings]; z0, z1 = min(zs), max(zs)
    for r in rings:
        z = r[0]
        F, S, B = (r[1], r[1], r[1]) if len(r) == 2 else r[1:]
        if F == S == B == 0:
            rows.append(None); continue
        row = []
        for k in range(sides + 1):
            a = rot + math.pi + TAU * k / sides          # empieza atrás: la costura queda en la espalda
            ca, sa = math.cos(a), math.sin(a)
            v = bm.verts.new((ca * (F if ca > 0 else B), sa * S * sy, z))
            row.append((v, k / sides + rot / TAU))   # u = 0.5 justo al frente
        rows.append(row)
    vv = (lambda z: (z - z0) / ((z1 - z0) or 1)) if uv_v is None else uv_v
    poles = {}
    for i, r in enumerate(rings):
        if rows[i] is None:
            poles[i] = bm.verts.new((0, 0, r[0]))
    for i in range(len(rings) - 1):
        a, b = rows[i], rows[i + 1]
        for k in range(sides):
            if a is None:
                f = bm.faces.new((poles[i], b[k + 1][0], b[k][0]))
                uvs = [((b[k][1] + b[k + 1][1]) / 2, vv(rings[i][0])), (b[k + 1][1], vv(rings[i + 1][0])), (b[k][1], vv(rings[i + 1][0]))]
            elif b is None:
                f = bm.faces.new((a[k][0], a[k + 1][0], poles[i + 1]))
                uvs = [(a[k][1], vv(rings[i][0])), (a[k + 1][1], vv(rings[i][0])), ((a[k][1] + a[k + 1][1]) / 2, vv(rings[i + 1][0]))]
            else:
                f = bm.faces.new((a[k][0], a[k + 1][0], b[k + 1][0], b[k][0]))
                uvs = [(a[k][1], vv(rings[i][0])), (a[k + 1][1], vv(rings[i][0])), (b[k + 1][1], vv(rings[i + 1][0])), (b[k][1], vv(rings[i + 1][0]))]
            for l, uv in zip(f.loops, uvs): l[uvl].uv = uv
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)   # une la costura en posición (UV quedan separadas)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    return me


def box(name, sx, sy, sz, drop=(), top_scale=1.0):
    """Caja (opcionalmente tronco de pirámide) sin las caras de `drop`; UV 0..1 por cara."""
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    uvl = bm.loops.layers.uv.new('UVMap')
    kill = [f for f in bm.faces for d in drop if f.normal['xyz'.index(d[1])] * (1 if d[0] == '+' else -1) > 0.9]
    bmesh.ops.delete(bm, geom=list(set(kill)), context='FACES')
    for v in bm.verts:
        k = top_scale if v.co.z > 0 else 1.0
        v.co = Vector((v.co.x * sx * k, v.co.y * sy * k, v.co.z * sz))
    for f in bm.faces:
        for l, uv in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))): l[uvl].uv = uv
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    return me


def disc(name, r, n, ry=None):
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap')
    vs = [bm.verts.new((0, r * math.cos(TAU * i / n), (ry or r) * math.sin(TAU * i / n))) for i in range(n)]
    f = bm.faces.new(vs)
    for l in f.loops: l[uvl].uv = (0.5, 0.5)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    return me


def strip(name, pts, width, height, normals):
    """Tira con perfil ">" pegada a una superficie (bigote)."""
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap'); rows = []
    n = len(pts)
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        nn = normals[i]; side = t.cross(nn).normalized() * (width[i] / 2)
        base = p - nn * 0.003
        rows.append((bm.verts.new(base - side), bm.verts.new(p + nn * height[i]), bm.verts.new(base + side)))
    for i in range(n - 1):
        for k in (0, 1):
            f = bm.faces.new((rows[i][k], rows[i + 1][k], rows[i + 1][k + 1], rows[i][k + 1]))
            for l in f.loops: l[uvl].uv = (0.5, 0.5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    return me


# ---------- jerarquía ----------
root = empty('Poroto', (0, 0, 0))
body = empty('cuerpo', (0, 0, 0), root)

# cuerpo octogonal; la columna frontal entre FACE_Z usa la textura de la cara (proyección plana)
core = link('nucleo', loft('poroto_cuerpo', BODY, 8, rot=math.radians(22.5)), body, M['body'])
core.data.materials.append(M['face'])
uv = core.data.uv_layers[0]
for p in core.data.polygons:
    c = p.center
    if c.x > 0 and abs(math.atan2(c.y, c.x)) < math.radians(22.5) and FACE_Z[0] - 1e-4 < c.z < FACE_Z[1] + 1e-4:
        p.material_index = 1
        for li in p.loop_indices:
            v = core.data.vertices[core.data.loops[li].vertex_index].co
            uv.data[li].uv = (v.y / FW + 0.5, (v.z - FACE_Z[0]) / (FACE_Z[1] - FACE_Z[0]))
shade(core, 55)

bm = bmesh.new(); bm.from_mesh(core.data); bm.transform(core.matrix_world)
BVH = BVHTree.FromBMesh(bm); bm.free()


def hit(origin, direction, off=0.0):
    loc, nrm, _, _ = BVH.ray_cast(origin, direction.normalized())
    return (loc + nrm * off, nrm) if loc else (None, None)


# bigote de manubrio (geometría: define la silueta)
half = [(0.0, 0.0, 0.036), (0.04, -0.012, 0.03), (0.085, -0.004, 0.02), (0.11, 0.028, 0.012), (0.098, 0.045, 0.008)]
seq = [(-y, dz, w) for y, dz, w in reversed(half[1:])] + half
pts, nrms = [], []
for y, dz, w in seq:
    p, n = hit(Vector((0, 0, 0.585 + dz)), Vector((1, y / 0.22, 0)))
    pts.append(p); nrms.append(n)
link('bigote', strip('bigote', pts, [w for *_, w in seq], [w * 0.45 for *_, w in seq], nrms), body, M['stache'])

# casco (salacot) octogonal; cinta y flor pintadas; ala plana de doble cara
hat = empty('gorro', (-0.012, 0, 0.765), body); hat.rotation_euler.y = math.radians(-9)
DOME = [(0.0, 0.205, 0.205, 0.205), (0.11, 0.175, 0.175, 0.175), (0.2, 0.0, 0.0, 0.0)]
shade(link('casco', loft('casco', DOME, 8, rot=math.radians(22.5), sy=0.95), hat, M['helmet']))
brim = loft('casco_ala', [(-0.045, 0.34, 0.34, 0.34), (0.0, 0.205, 0.205, 0.205)], 8, rot=math.radians(22.5), sy=0.93)
for l in brim.uv_layers[0].data: l.uv = (0.1, 0.9)   # zona lisa de la trama
shade(link('casco_ala', brim, hat, M['helmet']))

# brazos tipo Popeye (6 lados) + guante con puño
ARM = [(0.03, 0.058), (-0.045, 0.062), (-0.1, 0.044), (-0.15, 0.07), (-0.2, 0.046)]
GLOVE = [(0.012, 0.056), (-0.012, 0.058), (-0.05, 0.062), (-0.09, 0.04), (-0.1, 0.0)]
for s, side in ((1, 'I'), (-1, 'D')):
    a = empty(f'brazo_{side}', Vector((SHOULDER[0], s * SHOULDER[1], SHOULDER[2])), body)
    a.rotation_euler.x = s * math.radians(12)
    shade(link(f'brazo_{side}_malla', loft('brazo', ARM, 6), a, M['skin']))
    g = empty(f'mano_{side}', (0, 0, -0.205), a)
    shade(link(f'guante_{side}', loft('guante', GLOVE, 6, uv_v=lambda z: 1 - (0.012 - z) / 0.112 * 0.9), g, M['glove']))
    th = box('pulgar', 0.03, 0.028, 0.045, top_scale=0.6)
    t = shade(link(f'pulgar_{side}', th, g, M['glove'])); t.location = (0.05, -s * 0.02, -0.04); t.rotation_euler.y = math.radians(25)

# piernas: pantorrilla ancha → tobillo; pie casi plano con sandalia pintada + suela
LEG = [(0.24, 0.06), (0.14, 0.076), (0.04, 0.032)]
for s, side in ((1, 'I'), (-1, 'D')):
    f = empty(f'pata_{side}', (0, s * 0.1, 0), root)
    shade(link(f'pierna_{side}', loft('pierna', LEG, 6), f, M['skin']))
    foot = box('pie', 0.15, 0.09, 0.034, drop=('-z',), top_scale=0.7)
    fo = link(f'pie_{side}', foot, f, M['foot']); fo.location = (0.035, 0, 0.033)
    # UV del pie: proyección desde arriba (las tiras de la sandalia cruzan el empeine)
    for p in foot.polygons:
        for li in p.loop_indices:
            v = foot.vertices[foot.loops[li].vertex_index].co
            foot.uv_layers[0].data[li].uv = (v.x / 0.15 + 0.5, v.y / 0.09 + 0.5)
    shade(fo, 50)
    so = link(f'suela_{side}', box('suela', 0.18, 0.105, 0.016), f, M['sole']); so.location = (0.035, 0, 0.008)
    shade(so, 30)

# mochila: caja (sin la cara pegada al cuerpo) + saco de dormir hexagonal
PX = -0.2 - 0.06
pack = empty('mochila', (PX, 0, 0.47), body)
pm = box('mochila', 0.12, 0.32, 0.32, drop=('+x',))
for p in pm.polygons:   # la espalda de la mochila (−X) lleva bolsillo y hebilla; el resto, lona lisa
    back = p.normal.x < -0.9
    for li, (u, v) in zip(p.loop_indices, ((0, 0), (1, 0), (1, 1), (0, 1))):
        pm.uv_layers[0].data[li].uv = (0.25 + 0.75 * u, v) if back else (0.1 + 0.1 * u, 0.4 + 0.2 * v)
    if back:   # orienta la textura: u a lo ancho (Y), v hacia arriba (Z)
        for li in p.loop_indices:
            co = pm.vertices[pm.loops[li].vertex_index].co
            pm.uv_layers[0].data[li].uv = (0.25 + 0.75 * (0.5 - co.y / 0.32), co.z / 0.32 + 0.5)
shade(link('mochila_cuerpo', pm, pack, M['pack']), 30)
roll = loft('saco', [(-0.16, 0.0), (-0.15, 0.055), (0.15, 0.055), (0.16, 0.0)], 6, uv_v=lambda z: (z + 0.16) / 0.32)
ro = shade(link('saco_dormir', roll, pack, M['roll'])); ro.rotation_euler.x = math.radians(90); ro.location = (0, 0, 0.215)

# binoculares: dos prismas hexagonales que cuelgan (lentes pintados abajo)
BZ = 0.36
bino = empty('binoculares', (0.255, 0, BZ), body)
for s in (1, -1):
    t = shade(link('binocular_tubo', loft('tubo', [(-0.056, 0.0), (-0.055, 0.032), (0.05, 0.03), (0.051, 0.0)], 6,
                                               uv_v=lambda z: 0.0 if z < -0.0555 else 0.2 + (z + 0.055) / 0.106 * 0.8), bino, M['bino']))
    t.location = (0, s * 0.031, 0)

# lentes de sol (se muestran/ocultan): dos octógonos + puente + patillas planas
gl = empty('lentes_sol', (0, 0, 0), body)
for s in (1, -1):
    p, n = hit(Vector((0, 0, EYE_Z)), Vector((1, s * EYE_Y / 0.2, 0)), 0.018)
    ln = link('lente_sol', disc('lente_sol', 0.028, 8, 0.024), gl, M['shades']); ln.location = p
    ln.rotation_euler.z = math.atan2(n.y, n.x)
    q0, _ = hit(Vector((0, 0, EYE_Z + 0.005)), Vector((1, s * 0.9, 0)), 0.008)
    q1, _ = hit(Vector((0, 0, EYE_Z + 0.01)), Vector((0.05, s, 0)), 0.008)
    bm = bmesh.new()
    vs = [bm.verts.new(q0 + Vector((0, 0, 0.004))), bm.verts.new(q1 + Vector((0, 0, 0.004))),
          bm.verts.new(q1 - Vector((0, 0, 0.004))), bm.verts.new(q0 - Vector((0, 0, 0.004)))]
    bm.faces.new(vs); me = bpy.data.meshes.new('patilla'); bm.to_mesh(me); bm.free()
    link('patilla', me, gl, M['frame'])
c0, _ = hit(Vector((0, 0, EYE_Z + 0.004)), Vector((1, 0, 0)), 0.02)
bm = bmesh.new()
vs = [bm.verts.new(c0 + Vector((0, 0.03, 0.003))), bm.verts.new(c0 + Vector((0, -0.03, 0.003))),
      bm.verts.new(c0 + Vector((0, -0.03, -0.003))), bm.verts.new(c0 + Vector((0, 0.03, -0.003)))]
bm.faces.new(vs); me = bpy.data.meshes.new('puente_lentes'); bm.to_mesh(me); bm.free()
link('puente_lentes', me, gl, M['frame'])

# props ocultos que el juego activa (bufanda, libreta, lápiz, mapa)
sc_ = shade(link('bufanda', loft('bufanda', [(0.405, 0.238, 0.322, 0.222), (0.475, 0.245, 0.33, 0.228)], 8, rot=math.radians(22.5)), body, M['scarf']))
nb = link('libreta', box('libreta', 0.11, 0.15, 0.02), body, M['book']); nb.location = (0.33, 0.0, 0.36)   # al frente, entre las manos
pc = link('lapiz', loft('lapiz', [(-0.055, 0.0), (-0.045, 0.008), (0.055, 0.008), (0.056, 0.0)], 4), body, M['pencil'])
pc.location = (0.35, -0.03, 0.4); pc.rotation_euler.x = math.radians(60)
mp = link('mapa_mano', box('mapa', 0.004, 0.38, 0.28), body, M['map']); mp.location = (0.33, 0, 0.45)
for o in (sc_, nb, pc, mp):
    o.hide_set(True); o.hide_render = True


def bake_vertex_ao(strength=0.45, samples=24):
    """Hornea oclusión ambiental en un atributo de color por vértice ('Col') y lo multiplica por la textura.
    Es la sombra 'pintada' de los modelos N64: no depende de la luz del motor."""
    sc = bpy.context.scene
    prev = sc.render.engine
    sc.render.engine = 'CYCLES'; sc.cycles.samples = samples
    meshes = [o for o in col.objects if o.type == 'MESH' and not o.hide_render]
    for o in meshes:
        me = o.data
        if 'Col' in me.color_attributes: me.color_attributes.remove(me.color_attributes['Col'])
        ca = me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
        me.color_attributes.active_color = ca
    for o in meshes:
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
    sc.render.engine = prev
    # material: base = textura × mezcla(1, AO, strength)
    for m in {s.material for o in meshes for s in o.material_slots if s.material}:
        nt = m.node_tree; b = nt.nodes['Principled BSDF']
        for n in [n for n in nt.nodes if n.name in ('ao_attr', 'ao_mix', 'ao_mul')]: nt.nodes.remove(n)
        src = b.inputs['Base Color'].links[0].from_socket if b.inputs['Base Color'].is_linked else None
        attr = nt.nodes.new('ShaderNodeVertexColor'); attr.name = 'ao_attr'; attr.layer_name = 'Col'; attr.location = (-500, -100)
        mix = nt.nodes.new('ShaderNodeMix'); mix.name = 'ao_mix'; mix.data_type = 'RGBA'; mix.location = (-300, -100)
        mix.inputs['Factor'].default_value = strength
        mix.inputs['A'].default_value = (1, 1, 1, 1); nt.links.new(attr.outputs['Color'], mix.inputs['B'])
        mul = nt.nodes.new('ShaderNodeMix'); mul.name = 'ao_mul'; mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.location = (-150, 150)
        mul.inputs['Factor'].default_value = 1.0
        if src: nt.links.new(src, mul.inputs['A'])
        else: mul.inputs['A'].default_value = b.inputs['Base Color'].default_value[:]
        nt.links.new(mix.outputs['Result'], mul.inputs['B'])
        nt.links.new(mul.outputs['Result'], b.inputs['Base Color'])


def show_glasses(on):
    for o in [gl] + list(gl.children_recursive):
        o.hide_render = not on; o.hide_set(not on)


def tri_count(visible_only=True):
    n = 0
    for o in col.objects:
        if o.type == 'MESH' and not (visible_only and o.hide_render):
            n += sum(len(p.vertices) - 2 for p in o.data.polygons)
    return n


def export_glb(path):
    hidden = [o for o in col.objects if o.hide_get()]
    for o in hidden: o.hide_set(False)
    bpy.ops.object.select_all(action='DESELECT')
    for o in col.objects: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                              export_yup=True, export_cameras=False, export_lights=False)
    for o in hidden: o.hide_set(True)


show_glasses(False)
bpy.context.view_layer.update()

if '--' in sys.argv and '--export' in sys.argv:
    export_glb(sys.argv[sys.argv.index('--export') + 1])
