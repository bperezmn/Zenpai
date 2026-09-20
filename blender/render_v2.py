# Helpers de render para la escena zenpai-carpa.blend (ejecutar dentro de Blender:
#   exec(open('/ruta/blender/render_v2.py').read(), globals())
# Coloca las plantas (recortes foto-reales como billboards) por etapa, sustrato y nº de
# macetas, fija el estado de luz (día/noche/frío/calor), elige la vista (frente / cenital)
# y renderiza por lotes. Las métricas de los recortes salen de plantas/meta.json
# (generado con plantas/medir.py).
#
# MODO FOTO (v3, el que usa la app): la carpa es una FOTO (arte IA original en fotos/base-*.png)
# y Blender renderiza SOLO las plantas sobre fondo transparente — la carpa 3D sigue existiendo,
# invisible a cámara, para iluminar y reflejar. Luego blender/componer.py compone cada capa
# sobre la foto: foto × color del estado + sombra bajo cada maceta + plantas. Junto a cada PNG
# se escribe un JSON con las macetas proyectadas (cx, cy, w en fracción del encuadre).
import bpy, math, json, os
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

scn = bpy.context.scene
def node_of(tree, ntype): return next(n for n in tree.nodes if n.type == ntype)

BASE = bpy.path.abspath('//') if bpy.data.filepath else '/Users/bperezm/Documents/Aplicaciones/zenpai/blender/'
PL = BASE + 'plantas/'
OUT = BASE + 'renders/v2/'
META = json.load(open(PL + 'meta.json'))
MODO_FOTO = True

# los materiales de billboard se reconstruyen siempre desde los recortes (WebP sin pérdida):
# así un .blend guardado con rutas viejas o un clon nuevo nunca renderiza texturas rosas
for _m in [m for m in bpy.data.materials if m.name.startswith('bb_')]: bpy.data.materials.remove(_m)
for _i in [i for i in bpy.data.images if i.name.endswith('_cutout.png') or i.name.endswith('_cutout.webp')]: bpy.data.images.remove(_i)

POT_W = {'tierra': 0.27, 'coco': 0.27, 'hidro': 0.30}  # ancho real de la maceta / cubeta (m): normaliza todas las plantas
# posiciones de las macetas (x). Carpa 3D: interior de 0.78 m. Foto: donde están las macetas
# de la foto (frente: centros al 32/48/65 % del ancho; cenital: 22/50/78 % del alto)
XS_3D = {1: [0.0], 2: [-0.17, 0.17], 3: [-0.245, 0.0, 0.245]}
XS_FOTO = {1: [0.0], 2: [-0.22, 0.22], 3: [-0.33, 0.0, 0.33]}
XS_TOP_FOTO = {1: [0.0], 2: [-0.24, 0.24], 3: [-0.345, 0.0, 0.345]}
# foto: la planta central adelantada (más grande y más baja, como en el arte original) y todo
# un 11 % más grande (las copas llenaban la puerta en el original)
Y_CENTRO_FOTO = -0.15
ESCALA_FOTO = 1.25
STAGE_KEYS = {'veg': ['veg_a', 'veg_b', 'veg_a'], 'plantula': ['plantula'] * 3, 'flor': ['flor'] * 3,
              'cosecha': ['cosecha'] * 3, 'sed': ['sed'] * 3, 'germinacion': ['maceta'] * 3}
# vista cenital: ancho real del recorte completo (copa o borde de la maceta) y altura del plano
TOP_W_3D = {'plantula': 0.26, 'veg': 0.34, 'flor': 0.30, 'cosecha': 0.29, 'sed': 0.28, 'germinacion': 0.26}
TOP_W_FOTO = {k: round(v * 1.18, 3) for k, v in TOP_W_3D.items()}  # copas ≈ 36 % del ancho, como el original
TOP_Z = {'plantula': 0.24, 'veg': 0.55, 'flor': 0.62, 'cosecha': 0.62, 'sed': 0.45, 'germinacion': 0.22}
SECANDO_Z = 1.42 if MODO_FOTO else 1.18  # el alambre de secado, justo bajo la barra LED
XS = XS_FOTO if MODO_FOTO else XS_3D
XS_TOP = XS_TOP_FOTO if MODO_FOTO else XS_3D
TOP_W = TOP_W_FOTO if MODO_FOTO else TOP_W_3D

