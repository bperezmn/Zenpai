"""Pipeline del set fotorrealista de zenpai.

  python3 pipeline.py fetch  <nombre> <url>          descarga el PNG a raw/<nombre>.png
  python3 pipeline.py match  <nombre> [<nombre>...]  iguala el color a raw/base.png (franja del equipo) → color/<nombre>.png
  python3 pipeline.py sheet  <salida.jpg> <nombre>...  hoja de contacto (usa color/ si existe, si no raw/)
  python3 pipeline.py export <nombre> [<nombre>...]  exporta color/<nombre>.png → webp/<nombre>.webp (1200 px de ancho, q88)

El color se iguala por estadísticas (media y desviación por canal) de la franja alta de la carpa,
donde solo hay equipo: las fotos no están alineadas al píxel, así que no se comparan píxel a píxel.
"""
import os, sys, subprocess
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
RAW, COLOR, WEBP = (os.path.join(HERE, d) for d in ('raw', 'color', 'webp'))
for d in (RAW, COLOR, WEBP): os.makedirs(d, exist_ok=True)

def fetch(name, url):
    out = os.path.join(RAW, f'{name}.png')
    subprocess.run(['curl', '-sL', '-o', out, url], check=True)
    im = Image.open(out); print(name, im.size)

def _band(a):
    H, W, _ = a.shape
    return a[int(H*0.04):int(H*0.42), int(W*0.06):int(W*0.94)].reshape(-1, 3)

def match(names, base='base'):
    b = np.asarray(Image.open(os.path.join(RAW, f'{base}.png')).convert('RGB')).astype(np.float32)
    ref = _band(b); rm, rs = ref.mean(0), ref.std(0)
    for name in names:
        im = np.asarray(Image.open(os.path.join(RAW, f'{name}.png')).convert('RGB')).astype(np.float32)
        src = _band(im); sm, ss = src.mean(0), src.std(0)
        a = rs / ss; c = rm - a * sm
        out = np.clip(im * a + c, 0, 255).astype(np.uint8)
        Image.fromarray(out).save(os.path.join(COLOR, f'{name}.png'))
        print(f'{name:22s} a={a.round(3)} media {sm.round(0)} → {_band(out).mean(0).round(0)} (base {rm.round(0)})')

def _pick(name):
    p = os.path.join(COLOR, f'{name}.png')
    return p if os.path.exists(p) else os.path.join(RAW, f'{name}.png')

def sheet(out, names, H=760, gap=12, cols=6):
    ims = [Image.open(_pick(n)).convert('RGB') for n in names]
    th = [im.resize((round(im.width*H/im.height), H)) for im in ims]
    rows = [th[i:i+cols] for i in range(0, len(th), cols)]
    W = max(sum(t.width for t in r) + gap*(len(r)-1) for r in rows)
    sheet = Image.new('RGB', (W, len(rows)*(H+40) + gap*(len(rows)-1)), (0, 0, 0))
    d = ImageDraw.Draw(sheet); y = 0
    for r, row in enumerate(rows):
        x = 0
        for j, t in enumerate(row):
            sheet.paste(t, (x, y+40)); d.text((x+10, y+12), names[r*cols+j], fill=(255, 255, 255)); x += t.width + gap
        y += H + 40 + gap
    sheet.save(out, quality=86); print(out, sheet.size)

def export(names, width=1080):
    for name in names:
        im = Image.open(_pick(name)).convert('RGB')
        im = im.resize((width, round(im.height*width/im.width)), Image.LANCZOS)
        im.save(os.path.join(WEBP, f'{name}.webp'), quality=88, method=6)
        print(name, im.size, os.path.getsize(os.path.join(WEBP, f'{name}.webp'))//1024, 'KB')

if __name__ == '__main__':
    cmd, args = sys.argv[1], sys.argv[2:]
    if cmd == 'fetch': fetch(args[0], args[1])
    elif cmd == 'match': match(args)
    elif cmd == 'sheet': sheet(args[0], args[1:])
    elif cmd == 'export': export(args)
