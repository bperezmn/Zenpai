import { useEffect, useRef, useState } from 'react'
import { useStore, selectActive } from '../store'
import { closedImg, ajarImg } from '../lib'

// Apertura de la carpa: negro → cerrada → entreabierta → tu carpa (las fotos originales).
// Arranca solo cuando las dos fotos de la puerta ya están descargadas: antes, en un teléfono
// sin caché se veía la carpa abierta, luego la cerrada y otra vez abierta ("se abre dos veces").
// El fondo es negro hasta la última fase para que la escena nunca se cuele por debajo.
// onDone va por ref: los timers no se reinician con cada render de la carpa.
export default function Intro({ onDone }: { onDone: () => void }) {
  const c = useStore(selectActive)
  const [phase, setPhase] = useState(0) // 0 cerrada, 1 entreabierta, 2 fin
  const [ready, setReady] = useState(false)
  const done = useRef(onDone)
  done.current = onDone
  const ajar = ajarImg(c)

  useEffect(() => {
    let alive = true
    const load = (src: string) => new Promise<void>((res) => { const i = new Image(); i.onload = () => res(); i.onerror = () => res(); i.src = src })
    // tope de 1.5 s: sin red la apertura no se queda en negro
    Promise.race([Promise.all([load(closedImg), load(ajar)]), new Promise<void>((r) => setTimeout(r, 1500))])
      .then(() => { if (alive) setReady(true) })
    return () => { alive = false }
  }, [ajar])

  useEffect(() => {
    if (!ready) return
    const t1 = setTimeout(() => setPhase(1), 850)
    const t2 = setTimeout(() => setPhase(2), 1750)
    const t3 = setTimeout(() => done.current(), 2650)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [ready])

  return (
    <div className="absolute inset-0 z-50 cursor-pointer" onClick={() => done.current()} style={{ background: phase >= 2 ? 'transparent' : '#000' }}>
      {ready && (
        <>
          <img src={ajar} alt="" className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700" style={{ opacity: phase >= 2 ? 0 : 1 }} />
          <img src={closedImg} alt="" className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700" style={{ opacity: phase >= 1 ? 0 : 1 }} />
        </>
      )}
      <div className="label absolute bottom-16 left-0 right-0 text-center" style={{ color: 'rgba(255,255,255,.85)', textShadow: '0 2px 10px rgba(0,0,0,.9)' }}>
        {phase < 2 ? 'Abriendo tu carpa' : 'Bienvenido'}
      </div>
    </div>
  )
}
