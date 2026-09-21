# Compone cada etapa sobre la BASE nítida: la carpa y el equipo salen siempre de la base
# (primera generación), y de la foto encadenada solo se toma lo que cambia (las plantas),
# detectado por diferencia de color respecto a la base, con borde suavizado.
import sys, os, numpy as np
from PIL import Image, ImageFilter
os.makedirs('composed', exist_ok=True)
def load(p): return np.asarray(Image.open(p).convert('RGB')).astype(np.float32)
def blur(a, r): return np.asarray(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float32)
def compose(name, base_name, thr=30):
    base = load(f'raw/{base_name}.png')
    src = load(f'color/{name}.png') if os.path.exists(f'color/{name}.png') else load(f'raw/{name}.png')
    H, W, _ = base.shape
    d = np.abs(blur(src, 4) - blur(base, 4)).max(axis=2)          # diferencia por píxel (suavizada)
    m = (d > thr).astype(np.float32)
    # solo dentro de la abertura de la puerta: fuera, la base manda siempre
    win = np.zeros((H, W), np.float32); win[int(H*0.08):int(H*0.965), int(W*0.10):int(W*0.83)] = 1
    m *= win
    m = blur(m * 255, 10) / 255; m = (m > 0.35).astype(np.float32)   # cierra huecos entre hojas
    m = blur(m * 255, 14) / 255                                     # pluma del borde
    m3 = m[..., None]
    out = base * (1 - m3) + src * m3
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(f'composed/{name}.png')
    print(f'{name:18s} base={base_name:14s} plantas={m.mean()*100:.1f}% del cuadro')
if __name__ == '__main__':
    pairs = [a.split('=') for a in sys.argv[1:]]
    for name, b in pairs: compose(name, b)
