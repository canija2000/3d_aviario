# Piezas del mundo a partir de modelos CC0 de Kenney (Nature Kit, assets/referencias/kits/): se toma solo la
# geometría (siluetas ya resueltas en low-poly), se une en una sola malla, se lleva a su altura real y se
# re-texturiza con las texturas N64 del kit (blender/kit_build.py: kit_copa, kit_corteza), que el juego
# tiñe por especie. Exporta a models/kit/<id>.glb. Licencia de origen: CC0 (kenney.nl).
# Uso en vivo (MCP, después de kit_build.py): exec(open('blender/kenney_build.py').read())
import bpy, bmesh, math, os, sys
from mathutils import Vector

K = '/Users/jabac/dev/3d_aviario/assets/referencias/kits/kenney_nature-kit/Models/GLTF format/'
OUT = '/Users/jabac/dev/3d_aviario/models/kit'

# id del juego: (modelo Kenney, altura en metros, escala extra del tronco en planta, estirar en alto)
PIEZAS = {
    'palma_chilena': ('tree_palmTall', 9.0, 2.2, 1.0),   # tronco grueso de la palma chilena
    'quisco': ('cactus_tall', 2.2, 1.0, 1.0),
    'eucalipto': ('tree_thin', 15.0, 1.0, 1.0),
    'sauce_chileno': ('tree_tall', 8.0, 1.0, 1.0),
    'lenga': ('tree_plateau', 11.0, 1.0, 1.0),
    'nirre': ('tree_small', 4.0, 1.0, 1.0),
    'tronco_caido': ('log_large', 0.8, 1.0, 1.0),
    'flores_altura': ('flower_redA', 0.35, 1.0, 1.0),
    'chagual': ('plant_flatTall', 1.0, 1.0, 1.0),          # roseta; la vara floral se agrega abajo
    'totora': ('plant_flatTall', 2.0, 0.5, 1.0),
}


def mat(name):
    m = bpy.data.materials.get(name)
    if m is None:
        raise RuntimeError(f'falta el material {name}: correr antes blender/kit_build.py')
    return m


