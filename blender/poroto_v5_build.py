# Construye a Poroto (explorador, estilo N64) desde cero en la colección "Poroto".
# Uso en vivo (MCP): exec(open('blender/poroto_build.py').read())
# Uso headless:      Blender --background --python blender/poroto_build.py -- --export models/poroto.glb
# Convención: frente = +X, arriba = +Z (el exportador glTF lo pasa a Y-up; frente sigue en +X como en el juego).
#
# Criterios (ver blender/NOTAS.md): piezas rígidas separadas por articulación, presupuesto bajo de triángulos,
# texturas chicas con filtro bilineal, detalles pegados a la superficie (perfil ">") en vez de tubos flotantes,
# y nada de caras escondidas dentro de otras piezas.
import bpy, bmesh, math, random, sys
from mathutils import Vector

# ---------- forma: cápsula + cachetes (la superficie de referencia es la unión de ambos) ----------
R, RY = 0.2125, 0.235                     # radio en profundidad (X) y ancho (Y)
Z0, Z1, RB, RT = 0.30, 0.62, 0.18, 0.25   # tramo recto y radios verticales de las tapas
ZMIN, ZMAX = Z0 - RB, Z1 + RT
BELT = (0.300, 0.338)                     # franja del cinturón (pintada en la textura)
CHEEKS = [(Vector((0.0, s * 0.11, 0.55)), 0.2135) for s in (1, -1)]
FACE = (Vector((0.02, 0.0, 0.58)), 0.19)                                    # volumen frontal del rostro
SHOULDERS = [(Vector((-0.01, s * 0.25, 0.44)), 0.105) for s in (1, -1)]     # hombros anchos
BLEND = 0.06                                                                # suavidad de la fusión


def f_capsule(p):
    zc = min(max(p.z, Z0), Z1); dz = p.z - zc; rz = RB if p.z < Z0 else RT
    return (math.sqrt((p.x / R) ** 2 + (p.y / RY) ** 2 + (dz / rz) ** 2) - 1) * 0.22


def smin(a, b, k=BLEND):
    h = max(k - abs(a - b), 0) / k
    return min(a, b) - h * h * k * 0.25


def field(p):
    """Distancia aproximada a la superficie del cuerpo: cápsula fundida suavemente con cachetes, rostro y hombros."""
    d = f_capsule(p)
    for c, r in CHEEKS + [FACE] + SHOULDERS:
        d = smin(d, (p - c).length - r)
    return d


def normal(p, e=0.002):
    return Vector((field(p + Vector((e, 0, 0))) - field(p - Vector((e, 0, 0))),
                   field(p + Vector((0, e, 0))) - field(p - Vector((0, e, 0))),
                   field(p + Vector((0, 0, e))) - field(p - Vector((0, 0, e))))).normalized()


def surf(o, d, off=0.0):
    """Punto de la superficie (cuerpo + cachetes) al lanzar un rayo desde o (adentro) en dirección d."""
    d = d.normalized(); lo, hi = 0.0, 1.0
    for _ in range(30):
        m = (lo + hi) / 2
        if field(o + d * m) < 0: lo = m
        else: hi = m
    return o + d * (lo + off)


def side_pt(x, z, s, off=0.0):
    """Punto sobre el costado s (+1 izquierda, -1 derecha) a profundidad x y altura z."""
    return surf(Vector((x, 0, z)), Vector((0, s, 0)), off)


def half_x(y, z):
    zc = min(max(z, Z0), Z1); dz = z - zc; rz = RB if z < Z0 else RT
    return R * math.sqrt(max(1 - (y / RY) ** 2 - (dz / rz) ** 2, 0))


# ---------- materiales y texturas ----------
# Los colores del script son los de referencia; si el material ya existe en la escena se respeta
# el color que tenga (así no se pierden los ajustes hechos a mano en Blender).
rnd = random.Random(5)