def key_for(stage, substrate, i, pots):
    keys = STAGE_KEYS[stage]
    k = keys[i if pots == 3 else (1 if pots == 1 else i * 2)]
    # germinación: macetas de tierra para todos (en hidro/coco aún no hay nada que ver)
    if stage == 'germinacion' or substrate == 'tierra': return k
    return f'{substrate}_{k}'

def bb_mat(key):
    name = f'bb_{key}'
    if name in bpy.data.materials: return bpy.data.materials[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; bsdf = node_of(nt, 'BSDF_PRINCIPLED')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(PL + f'{key}_cutout.webp', check_existing=True); tex.image.alpha_mode = 'STRAIGHT'
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color']); nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
    bsdf.inputs['Roughness'].default_value = 0.55
    for k in ('Specular IOR Level', 'Specular'):
        if k in bsdf.inputs: bsdf.inputs[k].default_value = 0.25
    # BLENDED (alpha blend clásico), NO 'DITHERED': con dithered, la planta que queda
    # detrás de otro plano transparente sale como silueta NEGRA (verificado en Eevee 5.2)
    try: m.surface_render_method = 'BLENDED'
    except Exception: m.blend_method = 'BLEND'
    for attr in ('show_transparent_back', 'use_transparent_shadow'):
        try: setattr(m, attr, True)
        except Exception: pass
    return m

def clear_plants():
    for o in list(scn.objects):
        if o.name.startswith('planta_billboard_'): bpy.data.objects.remove(o, do_unlink=True)

def set_stage(stage, pots, substrate='tierra'):
    """Vista frontal: billboards verticales normalizados por el ancho de la maceta."""
    clear_plants()
    if stage == 'vacia': return
    if stage == 'secando':
        # un solo billboard ancho colgado bajo la barra LED: el alambre (fila 'top') a SECANDO_Z
        md = META['secando']; Wp = 0.70; Hp = Wp * md['h'] / md['w']
        bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0.10, 0), rotation=(math.pi / 2, 0, 0))
        o = bpy.context.active_object; o.name = 'planta_billboard_0'
        o.scale = (Wp, Hp, 1)
        o.location.z = SECANDO_Z - Hp / 2 + md['top'] / md['h'] * Hp
        o.data.materials.append(bb_mat('secando')); o['pot_w'] = 0.0
        return
    for i, x in enumerate(XS[pots]):
        key = key_for(stage, substrate, i, pots)
        pw = (POT_W[substrate] if key.startswith(substrate + '_') else POT_W['tierra']) * (ESCALA_FOTO if MODO_FOTO else 1.0)
        md = META[key]; Wp = pw * md['w'] / md['pot_w_px']; Hp = Wp * md['h'] / md['w']
        centro = i == 1 and pots == 3
        y = (Y_CENTRO_FOTO if centro else 0.10) if MODO_FOTO else 0.10 + (0.04 if centro else 0)
        bpy.ops.mesh.primitive_plane_add(size=1, location=(x, y, 0), rotation=(math.pi / 2, 0, 0))
        o = bpy.context.active_object; o.name = f'planta_billboard_{i}'
        o.scale = (Wp, Hp, 1)
        # la de la derecha espejada por UV (NO con escala negativa: Eevee compone mal la
        # transparencia de un plano invertido sobre otro plano transparente → silueta negra)
        if i == 2:
            for loop in o.data.uv_layers.active.data: loop.uv.x = 1.0 - loop.uv.x
        o.location.z = Hp / 2 - (md['h'] - md['bottom']) / md['h'] * Hp + 0.004
        o.data.materials.append(bb_mat(key)); o['pot_w'] = pw

