import { useState } from 'react'
import { useStore, selectActive } from '../store'

// Cierre del ciclo tras el secado: peso seco opcional + nota final → el cultivo pasa
// al archivo con su bitácora en solo-lectura. El momento de celebrar 🫙
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
      <div className="absolute inset-0" style={{ background: 'rgba(3,6,9,.55)', backdropFilter: 'blur(2px)' }} />
      <div className="absolute left-0 right-0 bottom-0 glass rounded-t-3xl px-5 pt-3 pb-7"
        onClick={(e) => e.stopPropagation()} style={{ animation: 'sheetUp .28s ease-out' }}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: 'var(--glass-bd)' }} />
        <div className="flex items-baseline justify-between mb-1">
          <h3 className="display font-bold text-[1.05rem]">Terminar cultivo</h3>
          <span className="text-[.7rem]" style={{ color: 'var(--faint)' }}>{c.grow} · día {c.day}</span>
        </div>
        <p className="text-[.74rem] mb-4" style={{ color: 'var(--muted)' }}>
          Ya secos y a los frascos 🫙 Guarda el cierre: su bitácora queda como historial de este ciclo.
        </p>

        <div className="text-[.58rem] font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--faint)' }}>⚖️ Peso seco (opcional)</div>
        <div className="flex items-center justify-center gap-6 mb-1">
          <button className="fstep" onClick={() => setWeight((v) => Math.max(0, v - 5))}>–</button>
          <div className="display font-bold text-[2rem] leading-none text-center" style={{ color: weight > 0 ? 'var(--acc)' : 'var(--faint)', minWidth: 110 }}>
            {weight > 0 ? `${weight} g` : 'sin pesar'}
          </div>
          <button className="fstep" onClick={() => setWeight((v) => Math.min(2000, v + 5))}>+</button>
        </div>
        <p className="text-center text-[.6rem] mb-4" style={{ color: 'var(--faint)' }}>pasos de 5 g · un primer cultivo suele dar ~30–80 g secos por planta</p>

        <div className="text-[.58rem] font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--faint)' }}>📝 Nota final (opcional)</div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          placeholder="¿Qué aprendiste? ¿Qué harías distinto la próxima vez?"
          className="w-full rounded-2xl p-3 mb-4 bg-transparent resize-none outline-none text-[.85rem]"
          style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--glass-bd)', color: 'var(--text)' }} />

        <div className="flex gap-2">
          <button onClick={onClose} className="fbtn-ghost flex-1">Todavía no</button>
          <button onClick={submit} className="fbtn flex-[2]">🫙 Terminar</button>
        </div>

        <style>{`
          @keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
          .fbtn{border:none;border-radius:15px;font-weight:700;padding:.85rem;font-family:'Space Grotesk';font-size:.92rem;cursor:pointer;background:linear-gradient(135deg,var(--acc),var(--acc2));color:#04150c}
          .fbtn-ghost{border:1px solid var(--glass-bd);border-radius:15px;font-weight:600;padding:.85rem;font-family:'Space Grotesk';font-size:.86rem;cursor:pointer;background:rgba(255,255,255,.05);color:var(--text)}
          .fstep{width:46px;height:46px;border-radius:16px;border:1px solid var(--glass-bd);background:rgba(255,255,255,.05);color:var(--text);font-size:1.5rem;font-weight:300;display:flex;align-items:center;justify-content:center;cursor:pointer}
          .fstep:active{background:rgba(255,255,255,.12)}
        `}</style>
      </div>
    </div>
  )
}
