import { useState } from 'react'
import { useStore, selectActive } from '../store'
import BrandMark from './BrandMark'
import NutrientesInfo from './NutrientesInfo'
import Premium from './Premium'
import YaRegue from './YaRegue'
import { stageLabel } from '../lib'
import { wateringGuide, targetFor, fmtRange, overwaterGuard, litrosRiego, abonoDe, ecHoy, drenajeTexto } from '../mentor'
import { dosisRiego, semanasFlorDe } from '../data/nutrientes'

// Ficha de riego: la "receta" de la etapa actual — cuánta agua (según la maceta), pH y EC objetivo.
// Se abre tras revisar la maceta ("pesa poco"); cambia sola conforme el cultivo avanza de etapa.
// Si el guardarraíl de sobre-riego está activo, el aviso vive AQUÍ (antes de confirmar),
// con salida honesta: "Regar igualmente" para cuando el sustrato está seco de verdad.
// Hidro: no se riega ni hay litros. La ficha es la de la solución nueva del depósito (pH, EC y,
// con Premium, la dosis por litro); "Ya la cambié" la anota.
// Abono: la regla de cuánto (según el nivel, la tierra abonada y el lavado) es gratis y sale de
// abonoDe(), la misma que Consejos y el plan; los mililitros exactos de la marca son Premium.
export default function WaterRecipe({ onConfirm, onHow, onClose }: { onConfirm: (force?: boolean) => void; onHow: () => void; onClose: () => void }) {
  const c = useStore(selectActive)
  const guide = useStore((s) => s.guide)
  const changeSolution = useStore((s) => s.changeSolution)
  const hidro = c.substrate === 'hidro'
  const w = wateringGuide(c)
  const ph = targetFor('ph', c.stage, c.substrate)
  const guard = overwaterGuard(c)
  // lo que lleva el agua de hoy; la marca: la fila de su tabla que toca y los ml para este riego,
  // a la fuerza del nivel (hidro: por cada litro de solución, que el depósito es el que tenga cada uno)
  const ab = abonoDe(c, guide)
  const linea = ab?.linea ?? null
  const fase = ab?.abona ? ab.fase : null
  const litros = hidro ? 1 : litrosRiego(c)
  const dosis = linea && fase ? dosisRiego(linea, fase, litros, ab!.factor) : []
  // la EC objetivo del agua de hoy (la misma que Medir): si hoy va solo agua (tierra abonada,
  // lavado…) no hay EC que buscar; con abono orgánico la EC no sirve para dosificarlo
  const ec = ecHoy(c, guide)
  const ecTxt = ec.range ? `${fmtRange(ec.range, 1)} mS` : ec.soloAgua ? 'solo agua' : 'sigue la tabla'
  const [showInfo, setShowInfo] = useState(false)
  // cómo regar: la plántula, un vaso sin drenaje; en tierra, mientras la cantidad sube por semanas,
  // tampoco drena (sus raíces no llenan la maceta); con la cantidad completa (y en coco desde el
  // vegetativo), hasta que drene un poco
  const howMuch = !w ? ''
    : c.stage === 'plantula' ? ` Riega ${w.when}.`
    : w.drain ? ` ${drenajeTexto(c)}`
    : ` Despacio, en círculo alrededor del tallo. Aún no hace falta que drene: la cantidad sube cada semana, hasta ~${w.full} L.`
  // la dosis de la marca es Premium; agua, pH y EC siguen siendo gratis
  const premium = useStore((s) => s.premium)
  const [showPremium, setShowPremium] = useState(false)

  return (
    <div className="absolute inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(3,6,9,.55)', backdropFilter: 'blur(2px)' }} />
      {/* con la regla del abono y la dosis de la marca puede no caber en un teléfono bajo: se desplaza */}
      <div className="absolute left-0 right-0 bottom-0 glass rounded-t-3xl px-5 pt-3 pb-7 max-h-[92%] overflow-y-auto"
        onClick={(e) => e.stopPropagation()} style={{ animation: 'sheetUp .28s ease-out' }}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: 'var(--glass-bd)' }} />
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="display font-bold text-[1.05rem]">{hidro ? 'Solución nueva' : 'Riego de hoy'}</h3>
          <span className="text-[.74rem]" style={{ color: 'var(--faint)' }}>{stageLabel[c.stage]} · {hidro ? 'depósito' : `maceta ${c.potL} L`}</span>
        </div>

        <div className="space-y-2">
          {!hidro && w && <Row label="Agua" value={w.amount} />}
          <Row label="pH" value={fmtRange(ph, 1)} />
          <Row label="EC · fuerza del abono" value={ecTxt} />
        </div>

        {/* la regla del abono, gratis: cuánto según el nivel, la tierra abonada, el lavado */}
        {ab && (
          <p className="mt-3 text-[.78rem] leading-snug" style={{ color: 'var(--muted)' }}>
            <span className="font-semibold" style={{ color: '#fff' }}>{ab.titulo}{ab.titulo.endsWith('?') ? '' : '.'}</span> {ab.texto}
          </p>
        )}

        {linea && fase && !premium && (
          <div className="mt-3 flex items-center gap-3 rounded-2xl pl-3.5 pr-2 py-2" style={{ border: '1px solid rgba(255,255,255,.14)', background: 'var(--panel)' }}>
            <span className="flex-1 min-w-0 text-[.82rem] leading-snug">
              Dosis de {linea.marca} {hidro ? 'por litro' : 'en cada riego'} <span style={{ color: 'var(--muted)' }}>· Premium</span>
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
                <div className="text-[.74rem] truncate" style={{ color: 'var(--muted)' }}>{fase.nombre} · {hidro ? 'por litro de solución' : `${litros} L de agua`}</div>
              </div>
              <button onClick={() => setShowInfo(true)} aria-label={`Ver la tabla de ${linea.marca}`} className="rtabla">Tabla</button>
            </div>
            {/* solo hay fase con dosis cuando hoy toca abono (ver abonoDe) */}
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
            {/* la fuerza del nivel ya va en los ml; en flor, la tabla va repartida en SU floración */}
            <div className="text-[.74rem] mt-3" style={{ color: 'var(--faint)' }}>
              Al {Math.round(ab!.factor * 100)} % de la tabla{c.stage === 'flor' && ab!.motivo !== 'lavado' ? `, repartida en unas ${semanasFlorDe(c)} semanas de flor` : ''}.
            </div>
            {!linea.verificado && (
              <div className="text-[.7rem] mt-3" style={{ color: 'var(--warn)' }}>Dosis de la tabla pública del fabricante. Compárala con la etiqueta de tu botella.</div>
            )}
          </div>
        )}

        <div className="mt-4 mb-4 space-y-1.5">
          <p className="text-[.76rem] leading-snug" style={{ color: 'var(--muted)' }}>
            {hidro ? (ab && !ab.abona
              ? 'Vacía el depósito y llénalo con agua limpia, sin abono. Ajusta el pH al final. Se cambia entera cada 7–10 días.'
              : 'Vacía el depósito y llénalo con agua limpia. Añade el abono, mezcla y ajusta el pH al final. Se cambia entera cada 7–10 días.')
              : `Ajusta el pH del agua antes de regar.${howMuch}`}
          </p>
        </div>

        {guard && (
          <div className="mb-3 rounded-2xl px-3.5 py-2.5 text-[.76rem] leading-snug"
            style={{ background: 'rgba(232,179,75,.1)', border: '1px solid var(--warn)', color: 'var(--warn)' }}>
            {guard}
          </div>
        )}

        {hidro ? (
          <div className="flex gap-2">
            <button onClick={onClose} className="rbtn-ghost flex-1">Cerrar</button>
            <button onClick={() => { changeSolution(); onClose() }} className="rbtn flex-1">Ya la cambié</button>
          </div>
        ) : guard ? (
          <div className="flex gap-2">
            <button onClick={() =>onConfirm(true)} className="rbtn-ghost flex-1">Regar igualmente</button>
            <button onClick={onClose} className="rbtn flex-1">Esperar</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={onHow} className="rbtn-ghost flex-1">Ver cómo</button>
            <button onClick={() =>onConfirm()} className="rbtn flex-1">Regar</button>
          </div>
        )}
        {/* regó sin anotarlo: hoy, ayer o anteayer (no cuenta para aprender el ritmo) */}
        {!hidro && <YaRegue onDone={onClose} />}

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
