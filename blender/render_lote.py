# Lanza un lote de renders con Blender en segundo plano (sin bloquear la interfaz):
#   /Applications/Blender.app/Contents/MacOS/Blender -b blender/zenpai-carpa.blend \
#       --python blender/render_lote.py -- <lote> [carpeta_salida]
# lotes: test · germinacion · sustratos (coco/hidro) · cenital · todo
import sys, os, time, bpy

here = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else os.path.dirname(bpy.data.filepath)
exec(open(os.path.join(here, 'render_v2.py')).read(), globals())

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['test']
lote = args[0]
out = (args[1].rstrip('/') + '/') if len(args) > 1 else None

STAGES = ('plantula', 'veg', 'flor', 'cosecha')
STATES4 = ('dia', 'noche', 'frio', 'calor')
LOTES = {
    'test': [('veg', 3, 'dia', 'tierra', 'top')],
    'tierra': [(s, p, st) for s in STAGES for st in STATES4 for p in (1, 2, 3)]
              + [('sed', p, 'dia') for p in (1, 2, 3)] + [('secando', 3, st) for st in ('dia', 'noche')],
    'germinacion': [('germinacion', p, st) for st in STATES4 for p in (1, 2, 3)],
    'sustratos': [(s, p, st, sub) for sub in ('coco', 'hidro') for s in STAGES for st in STATES4 for p in (1, 2, 3)]
                 + [('sed', p, 'dia', sub) for sub in ('coco', 'hidro') for p in (1, 2, 3)],
    'cenital': [(s, p, st, 'tierra', 'top') for s in STAGES + ('sed', 'germinacion') for st in STATES4 for p in (1, 2, 3)]
               + [('vacia', 0, st, 'tierra', 'top') for st in STATES4],
    'cenital_flor': [(s, p, st, 'tierra', 'top') for s in ('flor', 'cosecha') for st in STATES4 for p in (1, 2, 3)],
}
LOTES['todo'] = LOTES['tierra'] + LOTES['germinacion'] + LOTES['sustratos'] + LOTES['cenital']

setup_render()
t0 = time.time()
done = render_batch(LOTES[lote], out)
print(f'LOTE {lote}: {len(done)} renders en {time.time() - t0:.0f} s')
