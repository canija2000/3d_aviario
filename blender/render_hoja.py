# Hoja de revisión de Poroto: 4 vistas (frente, frente con lentes, lado, espalda) en una imagen 2x2.
# Requiere una cámara "cam_revision" que apunte a "cam_objetivo". Define HOJA_OUT antes de ejecutar.
import bpy, numpy as np


def show_glasses(on):
    gl = bpy.data.objects['lentes_sol']
    for o in [gl] + list(gl.children_recursive):
        o.hide_render = not on; o.hide_set(not on)


sc = bpy.context.scene
cam = bpy.data.objects['cam_revision']
S = 560
sc.render.resolution_x = sc.render.resolution_y = S
cam.data.lens = 60
views = [('frente', (2.0, -1.2, 0.95), False), ('frente_lentes', (2.0, -1.2, 0.95), True),
         ('lado', (0.0, -2.5, 0.7), False), ('espalda', (-1.8, -1.5, 1.0), False)]
imgs = []
tmp = HOJA_OUT.rsplit('.', 1)[0]
for name, loc, g in views:
    show_glasses(g); cam.location = loc
    sc.render.filepath = f'{tmp}_{name}.png'
    bpy.ops.render.render(write_still=True)
    im = bpy.data.images.load(sc.render.filepath, check_existing=False)
    a = np.empty(S * S * 4, dtype=np.float32); im.pixels.foreach_get(a)
    imgs.append(a.reshape(S, S, 4)); bpy.data.images.remove(im)
show_glasses(False); cam.location = views[0][1]
sheet = np.concatenate([np.concatenate([imgs[2], imgs[3]], 1), np.concatenate([imgs[0], imgs[1]], 1)], 0)
im = bpy.data.images.new('hoja', 2 * S, 2 * S); im.pixels.foreach_set(sheet.ravel())
im.filepath_raw = HOJA_OUT; im.file_format = 'PNG'; im.save(); bpy.data.images.remove(im)
