import { useEffect, useRef, useState } from 'react'
import type { HowToDef } from '../howtos'

const STEP_MS = 5000

// Visor de "muéstrame cómo": pasa fotos fijas con fundido + zoom suave (Ken Burns),
// barras de progreso tipo historias, toca izquierda/derecha para retroceder/avanzar.
export default function HowTo({ def, actionLabel, onAction, onClose }: {
  def: HowToDef
  actionLabel?: string          // botón del último paso (p.ej. "Transplantar →")
  onAction?: () => void         // al pulsar ese botón
  onClose: () => void
}) {
  const [i, setI] = useState(0)
  const last = i === def.steps.length - 1
  const timer = useRef<number | null>(null)

  // auto-avance (se detiene en el último paso, esperando la acción)
  useEffect(() => {
    if (last) return
    timer.current = window.setTimeout(() => setI((v) => Math.min(def.steps.length - 1, v + 1)), STEP_MS)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [i, last, def.steps.length])

  const go = (d: number) => setI((v) => Math.max(0, Math.min(def.steps.length - 1, v + d)))

  return (
    <div className="absolute inset-0 z-[55] select-none" style={{ background: '#04070a' }}>
      {/* fotos con crossfade + Ken Burns */}
      <div className="absolute inset-0 overflow-hidden">
        {def.steps.map((s, idx) => (
          <img key={idx} src={s.img} alt="" className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: idx === i ? 1 : 0, transition: 'opacity .6s ease', animation: idx === i ? 'kb 6s ease-out both' : undefined }} />
        ))}
        <div className="absolute top-0 left-0 right-0 h-28 pointer-events-none" style={{ background: 'linear-gradient(180deg,rgba(4,7,10,.8),transparent)' }} />
        <div className="absolute bottom-0 left-0 right-0 h-72 pointer-events-none" style={{ background: 'linear-gradient(0deg,rgba(4,7,10,.94),rgba(4,7,10,.4) 50%,transparent)' }} />
      </div>

      {/* zonas táctiles: izquierda = atrás, derecha = adelante */}
      <button className="absolute left-0 top-0 bottom-0 w-1/3 z-10" onClick={() => go(-1)} aria-label="anterior" />
      <button className="absolute right-0 top-0 bottom-0 w-2/3 z-10" onClick={() => go(1)} aria-label="siguiente" />

      {/* barras de progreso */}
      <div className="absolute top-3.5 left-3.5 right-3.5 z-20 flex gap-1.5">
        {def.steps.map((_, idx) => (
          <div key={idx} className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.25)' }}>
            <div style={{
              height: '100%', borderRadius: '9px', background: 'linear-gradient(90deg,var(--acc),var(--acc2))',
              width: idx < i ? '100%' : idx === i ? '100%' : '0%',
              transition: idx === i && !last ? `width ${STEP_MS}ms linear` : 'none',
              animation: idx === i && !last ? `fill ${STEP_MS}ms linear both` : undefined,
            }} />
          </div>
        ))}
      </div>

      {/* título + cerrar */}
      <div className="absolute top-9 left-4 right-4 z-20 flex items-center justify-between">
        <span className="display font-bold text-[1rem]" style={{ textShadow: '0 2px 8px rgba(0,0,0,.8)' }}>{def.title}</span>
        <button onClick={onClose} className="h-8 px-3 rounded-2xl glass text-white/85"
          style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: '.68rem' }}>Cerrar</button>
      </div>

      {/* texto del paso + acción */}
      <div className="absolute left-5 right-5 bottom-7 z-20">
        <div className="text-[.62rem] font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--acc)' }}>Paso {i + 1} de {def.steps.length}</div>
        <p className="text-[.98rem] font-medium leading-snug mb-4" style={{ textShadow: '0 2px 10px rgba(0,0,0,.9)' }}>{def.steps[i].caption}</p>
        {last && actionLabel && (
          <button onClick={onAction} className="w-full btn-glow rounded-2xl py-3 display font-bold text-[.9rem]">{actionLabel}</button>
        )}
        {last && !actionLabel && (
          <button onClick={onClose} className="w-full btn-glow rounded-2xl py-3 display font-bold text-[.9rem]">Entendido 👍</button>
        )}
      </div>

      <style>{`
        @keyframes kb { from { transform: scale(1.08); } to { transform: scale(1); } }
        @keyframes fill { from { width: 0%; } to { width: 100%; } }
      `}</style>
    </div>
  )
}
