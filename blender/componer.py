# Compone las capas de plantas (PNG RGBA de Blender, fondo transparente) sobre la foto de la
# carpa y escribe los WebP finales:
#   python3 blender/componer.py <carpeta_capas> [carpeta_salida]
# Cada capa {nombre}.png trae un {nombre}.json con las macetas proyectadas (cx, cy, w en
# fracción del encuadre) para dibujar la sombra bajo cada una. Del nombre salen la vista
# (frente / top), la etapa y el estado (día, noche, frío, calor).
#
# Orden de la composición (afinado con dos rondas de un panel de jueces visuales, 2026-09-20):
#   1. foto × color del estado SOLO dentro de la abertura de la puerta (la tela, los postes y el
#      cuarto no cambian de color: si no, parece un filtro sobre la imagen entera); de noche, un
#      gradiente vertical (más luz a media pared, menos junto a la barra y en el piso) y la barra
#      LED apagada con una máscara ajustada a los tubos
#   2. sombras: contacto (estrecha, densa) + ambiente (ancha, tenue), del color del estado
#   3. plantas: menos exposición y más saturación en el frente (contra la pared blanca salían
#      lavadas y sin croma), exposición por etapa (floración/cosecha menos castigadas de frente,
#      cosecha muy bajada en cenital), herencia PARCIAL del tinte del estado (~55 %); de noche no
#      se les resta exposición extra (quedaban en silueta). En la cenital la capa se recorta a la
#      bandeja (para no tapar el ducto ni las cinchas) y la placa se neutraliza (era cálida).
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageChops
from functools import reduce
import json, sys, os, glob
import numpy as np

D = os.path.dirname(os.path.abspath(__file__)) + '/'
BASES = {'frente': D + 'fotos/base-frente.png', 'top': D + 'fotos/base-cenital.png'}
ETAPAS = ('plantula', 'veg', 'flor', 'cosecha', 'sed', 'secando', 'germinacion', 'vacia')
ESTADO = {'dia': (1.0, 1.0, 1.0), 'noche': (0.50, 0.58, 0.72), 'frio': (0.72, 0.82, 1.0), 'calor': (1.0, 0.78, 0.62)}
EXTERIOR = {'dia': (1.0, 1.0, 1.0), 'noche': (0.72, 0.74, 0.80), 'frio': (0.96, 0.97, 1.0), 'calor': (1.0, 0.97, 0.95)}
PLANTA = {'dia': (1.0, 1.0, 1.0), 'noche': (0.71, 0.76, 0.85), 'frio': (0.85, 0.91, 1.0), 'calor': (1.0, 0.85, 0.74)}
EXPO_FRENTE = {'veg': 0.68, 'sed': 0.70, 'plantula': 0.75, 'flor': 0.80, 'cosecha': 0.80, 'germinacion': 0.90, 'secando': 0.85}
EXPO_TOP = {'veg': 0.78, 'sed': 0.78, 'plantula': 0.80, 'flor': 0.60, 'cosecha': 0.45, 'germinacion': 0.90}
SAT_FRENTE, SAT_TOP = 1.35, 1.05
BALANCE_TOP = (0.95, 1.0, 1.08)
SOMBRA_CONTACTO, SOMBRA_AMBIENTE, SOMBRA_TOP = 0.60, 0.20, 0.35
BANDEJA_TOP = (140, 205, 760, 1395)  # bandeja en la foto cenital (900×1600)

_cache = {}

def tinta(im, c):
    r, g, b = im.split()
    return Image.merge('RGB', (r.point(lambda v: v * c[0]), g.point(lambda v: v * c[1]), b.point(lambda v: v * c[2])))

def mascara_interior(base):
    """Abertura de la puerta: por cada fila, del primer al último píxel claro dentro de la caja de
    la carpa; el polígono resultante (rectángulo redondeado) se erosiona y se difumina poco, para
    no teñir el poste cromado ni la solapa de tela de arriba."""
    key = ('int', base.size)
    if key in _cache: return _cache[key]
    W, H = base.size
    L = np.asarray(base.convert('L'), dtype=np.uint8)
    x0, x1, y0, y1 = int(W * 0.09), int(W * 0.91), int(H * 0.075), int(H * 0.93)
    izq, der = [], []
    for y in range(y0, y1):
        cols = np.where(L[y, x0:x1] > 110)[0]
        if len(cols) and cols[-1] - cols[0] > W * 0.15: izq.append((x0 + cols[0], y)); der.append((x0 + cols[-1], y))
    m = Image.new('L', base.size, 0)
    if izq: ImageDraw.Draw(m).polygon(izq + der[::-1], fill=255)
    m = m.filter(ImageFilter.MinFilter(11)).filter(ImageFilter.GaussianBlur(6))
    _cache[key] = m
    return m

def mascara_led(base):
    """Los tubos de la barra LED en la foto de día: lo más brillante en la franja exacta donde
    cuelga (sin dilatar, para no oscurecer el resplandor de la pared)."""
    key = ('led', base.size)
    if key in _cache: return _cache[key]
    W, H = base.size
    L = np.asarray(base.convert('L'), dtype=np.uint8)
    sel = np.zeros_like(L); ya, yb = int(H * 0.325), int(H * 0.358)
    sel[ya:yb] = (L[ya:yb] > 232) * 255
    m = Image.fromarray(sel).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(2))
    _cache[key] = m
    return m

