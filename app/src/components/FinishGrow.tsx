import { useState } from 'react'
import { useStore, selectActive } from '../store'

// Cierre del ciclo tras el secado: peso seco opcional + nota final → el cultivo pasa
// al archivo con su bitácora en solo-lectura. El momento de celebrar.
export default function FinishGrow({ onClose }: { onClose: () => void }) {
  const c = useStore(selectActive)
  const finishGrow = useStore((s) => s.finishGrow)
  const [weight, setWeight] = useState(0) // 0 = sin pesar
  const [note, setNote] = useState('')

  function submit() {
    finishGrow(weight > 0 ? weight : null, note)
    onClose()
  }

  return (
    <div className="absolute inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(2px)' }} />
      <div className="absolute left-0 right-0 bottom-0 glass rounded-t-3xl px-5 pt-3 pb-7"
        onClick={(e) => e.stopPropagation()} style={{ animation: 'sheetUp .28s ease-out' }}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: 'var(--glass-bd)' }} />
        <div className="flex items-baseline justify-between mb-1">
          <h3 className="display font-bold text-[1.05rem]">Terminar cultivo</h3>
          <span className="text-[.74rem]" style={{ color: 'var(--faint)' }}>{c.grow} · día {c.day}</span>
        </div>
        <p className="text-[.76rem] mb-4" style={{ color: 'var(--muted)' }}>
          Ya secos y en los frascos. Guarda el cierre: la bitácora queda como historial de este ciclo.
        </p>

        <div className="label mb-1.5">Peso seco</div>
        <div className="flex items-center justify-center gap-6 mb-1.5">
          <button className="fstep" onClick={() => setWeight((v) => Math.max(0, v - 5))}>–</button>
          <div className="display font-bold text-[2rem] leading-none text-center" style={{ color: weight > 0 ? 'var(--text)' : 'var(--faint)', minWidth: 110 }}>
            {weight > 0 ? `${weight} g` : 'sin pesar'}
          </div>
          <button className="fstep" onClick={() => setWeight((v) => Math.min(2000, v + 5))}>+</button>
        </div>
        <p className="text-center text-[.74rem] mb-4" style={{ color: 'var(--faint)' }}>Opcional. Un primer cultivo suele dar 30–80 g secos por planta.</p>

        <div className="label mb-1.5">Nota final</div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          placeholder="Opcional. ¿Qué aprendiste? ¿Qué harías distinto la próxima vez?"
          className="w-full rounded-[5px] p-3 mb-4 bg-transparent resize-none outline-none text-[.85rem]"
          style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--glass-bd)', color: 'var(--text)' }} />

        <div className="flex gap-2">
          <button onClick={onClose} className="fbtn-ghost flex-1">Todavía no</button>
          <button onClick={submit} className="fbtn flex-1">Terminar</button>
        </div>

        <style>{`
          @keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
          .fbtn{border:none;border-radius:5px;font-weight:600;height:50px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:.9rem;cursor:pointer;background:#fff;color:#000}
          .fbtn-ghost{border:1px solid rgba(255,255,255,.4);border-radius:5px;font-weight:600;height:50px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:.88rem;cursor:pointer;background:transparent;color:var(--text)}
          .fstep{width:46px;height:46px;border-radius:5px;border:1px solid rgba(255,255,255,.4);background:transparent;color:var(--text);font-size:1.5rem;font-weight:300;display:flex;align-items:center;justify-content:center;cursor:pointer}
          .fstep:active{background:rgba(255,255,255,.12)}
        `}</style>
      </div>
    </div>
  )
}
