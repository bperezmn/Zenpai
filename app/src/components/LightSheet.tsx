import { useState } from 'react'
import { useStore, selectActive } from '../store'
import { fmtHour, lightHoursFor, nextLightChange } from '../lib'
import { useBackClose } from '../useBackClose'

const HORAS: { v: number | null; label: string }[] = [
  { v: null, label: 'Auto' }, { v: 12, label: '12 h' }, { v: 18, label: '18 h' }, { v: 20, label: '20 h' }, { v: 24, label: '24 h' },
]

// Horario de luz de la carpa: a qué hora enciende, cuántas horas, y si hay temporizador o
// controlador (entonces no avisamos). "Apagar/Encender ahora" es manual hasta el siguiente
// cambio programado; el horario sigue mandando después.
export default function LightSheet({ onClose }: { onClose: () => void }) {
  const c = useStore(selectActive)
  const toggleLight = useStore((s) => s.toggleLight)
  const setLightSchedule = useStore((s) => s.setLightSchedule)
  const notifyEnabled = useStore((s) => s.notifyEnabled)
  const [on, setOn] = useState(c.lightOnHour)
  const [hours, setHours] = useState<number | null>(c.lightHours)
  const [ctrl, setCtrl] = useState(c.hasController)
  useBackClose(true, onClose)

  const auto = c.stage === 'flor' || c.stage === 'cosecha' ? 12 : 18
  const eff = hours ?? auto
  const off = (on + eff) % 24
  const dirty = on !== c.lightOnHour || hours !== c.lightHours || ctrl !== c.hasController
  const next = new Date(nextLightChange(c))
  const nextTxt = `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`

  return (
    <div className="absolute inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(2px)' }} />
      <div className="absolute left-0 right-0 bottom-0 glass rounded-t-3xl px-5 pt-3 pb-7"
        onClick={(e) => e.stopPropagation()} style={{ animation: 'sheetUp .28s ease-out' }}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: 'var(--glass-bd)' }} />
        <div className="label mb-1">Luz · {c.grow}</div>
        <h3 className="display font-semibold text-[1.2rem] mb-3">Horario de luz</h3>

        <div className="flex items-center justify-between gap-3 py-3" style={{ borderTop: '1px solid rgba(255,255,255,.12)', borderBottom: '1px solid rgba(255,255,255,.12)' }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: c.light ? 'var(--blue)' : 'var(--faint)' }} />
            <div className="min-w-0">
              <div className="text-[.9rem] font-medium">{c.light ? 'Encendida' : 'Apagada'} ahora</div>
              <div className="label" style={{ fontSize: '.56rem' }}>{c.lightOverrideUntil ? `manual · el horario vuelve a las ${nextTxt}` : `según horario · próximo cambio ${nextTxt}`}</div>
            </div>
          </div>
          <button onClick={toggleLight} className="lbtn-ghost flex-none">{c.light ? 'Apagar ahora' : 'Encender ahora'}</button>
        </div>

        <div className="label mt-4 mb-2">Enciende a las</div>
        <div className="flex items-center gap-3">
          <input type="time" step={3600} value={`${String(on).padStart(2, '0')}:00`}
            onChange={(e) => { const h = parseInt(e.target.value.slice(0, 2), 10); if (!Number.isNaN(h)) setOn(h) }}
            className="linp" />
          <div className="label" style={{ fontSize: '.6rem' }}>{fmtHour(on)} → {fmtHour(off)} · {eff} h de luz</div>
        </div>

        <div className="label mt-4 mb-2">Horas de luz al día</div>
        <div className="flex gap-[7px]">
          {HORAS.map((h) => (
            <button key={String(h.v)} onClick={() => setHours(h.v)} className={`lchip ${hours === h.v ? 'on' : ''}`}>
              {h.v === null ? `Auto · ${auto} h` : h.label}
            </button>
          ))}
        </div>
        <p className="text-[.66rem] mt-1.5" style={{ color: 'var(--faint)' }}>Auto: 18 h en crecimiento y 12 h desde que pasas a floración.</p>

        <label className="flex items-center gap-3 mt-4 py-3 cursor-pointer" style={{ borderTop: '1px solid rgba(255,255,255,.12)', borderBottom: '1px solid rgba(255,255,255,.12)' }}>
          <input type="checkbox" checked={ctrl} onChange={(e) => setCtrl(e.target.checked)} style={{ width: 20, height: 20, margin: 0, accentColor: '#1F73B7' }} />
          <span className="text-[.86rem] font-medium flex-1">Tengo temporizador o controlador</span>
          <span className="label" style={{ fontSize: '.56rem' }}>{ctrl ? 'sin avisos' : 'te aviso'}</span>
        </label>
        {!ctrl && (
          <p className="text-[.66rem] mt-2" style={{ color: 'var(--muted)' }}>
            Te aviso a la hora de encender y de apagar: dentro de la app si la tienes a la vista, y como notificación si está en segundo plano{notifyEnabled ? '' : ' (activa los avisos en Ajustes)'}.
          </p>
        )}

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="lbtn-ghost flex-1">{dirty ? 'Cancelar' : 'Cerrar'}</button>
          {dirty && <button onClick={() => { setLightSchedule({ lightOnHour: on, lightHours: hours, hasController: ctrl }); onClose() }} className="lbtn flex-[2]">Guardar horario</button>}
        </div>

        <style>{`
          @keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
          .lbtn{border:none;border-radius:5px;font-weight:600;height:48px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:.9rem;cursor:pointer;background:#fff;color:#000}
          .lbtn-ghost{border:1px solid rgba(255,255,255,.4);border-radius:5px;font-weight:600;height:40px;padding:0 .9rem;font-family:'Instrument Sans',system-ui,sans-serif;font-size:.8rem;cursor:pointer;background:transparent;color:var(--text)}
          .lchip{flex:1;text-align:center;background:transparent;border:1px solid rgba(255,255,255,.18);border-radius:5px;padding:.55rem .2rem;cursor:pointer;color:var(--muted);font-weight:500;font-size:.74rem;font-family:'Instrument Sans',system-ui,sans-serif;white-space:nowrap}
          .lchip.on{border-color:#fff;color:#fff;background:rgba(255,255,255,.06)}
          .linp{background:transparent;border:1px solid rgba(255,255,255,.28);border-radius:5px;padding:.55rem .7rem;color:#fff;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:1rem;color-scheme:dark}
        `}</style>
      </div>
    </div>
  )
}
