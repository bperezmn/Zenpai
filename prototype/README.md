# zenpai · La Carpa (digital twin)

Abres la app y **ves TU carpa con tu planta dentro**, y cada parámetro anclado a su componente físico — la fusión de GROVE (la carpa es la interfaz) + TERRARIO (la planta viva) + el panel de control de tu equipo.

## Cómo verlo
Abre `prototype/index.html` en el navegador (doble clic). Si ya lo tenías abierto, **recarga** (Cmd+R).

## Qué hay y qué probar
- **Controles de arriba (Extractor · Luz · Ventilador):** tócalos. **Apaga la luz** → toda la carpa se oscurece (ciclo de descanso 🌙). Sube el **ventilador** → más flujo de aire azul cruzando la planta. Pausa el **extractor**.
- **Tu planta (en la maceta):** respira y reacciona a su estado. **Mantén el dedo en la tierra** para regarla → bebe, revive y el diario se escribe solo. **Toca una hoja** → diagnóstico IA. Toca la cápsula **salud**.
- **Controlador (arriba der., 24°/60°):** tócalo → clima completo (temp, HR, VPD, PPFD, CO₂, fotoperiodo).
- **Cámara:** tócala → vista en vivo / timelapse / detección de plagas.
- **Barra LED:** tócala → estado, PPFD, fotoperiodo.

## El dial Guía cambia la lectura
- **Guiado:** carpa + planta + una línea poética (sin números).
- **Equilibrado:** dock con TEMP / HR / VPD / LUZ / VENT.
- **Pro:** dock con VPD / PPFD / pH / EC / CO₂ / fotoperiodo exactos.

## Temas
Oscuro (def.) · Claro · Luz roja.

## Camino al foto-realismo (producto real)
Esta carpa es una **ilustración interactiva** premium. Para el look foto-real del render de referencia hay dos rutas en el producto real:
1. Un modelo **3D** pre-renderizado o en **three.js** (tu carpa como digital twin navegable).
2. El **feed real de la cámara** de tu carpa (AC Infinity ya la tiene) → tu planta REAL con los overlays de parámetros encima. Esta es la más potente.

> Si dejas tu render en `prototype/assets/tent.png`, lo cambio por el foto-real como fondo de la escena. Datos de ejemplo; estado e interacciones reales.
