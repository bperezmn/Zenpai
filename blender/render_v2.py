# Helpers de render para la escena zenpai-carpa.blend (ejecutar dentro de Blender:
#   exec(open('/ruta/blender/render_v2.py').read(), globals())
# Coloca las plantas (recortes foto-reales como billboards) por etapa y nº de macetas,
# fija el estado de luz (día/noche/frío/calor) y renderiza por lotes.
import bpy, math

scn = bpy.context.scene
def node_of(tree, ntype): return next(n for n in tree.nodes if n.type == ntype)

BASE = bpy.path.abspath('//') if bpy.data.filepath else '/Users/bperezm/Documents/Aplicaciones/zenpai/blender/'
PL = BASE + 'plantas/'
OUT = BASE + 'renders/v2/'

# métricas de cada recorte: alto/ancho px, fila del borde inferior de la maceta, ancho de la maceta en px
META = {
    'veg_a':    {'h': 1184, 'w': 864, 'bottom': 1141, 'pot_w_px': 358},
    'veg_b':    {'h': 1184, 'w': 864, 'bottom': 1151, 'pot_w_px': 325},
    'plantula': {'h': 1184, 'w': 864, 'bottom': 1183, 'pot_w_px': 697},
    'flor':     {'h': 1184, 'w': 864, 'bottom': 1044, 'pot_w_px': 263},
    'cosecha':  {'h': 1184, 'w': 864, 'bottom': 1080, 'pot_w_px': 277},
    'sed':      {'h': 1184, 'w': 864, 'bottom': 1183, 'pot_w_px': 580},
    # secado: ramas colgando de un alambre (fila 141 = alambre); se cuelga bajo la barra LED
    'secando':  {'h': 1184, 'w': 864, 'top': 141, 'bottom': 779, 'pot_w_px': 0},
}
POT_W = 0.27  # ancho real de la maceta (m): normaliza el tamaño de todas las plantas
XS = {1: [0.0], 2: [-0.17, 0.17], 3: [-0.245, 0.0, 0.245]}
STAGE_KEYS = {'veg': ['veg_a', 'veg_b', 'veg_a'], 'plantula': ['plantula'] * 3, 'flor': ['flor'] * 3,
              'cosecha': ['cosecha'] * 3, 'sed': ['sed'] * 3}

def bb_mat(key):
    name = f'bb_{key}'
    if name in bpy.data.materials: return bpy.data.materials[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; bsdf = node_of(nt, 'BSDF_PRINCIPLED')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(PL + f'{key}_cutout.png', check_existing=True); tex.image.alpha_mode = 'STRAIGHT'
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

def set_stage(stage, pots):
    for o in list(scn.objects):
        if o.name.startswith('planta_billboard_'): bpy.data.objects.remove(o, do_unlink=True)
    if stage == 'secando':
        # un solo billboard ancho colgado bajo la barra LED: el alambre (fila 'top') a z=1.18
        md = META['secando']; Wp = 0.70; Hp = Wp * md['h'] / md['w']
        bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0.10, 0), rotation=(math.pi / 2, 0, 0))
        o = bpy.context.active_object; o.name = 'planta_billboard_0'
        o.scale = (Wp, Hp, 1)
        o.location.z = 1.18 - Hp / 2 + md['top'] / md['h'] * Hp
        o.data.materials.append(bb_mat('secando'))
        return
    keys = STAGE_KEYS[stage]
    for i, x in enumerate(XS[pots]):
        key = keys[i if pots == 3 else (1 if pots == 1 else i * 2)]
        md = META[key]; Wp = POT_W * md['w'] / md['pot_w_px']; Hp = Wp * md['h'] / md['w']
        bpy.ops.mesh.primitive_plane_add(size=1, location=(x, 0.10 + (0.04 if i == 1 and pots == 3 else 0), 0), rotation=(math.pi / 2, 0, 0))
        o = bpy.context.active_object; o.name = f'planta_billboard_{i}'
        o.scale = (Wp, Hp, 1)
        # la de la derecha espejada por UV (NO con escala negativa: Eevee compone mal la
        # transparencia de un plano invertido sobre otro plano transparente → silueta negra)
        if i == 2:
            for loop in o.data.uv_layers.active.data: loop.uv.x = 1.0 - loop.uv.x
        o.location.z = Hp / 2 - (md['h'] - md['bottom']) / md['h'] * Hp + 0.004
        o.data.materials.append(bb_mat(key))

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
    L['luz_led'].energy = led; led_bsdf.inputs['Emission Strength'].default_value = led_emit
    L['luz_tinte'].color = tint; L['luz_tinte'].energy = tint_e; L['luz_clave'].energy = key
    L['luz_rim_teal'].energy = 220 * rim; L['luz_rim_lima'].energy = 140 * rim
    bg.inputs['Strength'].default_value = world

def setup_render(w=900, h=1600, samples=96):
    scn.render.resolution_x = w; scn.render.resolution_y = h; scn.render.resolution_percentage = 100
    scn.eevee.taa_render_samples = samples; scn.frame_set(24)

def render_batch(jobs, out=None):
    """jobs: lista de (stage, pots, state). Escribe {stage}-{state}-{pots}p.png"""
    import os
    out = out or OUT; os.makedirs(out, exist_ok=True)
    done = []
    for stage, pots, st in jobs:
        set_stage(stage, pots); state(st)
        scn.render.filepath = out + f'{stage}-{st}-{pots}p.png'
        bpy.ops.render.render(write_still=True); done.append(f'{stage}-{st}-{pots}p')
    state('dia')
    return done