def srgb(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def vary(c, a):
    return [max(0, min(255, v + rnd.uniform(-a, a))) for v in c]


def mat(name, rgb, rough=0.8, textured=False):
    m = bpy.data.materials.get(name)
    fresh = m is None
    if fresh:
        m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    if fresh or textured:
        b.inputs['Base Color'].default_value = (*[srgb(c) for c in rgb], 1)
        b.inputs['Roughness'].default_value = rough
    for n in [n for n in m.node_tree.nodes if n.type == 'TEX_IMAGE']:
        m.node_tree.nodes.remove(n)
    return m


def tex(m, imgname, w, h, fn):
    """fn(x, y) con y=0 abajo (v=0)."""
    img = bpy.data.images.get(imgname)
    if img: bpy.data.images.remove(img)
    img = bpy.data.images.new(imgname, w, h)
    px = []
    for y in range(h):
        for x in range(w):
            c = fn(x, y); px += [c[0] / 255, c[1] / 255, c[2] / 255, 1]
    img.pixels = px; img.pack()
    nt = m.node_tree
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = img; t.interpolation = 'Linear'
    nt.links.new(t.outputs['Color'], nt.nodes['Principled BSDF'].inputs['Base Color'])


# material agregado a mano para la correa de los binoculares
if 'Material.001' in bpy.data.materials and 'poroto_correa_binocular' not in bpy.data.materials:
    bpy.data.materials['Material.001'].name = 'poroto_correa_binocular'

TEXTURED = {'body', 'skin', 'helmet', 'pack', 'blanket', 'scarf', 'book', 'map'}
M = {k: mat(*v, textured=k in TEXTURED) for k, v in {
    'body': ('poroto_piel', (200, 154, 100), 0.5),
    'skin': ('poroto_piel_brazos', (200, 154, 100), 0.5),
    'eye': ('poroto_ojo', (22, 18, 20), 0.3),
    'stache': ('poroto_bigote', (62, 40, 28), 0.7),
    'helmet': ('poroto_casco', (212, 192, 140), 0.7),
    'band': ('poroto_casco_cinta', (110, 78, 48), 0.7),
    'glove': ('poroto_guante', (112, 76, 50), 0.7),
    'boot': ('poroto_bota', (42, 15, 12), 0.7),
    'pack': ('poroto_mochila', (122, 98, 62), 0.8),
    'packd': ('poroto_mochila_tapa', (96, 74, 46), 0.8),
    'buckle': ('poroto_hebilla', (214, 176, 70), 0.35),
    'belt': ('poroto_cinturon', (84, 56, 36), 0.6),
    'blanket': ('poroto_manta', (170, 60, 50), 0.9),
    'bino': ('poroto_binocular', (92, 103, 51), 0.5),
    'lens': ('poroto_lente', (110, 150, 170), 0.2),
    'strap': ('poroto_correa', (115, 63, 77), 0.7),
    'binostrap': ('poroto_correa_binocular', (95, 111, 231), 0.5),
    'shades': ('poroto_lentes_sol', (18, 18, 24), 0.12),
    'frame': ('poroto_lentes_marco', (40, 32, 28), 0.4),
    'scarf': ('poroto_bufanda', (60, 110, 180), 0.9),
    'book': ('poroto_libreta', (90, 140, 90), 0.8),
    'pencil': ('poroto_lapiz', (224, 192, 64), 0.6),
    'map': ('poroto_mapa', (232, 216, 176), 0.9),
}.items()}
# cintas, ala del casco y lentes se ven por ambas caras
for k in ('strap', 'binostrap', 'frame', 'helmet'):
    M[k].use_backface_culling = False

# cuerpo: short + cinturón con hebilla + piel, en una sola textura (v = altura, u = 0.5 al frente)
BH = 64


def skin_rgb(z):
    t = min(max((z - BELT[1]) / (ZMAX - BELT[1]), 0), 1)
    return [188 + 20 * t, 142 + 18 * t, 90 + 14 * t]


def body_px(x, y):
    z = ZMIN + (y + 0.5) / BH * (ZMAX - ZMIN)
    if z < BELT[0]:
        return vary([140, 132, 86] if x % 2 else [128, 120, 78], 4)
    if z < BELT[1]:
        if 14 <= x <= 17:
            edge = x in (14, 17) or z < BELT[0] + 0.007 or z > BELT[1] - 0.007
            return [214, 176, 70] if edge else [84, 56, 36]
        return vary([84, 56, 36], 3)
    return vary(skin_rgb(z), 3)


tex(M['body'], 'tx_cuerpo', 32, BH, body_px)
tex(M['skin'], 'tx_piel', 8, 8, lambda x, y: vary(skin_rgb(0.55), 3))

# casco: trama de fibra + flor rosa de centro amarillo al frente
FW, FH = 128, 32
FC = (FW / 2, 13.5)


def helmet_px(x, y):
    dx, dy = x - FC[0], y - FC[1]
    if dx * dx + dy * dy <= 2.2 ** 2:
        return [250, 206, 60]
    for k in range(5):
        a = math.pi / 2 + 2 * math.pi * k / 5
        px, py = FC[0] + 3.6 * math.cos(a), FC[1] + 3.6 * math.sin(a)
        if (x - px) ** 2 + (y - py) ** 2 <= 2.4 ** 2:
            return [238, 128, 168] if (x - px) ** 2 + (y - py) ** 2 > 1.2 else [248, 160, 192]
    return vary([212, 192, 140] if (x // 4 + y // 4) % 2 else [206, 186, 135], 4)


tex(M['helmet'], 'tx_casco', FW, FH, helmet_px)
tex(M['pack'], 'tx_mochila', 16, 16, lambda x, y: vary([122, 98, 62] if (x + y) % 2 else [112, 90, 56], 4))
tex(M['blanket'], 'tx_manta', 32, 8, lambda x, y: vary([176, 60, 50] if x % 8 < 5 else [232, 220, 196], 5))
tex(M['scarf'], 'tx_bufanda', 32, 8, lambda x, y: vary([60, 110, 180] if x % 8 < 4 else [230, 220, 200], 5))
tex(M['book'], 'tx_libreta', 16, 16, lambda x, y: [60, 40, 30] if x < 2 else vary([90, 140, 90], 6))


def mapa(x, y):
    y = 23 - y
    if x == 0 or y == 0 or x == 31 or y == 23: return [120, 92, 52]
    cx = 3 + y * 1.1 + math.sin(y * 0.9) * 1.5
    if abs(x - cx) < 1.6: return [200, 150, 60] if (x + y) % 5 == 0 else [150, 110, 60]
    if x > cx + 1.6: return vary([96, 140, 180], 6)
    return vary([232, 216, 176], 6)


tex(M['map'], 'tx_mapa', 32, 24, mapa)

# ---------- colección limpia ----------
col = bpy.data.collections.get('Poroto')
if not col:
    col = bpy.data.collections.new('Poroto'); bpy.context.scene.collection.children.link(col)
for o in list(col.objects):
    bpy.data.objects.remove(o, do_unlink=True)
for me in list(bpy.data.meshes):
    if me.users == 0: bpy.data.meshes.remove(me)
for m in list(bpy.data.materials):
    if m.users == 0 and not m.use_fake_user and m not in M.values(): bpy.data.materials.remove(m)
for im in list(bpy.data.images):
    if im.users == 0: bpy.data.images.remove(im)


# ---------- utilidades de malla ----------
def link(name, me, parent=None, m=None):
    o = bpy.data.objects.new(name, me); col.objects.link(o)
    if parent: o.parent = parent
    if m: me.materials.append(m)
    return o


def empty(name, loc, parent=None):
    e = bpy.data.objects.new(name, None); col.objects.link(e); e.empty_display_size = 0.06
    e.parent = parent; e.location = loc
    return e


def smooth(o):
    for p in o.data.polygons: p.use_smooth = True
    return o


def revolve(name, prof, seg=16, sy=1.0, sx=1.0):
    """Perfil [(r, z)] de abajo hacia arriba (r=0 en los polos; si el primero/último no es 0 queda abierto).
    UV: u=0.5 al frente (+X), v por altura."""
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap'); rings = []
    zs = [z for _, z in prof]; z0, dz = min(zs), (max(zs) - min(zs)) or 1
    for r, z in prof:
        if r < 1e-6: rings.append([bm.verts.new((0, 0, z))])
        else: rings.append([bm.verts.new((sx * r * math.cos(2 * math.pi * i / seg), sy * r * math.sin(2 * math.pi * i / seg), z)) for i in range(seg)])
    for a, b in zip(rings, rings[1:]):
        for i in range(seg):
            j = (i + 1) % seg
            if len(a) == 1: vs, us = (a[0], b[j], b[i]), (i + 0.5, j or seg, i)
            elif len(b) == 1: vs, us = (a[i], a[j], b[0]), (i, j or seg, i + 0.5)
            else: vs, us = (a[i], a[j], b[j], b[i]), (i, j or seg, j or seg, i)
            f = bm.faces.new(vs)
            for l, u in zip(f.loops, us):
                l[uvl].uv = ((u / seg + 0.5) % 1.0 if u < seg else 1.5, (l.vert.co.z - z0) / dz)
            uu = [l[uvl].uv.x for l in f.loops]   # la costura queda atrás (u=0/1)
            if max(uu) - min(uu) > 0.5:
                for l in f.loops:
                    if l[uvl].uv.x < 0.5: l[uvl].uv.x += 1
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    return me


def ellipsoid(name, rx, ry, rz, seg=8, rings=4, flat_bottom=None):
    prof = [(math.sin(math.pi * j / rings), -math.cos(math.pi * j / rings)) for j in range(rings + 1)]
    prof = [(r * rx, z * rz) for r, z in prof]
    if flat_bottom is not None:
        prof = [(r, max(z, flat_bottom)) for r, z in prof]
    return revolve(name, prof, seg, ry / rx)


def wedge(name, pts, widths, height, parent, m, closed=False, nrm=None):
    """Tira pegada a la superficie con perfil ">" (dos caras que se juntan en una arista hacia afuera).
    widths: ancho sobre la superficie en cada punto; height: cuánto sobresale la arista."""
    pts = [Vector(p) for p in pts]; n = len(pts)
    widths = widths if isinstance(widths, (list, tuple)) else [widths] * n
    heights = height if isinstance(height, (list, tuple)) else [height] * n
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap'); rows = []
    for i, p in enumerate(pts):
        a = pts[(i - 1) % n] if closed or i > 0 else p
        b = pts[(i + 1) % n] if closed or i < n - 1 else p
        t = (b - a).normalized()
        nn = nrm(p) if nrm else normal(p)
        side = t.cross(nn).normalized() * (widths[i] / 2)
        base = p - nn * 0.002
        rows.append((bm.verts.new(base - side), bm.verts.new(p + nn * heights[i]), bm.verts.new(base + side)))
    segs = [(i, (i + 1) % n) for i in range(n if closed else n - 1)]
    for i, j in segs:
        for k in (0, 1):
            f = bm.faces.new((rows[i][k], rows[j][k], rows[j][k + 1], rows[i][k + 1]))
            for l, uv in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))): l[uvl].uv = uv
    if not closed:
        for r in (rows[0], rows[-1]):
            if (r[0].co - r[2].co).length > 1e-5: bm.faces.new(r)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    return smooth(link(name, me, parent, m))