def set_stage_top(stage, pots):
    """Vista cenital: billboards horizontales (recortes vistos desde arriba) a la altura de la copa."""
    clear_plants()
    if stage in ('vacia', 'secando'): return
    for i, x in enumerate(XS_TOP[pots]):
        key = 'top_' + key_for(stage, 'tierra', i, pots)
        md = META[key]; Wp = TOP_W[stage]; Hp = Wp * md['h'] / md['w']
        z = TOP_Z[stage] + (0.03 if i == 1 and pots == 3 else 0)
        bpy.ops.mesh.primitive_plane_add(size=1, location=(x, 0.10, z), rotation=(0, 0, [0.0, 2.1, 4.2][i]))
        o = bpy.context.active_object; o.name = f'planta_billboard_{i}'
        o.scale = (Wp, Hp, 1)
        o.data.materials.append(bb_mat(key)); o['pot_w'] = POT_W['tierra']

def cam_frente():
    cam = bpy.data.objects['Camera']
    if MODO_FOTO:
        # ajustada a la foto: macetas ≈ 15 % del ancho, piso al 89 % del alto
        cam.location = (0.0, -3.2, 1.27); cam.rotation_euler = (1.55, 0, 0); cam.data.lens = 38
    return cam

def cam_cenital():
    """Cámara sobre la carpa mirando al piso. Carpa 3D: el plano de recorte cercano 'rebana' techo,
    LED y filtro (casa de muñecas). Foto: más alta, la carpa 3D es invisible a cámara.
    Imagen: arriba = -X (maceta #1 arriba), derecha = +Y."""
    cam = scn.objects.get('Camera_cenital')
    if not cam:
        cd = bpy.data.cameras.new('Camera_cenital'); cam = bpy.data.objects.new('Camera_cenital', cd)
        scn.collection.objects.link(cam)
    cam.rotation_euler = (0, 0, math.pi / 2)
    cam.data.lens = 50; cam.data.sensor_fit = 'VERTICAL'; cam.data.sensor_height = 24
    if MODO_FOTO: cam.location = (0, 0.10, 3.5); cam.data.clip_start = 0.1
    else: cam.location = (0, 0.05, 2.4); cam.data.clip_start = 2.4 - 1.20
    return cam

def modo_foto():
    """La carpa 3D no se ve (película transparente). Sus paredes y aparatos tampoco RENDERIZAN:
    las macetas de la foto quedan fuera del interior 3D (0.78 m) y la pared invisible cortaba
    a las plantas exteriores con una sombra recta. Quedan el piso y la barra LED (rebote y
    emisión) más las luces, que son lo que define el estado."""
    for o in scn.objects:
        if o.type in ('LIGHT', 'CAMERA') or o.name.startswith('planta_billboard_'): continue
        sombra = MODO_FOTO and o.name not in ('piso', 'led_barra', 'led_chasis')
        o.hide_render = sombra; o.hide_viewport = sombra; o.visible_camera = not MODO_FOTO
    # una sola luz de área ANCHA sobre toda la fila de macetas: misma exposición en las tres
    # plantas (con la LED de 0.6 m la central salía más clara y amarilla que las laterales)
    led = bpy.data.objects['luz_led'].data
    if MODO_FOTO: led.shape = 'RECTANGLE'; led.size = 1.7; led.size_y = 0.9
    else: led.shape = 'RECTANGLE'; led.size = 0.6; led.size_y = 0.3
    scn.render.film_transparent = MODO_FOTO
    scn.view_settings.view_transform = 'Standard' if MODO_FOTO else 'AgX'; scn.view_settings.look = 'None'
    cam_frente(); cam_cenital()

def pots_json(camera, z, top=False):
    """Macetas proyectadas al encuadre (para la sombra de componer.py)."""
    pots = []
    for o in sorted([o for o in scn.objects if o.name.startswith('planta_billboard_')], key=lambda o: o.name):
        w = float(o.get('pot_w', 0.0))
        if w <= 0: continue
        x, y = o.location.x, o.location.y
        p0 = world_to_camera_view(scn, camera, Vector((x, y, z)))
        pl = world_to_camera_view(scn, camera, Vector((x - w / 2, y, z))); pr = world_to_camera_view(scn, camera, Vector((x + w / 2, y, z)))
        pt = world_to_camera_view(scn, camera, Vector((x, y - w / 2, z))); pb = world_to_camera_view(scn, camera, Vector((x, y + w / 2, z)))
        pots.append({'cx': round(p0.x, 4), 'cy': round(1 - p0.y, 4), 'w': round(max(abs(pr.x - pl.x), abs(pb.x - pt.x)), 4)})
    return pots

