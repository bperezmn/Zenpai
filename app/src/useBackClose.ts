import { useEffect, useRef } from 'react'

// ===== gesto atrás del sistema (Android/PWA): cerrar capas, nunca matar la app =====
//
// Cada capa (pantalla u hoja) empuja UNA entrada al historial; atrás la consume y cierra
// la capa. Si la capa se cierra desde la UI, consumimos nosotros la entrada.
//
// Los history.back() PROPIOS también disparan popstate y son asíncronos — y StrictMode
// monta los efectos dos veces en dev. Para que nada de eso descuadre la pila, todos los
// back programáticos pasan por consumeEntry() (contador de supresión) y TODOS los
// listeners preguntan primero shouldHandlePop(): un pop suprimido no es del usuario.
let suppress = 0
const decided = new WeakMap<Event, boolean>()

// Los consumos van SERIALIZADOS: dos history.back() lanzados en el mismo tick se fusionan
// en un solo traversal del navegador, y el contador quedaría sobrecontado (tragándose el
// siguiente atrás REAL del usuario). Cada consumo espera al popstate del anterior.
let pendingConsumes = 0
let consuming = false
function pump() {
  if (consuming || pendingConsumes === 0) return
  consuming = true
  pendingConsumes--
  suppress++
  history.back()
}
export function consumeEntry() {
  pendingConsumes++
  pump()
}
// visor de depuración (solo dev): estado interno del sistema de atrás
if (import.meta.env.DEV) {
  ;(window as any).__backDebug = () => ({ suppress, pendingConsumes, consuming, layers: layerStack.length })
}

// Decisión POR EVENTO: varios listeners reciben el mismo popstate y todos deben
// ver la misma respuesta (el primero decide; los demás la releen del WeakMap).
export function shouldHandlePop(e: Event): boolean {
  const prev = decided.get(e)
  if (prev !== undefined) return prev
  const handle = suppress === 0
  if (!handle) {
    suppress--
    consuming = false
    setTimeout(pump, 0) // el consumo en cola, si lo hay, sale ahora
  }
  decided.set(e, handle)
  return handle
}

// Drenaje permanente: si un consumeEntry() se dispara cuando ya no queda ningún listener
// de capa/pantalla (p.ej. saliste a Home por la UI), ALGUIEN tiene que gastar la supresión
// de ese pop — si no, se quedaría armada y se tragaría el siguiente atrás REAL del usuario.
// Este listener de módulo decide (y drena) SIEMPRE; los hooks releen del WeakMap.
window.addEventListener('popstate', (e) => { shouldHandlePop(e) })

// Las entradas se firman con un id de SESIÓN: tras recargar la página, las entradas zenpai
// del documento anterior siguen en la pila pero ya no son nuestras — sin la firma, el
// handler de pantalla las confundiría con propias e ignoraría pulsaciones de atrás.
const SID = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
export function markerState(kind: 'layer' | 'screen'): object {
  return kind === 'layer' ? { zenpaiLayer: SID } : { zenpaiScreen: SID }
}
export function isOwnMarker(st: unknown): boolean {
  const s = st as { zenpaiLayer?: string; zenpaiScreen?: string } | null
  return !!s && (s.zenpaiLayer === SID || s.zenpaiScreen === SID)
}

// Hook para HOJAS/OVERLAYS. Mientras `open` sea true hay una entrada extra; atrás la
// consume y llama onClose. Los dueños de varias capas pasan un booleano compuesto
// ("hay alguna abierta") para que las transiciones internas no alternen `open`.
//
// Cuando conviven varias capas apiladas (p.ej. Ajustes + su confirmación de borrado),
// SOLO la capa superior responde al atrás. El orden vive en una pila de módulo —
// deliberadamente NO en history.state: StrictMode (doble montaje en dev) deja entradas
// con estado rancio y cualquier comparación contra él se desincroniza.
const layerStack: Array<object> = []
export function useBackClose(open: boolean, onClose: () => void) {
  const cb = useRef(onClose)
  cb.current = onClose
  useEffect(() => {
    if (!open) return
    const me = {}
    layerStack.push(me)
    let popped = false
    history.pushState(markerState('layer'), '')
    const onPop = (e: PopStateEvent) => {
      if (!shouldHandlePop(e)) return
      if (layerStack[layerStack.length - 1] !== me) return // no soy la capa superior: no es mi turno
      popped = true
      cb.current()
    }
    window.addEventListener('popstate', onPop)
    return () => {
      const i = layerStack.lastIndexOf(me)
      if (i >= 0) layerStack.splice(i, 1)
      window.removeEventListener('popstate', onPop)
      if (!popped) consumeEntry()
    }
  }, [open])
}
