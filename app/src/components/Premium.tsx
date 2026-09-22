import { useState } from 'react'
import { useStore } from '../store'
import { useBackClose } from '../useBackClose'

// ===== PRECIOS · editar aquí cuando estén decididos =====
// Texto tal cual se muestra, sin el periodo (p. ej. '4,99 €'). null = "Precio por definir".
const PRECIO_MENSUAL: string | null = null
const PRECIO_ANUAL: string | null = null

const BENEFICIOS = [
  'Diagnóstico de hojas por foto',
  'Dosis de abono de tu marca en cada riego',
  'Gráficas del ambiente',
  'Respaldo en la nube',
  'Carpas sin límite',
]

// Plan Premium: qué incluye y la prueba gratis mientras no haya pagos (llegan con la versión
// de tienda). Se abre encima de otras hojas (riego, diagnóstico, ajustes): gestiona su "atrás".
export default function Premium({ onClose }: { onClose: () => void }) {
  useBackClose(true, onClose)
  const premium = useStore((s) => s.premium)
  const setPremium = useStore((s) => s.setPremium)
  const [periodo, setPeriodo] = useState<'mensual' | 'anual'>('anual')
  const precio = periodo === 'mensual' ? PRECIO_MENSUAL : PRECIO_ANUAL

  return (
    // los clics no suben a la hoja de debajo (que se cerraría al tocar fuera de su panel)
    <div className="absolute inset-0 z-[60] overflow-y-auto" style={{ background: '#000' }} onClick={(e) => e.stopPropagation()}>
      <div className="min-h-full flex flex-col gap-[18px] px-6 pt-12 pb-7">
        <div className="flex items-center justify-between">
          <span className="label" style={{ color: 'var(--muted)' }}>zenpai premium</span>
          <button onClick={onClose} aria-label="Cerrar" className="w-11 h-11 flex items-center justify-center flex-none" style={{ border: '1px solid rgba(255,255,255,.28)', borderRadius: 5, color: '#fff', background: 'transparent' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <h1 className="display text-[1.85rem] font-semibold" style={{ lineHeight: 1.15 }}>Un mentor que también ve tus plantas</h1>

        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={() => setPeriodo('mensual')} aria-pressed={periodo === 'mensual'} className={`pchip ${periodo === 'mensual' ? 'on' : ''}`}>Mensual</button>
          <button onClick={() => setPeriodo('anual')} aria-pressed={periodo === 'anual'} className={`pchip ${periodo === 'anual' ? 'on' : ''}`}>Anual</button>
        </div>

        <div className="flex flex-col gap-3.5 px-4 py-[18px]" style={{ border: '1px solid #fff', borderRadius: 5 }}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="display text-[1.25rem] font-semibold">Premium</span>
            {precio
              ? <span className="mono text-[1rem]">{precio} / {periodo === 'mensual' ? 'mes' : 'año'}</span>
              : <span className="text-[.82rem]" style={{ color: 'var(--muted)' }}>Precio por definir</span>}
          </div>
          <ul className="flex flex-col gap-2.5">
            {BENEFICIOS.map((b) => (
              <li key={b} className="flex items-center gap-2.5 text-[.875rem]">
                <svg className="flex-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
                {b}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2.5 p-4" style={{ border: '1px solid rgba(255,255,255,.14)', borderRadius: 5 }}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="display text-[1.125rem] font-semibold" style={{ color: 'var(--muted)' }}>Gratis</span>
            {!premium && <span className="label" style={{ color: 'var(--muted)' }}>Tu plan</span>}
          </div>
          <p className="text-[.875rem]" style={{ color: 'var(--muted)', lineHeight: 1.5 }}>
            Una carpa, riego y luz con avisos, técnicas paso a paso y tu timelapse.
          </p>
        </div>

        <div className="flex-1" />

        {premium ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-center gap-2 text-[.92rem] font-medium">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
              Premium activo
            </div>
            <button onClick={() => setPremium(false)} className="pbtn-ghost">Desactivar prueba</button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <button onClick={() => { setPremium(true); onClose() }} className="pbtn">Probar Premium</button>
            <p className="text-[.76rem] text-center leading-snug" style={{ color: 'var(--faint)' }}>
              Los pagos llegan con la versión de tienda. Mientras, puedes probarlo gratis.
            </p>
          </div>
        )}
      </div>

      <style>{`
        .pchip{height:44px;background:transparent;border:1px solid rgba(255,255,255,.18);border-radius:5px;color:var(--muted);font-family:'Instrument Sans',system-ui,sans-serif;font-size:.875rem;cursor:pointer}
        .pchip.on{background:rgba(255,255,255,.06);border-color:#fff;color:#fff}
        .pbtn{width:100%;height:52px;border:none;border-radius:5px;background:#fff;color:#000;font-family:'Instrument Sans',system-ui,sans-serif;font-weight:600;font-size:.94rem;cursor:pointer}
        .pbtn-ghost{width:100%;height:52px;border:1px solid rgba(255,255,255,.4);border-radius:5px;background:transparent;color:#fff;font-family:'Instrument Sans',system-ui,sans-serif;font-weight:600;font-size:.94rem;cursor:pointer}
      `}</style>
    </div>
  )
}