def box(name, sx, sy, sz, parent, m, drop=(), bevel=0.0):
    """Caja; drop = caras a omitir ('+x','-x','+y','-y','+z','-z') porque quedan tapadas."""
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    uvl = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        for l, uv in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))): l[uvl].uv = uv
    kill = []
    for f in bm.faces:
        c = f.normal
        for d in drop:
            ax = 'xyz'.index(d[1]); sgn = 1 if d[0] == '+' else -1
            if c[ax] * sgn > 0.9: kill.append(f)
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    for v in bm.verts: v.co = Vector((v.co.x * sx, v.co.y * sy, v.co.z * sz))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = link(name, me, parent, m)
    if bevel:
        b = o.modifiers.new('bisel', 'BEVEL'); b.width = bevel; b.segments = 1
    return o


# ---------- jerarquía ----------
root = empty('Poroto', (0, 0, 0))
body = empty('cuerpo', (0, 0, 0), root)

def body_mesh(name, seg=18, elev=(-90, -68, -48, -32, -18, -6, 6, 17, 28, 40, 53, 67, 90), center=Vector((0, 0, 0.5))):
    """Malla del cuerpo: una grilla esférica proyectada sobre la superficie fundida (sin pliegues ni caras
    escondidas). UV: u=0.5 al frente, v = altura (así la textura pinta short, cinturón y piel por altura)."""
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap'); rings = []
    for e in elev:
        el = math.radians(e)
        n = 1 if abs(e) == 90 else seg
        ring = []
        for i in range(n):
            az = 2 * math.pi * i / seg
            d = Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)))
            ring.append(bm.verts.new(surf(center, d)))
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for i in range(seg):
            j = (i + 1) % seg
            if len(a) == 1: vs, us = (a[0], b[j], b[i]), (i + 0.5, j or seg, i)
            elif len(b) == 1: vs, us = (a[i], a[j], b[0]), (i, j or seg, i + 0.5)
            else: vs, us = (a[i], a[j], b[j], b[i]), (i, j or seg, j or seg, i)
            f = bm.faces.new(vs)
            for l, u in zip(f.loops, us):
                l[uvl].uv = ((u / seg + 0.5) % 1.0 if u < seg else 1.5, min(max((l.vert.co.z - ZMIN) / (ZMAX - ZMIN), 0.01), 0.99))
            uu = [l[uvl].uv.x for l in f.loops]
            if max(uu) - min(uu) > 0.5:
                for l in f.loops:
                    if l[uvl].uv.x < 0.5: l[uvl].uv.x += 1
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    return me


