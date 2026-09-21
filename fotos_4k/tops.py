# Vistas cenitales: de cada foto de día salen las 4 variantes que espera la app
# (dia / noche / frio / calor) con un ajuste de color determinista, a 1080 px de ancho.
import os, glob, numpy as np
from PIL import Image
os.makedirs('webp/top', exist_ok=True)
STATES = {
    'dia':   lambda a: a,
    'noche': lambda a: 255 * (a / 255) ** 1.5 * np.array([0.30, 0.33, 0.42]),
    'frio':  lambda a: a * np.array([0.86, 0.94, 1.08]),
    'calor': lambda a: a * np.array([1.08, 0.95, 0.84]),
}
for path in sorted(glob.glob('raw/top-*.png')):
    name = os.path.basename(path)[:-4]           # top-vacia | top-veg-3p
    parts = name.split('-')
    stage, p = parts[1], (parts[2] if len(parts) > 2 else None)
    im = Image.open(path).convert('RGB')
    im = im.resize((1080, round(im.height * 1080 / im.width)), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    for st, f in STATES.items():
        out = Image.fromarray(np.clip(f(a), 0, 255).astype(np.uint8))
        fn = f'top-{stage}-{st}' + (f'-{p}' if p else '') + '.webp'
        out.save(f'webp/top/{fn}', quality=85, method=6)
print(len(os.listdir('webp/top')), 'cenitales')
