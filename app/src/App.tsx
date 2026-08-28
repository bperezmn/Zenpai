import { useEffect } from 'react'
import { useStore, selectActive } from './store'
import { preloadFor, CONSENT_VERSION } from './lib'
import { consumeEntry, shouldHandlePop, markerState, isOwnMarker } from './useBackClose'
import Home from './components/Home'
import Onboarding from './components/Onboarding'
import ConfigScreen from './components/ConfigScreen'
import Germination from './components/Germination'
import TentView from './components/TentView'
import Gate from './components/Gate'

export default function App() {
  const ready = useStore((s) => s.ready)
  const loadError = useStore((s) => s.loadError)
  const consentV = useStore((s) => s.consentV)
  const onboarded = useStore((s) => s.onboarded)
  const creating = useStore((s) => s.creating)
  const activeId = useStore((s) => s.activeId)
  const hasActive = useStore((s) => s.activeId != null && s.grows.some((g) => g.id === s.activeId))
  const recomputeTime = useStore((s) => s.recomputeTime)
  const active = useStore(selectActive)

  // precarga solo las imágenes del cultivo abierto (no las 31)
  useEffect(() => { if (hasActive) preloadFor(active) }, [hasActive, activeId, active.stage, active.substrate, active.thirst > 0.55, active.fan])

  // mantener el día/etapa/sed sincronizados con el reloj real (al volver a la app y cada minuto);
  // el mismo pulso revisa si toca un recordatorio de riego (solo con la app fuera de pantalla)
  useEffect(() => {
    recomputeTime()
    const tick = () => { recomputeTime(); useStore.getState().checkWaterReminder() }
    const onVis = () => { if (document.visibilityState === 'visible') recomputeTime(); else useStore.getState().checkWaterReminder() }
    document.addEventListener('visibilitychange', onVis)
    const id = window.setInterval(tick, 60000)
    return () => { document.removeEventListener('visibilitychange', onVis); window.clearInterval(id) }
  }, [recomputeTime])

  // gesto atrás del sistema a nivel de PANTALLA: desde el formulario o una carpa vuelve
  // a "Mis cultivos" en vez de matar la app. (Las hojas/overlays empujan su propia entrada
  // con useBackClose; esta es la de debajo.) La entrada vive mientras NO estés en Home:
  // las transiciones formulario→remojo→carpa no la tocan (sin carreras de history).
  // tras una recarga, la entrada actual puede traer el marcador de la sesión anterior:
  // se neutraliza para que el primer atrás no caiga en tierra de nadie
  useEffect(() => {
    if (isOwnMarker(history.state) || (history.state && (history.state.zenpaiScreen || history.state.zenpaiLayer))) {
      history.replaceState(null, '')
    }
  }, [])

  const inScreen = hasActive || creating
  useEffect(() => {
    if (!inScreen) return
    let popped = false
    history.pushState(markerState('screen'), '')
    const onPop = (e: PopStateEvent) => {
      if (!shouldHandlePop(e)) return
      // popstate no dice QUÉ entrada se consumió: si el estado nuevo aún es de una capa
      // zenpai DE ESTA SESIÓN (p.ej. atrás cerró una hoja y quedamos en la entrada de
      // pantalla), no es nuestro turno. Marcadores de sesiones anteriores cuentan como
      // entrada base: sí actuamos.
      if (isOwnMarker(e.state)) return
      popped = true
      // atrás a nivel de pantalla siempre aterriza en "Mis cultivos": goHome limpia
      // creating Y activeId, así el formulario abierto desde una carpa no deja una
      // pantalla viva con su entrada de historial ya consumida.
      useStore.getState().goHome()
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      if (!popped) consumeEntry()
    }
  }, [inScreen])

  const screen = !ready
    ? <Splash />
    : loadError
      ? <LoadError />
      : consentV < CONSENT_VERSION
        ? <Gate />
        : !onboarded
          ? <Onboarding />
          : creating
            ? <ConfigScreen />
            : !hasActive
              ? <Home />
              : active.stage === 'remojo' ? <Germination /> : <TentView />

  return (
    <>
      <div className="stage" />
      <div className="phone-wrap">
        <div className="phone">{screen}</div>
      </div>
    </>
  )
}

function Splash() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
      <Logo size={56} />
      <div className="display grad-text text-2xl font-bold">zenpai</div>
    </div>
  )
}

// datos guardados ilegibles: avisamos SIN escribir encima (no perder los cultivos del usuario)
function LoadError() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
      <Logo size={48} />
      <h2 className="display text-[1.15rem] font-bold mt-1">No pudimos leer tus datos</h2>
      <p className="text-[.85rem]" style={{ color: 'var(--muted)' }}>
        Tus cultivos siguen guardados en este dispositivo, pero algo impidió leerlos. Reintenta; si el problema continúa, no los hemos borrado.
      </p>
      <button onClick={() => window.location.reload()}
        className="btn-glow rounded-2xl px-6 py-2.5 display font-bold text-[.85rem] mt-2">Reintentar</button>
    </div>
  )
}

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <defs>
        <linearGradient id="zg" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="1" stopColor="#bef264" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="44" fill="none" stroke="url(#zg)" strokeWidth="8" strokeLinecap="round" strokeDasharray="245 32" transform="rotate(128 60 60)" />
      <line x1="60" y1="84" x2="60" y2="58" stroke="url(#zg)" strokeWidth="4.5" strokeLinecap="round" />
      <g transform="translate(57 64) rotate(-40)"><path d="M0 0 C 7 -5 5 -18 0 -23 C -5 -18 -7 -5 0 0 Z" fill="url(#zg)" /></g>
      <g transform="translate(63 60) rotate(40)"><path d="M0 0 C 7 -5 5 -18 0 -23 C -5 -18 -7 -5 0 0 Z" fill="url(#zg)" /></g>
    </svg>
  )
}
