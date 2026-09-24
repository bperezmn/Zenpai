import { useRef, useState } from 'react'
import { useStore, selectActive } from '../store'
import type { MetricKey } from '../lib'
import { metricDef, targetFor, evalRange, metricTip, fmtRange, STATUS_COLOR, ecHoy } from '../mentor'
import { readingSeries } from '../readings'
import MiniChart from './MiniChart'
import Ambiente from './Ambiente'

// Hoja para registrar TU medición de una métrica → semáforo + consejo + queda en la bitácora.
// Honesto: no inventamos lecturas de sensores; el dato lo pones tú. La casilla empieza VACÍA
// (un número ya puesto se anotaría en verde con un toque, sin que nadie lo midiera) y "Anotar"
// espera a que escribas uno; + y – solo ajustan un número ya escrito (con la casilla vacía, la
// abren para escribir). La temperatura y la humedad salen del mismo medidor: van juntas.
// La EC se juzga contra la de HOY (ecHoy): un día de solo agua no tiene objetivo (lo que marca es
// tu agua del grifo) y con abono orgánico tampoco.
// nombre completo para el título de la hoja (los chips usan la etiqueta corta de METRICS)
const METRIC_NAME: Record<MetricKey, string> = { temp: 'Temperatura', hr: 'Humedad', ph: 'pH', vpd: 'VPD', ec: 'EC', ppfd: 'PPFD' }
// tope de lo que puede marcar cada medidor: por encima es un error al escribir (255 por 25.5)
const MAX: Record<MetricKey, number> = { temp: 60, hr: 100, ph: 14, vpd: 5, ec: 10, ppfd: 3000 }

// lo que escribiste → número (coma o punto decimal, como salga en el teclado del teléfono);
// null si no es un número. Un separador suelto (".") es que aún estás escribiendo.
function parseReading(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (!/^(\d+\.?\d*|\.\d+)$/.test(t)) return null
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : null
}

