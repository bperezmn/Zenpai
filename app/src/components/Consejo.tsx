import type { ReactNode } from 'react'
import type { Status } from '../mentor'
import type { HowToId } from '../howtos'

// Un consejo: la misma tarjeta en toda la app (Hoy, Medir, la ficha de riego). Punto de color,
// título corto, texto y, si hace falta, una acción y «Ver cómo». Sale de la tarjeta de Hoy.
// El tono viene de los tokens, nunca de colores escritos a mano:
// info = borde gris y punto azul; aviso = ámbar (--warn); alerta = rojo (--danger).
export type Tono = 'info' | 'aviso' | 'alerta'
const TONO: Record<Tono, { bd: string; bg: string; dot: string }> = {
  info: { bd: 'var(--glass-bd)', bg: 'rgba(255,255,255,.04)', dot: 'var(--blue)' },
  aviso: { bd: 'var(--warn)', bg: 'var(--warn-bg)', dot: 'var(--warn)' },
  alerta: { bd: 'var(--danger)', bg: 'var(--danger-bg)', dot: 'var(--danger)' },
}
// el semáforo de una lectura (o el tono de un consejo del mentor) → el tono de la tarjeta
export const tonoDe = (s?: Status | null): Tono => (s === 'bad' ? 'alerta' : s === 'warn' ? 'aviso' : 'info')

const BTN = { borderRadius: 5, background: 'transparent', border: '1px solid rgba(255,255,255,.4)', color: '#fff' } as const

export default function Consejo({ tono = 'info', titulo, children, accion, howto, onHowto, compacto, className = '' }: {
  tono?: Tono
  titulo?: string
  children: ReactNode
  accion?: { label: string; onClick: () => void }
  howto?: HowToId                        // «Ver cómo»: la guía que lo enseña (sale solo si hay onHowto)
  onHowto?: (id: HowToId) => void
  compacto?: boolean                     // dentro de una ficha: menos relleno
  className?: string
}) {
  const t = TONO[tono]
  const verComo = howto && onHowto ? () => onHowto(howto) : null
  return (
    <div className={`flex items-start gap-3 rounded-2xl ${compacto ? 'px-3 py-2.5' : 'px-3.5 py-3'} ${className}`}
      style={{ background: t.bg, border: `1px solid ${t.bd}` }}>
      <span className="w-1.5 h-1.5 rounded-full mt-[7px] flex-none" style={{ background: t.dot }} />
      <div className="min-w-0 flex-1">
        {titulo && <div className="text-[.86rem] font-bold leading-tight mb-0.5">{titulo}</div>}
        <div className="text-[.8rem] leading-relaxed" style={{ color: titulo ? 'var(--muted)' : 'var(--text)' }}>{children}</div>
        {(accion || verComo) && (
          <div className="flex gap-2 mt-2.5">
            {verComo && <button onClick={verComo} className="flex-1 h-11 text-[.82rem] font-semibold" style={BTN}>Ver cómo</button>}
            {accion && <button onClick={accion.onClick} className="flex-1 h-11 text-[.82rem] font-semibold" style={BTN}>{accion.label}</button>}
          </div>
        )}
      </div>
    </div>
  )
}