STATES = {  # led, emisión barra, color tinte, energía tinte, clave, factor rims, fuerza mundo
    'dia':   (55, 7.0,  (0.40, 0.60, 1.0), 0,  350, 1.0,  1.0),
    'noche': (0,  0.15, (0.25, 0.42, 1.0), 6,  80,  0.55, 0.45),
    'frio':  (55, 7.0,  (0.35, 0.55, 1.0), 45, 350, 1.0,  1.0),
    'calor': (55, 7.0,  (1.0, 0.30, 0.12), 45, 350, 1.0,  1.0),
}
def state(name):
    L = {o.name: o.data for o in scn.objects if o.type == 'LIGHT'}
    led_bsdf = node_of(bpy.data.materials['led_barra'].node_tree, 'BSDF_PRINCIPLED')
    bg = node_of(scn.world.node_tree, 'BACKGROUND')
    led, led_emit, tint, tint_e, key, rim, world = STATES[name]
    if MODO_FOTO:
        # foto: la película es 'Standard' (no AgX) y la luz es más ancha → menos energía para no
        # quemar las copas; de noche sin rims de marca (dejaban una media luna cálida en las macetas)
        led = led * 0.8
        if name == 'noche': rim = 0.1
    L['luz_led'].energy = led; led_bsdf.inputs['Emission Strength'].default_value = led_emit
    L['luz_tinte'].color = tint; L['luz_tinte'].energy = tint_e; L['luz_clave'].energy = key
    L['luz_rim_teal'].energy = 220 * rim; L['luz_rim_lima'].energy = 140 * rim
    bg.inputs['Strength'].default_value = world

def setup_render(w=900, h=1600, samples=96):
    scn.render.resolution_x = w; scn.render.resolution_y = h; scn.render.resolution_percentage = 100
    scn.eevee.taa_render_samples = samples; scn.frame_set(24)
    if MODO_FOTO: modo_foto()

def job_name(stage, pots, st, sub='tierra', view='front'):
    if view == 'top': return f'top-{stage}-{st}' if stage == 'vacia' else f'top-{stage}-{st}-{pots}p'
    return ('' if sub == 'tierra' else f'{sub}-') + f'{stage}-{st}-{pots}p'

def render_batch(jobs, out=None):
    """jobs: lista de (stage, pots, state[, substrate='tierra'[, view='front'|'top']]).
    Escribe {stage}-{state}-{pots}p.png · {sustrato}-{stage}-{state}-{pots}p.png (coco/hidro)
    · top-{stage}-{state}-{pots}p.png (cenital, solo tierra). En modo foto, cada PNG es solo
    la capa de plantas y lleva al lado su .json de macetas para componer.py."""
    out = out or OUT; os.makedirs(out, exist_ok=True)
    main_cam = cam_frente()
    done = []
    for job in jobs:
        stage, pots, st = job[:3]
        sub = job[3] if len(job) > 3 else 'tierra'; view = job[4] if len(job) > 4 else 'front'
        if view == 'top': set_stage_top(stage, pots); scn.camera = cam_cenital()
        else: set_stage(stage, pots, sub); scn.camera = main_cam
        state(st)
        name = job_name(stage, pots, st, sub, view)
        scn.render.filepath = out + name + '.png'
        bpy.ops.render.render(write_still=True); done.append(name)
        if MODO_FOTO:
            pj = pots_json(scn.camera, 0.22 if view == 'top' else 0.0)
            json.dump(pj, open(out + name + '.json', 'w'))
    scn.camera = main_cam; state('dia')
    return done
