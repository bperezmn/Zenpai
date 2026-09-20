# zenpai · escena 3D de la carpa (Blender 5.2)

`zenpai-carpa.blend` — carpa de cultivo paramétrica construida por script (bpy):
cascarón de tela negra + interior mylar reflectante, marco de carbono, puerta enrollada,
filtro de carbón + extractor, barra LED full-spectrum (emisiva + area light), ventilador clip,
controlador con pantalla, 3 macetas de tela y plantas de cannabis (hoja palmada de 7 dedos
generada por geometría, vegetativo). Cámara vertical fija 9:16 (40mm), luces de producto
(clave + rim teal/lima de marca), Eevee con raytracing.

## Estados (misma cámara, misma escena — lo que hace mágico el hero de AC Infinity)
- `luz_led` energía 55 + `led_barra` emisión 7 → **día**
- `luz_led` 0 + emisión 0.15 + `luz_tinte` azul 6 + clave/rims atenuadas → **noche**
- `luz_tinte` azul (0.35,0.55,1.0) energía 45 → **frío**
- `luz_tinte` roja (1.0,0.30,0.12) energía 45 → **calor**

Renders de referencia en `renders/` (720×1280). Objetivo: reemplazar las imágenes IA
(inconsistentes entre etapas) por renders de UNA escena con estados que reaccionan a los
datos del usuario, y secuencias de fotogramas (puerta abriéndose) para scrub estilo Apple.
