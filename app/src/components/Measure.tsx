import { useState } from 'react'
import { useStore, selectActive } from '../store'
import type { MetricKey } from '../lib'
import { metricDef, targetFor, evalMetric, metricTip, fmtRange, STATUS_COLOR } from '../mentor'

// Hoja para registrar TU medición de una métrica → semáforo + consejo + queda en la bitácora.
// Honesto: no inventamos lecturas de sensores; el dato lo pones tú.
export default function Measure({ metric, onClose }: { metric: MetricKey; onClose: () => void }) {
  const c = useStore(selectActive)
  const measure = useStore((s) => s.measure)
  const def = metricDef(metric)
  const range = targetFor(metric, c.stage, c.substrate)
  const mid = range ? +(((range.lo + range.hi) / 2).toFixed(def.dec)) : 0
  const [val, setVal] = useState<number>(c.readings[metric] ?? mid)

  const { status } = evalMetric(metric, val, c.stage, c.substrate)
  const tip = metricTip(metric, val, status, c.stage, c.substrate)
  const color = STATUS_COLOR[status]
  const step = def.step
  const round = (n: number) => +n.toFixed(def.dec)
  const bump = (d: number) => setVal((v) => round(Math.max(0, v + d * step)))

  return (
    <div className="absolute inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(3,6,9,.55)', backdropFilter: 'blur(2px)' }} />
      <div className="absolute left-0 right-0 bottom-0 glass rounded-t-3xl px-5 pt-3 pb-7"
        onClick={(e) => e.stopPropagation()} style={{ animation: 'sheetUp .28s ease-out' }}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: 'var(--glass-bd)' }} />
        <div className="flex items-baseline justify-between mb-1">
          <h3 className="display font-bold text-[1.05rem]">Medir {def.label}</h3>
          <span className="text-[.7rem]" style={{ color: 'var(--faint)' }}>objetivo {fmtRange(range, def.dec)} {def.unit}</span>
        </div>

        {/* lectura + stepper */}
        <div className="flex items-center justify-center gap-5 my-4">
          <button className="step" onClick={() => bump(-1)}>–</button>
          <div className="text-center min-w-[110px]">
            <div className="display font-bold text-[2.4rem] leading-none" style={{ color }}>
              {def.dec ? val.toFixed(def.dec) : Math.round(val)}
            </div>
            <div className="text-[.62rem] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>{def.unit || def.label}</div>
          </div>
          <button className="step" onClick={() => bump(1)}>+</button>
        </div>

        {/* consejo del mentor */}
        <div className="flex items-start gap-2.5 rounded-2xl px-3.5 py-3 mb-4" style={{ background: 'rgba(255,255,255,.04)', border: `1px solid ${color}` }}>
          <span className="w-2.5 h-2.5 rounded-full mt-1.5 flex-none" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
          <span className="text-[.84rem] leading-snug">{tip}</span>
        </div>

        <button className="anota" onClick={() => { measure(metric, round(val)); onClose() }}>Anotar en la bitácora</button>

        <style>{`
          @keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
          .step{width:46px;height:46px;border-radius:16px;border:1px solid var(--glass-bd);background:rgba(255,255,255,.05);color:var(--text);font-size:1.5rem;font-weight:300;display:flex;align-items:center;justify-content:center;cursor:pointer}
          .step:active{background:rgba(255,255,255,.12)}
          .anota{width:100%;border:none;border-radius:15px;font-weight:700;padding:.85rem;font-family:'Space Grotesk';font-size:.92rem;cursor:pointer;background:linear-gradient(135deg,var(--acc),var(--acc2));color:#04150c}
        `}</style>
      </div>
    </div>
  )
}
