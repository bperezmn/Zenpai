import { useState } from 'react'
import { useStore, selectActive } from '../store'
import { stageLabel } from '../lib'
import { metricsFor, targetFor, fmtRange } from '../mentor'
import { readingSeries } from '../readings'
import { fmtDay } from '../plan'
import { useBackClose } from '../useBackClose'
import MiniChart from './MiniChart'
import Premium from './Premium'

type Period = '24h' | '7d' | 'ciclo'
const PERIODS: { id: Period; label: string }[] = [
  { id: '24h', label: '24 h' }, { id: '7d', label: '7 días' }, { id: 'ciclo', label: 'Ciclo' },
]

// Ambiente: historial de TUS lecturas por métrica (las que anotaste en la bitácora), con la
// banda objetivo de la etapa. Se abre encima de otras hojas, así que gestiona su propio atrás.
export default function Ambiente({ onClose }: { onClose: () => void }) {
  useBackClose(true, onClose)
  const c = useStore(selectActive)
  const events = useStore((s) => s.events)
  const guide = useStore((s) => s.guide)
  const premium = useStore((s) => s.premium)
  const [period, setPeriod] = useState<Period>('7d')
  const [showPremium, setShowPremium] = useState(false)

  const now = Date.now()
  const from = period === '24h' ? now - 86400000 : period === '7d' ? now - 7 * 86400000 : undefined
  const cards = metricsFor(guide)
    .map((m) => ({ m, all: readingSeries(events, m.key) }))
    .filter((x) => x.all.length > 0)

  return (
    <>
      <div className="absolute inset-0 z-[60]" onClick={onClose}>
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(2px)' }} />
        <div className="absolute left-0 right-0 bottom-0 glass rounded-t-3xl px-5 pt-3 pb-7 max-h-[88%] flex flex-col"
          onClick={(e) => e.stopPropagation()} style={{ animation: 'sheetUp .28s ease-out' }}>
          <div className="mx-auto mb-3 h-1 w-10 rounded-full flex-none" style={{ background: 'var(--glass-bd)' }} />
          <div className="flex items-start gap-3 mb-3 flex-none">
            <div className="min-w-0 flex-1">
              <div className="label mb-1">Ambiente</div>
              <h3 className="display font-semibold text-[1.2rem] leading-tight truncate">{c.grow}</h3>
            </div>
            <button onClick={onClose} aria-label="Cerrar" className="w-11 h-11 flex items-center justify-center flex-none"
              style={{ border: '1px solid rgba(255,255,255,.28)', borderRadius: 5, color: '#fff', background: 'transparent' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>

          {premium && cards.length > 0 && (
            <div className="flex gap-[7px] mb-3 flex-none" role="group" aria-label="Periodo">
              {PERIODS.map((p) => (
                <button key={p.id} onClick={() => setPeriod(p.id)} aria-pressed={period === p.id} className={`amb-seg ${period === p.id ? 'on' : ''}`}>{p.label}</button>
              ))}
            </div>
          )}

          <div className="overflow-y-auto -mx-1 px-1 space-y-2" style={{ minHeight: 0 }}>
            {cards.length === 0 && (
              <p className="text-[.8rem] leading-relaxed py-2" style={{ color: 'var(--muted)' }}>
                Aún no hay lecturas en este cultivo. Anota la temperatura, la humedad o el pH desde la carpa.
              </p>
            )}
            {cards.map(({ m, all }) => {
              const last = all[all.length - 1]
              const r = targetFor(m.key, c.stage, c.substrate)
              const u = m.unit ? ` ${m.unit}` : ''
              const shown = m.dec ? last.value.toFixed(m.dec) : Math.round(last.value).toString()
              const etapa = c.stage === 'secando' ? 'secado' : stageLabel[c.stage].toLowerCase()
              const target = r ? `Objetivo en ${m.key === 'ph' ? c.substrate : etapa}: ${fmtRange(r, m.dec)}${u}` : 'Sin objetivo en esta etapa'
              return (
                <div key={m.key} className="rounded-2xl px-3.5 py-3" style={{ background: 'var(--panel)', border: '1px solid rgba(255,255,255,.14)' }}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="label">{m.label}</span>
                    <span className="mono text-[1rem]">{shown}<span style={{ color: 'var(--muted)' }}>{u}</span></span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 mt-1 text-[.74rem]">
                    <span style={{ color: 'var(--muted)' }}>{target}</span>
                    <span className="flex-none" style={{ color: 'var(--faint)' }}>{fmtDay(last.ts)}</span>
                  </div>
                  {premium && (
                    <div className="mt-2.5">
                      <MiniChart points={readingSeries(events, m.key, from)} band={r ? [r.lo, r.hi] : undefined} width={320} height={72} unit={m.unit} />
                    </div>
                  )}
                </div>
              )
            })}

            {!premium && cards.length > 0 && (
              <div className="rounded-2xl px-3.5 py-3" style={{ border: '1px solid rgba(255,255,255,.14)' }}>
                <div className="flex items-center gap-2.5 mb-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--muted)', flex: 'none' }}>
                    <rect x="5" y="11" width="14" height="9" rx="1.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                  <span className="text-[.86rem] font-medium">Gráficas del ambiente · Premium</span>
                </div>
                <button onClick={() => setShowPremium(true)} className="amb-btn w-full">Ver Premium</button>
              </div>
            )}
          </div>
        </div>
        <style>{`
          @keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
          .amb-seg{flex:1;height:44px;text-align:center;background:transparent;border:1px solid rgba(255,255,255,.18);border-radius:5px;cursor:pointer;color:var(--muted);font-weight:500;font-size:.84rem;font-family:'Instrument Sans',system-ui,sans-serif;white-space:nowrap}
          .amb-seg.on{border-color:#fff;color:#fff;background:rgba(255,255,255,.06)}
          .amb-btn{border:none;border-radius:5px;font-weight:600;height:50px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:.92rem;cursor:pointer;background:#fff;color:#000}
        `}</style>
      </div>
      {showPremium && (
        <div className="absolute inset-0 z-[70]">
          <Premium onClose={() => setShowPremium(false)} />
        </div>
      )}
    </>
  )
}