export default function Measure({ metric, onClose }: { metric: MetricKey; onClose: () => void }) {
  const c = useStore(selectActive)
  const measure = useStore((s) => s.measure)
  const events = useStore((s) => s.events)
  const guide = useStore((s) => s.guide)
  const premium = useStore((s) => s.premium)
  const [showAmbiente, setShowAmbiente] = useState(false)
  // temperatura y humedad: el mismo aparato da las dos, se anotan en la misma hoja
  const pair = metric === 'temp' || metric === 'hr'
  const keys: MetricKey[] = pair ? ['temp', 'hr'] : [metric]
  const [texts, setTexts] = useState<Partial<Record<MetricKey, string>>>({})
  const inputs = useRef<Partial<Record<MetricKey, HTMLInputElement | null>>>({})

  // estado de cada casilla: lo escrito, el número que se anotaría (redondeado a los decimales
  // de la métrica) y, si no vale, por qué
  const fields = keys.map((key) => {
    const def = metricDef(key)
    const u = def.unit ? ` ${def.unit}` : ''
    const fmt = (n: number) => (def.dec ? n.toFixed(def.dec) : Math.round(n).toString())
    const hoy = key === 'ec' ? ecHoy(c, guide) : null
    const range = hoy ? hoy.range : targetFor(key, c.stage, c.substrate)
    const nota = hoy?.nota ?? null
    const text = texts[key] ?? ''
    const empty = text.trim() === ''
    const n = parseReading(text)
    const typing = text.trim() === '.' || text.trim() === ','
    const error = empty || typing ? null : n === null ? 'Escribe solo el número.' : n > MAX[key] ? `Revisa el número: tiene que estar entre 0 y ${MAX[key]}${u}.` : null
    const value = n !== null && !error ? +n.toFixed(def.dec) : null
    // sin objetivo hoy no hay semáforo: el consejo es la nota
    const ev = value !== null && range ? evalRange(key, value, range) : null
    // pistas junto a la casilla: el objetivo de la etapa y tu última lectura (con cuándo fue)
    const last = c.readings[key]
    const lastDay = c.readingDays[key]
    const ago = lastDay == null ? null : c.day - lastDay <= 0 ? 'hoy' : c.day - lastDay === 1 ? 'ayer' : `hace ${c.day - lastDay} días`
    const hint = [
      range ? `Objetivo ${fmtRange(range, def.dec)}${u}` : hoy?.soloAgua ? 'Hoy va solo agua' : nota ? 'Sin objetivo con abono orgánico' : 'Sin objetivo en esta etapa',
      last != null ? `última ${fmt(last)}${u}${ago ? `, ${ago}` : ''}` : null,
    ].filter(Boolean).join(' · ')
    // con más decimales de los que usa la métrica, avisamos de cómo queda anotado
    const rounded = value !== null && n !== null && value !== n ? `Se anota como ${fmt(value)}${u}.` : null
    return { key, def, fmt, range, nota, text, empty, error, value, ev, hint, rounded }
  })
  type Field = (typeof fields)[number]

  // al menos una lectura escrita y ninguna a medio escribir o que no cuadre
  const canSave = fields.some((f) => f.value !== null) && fields.every((f) => f.empty || f.value !== null)

  function save() {
    if (!canSave) return
    const values: Partial<Record<MetricKey, number>> = {}
    for (const f of fields) if (f.value !== null) values[f.key] = f.value
    measure(values)
    onClose()
  }

  // +/– ajustan lo que escribiste; con la casilla vacía (o a medio escribir) solo la abren: un
  // número puesto por la app se anotaría sin que nadie lo midiera
  function bump(f: Field, d: number) {
    const cur = parseReading(f.text)
    if (cur === null) { inputs.current[f.key]?.focus(); return }
    const next = +Math.min(MAX[f.key], Math.max(0, cur + d * f.def.step)).toFixed(f.def.dec)
    // respeta el separador que usaste al escribir (coma o punto)
    const s = f.fmt(next)
    setTexts((t) => ({ ...t, [f.key]: f.text.includes(',') ? s.replace('.', ',') : s }))
  }

  // Intro en la primera casilla (de dos) salta a la segunda si está vacía; si no, anota
  function onEnter(i: number) {
    const nextF = fields[i + 1]
    if (nextF && nextF.empty) inputs.current[nextF.key]?.focus()
    else save()
  }

  function renderField(f: Field, i: number) {
    const name = METRIC_NAME[f.key]
    const lower = f.key === 'temp' || f.key === 'hr' ? name.toLowerCase() : name // las siglas quedan como están
    const color = f.ev ? STATUS_COLOR[f.ev.status] : 'var(--text)'
    const note = f.error ?? f.rounded
    return (
      <div key={f.key} className={pair ? 'mt-4' : ''}>
        {pair && <div className="label">{name}</div>}
        {/* lectura + stepper */}
        <div className={`flex items-center justify-center gap-5 ${pair ? 'mt-1' : 'mt-4'}`}>
          <button className="step" aria-label={`Bajar ${lower}`} onClick={() => bump(f, -1)}>–</button>
          <div className="text-center">
            <input ref={(el) => { inputs.current[f.key] = el }}
              className={`mval ${f.error ? 'err' : ''}`} style={{ color }}
              type="text" inputMode="decimal" enterKeyHint={pair && i === 0 ? 'next' : 'done'}
              autoComplete="off" spellCheck={false} maxLength={7} placeholder="—"
              aria-label={`${name}${f.def.unit ? ` en ${f.def.unit}` : ''}`}
              value={f.text}
              onChange={(e) => { const v = e.target.value.replace(/[^\d.,]/g, '').slice(0, 7); setTexts((t) => ({ ...t, [f.key]: v })) }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(i) } }} />
            <div className="label mt-1">{f.def.unit || f.def.label}</div>
          </div>
          <button className="step" aria-label={`Subir ${lower}`} onClick={() => bump(f, 1)}>+</button>
        </div>
        <p className="text-center text-[.74rem] mt-2" style={{ color: 'var(--muted)' }}>{f.hint}</p>
        {note && <p className="text-center text-[.74rem] mt-0.5" style={{ color: f.error ? 'var(--warn)' : 'var(--muted)' }}>{note}</p>}

        {/* consejo del mentor sobre lo que escribiste (sin objetivo hoy, la nota en su lugar);
            con una marca en tierra a menos de la dosis completa, la nota explica el objetivo más bajo */}
        {f.value !== null && (f.ev || f.nota) && (
          <div className="flex items-start gap-2.5 rounded-2xl px-3.5 py-3 mt-3" style={{ background: 'rgba(255,255,255,.04)', border: `1px solid ${f.ev ? color : 'var(--glass-bd)'}` }}>
            <span className="w-2.5 h-2.5 rounded-full mt-1.5 flex-none" style={{ background: f.ev ? color : 'var(--blue)', boxShadow: f.ev ? `0 0 8px ${color}` : undefined }} />
            <span className="text-[.84rem] leading-relaxed">
              {f.ev ? metricTip(f.key, f.value, f.ev.status, c.stage, c.substrate, f.range) : f.nota}
              {f.ev && f.nota && f.ev.status === 'ok' ? ` ${f.nota}` : ''}
            </span>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
    <div className="absolute inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(3,6,9,.55)', backdropFilter: 'blur(2px)' }} />
      <div className="absolute left-0 right-0 bottom-0 glass rounded-t-3xl px-5 pt-3 pb-7 max-h-[92%] overflow-y-auto"
        onClick={(e) => e.stopPropagation()} style={{ animation: 'sheetUp .28s ease-out' }}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: 'var(--glass-bd)' }} />
        <div className="mb-1">
          <h3 className="display font-bold text-[1.05rem]">{pair ? 'Temperatura y humedad' : METRIC_NAME[metric]}</h3>
          <div className="text-[.74rem] mt-0.5" style={{ color: 'var(--muted)' }}>
            {pair ? 'El mismo medidor marca las dos. Escribe lo que veas en él; puedes dejar una vacía.' : 'Escribe lo que marca tu medidor.'}
          </div>
        </div>

        {fields.map(renderField)}

        <button className="anota mt-5" disabled={!canSave} onClick={save}>Anotar en la bitácora</button>
        {/* el botón apagado dice qué falta */}
        {!canSave && fields.every((f) => f.empty) && (
          <p className="text-center text-[.74rem] mt-2" style={{ color: 'var(--faint)' }}>Escribe el número que marca tu medidor para anotarlo.</p>
        )}

        {/* historial (7 días) de lo que hay en esta hoja; el ambiente completo se abre encima */}
        <div className="mt-4 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,.12)' }}>
          <div className="flex items-center justify-between gap-3">
            <span className="label">Últimas lecturas</span>
            <button onClick={() => setShowAmbiente(true)} className="h-11 text-[.8rem] font-medium"
              style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
              Ver todo el ambiente
            </button>
          </div>
          {premium ? fields.map((f) => (
            <div key={f.key} className={pair ? 'mb-2' : ''}>
              {pair && <div className="text-[.74rem] mb-1" style={{ color: 'var(--muted)' }}>{METRIC_NAME[f.key]}</div>}
              <MiniChart points={readingSeries(events, f.key, Date.now() - 7 * 86400000)} band={f.range ? [f.range.lo, f.range.hi] : undefined}
                width={340} height={pair ? 52 : 64} unit={f.def.unit} />
            </div>
          )) : (
            <p className="text-[.78rem]" style={{ color: 'var(--faint)' }}>Historial con Premium</p>
          )}
        </div>

        <style>{`
          @keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
          .step{width:46px;height:46px;border-radius:5px;border:1px solid var(--glass-bd);background:rgba(255,255,255,.05);color:var(--text);font-size:1.5rem;font-weight:300;display:flex;align-items:center;justify-content:center;cursor:pointer}
          .step:active{background:rgba(255,255,255,.12)}
          .mval{width:128px;height:64px;padding:0 .4rem;text-align:center;border-radius:5px;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.04);font-family:'Sora','Instrument Sans',sans-serif;font-weight:700;font-size:2.4rem;line-height:1;letter-spacing:-.02em}
          .mval::placeholder{color:var(--faint);font-weight:400}
          .mval:focus{outline:none;border-color:#fff}
          .mval.err,.mval.err:focus{border-color:var(--warn)}
          .anota{width:100%;border:1px solid #fff;border-radius:5px;font-weight:700;padding:.85rem;font-family:'Sora',sans-serif;font-size:.92rem;cursor:pointer;background:#fff;color:#000}
          .anota:disabled{background:transparent;border-color:rgba(255,255,255,.2);color:var(--faint);cursor:default}
        `}</style>
      </div>
    </div>
    {showAmbiente && <Ambiente onClose={() => setShowAmbiente(false)} />}
    </>
  )
}