def mascara_bandeja(size):
    key = ('bandeja', size)
    if key in _cache: return _cache[key]
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).rounded_rectangle(BANDEJA_TOP, radius=40, fill=255)
    m = m.filter(ImageFilter.GaussianBlur(8))
    _cache[key] = m
    return m

def gradiente_noche(im):
    """De noche la luz ambiente cae hacia el piso y hacia la barra apagada: más luz a media pared."""
    W, H = im.size
    g = np.interp(np.arange(H) / H, [0.0, 0.30, 0.55, 0.90, 1.0], [0.80, 0.78, 1.15, 0.68, 0.60]).astype(np.float32)
    arr = np.asarray(im, dtype=np.float32) * g[:, None, None]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

def fondo_estado(base, st, top):
    if top: return tinta(tinta(base, BALANCE_TOP), ESTADO[st])
    interior = tinta(base, ESTADO[st])
    if st == 'noche': interior = gradiente_noche(interior)
    exterior = tinta(base, EXTERIOR[st])
    img = Image.composite(interior, exterior, mascara_interior(base))
    if st == 'noche':
        led = mascara_led(base)
        img = Image.composite(tinta(img, (0.35, 0.36, 0.40)), img, led)
        # la sombra que la barra proyectaba en la foto de día se aclara un poco (sin fuente arriba
        # no tiene sentido), en una banda suave justo bajo la barra
        bb = led.getbbox()
        if bb:
            W, H = img.size; banda = Image.new('L', img.size, 0)
            ImageDraw.Draw(banda).rectangle([bb[0], int(H * 0.358), bb[2], int(H * 0.395)], fill=255)
            banda = banda.filter(ImageFilter.GaussianBlur(15))
            img = Image.composite(ImageEnhance.Brightness(img).enhance(1.12), img, banda)
    return img

def con_sombras(img, pots, st, top):
    if not pots: return img
    W, H = img.size
    color = Image.new('RGB', img.size, tuple(int(255 * v * 0.15) for v in ESTADO[st]))
    capas = []
    for p in pots:
        cx, cy, w = p['cx'] * W, p['cy'] * H, p['w'] * W
        if top:
            s = Image.new('L', img.size, 0); ImageDraw.Draw(s).ellipse([cx - w * 0.55, cy - w * 0.55, cx + w * 0.55, cy + w * 0.55], fill=int(255 * SOMBRA_TOP))
            capas.append(s.filter(ImageFilter.GaussianBlur(10)))
        else:
            s = Image.new('L', img.size, 0)
            ImageDraw.Draw(s).ellipse([cx - w * 0.525, cy - w * 0.06 + 3, cx + w * 0.525, cy + w * 0.06 + 3], fill=int(255 * SOMBRA_CONTACTO))
            capas.append(s.filter(ImageFilter.GaussianBlur(8)))
            a = Image.new('L', img.size, 0)
            ImageDraw.Draw(a).ellipse([cx - w * 1.1, cy - w * 0.25 + H * 0.02, cx + w * 1.1, cy + w * 0.25 + H * 0.02], fill=int(255 * SOMBRA_AMBIENTE))
            capas.append(a.filter(ImageFilter.GaussianBlur(40)))
    return Image.composite(color, img, reduce(ImageChops.lighter, capas))

def plantas(capa, st, top, etapa):
    rgb = capa.convert('RGB'); a = capa.getchannel('A')
    expo = (EXPO_TOP if top else EXPO_FRENTE).get(etapa, 0.8)
    if st == 'noche': expo = min(1.0, expo + 0.25)  # el tinte ya las oscurece: sin doble castigo
    rgb = ImageEnhance.Brightness(rgb).enhance(expo)
    rgb = ImageEnhance.Color(rgb).enhance(SAT_TOP if top else SAT_FRENTE)
    rgb = tinta(rgb, PLANTA[st])
    if top: a = ImageChops.multiply(a, mascara_bandeja(capa.size))
    out = rgb.convert('RGBA'); out.putalpha(a)
    return out

def componer(capa_png, out_dir, base_override=None):
    name = os.path.basename(capa_png)[:-4]
    partes = name.split('-')
    top = partes[0] == 'top'
    st = next((p for p in partes if p in ESTADO), 'dia')
    etapa = next((p for p in partes if p in ETAPAS), 'veg')
    base = Image.open(base_override or BASES['top' if top else 'frente']).convert('RGB')
    pots = json.load(open(capa_png[:-4] + '.json')) if os.path.exists(capa_png[:-4] + '.json') else []
    img = con_sombras(fondo_estado(base, st, top), pots, st, top)
    capa = Image.open(capa_png).convert('RGBA')
    if capa.size != img.size: capa = capa.resize(img.size, Image.LANCZOS)
    img = Image.alpha_composite(img.convert('RGBA'), plantas(capa, st, top, etapa)).convert('RGB')
    os.makedirs(out_dir, exist_ok=True)
    img.save(os.path.join(out_dir, name + '.webp'), 'WEBP', quality=74, method=6)
    return name

if __name__ == '__main__':
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else D + '../app/public/assets/v2/'
    hechos = [componer(p, out) for p in sorted(glob.glob(os.path.join(src, '*.png')))]
    print(len(hechos), 'compuestos →', out)
