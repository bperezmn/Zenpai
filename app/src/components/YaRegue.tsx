import { useState } from 'react'
import { useStore, selectActive } from '../store'

// "Ya regué y no lo anoté": un riego anotado después (hoy, ayer o anteayer). Queda en la bitácora
// con esa fecha y la próxima revisión cuenta desde ahí. No enseña el ritmo de la maceta: la hora
// exacta no la sabemos. Solo días desde el trasplante (antes no había maceta que regar).
export default function YaRegue({ onDone }: { onDone: () => void }) {
  const c = useStore(selectActive)
  const water = useStore((s) => s.water)
  const [open, setOpen] = useState(false)
  const now = Date.now()
  const opts = [{ k: 0, label: 'Hoy' }, { k: 1, label: 'Ayer' }, { k: 2, label: 'Anteayer' }]
    .filter((o) => !c.germTs || now - o.k * 86400000 >= c.germTs)

  return (
    <>
      {open ? (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,.12)' }}>
          <div className="text-[.86rem] font-medium">¿Cuándo regaste?</div>
          <div className="flex gap-[7px] mt-2">
            {opts.map((o) => (
              <button key={o.k} onClick={() => { water({ daysAgo: o.k }); onDone() }} className="yrchip flex-1">{o.label}</button>
            ))}
          </div>
          <p className="text-[.74rem] leading-snug mt-2" style={{ color: 'var(--faint)' }}>
            Queda en la bitácora con esa fecha y la próxima revisión cuenta desde ahí.
          </p>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="yrlink mt-1">Ya regué y no lo anoté</button>
      )}
      <style>{`
        .yrlink{display:block;width:100%;min-height:44px;background:none;border:none;color:var(--muted);font-family:'Instrument Sans',system-ui,sans-serif;font-size:.82rem;text-decoration:underline;text-underline-offset:4px;cursor:pointer}
        .yrchip{min-height:44px;border:1px solid rgba(255,255,255,.28);border-radius:5px;background:transparent;color:#fff;font-family:'Instrument Sans',system-ui,sans-serif;font-weight:600;font-size:.86rem;cursor:pointer}
        .yrchip:active{background:rgba(255,255,255,.1)}
      `}</style>
    </>
  )
}
