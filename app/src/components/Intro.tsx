import { useEffect, useState } from 'react'
import { useStore, selectActive } from '../store'
import { closedImg, ajarImg, doorFrame, DOOR_FRAMES, v2Stage } from '../lib'

// Apertura de la carpa. Con la escena 3D (v2): 24 fotogramas de la puerta enrollándose
// sobre la carpa VACÍA, y al final un fundido a la imagen real — tus plantas "aparecen".
// Sin v2 (etapas aún con arte anterior): el crossfade cerrada → entreabierta de siempre.
const DUR_MS = 1500

export default function Intro({ onDone }: { onDone: () => void }) {
  const c = useStore(selectActive)
  const useSeq = v2Stage(c) !== null && c.stage !== 'secando'
  const [frame, setFrame] = useState(1)
  const [fin, setFin] = useState(false)
  const [phase, setPhase] = useState(0) // solo para el modo antiguo

  useEffect(() => {
    if (!useSeq) {
      const t1 = setTimeout(() => setPhase(1), 850)
      const t2 = setTimeout(() => setPhase(2), 1750)
      const t3 = setTimeout(onDone, 2650)
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
    }
    let raf = 0
    let cancelled = false
    // precarga (con tope de espera): sin ella, los fotogramas saltarían en la primera visita
    const imgs = Array.from({ length: DOOR_FRAMES }, (_, k) => { const im = new Image(); im.src = doorFrame(k + 1); return im })
    const ready = Promise.race([
      Promise.all(imgs.map((im) => im.decode().catch(() => {}))),
      new Promise((res) => setTimeout(res, 1800)),
    ])
    ready.then(() => {
      if (cancelled) return
      const start = performance.now()
      const step = (t: number) => {
        const p = Math.min(1, (t - start) / DUR_MS)
        const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
        setFrame(1 + Math.round(eased * (DOOR_FRAMES - 1)))
        if (p < 1) raf = requestAnimationFrame(step)
        else { setFin(true); setTimeout(onDone, 750) }
      }
      raf = requestAnimationFrame(step)
    })
    return () => { cancelled = true; cancelAnimationFrame(raf) }
  }, [onDone, useSeq])

  if (useSeq) {
    return (
      <div className="absolute inset-0 z-50 cursor-pointer" onClick={onDone}>
        <img src={doorFrame(frame)} alt="" className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700" style={{ opacity: fin ? 0 : 1 }} />
        <div className="absolute bottom-16 left-0 right-0 text-center text-[.74rem] font-semibold transition-opacity duration-500" style={{ color: '#cfe3d7', textShadow: '0 2px 10px rgba(0,0,0,.9)', opacity: fin ? 0 : 1 }}>
          abriendo tu carpa…
        </div>
      </div>
    )
  }
  return (
    <div className="absolute inset-0 z-50 cursor-pointer" onClick={onDone}>
      <img src={ajarImg(c)} alt="" className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700" style={{ opacity: phase >= 2 ? 0 : 1 }} />
      <img src={closedImg} alt="" className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700" style={{ opacity: phase >= 1 ? 0 : 1 }} />
      <div className="absolute bottom-16 left-0 right-0 text-center text-[.74rem] font-semibold" style={{ color: '#cfe3d7', textShadow: '0 2px 10px rgba(0,0,0,.9)' }}>
        {phase < 2 ? 'abriendo tu carpa…' : 'bienvenido 🌿'}
      </div>
    </div>
  )
}
