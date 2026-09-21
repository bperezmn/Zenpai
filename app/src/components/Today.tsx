import { useState } from 'react'
import { useStore, selectActive } from '../store'
import { stageLabel, type Training } from '../lib'
import { mentorAdvice, canTrain, STATUS_COLOR } from '../mentor'
import { isDefoliated } from '../lib'
import { HOWTOS } from '../howtos'
import HowTo from './HowTo'

const TECHNIQUES: { id: Training; label: string }[] = [
  { id: 'none', label: 'Ninguna' },
  { id: 'lst', label: 'LST' },
  { id: 'lollipop', label: 'Lollipop' },
  { id: 'apical', label: 'Poda apical' },
]

// Consejos del mentor: enseñan cómo hacer las cosas según la etapa y el nivel del usuario.
export default function Today({ onClose }: { onClose: () => void }) {
  const c = useStore(selectActive)
  const guide = useStore((s) => s.guide)
  const applyTraining = useStore((s) => s.applyTraining)
  const defoliate = useStore((s) => s.defoliate)
  const [howto, setHowto] = useState<'apical' | 'defoliacion' | null>(null)
  const startFlowering = useStore((s) => s.startFlowering)
  const [confirmFlower, setConfirmFlower] = useState(false)
  const advice = mentorAdvice(c, guide)
  const showTraining = c.stage === 'veg' && canTrain(guide)
  // defoliar: en vegetativo o floración (nivel medio/avanzado); la imagen lo muestra unos días
  const showDefol = (c.stage === 'veg' || c.stage === 'flor') && canTrain(guide)
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
          <span className="text-[.74rem]" style={{ color: 'var(--faint)' }}>{stageLabel[c.stage]} · día {c.day}</span>
        </div>

        <div className="overflow-y-auto -mx-1 px-1 space-y-2">
          {advice.map((a, i) => (
            <div key={i} className="flex items-start gap-3 rounded-2xl px-3.5 py-3"
              style={{ background: 'rgba(255,255,255,.04)', border: `1px solid ${a.tone && a.tone !== 'ok' ? STATUS_COLOR[a.tone] : 'var(--glass-bd)'}` }}>
              <span className="w-1.5 h-1.5 rounded-full mt-[7px] flex-none" style={{ background: a.tone && a.tone !== 'ok' ? STATUS_COLOR[a.tone] : 'var(--blue)' }} />
              <div className="min-w-0">
                <div className="text-[.86rem] font-bold leading-tight mb-0.5">{a.title}</div>
                <div className="text-[.8rem] leading-relaxed" style={{ color: 'var(--muted)' }}>{a.body}</div>
              </div>
            </div>
          ))}

          {/* fotoperiódicas: anotar el cambio de luz a 12/12 (dispara la floración real) */}
          {showFlowering && (
            <div className="pt-1">
              {confirmFlower ? (
                <div className="rounded-2xl px-3.5 py-3" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--acc)' }}>
                  <div className="text-[.82rem] font-bold mb-1">¿Ya pusiste la luz en 12/12?</div>
                  <p className="text-[.76rem] leading-snug mb-2.5" style={{ color: 'var(--muted)' }}>
                    Desde hoy cuentan las 8–9 semanas de floración. Los objetivos y consejos cambian a modo flor.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmFlower(false)} className="flex-1 rounded-2xl py-2.5 text-[.82rem] font-semibold"
                      style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.4)', color: '#fff' }}>Aún no</button>
                    <button onClick={() => { setConfirmFlower(false); startFlowering(); onClose() }}
                      className="flex-1 rounded-2xl py-2.5 text-[.82rem] display font-bold"
                      style={{ background: '#fff', color: '#000', border: '1px solid #fff' }}>Sí, ya está en 12/12</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirmFlower(true)}
                  className="w-full rounded-2xl py-3 text-[.82rem] font-bold"
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.4)', color: '#fff' }}>
                  Pasar a floración (12/12)
                </button>
              )}
            </div>
          )}

          {/* entrenamiento (solo veg y nivel medio/avanzado): cambia la imagen + bitácora */}
          {showTraining && (
            <div className="pt-1">
              <div className="label mb-1.5">Entrenamiento</div>
              <div className="grid grid-cols-2 gap-2">
                {TECHNIQUES.map((t) => (
                  <button key={t.id} onClick={() => t.id === 'apical' && c.training !== 'apical' ? setHowto('apical') : applyTraining(t.id)}
                    className="text-center rounded-2xl py-2.5 text-[.82rem] font-semibold"
                    style={c.training === t.id
                      ? { background: '#fff', color: '#000', border: '1px solid #fff' }
                      : { background: 'rgba(255,255,255,.04)', border: '1px solid var(--glass-bd)', color: 'var(--text)' }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {showDefol && (
            <div className="pt-2">
              <div className="label mb-1.5">Defoliación</div>
              {isDefoliated(c) ? (
                <div className="text-[.78rem] leading-snug py-2" style={{ color: 'var(--muted)' }}>Defoliadas hace poco. Deja que recuperen antes de volver a quitar hojas.</div>
              ) : (
                <button onClick={() => setHowto('defoliacion')}
                  className="w-full rounded-2xl py-2.5 text-[.82rem] font-semibold"
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.4)', color: '#fff' }}>
                  Ver cómo defoliar
                </button>
              )}
            </div>
          )}
        </div>

        <p className="text-[.74rem] mt-3 text-center leading-snug" style={{ color: 'var(--faint)' }}>
          Guía de referencia general. No sustituye tu criterio ni el consejo profesional.
        </p>
      </div>
      {howto === 'apical' && (
        <HowTo def={HOWTOS.apical} actionLabel="Ya la podé"
          onAction={() => { setHowto(null); applyTraining('apical') }} onClose={() => setHowto(null)} />
      )}
      {howto === 'defoliacion' && (
        <HowTo def={HOWTOS.defoliacion} actionLabel="Ya defolié"
          onAction={() => { setHowto(null); defoliate() }} onClose={() => setHowto(null)} />
      )}
      <style>{`@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
    </div>
  )
}