core = smooth(link('nucleo', body_mesh('poroto_cuerpo'), body, M['body']))

# ojos: puntos negros (mismo tamaño los dos)
EYE = (0.006, 0.016, 0.02)
for s, side in ((1, 'I'), (-1, 'D')):
    p = surf(Vector((0, 0, 0.67)), Vector((1, s * 0.27, 0)), 0.0)
    e = empty(f'ojo_{side}', p, body)
    nn = normal(p); e.rotation_euler.z = math.atan2(nn.y, nn.x)
    me = ellipsoid('ojo', EYE[2], EYE[1], EYE[0], 8, 2)   # eje hacia afuera: de frente se ve el octágono
    for v in me.vertices: v.co = Vector((v.co.z, v.co.y, v.co.x))
    smooth(link(f'ojo_{side}_malla', me, e, M['eye']))

# bigote de manubrio: solo la mitad visible, perfil ">"
zb = 0.585
half = [(0.0, 0.0, 0.036), (0.035, -0.012, 0.032), (0.07, -0.012, 0.026), (0.1, 0.002, 0.018),
        (0.115, 0.025, 0.013), (0.105, 0.042, 0.009)]
seq = [(-y, dz, w) for y, dz, w in reversed(half[1:])] + half
pts = [surf(Vector((0, 0, zb + dz)), Vector((1, y / R, 0))) for y, dz, _ in seq]
wedge('bigote', pts, [w for *_, w in seq], [w * 0.45 for *_, w in seq], body, M['stache'])

