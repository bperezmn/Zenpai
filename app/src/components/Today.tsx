import { useState } from 'react'
import { useStore, selectActive } from '../store'
import { stageLabel, type Training } from '../lib'
import { mentorAdvice, canTrain, STATUS_COLOR } from '../mentor'

const TECHNIQUES: { id: Training; label: string }[] = [
  { id: 'none', label: 'Ninguna' },
  { id: 'lst', label: 'LST' },
  { id: 'lollipop', label: 'Lollipop' },
]

// Consejos del mentor: enseñan cómo hacer las cosas según la etapa y el nivel del usuario.
export default function Today({ onClose }: { onClose: () => void }) {
  const c = useStore(selectActive)
  const guide = useStore((s) => s.guide)
  const applyTraining = useStore((s) => s.applyTraining)
  const startFlowering = useStore((s) => s.startFlowering)
  const [confirmFlower, setConfirmFlower] = useState(false)
  const advice = mentorAdvice(c, guide)
  const showTraining = c.stage === 'veg' && canTrain(guide)
  // fotoperiódicas en veg: aquí se anota el cambio real de luz a 12/12
  const showFlowering = c.stage === 'veg' && c.seedType === 'foto' && !c.flowerTs

  return (
    <div className="absolute inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(3,6,9,.55)', backdropFilter: 'blur(2px)' }} />
      <div className="absolute left-0 right-0 bottom-0 glass rounded-t-3xl px-5 pt-3 pb-7 max-h-[82%] flex flex-col"
        onClick={(e) => e.stopPropagation()} style={{ animation: 'sheetUp .28s ease-out' }}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: 'var(--glass-bd)' }} />
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="display font-bold text-[1.05rem]">Consejos</h3>
          <span className="text-[.7rem]" style={{ color: 'var(--faint)' }}>{stageLabel[c.stage]} · día {c.day}</span>
        </div>

        <div className="overflow-y-auto -mx-1 px-1 space-y-2">
          {advice.map((a, i) => (
            <div key={i} className="flex items-start gap-3 rounded-2xl px-3.5 py-3"
              style={{ background: 'rgba(255,255,255,.04)', border: `1px solid ${a.tone && a.tone !== 'ok' ? STATUS_COLOR[a.tone] : 'var(--glass-bd)'}` }}>
              <span className="text-[1.15rem] leading-none mt-[1px]">{a.icon}</span>
              <div className="min-w-0">
                <div className="text-[.86rem] font-bold leading-tight mb-0.5">{a.title}</div>
                <div className="text-[.8rem] leading-snug" style={{ color: 'var(--muted)' }}>{a.body}</div>
              </div>
            </div>
          ))}

          {/* fotoperiódicas: anotar el cambio de luz a 12/12 (dispara la floración real) */}
          {showFlowering && (
            <div className="pt-1">
              {confirmFlower ? (
                <div className="rounded-2xl px-3.5 py-3" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--acc)' }}>
                  <div className="text-[.82rem] font-bold mb-1">¿Ya pusiste la luz en 12/12?</div>
                  <p className="text-[.72rem] mb-2.5" style={{ color: 'var(--muted)' }}>
                    Desde hoy cuentan las ~8–9 semanas de floración; los objetivos y consejos cambian a modo flor.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmFlower(false)} className="flex-1 rounded-2xl py-2.5 text-[.78rem] font-semibold"
                      style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--glass-bd)', color: 'var(--text)' }}>Aún no</button>
                    <button onClick={() => { setConfirmFlower(false); startFlowering(); onClose() }}
                      className="flex-[2] rounded-2xl py-2.5 text-[.78rem] font-bold"
                      style={{ background: 'linear-gradient(135deg,var(--acc),var(--acc2))', color: '#04150c', border: 'none' }}>Sí, ya está en 12/12 🌸</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirmFlower(true)}
                  className="w-full rounded-2xl py-3 text-[.82rem] font-bold"
                  style={{ background: 'linear-gradient(135deg,rgba(52,211,153,.22),rgba(190,242,100,.1))', border: '1px solid var(--acc)', color: 'var(--acc)' }}>
                  🌸 Pasar a floración (12/12)
                </button>
              )}
            </div>
          )}

          {/* entrenamiento (solo veg y nivel medio/avanzado): cambia la imagen + bitácora */}
          {showTraining && (
            <div className="pt-1">
              <div className="text-[.58rem] font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--faint)' }}>✂️ Aplicar entrenamiento</div>
              <div className="flex gap-[7px]">
                {TECHNIQUES.map((t) => (
                  <button key={t.id} onClick={() => applyTraining(t.id)}
                    className="flex-1 text-center rounded-2xl py-2.5 text-[.78rem] font-semibold"
                    style={c.training === t.id
                      ? { background: 'linear-gradient(135deg,var(--acc),var(--acc2))', color: '#04150c', border: '1px solid var(--acc)' }
                      : { background: 'rgba(255,255,255,.04)', border: '1px solid var(--glass-bd)', color: 'var(--text)' }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="text-[.64rem] mt-3 text-center" style={{ color: 'var(--faint)' }}>
          Guía de referencia general · no sustituye tu criterio ni consejo profesional.
        </p>
      </div>
      <style>{`@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
    </div>
  )
}
