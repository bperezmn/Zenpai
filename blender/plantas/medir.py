# Mide los recortes ({clave}_cutout.webp, WebP sin pérdida con alfa; un PNG de Higgsfield se
# convierte con Image.save(..., 'WEBP', lossless=True)) y escribe meta.json para render_v2.py.
#   python3 blender/plantas/medir.py
# Frente: alto/ancho, fila del borde inferior de la maceta y ancho de la
# maceta en px (fila más ancha de las 200 inferiores = borde/lid). Cenital (top_*): se recorta
# la imagen al bbox del alfa (+4 px), así el plano en Blender es exactamente la planta.
# Las claves LEGACY conservan los valores con los que se renderizó el set de tierra.
from PIL import Image
import numpy as np, json, glob, os

D = os.path.dirname(os.path.abspath(__file__)) + '/'
LEGACY = {
    'veg_a':    {'h': 1184, 'w': 864, 'bottom': 1141, 'pot_w_px': 358},
    'veg_b':    {'h': 1184, 'w': 864, 'bottom': 1151, 'pot_w_px': 325},
    'plantula': {'h': 1184, 'w': 864, 'bottom': 1183, 'pot_w_px': 697},
    'flor':     {'h': 1184, 'w': 864, 'bottom': 1044, 'pot_w_px': 263},
    'cosecha':  {'h': 1184, 'w': 864, 'bottom': 1080, 'pot_w_px': 277},
    'sed':      {'h': 1184, 'w': 864, 'bottom': 1183, 'pot_w_px': 580},
    'secando':  {'h': 1184, 'w': 864, 'top': 141, 'bottom': 779, 'pot_w_px': 0},
}
meta = dict(LEGACY)
for p in sorted(glob.glob(D + '*_cutout.webp')):
    key = os.path.basename(p)[:-len('_cutout.webp')]
    if key in LEGACY: continue
    im = Image.open(p).convert('RGBA')
    a = np.array(im)[:, :, 3] > 128
    rows = np.where(a.any(1))[0]; cols = np.where(a.any(0))[0]
    if key.startswith('top_'):
        m = 4
        box = (max(int(cols[0]) - m, 0), max(int(rows[0]) - m, 0), min(int(cols[-1]) + m + 1, im.width), min(int(rows[-1]) + m + 1, im.height))
        if box != (0, 0, im.width, im.height): im = im.crop(box); im.save(p, 'WEBP', lossless=True, quality=100, method=6)
        meta[key] = {'h': im.height, 'w': im.width}
    else:
        bottom = int(rows[-1])
        def wid(r):
            c = np.where(a[r])[0]; return int(c[-1] - c[0] + 1) if len(c) else 0
        meta[key] = {'h': im.height, 'w': im.width, 'bottom': bottom,
                     'pot_w_px': max(wid(r) for r in range(max(0, bottom - 200), bottom + 1))}
    print(key, meta[key])
json.dump(meta, open(D + 'meta.json', 'w'), indent=1)
print('meta.json:', len(meta), 'recortes')