# casco de explorador (salacot) echado hacia atrás, con flor al frente
hat = empty('gorro', (-0.012, 0, 0.775), body); hat.rotation_euler.y = math.radians(-9)
HX = 0.93
dome = [(0.212 * math.cos(math.radians(a)), 0.2 * math.sin(math.radians(a))) for a in (0, 25, 50, 72)] + [(0, 0.2)]
smooth(link('casco', revolve('casco', dome, 16, 0.95, HX), hat, M['helmet']))
smooth(link('casco_cinta', revolve('casco_cinta', [(0.217, 0.0), (0.215, 0.04)], 16, 0.95, HX), hat, M['band']))
ala = smooth(link('casco_ala', revolve('casco_ala', [(0.34, -0.05), (0.275, -0.022), (0.213, 0.0)], 16, 0.93, HX), hat, M['helmet']))
for l in ala.data.uv_layers[0].data: l.uv = (l.uv.x * 0.2, 0.05)   # el ala no lleva la flor
smooth(link('casco_boton', revolve('boton', [(0.022, 0.0), (0.02, 0.012), (0, 0.016)], 6), hat, M['band'])).location.z = 0.195

# brazos musculosos: nacen dentro del hombro; bíceps, codo y antebrazo grueso (tipo Popeye) que se
# angosta en la muñeca; el guante tiene un puño acampanado que envuelve la muñeca (sin vértice raro).
ARM = [(0.0, 0.04), (0.05, 0.03), (0.06, -0.01), (0.062, -0.045), (0.044, -0.095), (0.068, -0.135),
       (0.072, -0.165), (0.052, -0.2), (0.042, -0.215), (0.0, -0.22)]
