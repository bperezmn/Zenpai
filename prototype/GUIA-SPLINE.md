# Guía: crear tu carpa 3D foto-real en Spline y conectarla a zenpai

Objetivo: que el render 3D de tu carpa (estilo AC Infinity) viva dentro de la app, con los overlays de zenpai (parámetros, toggles) encima. El archivo `carpa-3d.html` ya tiene la integración lista — solo falta tu escena.

---

## 1. Crea tu escena en Spline
1. Entra a **https://spline.design** y crea una cuenta (plan gratis sirve para empezar).
2. **New File** → empiezas con un lienzo 3D.

## 2. Consigue la carpa (lo más rápido: importar un modelo)
Modelar una carpa realista desde cero lleva tiempo. Atajo:
- Busca un modelo 3D de "grow tent" o "tent box" en **Sketchfab.com** o **CGTrader** (formato **.glb / .gltf**; muchos gratis con licencia CC).
- En Spline: **File → Import** y arrastra el `.glb`. Ya tienes la base.
- Para los equipos (filtro, extractor, barra LED, ventilador, cámara): impórtalos por separado o constrúyelos con primitivas (cilindros = filtro/extractor; caja delgada = LED; círculo + aspas = ventilador).

> Si no encuentras carpa, modela una caja simple (un cubo abierto, paredes oscuras, interior claro) — con buena luz ya se ve premium.

## 3. Hazla foto-real (materiales + luz)
- **Materiales:** selecciona cada objeto → panel **Material**. Usa `Glass`/`Metal`/color con *roughness* baja para metales (extractor, postes) y mate oscuro para la tela. Spline trae materiales tipo PBR.
- **Iluminación:** añade **Directional Light** (sol suave) + un **Point/Rect Light** donde va la barra LED (cálida). Activa sombras.
- **Environment / HDRI:** en *Scene → Environment* pon un HDRI para reflejos realistas (descarga gratis en **polyhaven.com** y súbelo). Esto es lo que más sube el realismo.
- **Glow/Bloom:** activa post-procesado (Bloom) para que el LED y los indicadores brillen.

## 4. Tu planta dentro
- Importa un modelo 3D de planta (busca "cannabis plant" / "plant" en Sketchfab) y colócala en la maceta.
- Alternativa ligera: un plano vertical con una foto PNG de planta (billboard). Pesa menos en móvil.

## 5. Anímala y crea ESTADOS
- **Ventilador/extractor girando:** selecciona las aspas → panel **Events** → animación de **rotación** en loop (360° continuo).
- **Luz on/off:** crea dos **States** (p. ej. *Día* y *Noche*): en *Noche* baja la intensidad de la luz LED y oscurece el interior. Spline interpola la transición.

## 6. Variables para controlarla desde zenpai (la magia)
En el panel **Variables** crea:
- `luz` → **Boolean**
- `ventilador` → **Number** (0–6) o Boolean
- `extractor` → **Boolean**

Luego en **Events** usa **Variable Change** → acción **Transition to State** (ej.: cuando `luz` = false → estado *Noche*). Así, cuando zenpai cambie la variable, tu carpa reacciona.

## 7. Exporta y pégala en zenpai
1. Botón **Export** (arriba) → pestaña **Spline Viewer** → **Update** → copia la **URL** que termina en `…/scene.splinecode`.
2. Abre `carpa-3d.html` y pega esa URL en:
   ```js
   const SCENE_URL = 'https://prod.spline.design/XXXX/scene.splinecode';
   ```
3. Recarga. Tu carpa 3D aparece de fondo y los overlays de zenpai quedan encima. ✅

## 8. Control en vivo (ya cableado)
Los toggles de zenpai ya llaman a:
```js
setVar('luz', true/false);      // controla tu variable de Spline
setVar('ventilador', 5);
setVar('extractor', true/false);
```
Con que tus variables se llamen igual, **encender la luz en zenpai apaga/enciende la luz en tu carpa 3D**. (Para control más fino: `@splinetool/runtime` con `emitEvent`.)

## 9. Rendimiento (importante para móvil)
- Mantén el conteo de polígonos bajo; comprime texturas; pocas luces con sombra.
- Spline Viewer es WebGL: prueba en un móvil real.

---

## Recursos
- Modelos: **sketchfab.com**, **cgtrader.com**, **turbosquid.com**
- HDRIs y texturas gratis: **polyhaven.com**
- Docs export/embed: https://docs.spline.design/exporting-your-scene/web/exporting-as-spline-viewer
- API en código (control avanzado): `@splinetool/runtime` (npm)

## Plan B (aún más realista): la cámara real
Recuerda que la ruta más foto-real para producción es el **feed real de la cámara de la carpa** (AC Infinity ya la tiene): muestras tu planta REAL en vivo y encimas estos mismos overlays. Si algún día quieres, lo montamos.
