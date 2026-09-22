import { useState } from 'react'
import { useStore, selectActive } from '../store'
import BrandMark from './BrandMark'
import NutrientesInfo from './NutrientesInfo'
import Premium from './Premium'
import { stageLabel } from '../lib'
import { wateringGuide, targetFor, fmtRange, overwaterGuard, litrosRiego, semanaFlor } from '../mentor'
import { lineaPorId, faseActual, dosisRiego } from '../data/nutrientes'

// Ficha de riego: la "receta" de la etapa actual — cuánta agua (según la maceta), pH y EC objetivo.
// Se muestra al regar; cambia sola conforme el cultivo avanza de etapa.
// Si el guardarraíl de sobre-riego está activo, el aviso vive AQUÍ (antes de confirmar),
// con salida honesta: "Regar igualmente" para cuando el sustrato está seco de verdad.
export default function WaterRecipe({ onConfirm, onHow, onClose }: { onConfirm: (force?: boolean) => void; onHow: () => void; onClose: () => void }) {
  const c = useStore(selectActive)
  const guide = useStore((s) => s.guide)
  const w = wateringGuide(c)
  const ph = targetFor('ph', c.stage, c.substrate)
  const ec = targetFor('ec', c.stage, c.substrate)
  const guard = overwaterGuard(c)
  // plan de abono: la fase de la tabla del fabricante que toca hoy y los ml para este riego
  const linea = lineaPorId(c.nutrientesId)
  const fase = linea && (c.stage === 'plantula' || c.stage === 'veg' || c.stage === 'flor') ? faseActual(linea, c.stage, c.day, semanaFlor(c)) : null
  const litros = litrosRiego(c)
  const dosis = linea && fase ? dosisRiego(linea, fase, litros) : []
  const [showInfo, setShowInfo] = useState(false)
  // la dosis de la marca es Premium; agua, pH y EC siguen siendo gratis
  const premium = useStore((s) => s.premium)
  const [showPremium, setShowPremium] = useState(false)

  return (
    <div className="absolute inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(3,6,9,.55)', backdropFilter: 'blur(2px)' }} />
      <div className="absolute left-0 right-0 bottom-0 glass rounded-t-3xl px-5 pt-3 pb-7"
        onClick={(e) => e.stopPropagation()} style={{ animation: 'sheetUp .28s ease-out' }}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: 'var(--glass-bd)' }} />
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="display font-bold text-[1.05rem]">Riego de hoy</h3>
          <span className="text-[.7rem]" style={{ color: 'var(--faint)' }}>{stageLabel[c.stage]} · maceta {c.potL} L</span>
        </div>

        <div className="space-y-2">
          <Row label="Agua" value={w ? w.amount : 'a fondo'} />
          <Row label="pH" value={fmtRange(ph, 1)} />
          <Row label="EC · fuerza del abono" value={ec ?`${fmtRange(ec, 1)} mS`: 'solo agua'} />
        </div>

        {linea && fase && !premium && (
          <div className="mt-3 flex items-center gap-3 rounded-2xl pl-3.5 pr-2 py-2" style={{ border: '1px solid rgba(255,255,255,.14)', background: 'var(--panel)' }}>
            <span className="flex-1 min-w-0 text-[.82rem] leading-snug">
              Dosis de {linea.marca} en cada riego <span style={{ color: 'var(--muted)' }}>· Premium</span>
            </span>
            <button onClick={() => setShowPremium(true)} className="rbtn-ver">Ver</button>
          </div>
        )}

        {linea && fase && premium && (
          <div className="mt-3 rounded-2xl px-3.5 py-3" style={{ border: '1px solid rgba(255,255,255,.14)', background: 'var(--panel)' }}>
            <div className="flex items-center gap-3">
              <BrandMark linea={linea} size={36} wide />
              <div className="min-w-0 flex-1">
                <div className="text-[.86rem] font-medium truncate">{linea.marca}</div>
                <div className="text-[.72rem] truncate" style={{ color: 'var(--muted)' }}>{fase.nombre} · {litros} L de agua</div>
              </div>
              <button onClick={() => setShowInfo(true)} aria-label={`Ver la tabla de ${linea.marca}`} className="rtabla">Tabla</button>
            </div>
            {dosis.length === 0 ? (
              <div className="text-[.78rem] mt-3" style={{ color: 'var(--muted)' }}>Esta semana toca solo agua, sin abono.</div>
            ) : (
              <div className="mt-3 pt-3 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,.1)' }}>
                {dosis.map((d) => (
                  <div key={d.producto.id} className="flex items-center justify-between gap-3">
                    <div className="text-[.84rem] min-w-0 truncate">{d.producto.nombre}</div>
                    <div className="flex items-baseline gap-2 flex-none">
                      {d.ml < 1 && <span className="text-[.7rem]" style={{ color: 'var(--faint)' }}>≈ {Math.max(1, Math.round(d.ml * 20))} gotas</span>}
                      <span className="mono text-[1rem] font-medium">{d.ml} <span className="text-[.68rem]" style={{ color: 'var(--muted)' }}>ml</span></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!linea.verificado && (
              <div className="text-[.7rem] mt-3" style={{ color: 'var(--warn)' }}>Dosis de la tabla pública del fabricante. Compárala con la etiqueta de tu botella.</div>
            )}
          </div>
        )}

        <div className="mt-4 mb-4 space-y-1.5">
          <p className="text-[.76rem] leading-snug" style={{ color: 'var(--muted)' }}>
            Ajusta el pH del agua antes de regar.{w?.when ? ` Riega ${w.when}.` : ''}
          </p>
          {guide === 'novato' && ec && dosis.length === 0 && (
            <p className="text-[.72rem] leading-snug" style={{ color: 'var(--faint)' }}>
              ¿Sin medidor de EC? Empieza con un cuarto de la dosis que indique tu abono.
            </p>
          )}
        </div>

        {guard && (
          <div className="mb-3 rounded-2xl px-3.5 py-2.5 text-[.76rem] leading-snug"
            style={{ background: 'rgba(232,179,75,.1)', border: '1px solid var(--warn)', color: 'var(--warn)' }}>
            {guard}
          </div>
        )}

        {guard ? (
          <div className="flex gap-2">
            <button onClick={() =>onConfirm(true)} className="rbtn-ghost flex-1">Regar igualmente</button>
            <button onClick={onClose} className="rbtn flex-1">Esperar</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={onHow} className="rbtn-ghost flex-1">Ver cómo</button>
            <button onClick={() =>onConfirm()} className="rbtn flex-[2]">Regar</button>
          </div>
        )}

        {linea && showInfo && <NutrientesInfo linea={linea} onClose={() => setShowInfo(false)} />}
        <style>{`
          @keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
          .rbtn{border:none;border-radius:5px;font-weight:600;height:50px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:.92rem;cursor:pointer;background:#fff;color:#000}
          .rbtn-ghost{border:1px solid rgba(255,255,255,.4);border-radius:5px;font-weight:600;height:50px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:.88rem;cursor:pointer;background:transparent;color:var(--text);white-space:nowrap;padding:0 8px}
          .rbtn-ver{flex:none;height:44px;padding:0 16px;border:1px solid rgba(255,255,255,.4);border-radius:5px;background:transparent;color:#fff;font-family:'Instrument Sans',system-ui,sans-serif;font-weight:600;font-size:.84rem;cursor:pointer}
          .rtabla{flex:none;height:32px;padding:0 10px;border:1px solid rgba(255,255,255,.28);border-radius:5px;background:transparent;color:#fff;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:.56rem;letter-spacing:.14em;text-transform:uppercase;cursor:pointer}
        `}</style>
      </div>
      {showPremium && <Premium onClose={() => setShowPremium(false)} />}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--glass-bd)' }}>
      <span className="flex-1 text-[.82rem]" style={{ color: 'var(--muted)' }}>{label}</span>
      <span className="display font-bold text-[.98rem] text-right">{value}</span>
    </div>
  )
}