GLOVE = [(0.0, 0.012), (0.056, 0.012), (0.058, -0.012), (0.062, -0.04), (0.058, -0.075), (0.04, -0.1), (0.0, -0.108)]
for s, side in ((1, 'I'), (-1, 'D')):
    c, _ = SHOULDERS[0 if s > 0 else 1]
    a = empty(f'brazo_{side}', c + Vector((0, s * 0.05, 0)), body)
    a.rotation_euler.x = s * math.radians(12)         # los brazos se abren un poco del cuerpo
    arm = smooth(link(f'brazo_{side}_malla', revolve('brazo', ARM, 8), a, M['skin']))
    g = empty(f'mano_{side}', (0.0, 0, -0.205), a)
    smooth(link(f'guante_{side}', revolve('guante', GLOVE, 8, 0.9), g, M['glove']))
    smooth(link(f'pulgar_{side}', ellipsoid('pulgar', 0.022, 0.02, 0.03, 6, 3), g, M['glove'])).location = (0.045, -s * 0.022, -0.035)

# piernas: pantorrilla ancha que se afina al tobillo + pie casi plano con sandalia
LEG = [(0.0, 0.03), (0.03, 0.03), (0.034, 0.05), (0.052, 0.08), (0.07, 0.12), (0.074, 0.15), (0.066, 0.2), (0.06, 0.23)]
for s, side in ((1, 'I'), (-1, 'D')):
    f = empty(f'pata_{side}', (0, s * 0.1, 0), root)
    smooth(link(f'pierna_{side}', revolve('pierna', LEG, 8), f, M['skin']))
    foot = ellipsoid('pie', 0.075, 0.048, 0.035, 10, 4, flat_bottom=0.0)
    smooth(link(f'pie_{side}', foot, f, M['skin'])).location = (0.035, 0, 0.016)
    box(f'suela_{side}', 0.18, 0.105, 0.016, f, M['boot'], bevel=0.006).location = (0.035, 0, 0.008)
    # tiras de la sandalia: una sobre el empeine (perfil ">") y una alrededor del tobillo
    fc, frx, fry, frz = Vector((0.035, 0, 0.016)), 0.075, 0.048, 0.035
    def on_foot(x, y):
        q = 1 - ((x - fc.x) / frx) ** 2 - (y / fry) ** 2
        return Vector((x, y, fc.z + frz * math.sqrt(max(q, 0))))
    def foot_n(p):
        return Vector(((p.x - fc.x) / frx ** 2, p.y / fry ** 2, (p.z - fc.z) / frz ** 2)).normalized()
    for xx in (0.05, 0.085):
        pts = [on_foot(xx, fry * k * 0.93 * math.sqrt(max(1 - ((xx - fc.x) / frx) ** 2, 0))) for k in (-1, -0.6, -0.25, 0.25, 0.6, 1)]
        pts.insert(3, on_foot(xx, 0.0))
        wedge(f'sandalia_{side}', pts, 0.016, 0.004, f, M['boot'], nrm=foot_n)
    smooth(link(f'sandalia_tobillo_{side}', revolve('tobillo', [(0.037, 0.038), (0.036, 0.052)], 8), f, M['boot']))

