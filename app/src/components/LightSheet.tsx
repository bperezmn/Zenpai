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
// Autoflorecientes: 18 h todo el ciclo (pueden subir a 20 h); el 12 h no se ofrece salvo que
// ya lo tengan guardado, y entonces se les explica por qué no conviene.
export default function LightSheet({ onClose }: { onClose: () => void }) {
  const c = useStore(selectActive)
  const toggleLight = useStore((s) => s.toggleLight)
  const setLightSchedule = useStore((s) => s.setLightSchedule)
  const notifyEnabled = useStore((s) => s.notifyEnabled)
  const [on, setOn] = useState(c.lightOnHour)
  const [hours, setHours] = useState<number | null>(c.lightHours)
  const [ctrl, setCtrl] = useState(c.hasController)
  useBackClose(true, onClose)

  const isAuto = c.seedType === 'auto'
  const inFlower = c.stage === 'flor' || c.stage === 'cosecha'
  const auto = lightHoursFor({ ...c, lightHours: null }) // lo que da "Auto" ahora mismo
  const eff = hours ?? auto
  const opciones = HORAS.filter((h) => !(isAuto && h.v === 12 && c.lightHours !== 12))
  const autoTxt = isAuto
    ? 'Autofloreciente: 18 h de luz todo el ciclo, nunca 12 h. La opción «Auto» ya te da 18 h; 20 h también vale.'
    : inFlower
      ? 'Auto: ahora 12 h, las que pide la floración.'
      : 'Auto: ahora 18 h. Al marcar «Pasar a floración» vuelve a Auto y baja a 12 h.'
  // lo que no conviene: 12 h (o 24 h, sin descanso) en una auto; más de 12 h en una fotoperiódica ya en flor
  const aviso = isAuto && hours === 12
    ? 'Con 12 h una autofloreciente pierde luz y cosecha.'
    : isAuto && hours === 24
      ? '18–20 h es lo recomendado: 24 h no le da descanso y calienta más la carpa.'
    : !isAuto && inFlower && hours != null && hours > 12
      ? 'En floración necesita 12 h de oscuridad seguidas: vuelve a Auto.'
      : null
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
              <div className="text-[.74rem]" style={{ color: 'var(--muted)' }}>{c.lightOverrideUntil ? `Manual · vuelve al horario a las ${nextTxt}` : `Según horario · cambia a las ${nextTxt}`}</div>
            </div>
          </div>
          <button onClick={toggleLight} className="lbtn-ghost flex-none" style={{ minWidth: 96 }}>{c.light ? 'Apagar' : 'Encender'}</button>
        </div>

        <div className="label mt-4 mb-2">Enciende a las</div>
        <div className="flex items-center gap-3">
          <input type="time" step={3600} value={`${String(on).padStart(2, '0')}:00`}
            onChange={(e) => { const h = parseInt(e.target.value.slice(0, 2), 10); if (!Number.isNaN(h)) setOn(h) }}
            className="linp" />
          <div className="mono text-[.82rem]" style={{ color: 'var(--muted)' }}>{fmtHour(on)} → {fmtHour(off)} · {eff} h</div>
        </div>

        <div className="label mt-4 mb-2">Horas de luz al día</div>
        <div className="flex gap-[7px]">
          {opciones.map((h) => (
            <button key={String(h.v)} onClick={() => setHours(h.v)} className={`lchip ${hours === h.v ? 'on' : ''}`}>{h.label}</button>
          ))}
        </div>
        <p className="text-[.76rem] mt-2" style={{ color: 'var(--muted)' }}>{autoTxt}</p>
        {aviso && <p className="text-[.76rem] mt-1" style={{ color: 'var(--warn)' }}>{aviso}</p>}

        <label className="flex items-center gap-3 mt-4 py-3 cursor-pointer" style={{ borderTop: '1px solid rgba(255,255,255,.12)', borderBottom: '1px solid rgba(255,255,255,.12)' }}>
          <input type="checkbox" checked={ctrl} onChange={(e) => setCtrl(e.target.checked)} style={{ width: 20, height: 20, margin: 0, accentColor: '#1F73B7' }} />
          <span className="text-[.86rem] font-medium flex-1">Tengo temporizador o controlador</span>
        </label>
        <p className="text-[.76rem] mt-2" style={{ color: 'var(--muted)' }}>
          {ctrl ? 'Con temporizador no te avisamos de la luz.' : 'Te avisamos al encender y al apagar. Con la app en segundo plano llega como notificación.'}
        </p>
        {!ctrl && !notifyEnabled && (
          <p className="text-[.76rem] mt-1" style={{ color: 'var(--warn)' }}>Activa los avisos en Ajustes para recibirlos.</p>
        )}

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="lbtn-ghost flex-1" style={{ height: 48 }}>{dirty ? 'Cancelar' : 'Cerrar'}</button>
          {dirty && <button onClick={() => { setLightSchedule({ lightOnHour: on, lightHours: hours, hasController: ctrl }); onClose() }} className="lbtn flex-1">Guardar horario</button>}
        </div>

        <style>{`
          @keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
          .lbtn{border:none;border-radius:5px;font-weight:600;height:48px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:.92rem;cursor:pointer;background:#fff;color:#000}
          .lbtn-ghost{border:1px solid rgba(255,255,255,.4);border-radius:5px;font-weight:600;height:40px;padding:0 .9rem;font-family:'Instrument Sans',system-ui,sans-serif;font-size:.84rem;cursor:pointer;background:transparent;color:var(--text)}
          .lchip{flex:1;min-height:44px;text-align:center;background:transparent;border:1px solid rgba(255,255,255,.18);border-radius:5px;padding:.55rem .2rem;cursor:pointer;color:var(--muted);font-weight:500;font-size:.82rem;font-family:'Instrument Sans',system-ui,sans-serif;white-space:nowrap}
          .lchip.on{border-color:#fff;color:#fff;background:rgba(255,255,255,.06)}
          .linp{background:transparent;border:1px solid rgba(255,255,255,.28);border-radius:5px;padding:.55rem .7rem;color:#fff;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:1rem;color-scheme:dark}
        `}</style>
      </div>
    </div>
  )
}
