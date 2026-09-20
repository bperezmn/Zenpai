# zenpai · escena 3D de la carpa (Blender 5.2 + Higgsfield)

`zenpai-carpa.blend` — carpa de cultivo paramétrica construida por script (bpy): cascarón de
tela negra + interior mylar, marco de carbono, puerta enrollable (fotogramas 1–24), filtro de
carbón + extractor, barra LED (emisiva + area light), ventilador clip, controlador. Cámara
frontal fija 9:16 (38 mm) y cámara cenital (`Camera_cenital`, 50 mm a 2.4 m mirando al piso:
su plano de recorte cercano "rebana" techo, LED y filtro → vista casa de muñecas).
Eevee con raytracing, AgX.

Las plantas NO son geometría: son recortes foto-reales (Higgsfield · Nano Banana +
`remove_background`) colocados como billboards dentro de la escena, normalizados por el ancho
real de la maceta (0.27 m tela / 0.30 m cubeta DWC). Así todas las etapas comparten escala,
cámara y luz — y el interior reacciona a los datos del usuario.

## Archivos
- `plantas/*_cutout.png` — recortes: `{plantula,veg_a,veg_b,flor,cosecha,sed,secando}` (tierra),
  `hidro_*` (cubeta DWC), `coco_*` (maceta beige con coco), `maceta` (vacía, germinación) y
  `top_*` (vistos desde arriba, para la cenital). Los `.glb` (Tripo) no se versionan.
- `plantas/medir.py` → `plantas/meta.json`: mide cada recorte (borde inferior y ancho de la
  maceta en px; los `top_*` se recortan al bbox del alfa). Correr tras añadir recortes.
- `render_v2.py` — helpers (`exec(open(...).read(), globals())` dentro de Blender):
  `set_stage(etapa, macetas, sustrato)`, `set_stage_top(...)`, `state('dia'|'noche'|'frio'|'calor')`,
  `render_batch([(etapa, macetas, estado[, sustrato[, 'front'|'top']]), ...], carpeta)`.
- `render_lote.py` — lotes sin interfaz (no bloquea Blender):
  `Blender -b blender/zenpai-carpa.blend --python blender/render_lote.py -- <lote> <carpeta>`
  con lote = `test · germinacion · sustratos · cenital · todo` (~5 s por render en M5).
- Luego, PNG → WebP (calidad 74) en `app/public/assets/v2/`.

## Nombres de render (= lo que pide `lib.ts`)
`{etapa}-{estado}-{macetas}p` (tierra) · `{coco|hidro}-{etapa}-{estado}-{macetas}p` ·
`top-{etapa}-{estado}-{macetas}p` (cenital, solo tierra) · `top-vacia-{estado}` ·
`secando-{dia|noche}-3p` · `sed-…-dia` (solo día) · `abrir-01..24` (puerta, carpa vacía).

## Estados (misma cámara, misma escena — lo que hace mágico el hero de AC Infinity)
- `luz_led` 55 + `led_barra` emisión 7 → **día**
- `luz_led` 0 + emisión 0.15 + `luz_tinte` azul 6 + clave/rims atenuadas → **noche**
- `luz_tinte` azul (0.35,0.55,1.0) energía 45 → **frío** · roja (1.0,0.30,0.12) → **calor**

## Lecciones (para no repetirlas)
- Generar las plantas sobre gris plano `#808080` con la maceta completa: sobre negro, el
  quitafondos se comía las macetas negras.
- Material de los billboards en `surface_render_method = 'BLENDED'`: con `DITHERED`, la
  planta que queda detrás de otro plano transparente sale como silueta negra.
- Espejar la planta derecha por UV, no con escala negativa (mismo artefacto).
- Para editar el recipiente de una planta ya generada, pasar el recorte compuesto sobre
  gris como `image_references` a Nano Banana: conserva la planta idéntica.
- Los modelos de vídeo (Seedance) rechazan la planta de cannabis en movimiento (`nsfw`);
  la "vida" de la escena en la app es CSS (respiración lenta + fundido entre estados).