# mochila con saco de dormir (sin caras tapadas: cara pegada al cuerpo y tapa superior)
PX = -R - 0.06
pack = empty('mochila', (PX, 0, 0.47), body)
box('mochila_cuerpo', 0.12, 0.32, 0.3, pack, M['pack'], drop=('+x', '+z'), bevel=0.02)
box('mochila_tapa', 0.13, 0.325, 0.1, pack, M['packd'], drop=('+x', '-z'), bevel=0.02).location = (-0.003, 0, 0.11)
box('mochila_bolsillo', 0.04, 0.17, 0.11, pack, M['packd'], drop=('+x',), bevel=0.012).location = (-0.078, 0, -0.04)
box('mochila_hebilla', 0.008, 0.03, 0.025, pack, M['buckle'], drop=('+x',)).location = (-0.07, 0, 0.075)
roll = smooth(link('saco_dormir', revolve('saco', [(0, -0.16), (0.05, -0.16), (0.056, -0.13), (0.056, 0.13), (0.05, 0.16), (0, 0.16)], 8), pack, M['blanket']))
roll.rotation_euler.x = math.radians(90); roll.location = (0.0, 0, 0.21)
for p in roll.data.polygons:   # tapas del saco lisas (sin espiral de rayas)
    if any(abs(roll.data.vertices[v].co.z) > 0.14 for v in p.vertices):
        for li in p.loop_indices: roll.data.uv_layers[0].data[li].uv = (0.05, 0.5)
for yy in (-0.08, 0.08):
    t = smooth(link('saco_amarra', revolve('amarra', [(0.06, -0.01), (0.06, 0.01)], 8), pack, M['belt']))
    t.rotation_euler.x = math.radians(90); t.location = (0, yy, 0.21)

# tirantes: de la tapa, sobre el hombro, por delante del brazo, bajo la axila y de vuelta a la mochila
for s, side in ((1, 'I'), (-1, 'D')):
    keys = ((-0.16, 0.56), (-0.09, 0.565), (-0.01, 0.565), (0.06, 0.535), (0.1, 0.46), (0.08, 0.38),
            (0.0, 0.345), (-0.09, 0.35), (-0.16, 0.36))
    path = [Vector((PX + 0.04, s * 0.13, 0.56))]
    for (x0, z0), (x1, z1) in zip(keys, keys[1:]):
        for k in (0, 1 / 3, 2 / 3):
            path.append(side_pt(x0 + (x1 - x0) * k, z0 + (z1 - z0) * k, s))
    path.append(side_pt(*keys[-1], s))
    path.append(Vector((PX + 0.04, s * 0.13, 0.36)))
    wedge(f'tirante_{side}', path, 0.026, 0.006, body, M['strap'])

