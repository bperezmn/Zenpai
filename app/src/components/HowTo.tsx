import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useStore } from '../store'
import type { HowToDef } from '../howtos'

// ritmo: cada paso dura lo que se tarda en leerlo (unos 2 s + 0.35 s por palabra), entre 4 y 12 s
const stepMs = (caption: string) => Math.min(12000, Math.max(4000, 2000 + 350 * caption.trim().split(/\s+/).length))
// apretar más que esto es pausar para leer, no pasar de paso
const HOLD_MS = 250

// Visor de "muéstrame cómo": pasa fotos fijas con fundido + zoom suave (Ken Burns),
// barras de progreso tipo historias, toca izquierda/derecha para retroceder/avanzar y
// mantén el dedo apretado para pausar. Al llegar al último paso queda como vista.
export default function HowTo({ def, actionLabel, onAction, onClose }: {
  def: HowToDef
  actionLabel?: string          // botón de la acción: verbo corto, sin flechas (p.ej. "Trasplantar")
  onAction?: () => void         // al pulsar ese botón
  onClose: () => void
}) {
  const n = def.steps.length
  const [i, setI] = useState(0)
  const last = i === n - 1
  const ms = stepMs(def.steps[i].caption)
  const markHowtoSeen = useStore((s) => s.markHowtoSeen)
  // "ya sé cómo": quien ya la vio (o es avanzado) tiene el botón desde el paso 1
  const [known] = useState(() => { const s = useStore.getState(); return s.guide === 'avanzado' || !!s.howtoSeen[def.id] })
  const [paused, setPaused] = useState(false)
  const run = useRef({ step: -1, left: 0, since: 0 })   // lo que le queda al paso actual
  const pressTs = useRef(0)

  // auto-avance (se detiene en el último paso, esperando la acción). La pausa guarda lo que faltaba.
  useEffect(() => {
    const r = run.current
    if (r.step !== i) { r.step = i; r.left = ms }
    if (last || paused) return
    r.since = Date.now()
    const t = window.setTimeout(() => setI((v) => Math.min(n - 1, v + 1)), r.left)
    return () => { clearTimeout(t); r.left -= Date.now() - r.since }
  }, [i, last, paused, ms, n])

  useEffect(() => { if (last) markHowtoSeen(def.id) }, [last, def.id, markHowtoSeen])

  const go = (d: number) => setI((v) => Math.max(0, Math.min(n - 1, v + d)))
  // zonas táctiles: apretar pausa; soltar reanuda y, si fue un toque corto, cambia de paso
  const hold = {
    onPointerDown: () => { pressTs.current = Date.now(); setPaused(true) },
    onPointerUp: () => setPaused(false),
    onPointerCancel: () => setPaused(false),
    onPointerLeave: () => setPaused(false),
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  }
  const tap = (d: number) => () => {
    const held = pressTs.current > 0 && Date.now() - pressTs.current >= HOLD_MS
    pressTs.current = 0
    if (!held) go(d)
  }
  const play = paused ? 'paused' : 'running'

  return (
    <div className="absolute inset-0 z-[55] select-none" style={{ background: '#04070a' }}>
      {/* fotos con crossfade + Ken Burns, con el encuadre de cada paso (zoom y punto fijo) */}
      <div className="absolute inset-0 overflow-hidden">
        {def.steps.map((s, idx) => {
          const at = `${s.focus?.x ?? 50}% ${s.focus?.y ?? 50}%`
          const z = s.zoom ?? 1
          return (
            <img key={idx} src={s.img} alt="" className="absolute inset-0 w-full h-full object-cover"
              style={{
                objectPosition: at, transformOrigin: at, transform: `scale(${z})`, '--z': z, '--z0': z * 1.08,
                opacity: idx === i ? 1 : 0, transition: 'opacity .6s ease',
                animationName: idx === i ? 'kb' : 'none', animationDuration: `${ms + 1000}ms`,
                animationTimingFunction: 'ease-out', animationFillMode: 'both', animationPlayState: play,
              } as CSSProperties} />
          )
        })}
        <div className="absolute top-0 left-0 right-0 h-28 pointer-events-none" style={{ background: 'linear-gradient(180deg,rgba(4,7,10,.8),transparent)' }} />
        <div className="absolute bottom-0 left-0 right-0 h-72 pointer-events-none" style={{ background: 'linear-gradient(0deg,rgba(4,7,10,.94),rgba(4,7,10,.4) 50%,transparent)' }} />
      </div>

      {/* zonas táctiles: izquierda = atrás, derecha = adelante. touch-none: si el dedo se mueve
          un poco al apretar, el navegador no lo toma como scroll (cancelaría la pausa) */}
      <button className="absolute left-0 top-0 bottom-0 w-1/3 z-10 touch-none" {...hold} onClick={tap(-1)} aria-label="anterior" />
      <button className="absolute right-0 top-0 bottom-0 w-2/3 z-10 touch-none" {...hold} onClick={tap(1)} aria-label="siguiente" />

      {/* barras de progreso: cada una dura lo que su paso */}
      <div className="absolute top-3.5 left-3.5 right-3.5 z-20 flex gap-1.5">
        {def.steps.map((_, idx) => (
          <div key={idx} className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.25)' }}>
            <div style={{
              height: '100%', borderRadius: '9px', background: '#fff',
              width: idx <= i ? '100%' : '0%',
              animationName: idx === i && !last ? 'fill' : 'none', animationDuration: `${ms}ms`,
              animationTimingFunction: 'linear', animationFillMode: 'both', animationPlayState: play,
            }} />
          </div>
        ))}
      </div>

      {/* título + cerrar */}
      <div className="absolute top-9 left-4 right-4 z-20 flex items-center justify-between">
        <span className="display font-bold text-[1rem]" style={{ textShadow: '0 2px 8px rgba(0,0,0,.8)' }}>{def.title}</span>
        <button onClick={onClose} className="h-8 px-3 rounded-2xl glass text-white/85 display font-bold text-[.78rem]">Cerrar</button>
      </div>

      {/* texto del paso + acción (en el último paso, o desde el primero si ya sabe cómo). El texto
          deja pasar los toques a las zonas: apretar sobre lo que se lee también pausa */}
      <div className="absolute left-5 right-5 bottom-7 z-20 pointer-events-none">
        <div className="label mb-1.5" style={{ color: 'rgba(255,255,255,.85)', textShadow: '0 1px 6px rgba(0,0,0,.8)' }}>Paso {i + 1} de {n}</div>
        <p className="text-[.98rem] font-medium leading-snug mb-4" style={{ textShadow: '0 2px 10px rgba(0,0,0,.9)' }}>{def.steps[i].caption}</p>
        {(last || known) && (
          <button onClick={actionLabel ? onAction : onClose} className="w-full btn-glow rounded-2xl py-3 display font-bold text-[.9rem] pointer-events-auto">{actionLabel ?? 'Entendido'}</button>
        )}
      </div>

      <style>{`
        @keyframes kb { from { transform: scale(var(--z0, 1.08)); } to { transform: scale(var(--z, 1)); } }
        @keyframes fill { from { width: 0%; } to { width: 100%; } }
      `}</style>
    </div>
  )
}