def flower_material():
    m = bpy.data.materials.get('kit_flor')
    if m: return m
    m = bpy.data.materials.new('kit_flor'); m.use_nodes = True
    img = bpy.data.images.new('kit_tx_flor', 16, 16)
    px = []
    cols = [(0.86, 0.24, 0.36), (0.95, 0.82, 0.25), (0.45, 0.5, 0.92), (0.9, 0.9, 0.95)]   # añañuca, amarilla, azulillo, blanca
    for y in range(16):
        for x in range(16):
            r, g, b = cols[(x // 8) + 2 * (y // 8)]
            k = 0.85 + 0.15 * ((x * 7 + y * 3) % 5) / 4
            px += [r * k, g * k, b * k, 1]
    img.pixels = px; img.pack()
    nt = m.node_tree; t = nt.nodes.new('ShaderNodeTexImage'); t.image = img; t.interpolation = 'Linear'
    nt.links.new(t.outputs['Color'], nt.nodes['Principled BSDF'].inputs['Base Color'])
    return m


col = bpy.data.collections.get('Kit_Kenney')
if not col:
    col = bpy.data.collections.new('Kit_Kenney'); bpy.context.scene.collection.children.link(col)
for o in list(col.objects): bpy.data.objects.remove(o, do_unlink=True)


def box_uv(me, scale):
    """UV por proyección de caja (eje dominante de cada cara): la textura se repite cada 1/scale metros."""
    uv = me.uv_layers[0] if me.uv_layers else me.uv_layers.new(name='UVMap')
    for p in me.polygons:
        n = p.normal; ax = max(range(3), key=lambda i: abs(n[i]))
        a, b = [(1, 2), (0, 2), (0, 1)][ax]
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = (co[a] * scale, co[b] * scale)


def import_piece(pid, src, height, trunk_xy, stretch):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=K + src + '.glb')
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == 'MESH']
    # una sola malla
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1: bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in new:
        if o != obj and o.name in bpy.data.objects: bpy.data.objects.remove(o, do_unlink=True)
    for c in obj.users_collection: c.objects.unlink(obj)
    col.objects.link(obj); obj.name = pid; obj.data.name = pid
    me = obj.data
    # materiales: hojas/pasto/pétalos → copa (o flor); madera → corteza
    new_slots = []
    for m in me.materials:
        n = (m.name if m else '').lower()
        new_slots.append(flower_material() if n.startswith('color') else mat('kit_corteza') if 'wood' in n else mat('kit_copa'))
    old_idx = [p.material_index for p in me.polygons]   # materials.clear() deja todo en 0 (Blender 5)
    me.materials.clear()
    for m in dict.fromkeys(new_slots): me.materials.append(m)
    idx = {m.name: i for i, m in enumerate(me.materials)}
    old_to_new = [idx[m.name] for m in new_slots]
    for p, oi in zip(me.polygons, old_idx): p.material_index = old_to_new[oi] if oi < len(old_to_new) else 0
    # tamaño real: base en el suelo, centrado, altura nominal; tronco más grueso si corresponde
    bb = [Vector(c) for c in obj.bound_box]
    z0 = min(v.z for v in bb); z1 = max(v.z for v in bb)
    cx = sum(v.x for v in bb) / 8; cy = sum(v.y for v in bb) / 8
    s = height / (z1 - z0)
    for v in me.vertices:
        v.co = Vector(((v.co.x - cx) * s, (v.co.y - cy) * s, (v.co.z - z0) * s * stretch))
    if pid == 'palma_chilena':  # copa densa y redonda: agranda las hojas alrededor de la punta del tronco
        top = max(v.co.z for v in me.vertices)
        leaf = {vi for p in me.polygons if me.materials[p.material_index].name == 'kit_copa' for vi in p.vertices}
        for vi in leaf:
            v = me.vertices[vi]; v.co.x *= 1.8; v.co.y *= 1.8; v.co.z = top - (top - v.co.z) * 1.5
    if trunk_xy != 1.0:  # engrosa solo el tronco (caras de corteza)
        trunk = {vi for p in me.polygons if me.materials[p.material_index].name == 'kit_corteza' for vi in p.vertices}
        for vi in trunk:
            v = me.vertices[vi]; v.co.x *= trunk_xy; v.co.y *= trunk_xy
    for p in me.polygons: p.use_smooth = True
    me.set_sharp_from_angle(angle=math.radians(50))
    box_uv(me, 0.5 if height > 3 else 2.5)
    return obj


done = {}
for pid, (src, h, txy, st) in PIEZAS.items():
    o = import_piece(pid, src, h, txy, st)
    done[pid] = o

# chagual: vara floral con espiga turquesa sobre la roseta
ch = done['chagual']
bm = bmesh.new(); bm.from_mesh(ch.data)
stalk = bmesh.ops.create_cone(bm, cap_ends=True, segments=5, radius1=0.05, radius2=0.035, depth=1.6)
for v in stalk['verts']: v.co.z += 0.8 + 0.7
spike = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.16, radius2=0.04, depth=0.7)
for v in spike['verts']: v.co.z += 2.45
bm.to_mesh(ch.data); bm.free()
ch.data.materials.append(mat('kit_corteza')); ch.data.materials.append(flower_material())
ic, iflor = len(ch.data.materials) - 2, len(ch.data.materials) - 1
for p in ch.data.polygons:
    c = p.center
    if c.z > 2.05: p.material_index = iflor
    elif c.z > 0.85 and abs(c.x) < 0.1 and abs(c.y) < 0.1: p.material_index = ic
box_uv(ch.data, 2.5)

for i, o in enumerate(done.values()):
    o.location = (i * 6.0, 20.0, 0)


def tri_count():
    return {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in col.objects}


def export_all(folder=OUT):
    os.makedirs(folder, exist_ok=True)
    for o in col.objects:
        loc = o.location.copy(); o.location = (0, 0, 0)
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=os.path.join(folder, o.name + '.glb'), export_format='GLB', use_selection=True,
                                  export_apply=True, export_yup=True, export_cameras=False, export_lights=False)
        o.location = loc


bpy.context.view_layer.update()
if '--' in sys.argv and '--export' in sys.argv:
    export_all(sys.argv[sys.argv.index('--export') + 1])