# binoculares colgando hacia abajo, con correa terciada que da la vuelta completa al cuerpo
BZ = 0.36
bino = empty('binoculares', (half_x(0, BZ) + 0.038, 0, BZ), body)
for s in (1, -1):
    t = smooth(link('binocular_tubo', revolve('tubo', [(0.03, -0.055), (0.033, 0.0), (0.028, 0.05), (0, 0.05)], 6), bino, M['bino']))
    t.location = (0, s * 0.036, 0)
    l = link('binocular_lente', revolve('lente', [(0, 0.0), (0.024, 0.0)], 6), bino, M['lens'])
    l.location = (0, s * 0.036, -0.056); l.rotation_euler.x = math.pi
box('binocular_puente', 0.02, 0.04, 0.03, bino, M['bino']).location = (0, 0, 0.02)


def bz(a):   # altura de la correa según el ángulo alrededor del cuerpo (0 = frente, 90° = izquierda)
    return 0.455 + 0.135 * math.sin(a) - 0.025 * math.cos(a)


loop = [surf(Vector((0, 0, bz(a))), Vector((math.cos(a), math.sin(a), 0))) for a in [2 * math.pi * i / 28 for i in range(28)]]
wedge('correa', loop, 0.014, 0.004, body, M['binostrap'], closed=True)

# lentes de sol (se muestran/ocultan desde el juego)
gl = empty('lentes_sol', (0, 0, 0), body)
for s in (1, -1):
    c = surf(Vector((0, 0, 0.672)), Vector((1, s * 0.3, 0)), 0.02)
    nn = normal(c)
    ln = smooth(link('lente_sol', revolve('lente_sol', [(0, -0.003), (0.05, -0.003), (0.05, 0.003), (0, 0.003)], 8, 0.85), gl, M['shades']))
    ln.rotation_euler = (0, math.radians(90), math.atan2(nn.y, nn.x)); ln.location = c
    pts = [surf(Vector((0, 0, 0.68)), Vector((math.cos(a), s * math.sin(a), 0))) for a in [math.radians(d) for d in range(36, 97, 8)]]
    wedge('patilla', pts, 0.009, 0.004, gl, M['frame'])
c0 = surf(Vector((0, 0, 0.688)), Vector((1, 0, 0)), 0.02)
wedge('puente_lentes', [c0 + Vector((-0.004, 0.028, -0.005)), c0, c0 + Vector((-0.004, -0.028, -0.005))], 0.008, 0.003, gl, M['frame'],
      nrm=lambda p: Vector((1, 0, 0)))

# props ocultos que el juego activa (bufanda, libreta, lápiz, mapa)
sc_ = smooth(link('bufanda', revolve('bufanda', [(1.12, 0.5), (1.1, 0.56)], 16, RY * 1.25, R * 1.02), body, M['scarf']))
nb = box('libreta', 0.15, 0.11, 0.02, body, M['book']); nb.location = (0.27, -0.1, 0.33)
pc = link('lapiz', revolve('lapiz', [(0, -0.055), (0.008, -0.045), (0.008, 0.055), (0, 0.055)], 5), body, M['pencil'])
pc.location = (0.29, -0.06, 0.37); pc.rotation_euler.x = math.radians(70)
mp = box('mapa_mano', 0.004, 0.38, 0.28, body, M['map']); mp.location = (0.33, 0, 0.45)
for o in (sc_, nb, pc, mp):
    o.hide_set(True); o.hide_render = True


def show_glasses(on):
    for o in [gl] + list(gl.children_recursive):
        o.hide_render = not on; o.hide_set(not on)


def tri_count(visible_only=True):
    dg = bpy.context.evaluated_depsgraph_get(); n = 0
    for o in col.objects:
        if o.type == 'MESH' and not (visible_only and o.hide_render):
            m = o.evaluated_get(dg).to_mesh(); m.calc_loop_triangles(); n += len(m.loop_triangles); o.evaluated_get(dg).to_mesh_clear()
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
