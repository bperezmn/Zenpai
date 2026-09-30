import { useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { stageLabel, type Cultivo, type Stage } from '../lib'
import { guiasPara, type Guia, type HowToDef } from '../howtos'
import { useBackClose } from '../useBackClose'
import HowTo from './HowTo'

// el orden del ciclo: agrupa la lista y decide qué viene después (germinación = datos viejos, plántula)
const ORDEN: Stage[] = ['remojo', 'plantula', 'veg', 'flor', 'cosecha', 'secando']
const pos = (s: Stage) => (s === 'germinacion' ? 1 : ORDEN.indexOf(s))
const GRUPO: Partial<Record<Stage, string>> = { remojo: 'Germinación' }
const grupoDe = (s: Stage) => GRUPO[s] ?? stageLabel[s]

// Las guías, ordenadas como el cultivo. Con cultivo: arriba «Ahora» (las de su etapa), luego
// «Próximo» (la siguiente etapa que tiene guías) y el resto plegado por etapas; solo las de su
// semilla, su sustrato y tu nivel, pero todas se abren. Sin cultivo (Mis cultivos): todas las
// versiones, por etapa. Todas son gratis.
export function GuiasLista({ c, onOpen }: { c: Cultivo | null; onOpen: (g: Guia) => void }) {
  const guide = useStore((s) => s.guide)
  const seen = useStore((s) => s.howtoSeen)
  const todas = guiasPara(guide, c)
  const aqui = c ? pos(c.stage) : -1
  const ahora = c ? todas.filter((g) => g.etapas.includes(c.stage)) : []
  const futuras = c ? todas.filter((g) => !ahora.includes(g) && pos(g.etapas[0]) > aqui) : []
  const sig = futuras.length ? Math.min(...futuras.map((g) => pos(g.etapas[0]))) : -1
  const proximo = futuras.filter((g) => pos(g.etapas[0]) === sig)
  const resto = todas.filter((g) => !ahora.includes(g) && !proximo.includes(g))
  const grupos = ORDEN.map((st) => ({ st, gs: resto.filter((g) => g.etapas[0] === st) })).filter((x) => x.gs.length > 0)
  const fila = (g: Guia) => <Fila key={g.id} g={g} sub={c?.substrate ?? null} tag={!c} vista={!!seen[g.id]} onOpen={() => onOpen(g)} />

  return (
    <div className="space-y-4">
      {ahora.length > 0 && c && (
        <Seccion titulo="Ahora" nota={c.stage === 'remojo' ? stageLabel[c.stage] : `${stageLabel[c.stage]} · día ${c.day}`}>{ahora.map(fila)}</Seccion>
      )}
      {proximo.length > 0 && <Seccion titulo="Próximo" nota={grupoDe(proximo[0].etapas[0])}>{proximo.map(fila)}</Seccion>}
      {grupos.map(({ st, gs }) => (c
        ? <Plegable key={st} titulo={grupoDe(st)} n={gs.length}>{gs.map(fila)}</Plegable>
        : <Seccion key={st} titulo={grupoDe(st)}>{gs.map(fila)}</Seccion>
      ))}
    </div>
  )
}

function Seccion({ titulo, nota, children }: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="label">{titulo}</span>
        {nota && <span className="text-[.74rem]" style={{ color: 'var(--faint)' }}>{nota}</span>}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

// lo que ya pasó o queda lejos: plegado, se abre al tocar
function Plegable({ titulo, n, children }: { titulo: string; n: number; children: ReactNode }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <section>
      <button onClick={() => setAbierto(!abierto)} aria-expanded={abierto}
        className="w-full min-h-[44px] flex items-center justify-between gap-3 text-left"
        style={{ background: 'none', border: 0, borderTop: '1px solid rgba(255,255,255,.12)', padding: 0, color: 'inherit', cursor: 'pointer' }}>
        <span className="label">{titulo}</span>
        <span className="flex items-center gap-2 text-[.74rem]" style={{ color: 'var(--faint)' }}>
          {n} {n === 1 ? 'guía' : 'guías'}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: abierto ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }}><path d="M6 9l6 6 6-6" /></svg>
        </span>
      </button>
      {abierto && <div className="space-y-2 pb-1">{children}</div>}
    </section>
  )
}

// una guía: su portada (la suya o la foto del paso 1, con su encuadre), el título, una línea y la marca de vista.
// tag: la versión (autoflorecientes, hidro…), solo en la lista sin cultivo, donde salen todas
function Fila({ g, sub, tag, vista, onOpen }: { g: Guia; sub: Cultivo['substrate'] | null; tag: boolean; vista: boolean; onOpen: () => void }) {
  const s0 = g.def(sub).steps[0]
  return (
    <button onClick={onOpen} className="w-full flex items-center gap-3 px-2.5 py-2 text-left"
      style={{ borderRadius: 5, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.02)', color: 'inherit', cursor: 'pointer' }}>
      <span className="relative w-12 h-12 flex-none overflow-hidden" style={{ borderRadius: 5, background: '#0b0c0f' }}>
        <img src={g.portada ?? s0.img} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: g.portada ? '50% 38%' : `${s0.focus?.x ?? 50}% ${s0.focus?.y ?? 50}%` }} />
      </span>
      <span className="min-w-0 flex-1 flex flex-col gap-0.5">
        {tag && g.variante && <span className="label">{g.variante}</span>}
        <span className="text-[.9rem] font-semibold leading-tight">{g.titulo}</span>
        <span className="text-[.78rem] leading-snug" style={{ color: 'var(--muted)' }}>{g.resumen}</span>
      </span>
      {vista && (
        <svg className="flex-none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Vista">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      )}
    </button>
  )
}

// La lista en su propia hoja (Mis cultivos, sin cultivo; la germinación, con el cultivo en remojo).
// Abrir una guía desde aquí solo la enseña: «Entendido», nada se anota. Gestiona su «atrás».
export default function GuiasSheet({ c, onClose }: { c: Cultivo | null; onClose: () => void }) {
  useBackClose(true, onClose)
  const [abierta, setAbierta] = useState<HowToDef | null>(null)
  useBackClose(!!abierta, () => setAbierta(null))
  return (
    <div className="absolute inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(3,6,9,.55)', backdropFilter: 'blur(2px)' }} />
      <div className="absolute left-0 right-0 bottom-0 glass rounded-t-3xl px-5 pt-3 pb-7 max-h-[88%] flex flex-col"
        onClick={(e) => e.stopPropagation()} style={{ animation: 'sheetUp .28s ease-out' }}>
        <div className="mx-auto mb-2 h-1 w-10 rounded-full flex-none" style={{ background: 'var(--glass-bd)' }} />
        <div className="flex items-center justify-between mb-2 flex-none">
          <h3 className="display font-bold text-[1.05rem]">Guías de cultivo</h3>
          <button onClick={onClose} className="h-11 px-1 text-[.82rem] font-semibold" style={{ background: 'none', border: 0, color: 'var(--muted)', cursor: 'pointer' }}>Cerrar</button>
        </div>
        <div className="overflow-y-auto -mx-1 px-1">
          <GuiasLista c={c} onOpen={(g) => setAbierta(g.def(c?.substrate ?? null))} />
        </div>
      </div>
      {/* los toques de la guía no suben al fondo de la hoja, que la cerraría */}
      {abierta && (
        <div onClick={(e) => e.stopPropagation()}>
          <HowTo def={abierta} onClose={() => setAbierta(null)} />
        </div>
      )}
      <style>{`@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
    </div>
  )
}
