# zenpai · la carpa: foto + plantas 3D (Blender 5.2 + Higgsfield)

**Cómo se hace cada imagen de la app (v3, modo foto):** la carpa es una FOTO — el arte IA
original que definió el look (ángulo 3/4, postes cromados, LED colgada, filtro con ducto,
ventilador, controlador, bandeja negra, fondo de estudio) — y las plantas son recortes
foto-reales colocados en la escena 3D y renderizados **solos, sobre fondo transparente**.
`componer.py` pone cada capa sobre la foto: foto × color del estado (día / noche / frío /
calor) + sombra suave bajo cada maceta + plantas (que ya vienen iluminadas por Blender con
las luces de ese mismo estado). Así el interior "reacciona" a los datos sin perder el look.

- `fotos/base-frente.png` — carpa abierta y vacía (la `carpa-vacia` original sin macetas,
  editada con Nano Banana y escalada a 2K), 900×1600.
- `fotos/base-cenital.png` — bandeja vacía desde arriba (misma edición sobre `carpa-cenital`).
- `fotos/puerta-0..3.png` — cerrada → rendija (1/4, generada) → entreabierta → abierta;
  los 24 fotogramas `abrir-NN` de la app son fundidos entre estos cuatro.
- `zenpai-carpa.blend` — la carpa 3D paramétrica (cascarón, mylar, LED, filtro…). En modo
  foto sigue existiendo para ILUMINAR y REFLEJAR las plantas, pero es invisible a cámara
  (`visible_camera = False`). Las luces `luz_led` / `luz_tinte` / `luz_clave` / rims definen
  los estados. Cámara frontal ajustada a la foto (y = −3.2, z = 1.21, 38 mm: macetas ≈ 15 %
  del ancho, piso al 86 % del alto); cámara cenital a 3.5 m (macetas al 22/50/78 % del alto).
- `plantas/*_cutout.webp` — recortes (WebP sin pérdida): `{plantula,veg_a,veg_b,flor,cosecha,
  sed,secando}` (tierra), `hidro_*` (cubeta DWC), `coco_*` (maceta beige con coco), `maceta`
  (vacía, germinación) y `top_*` (vistos desde arriba). Generados con Higgsfield (Nano Banana,
  fondo gris `#808080`, luego `remove_background`); las variantes de sustrato se hicieron
  pasando el recorte de tierra como referencia y pidiendo solo cambiar el recipiente.
- `plantas/medir.py` → `plantas/meta.json`: mide cada recorte (borde inferior y ancho de la
  maceta en px; los `top_*` se recortan al bbox del alfa). Correr tras añadir recortes.
- `render_v2.py` — helpers (`exec(open(...).read(), globals())` dentro de Blender):
  `set_stage(etapa, macetas, sustrato)`, `set_stage_top(...)`, `state(...)`,
  `render_batch([(etapa, macetas, estado[, sustrato[, 'front'|'top']]), ...], carpeta)`.
  `MODO_FOTO = False` vuelve al render 3D completo (v2, con techo rebanado en la cenital).
- `render_lote.py` — lotes sin interfaz (no bloquea Blender), ~2 s por capa en M5:
  `Blender -b blender/zenpai-carpa.blend --python blender/render_lote.py -- <lote> <carpeta>`
  con lote = `test · tierra · germinacion · sustratos · cenital · todo` (243 capas).
- `componer.py <carpeta_capas> [salida]` — compone y escribe los WebP en `app/public/assets/v2/`.

## Nombres de imagen (= lo que pide `lib.ts`)
`{etapa}-{estado}-{macetas}p` (tierra) · `{coco|hidro}-{etapa}-{estado}-{macetas}p` ·
`top-{etapa}-{estado}-{macetas}p` (cenital, solo tierra) · `top-vacia-{estado}` ·
`secando-{dia|noche}-3p` · `sed-…-dia` (solo día) · `abrir-01..24` (apertura; `abrir-24` =
carpa vacía).

## Estados
Foto × color SOLO dentro de la abertura de la puerta (`componer.ESTADO`): día 1 · noche
(0.50, 0.58, 0.72) con gradiente vertical y barra LED apagada por máscara · frío (0.72, 0.82,
1.0) · calor (1.0, 0.78, 0.62). Las plantas heredan ~55 % del tinte (`PLANTA`), con exposición
por etapa y vista (`EXPO_FRENTE` / `EXPO_TOP`) y más saturación de frente (1.35). En Blender:
`luz_led` (área 1.7×0.9 m, 44 W) + barra emisiva → día; LED 0 + `luz_tinte` azul 6 W → noche;
`luz_tinte` azul o roja 45 W → frío / calor. Todo esto lo fijó un panel de jueces visuales en
dos rondas (puntuaciones 5.5/4/5 → 7/7/7); los valores están comentados en `componer.py`.

## Lecciones (para no repetirlas)
- La carpa 3D "limpia" perdió contra el arte IA original a ojos del usuario: las fotos IA
  tienen materiales, cables, tensores y desgaste que cuesta mucho modelar. La combinación
  foto + plantas 3D da lo mejor de ambos (look + estados + macetas + sustratos + cenital).
- Generar las plantas sobre gris plano `#808080` con la maceta completa: sobre negro, el
  quitafondos se comía las macetas negras.
- Material de los billboards en `surface_render_method = 'BLENDED'`: con `DITHERED`, la
  planta que queda detrás de otro plano transparente sale como silueta negra.
- Espejar la planta derecha por UV, no con escala negativa (mismo artefacto).
- Para editar una imagen ya generada (quitar macetas, cambiar recipiente), pasarla como
  `image_references` a Nano Banana: conserva composición y encuadre casi al píxel (la salida
  es 768×1344; escalar a 2K con `upscale_image`).
- Con película transparente, usar `view_transform = 'Standard'` (AgX desatura las plantas
  frente a la foto).
- Los modelos de vídeo (Seedance) rechazan la planta de cannabis en movimiento (`nsfw`);
  la "vida" de la escena en la app es CSS (respiración lenta + fundido entre estados).
