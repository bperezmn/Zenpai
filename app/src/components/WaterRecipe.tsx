import { useStore, selectActive } from '../store'
import { stageLabel } from '../lib'
import { wateringGuide, targetFor, fmtRange, overwaterGuard } from '../mentor'

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
          <Row icon="💧" label="Agua" value={w ? w.amount : 'a fondo'} />
          <Row icon="🧪" label="pH" value={fmtRange(ph, 1)} />
          <Row icon="⚗️" label="EC · fuerza del abono" value={ec ? `${fmtRange(ec, 1)} mS` : 'solo agua'} />
        </div>

        <div className="mt-3 mb-4 space-y-1">
          <p className="text-[.72rem]" style={{ color: 'var(--muted)' }}>
            Ajusta el pH del agua ANTES de regar.{w?.when ? ` Riega ${w.when}.` : ''}
          </p>
          {guide === 'novato' && ec && (
            <p className="text-[.68rem]" style={{ color: 'var(--faint)' }}>
              ¿Sin medidor de EC? Empieza con 1/4 de la dosis de abono que indique el fabricante.
            </p>
          )}
        </div>

        {guard && (
          <div className="mb-3 rounded-2xl px-3.5 py-2.5 text-[.74rem]"
            style={{ background: 'rgba(232,179,75,.1)', border: '1px solid var(--warn)', color: 'var(--warn)' }}>
            {guard}
          </div>
        )}

        {guard ? (
          <div className="flex gap-2">
            <button onClick={() => onConfirm(true)} className="rbtn-ghost flex-1 whitespace-nowrap">Regar igualmente 💧</button>
            <button onClick={onClose} className="rbtn flex-[2] whitespace-nowrap">Esperar ✋</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={onHow} className="rbtn-ghost flex-1">Ver cómo 👀</button>
            <button onClick={() => onConfirm()} className="rbtn flex-[2]">Regar 💧</button>
          </div>
        )}

        <style>{`
          @keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
          .rbtn{border:none;border-radius:15px;font-weight:700;padding:.85rem;font-family:'Space Grotesk';font-size:.92rem;cursor:pointer;background:linear-gradient(135deg,var(--acc),var(--acc2));color:#04150c}
          .rbtn-ghost{border:1px solid var(--glass-bd);border-radius:15px;font-weight:600;padding:.85rem;font-family:'Space Grotesk';font-size:.86rem;cursor:pointer;background:rgba(255,255,255,.05);color:var(--text)}
        `}</style>
      </div>
    </div>
  )
}

function Row({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--glass-bd)' }}>
      <span className="text-[1.1rem] leading-none">{icon}</span>
      <span className="flex-1 text-[.82rem]" style={{ color: 'var(--muted)' }}>{label}</span>
      <span className="display font-bold text-[.98rem]">{value}</span>
    </div>
  )
}
