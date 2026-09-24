import { useEffect, useRef, useState } from 'react'
import { useStore, selectActive } from '../store'
import { stageLabel, ventanaApicalAuto, type MetricKey, type Training } from '../lib'
import { mentorAdvice, canTrain, STATUS_COLOR } from '../mentor'
import { isDefoliated } from '../lib'
import { HOWTOS } from '../howtos'
import HowTo from './HowTo'
import WeekPlan from './WeekPlan'
import type { PlanKind } from '../plan'

const TECHNIQUES: { id: Training; label: string }[] = [
  { id: 'none', label: 'Ninguna' },
  { id: 'lst', label: 'LST' },
  { id: 'lollipop', label: 'Lollipop' },
  { id: 'apical', label: 'Poda apical' },
]

// Consejos del mentor: enseñan cómo hacer las cosas según la etapa y el nivel del usuario.
// Pestaña "Semana": el plan de los próximos 7 días; cada tarea abre su acción.
export default function Today({ onClose, onCheck, onLight, onMeasure, onPhoto, onDiagnose }: {
  onClose: () => void
  onCheck: (mode?: 'solucion') => void   // revisar la maceta / el depósito (hidro: 'solucion' = cambiarla)
  onLight: () => void                     // la hoja de Luz (horario anotado que no conviene)
  onMeasure: (key: MetricKey) => void
  onPhoto: () => void
  onDiagnose: () => void
}) {
  const c = useStore(selectActive)
  const guide = useStore((s) => s.guide)
  const applyTraining = useStore((s) => s.applyTraining)
  const defoliate = useStore((s) => s.defoliate)
  const [howto, setHowto] = useState<'apical' | 'defoliacion' | null>(null)
  const startFlowering = useStore((s) => s.startFlowering)
  const [confirmFlower, setConfirmFlower] = useState(false)
  const [tab, setTab] = useState<'hoy' | 'semana'>('hoy')
  const flowerRef = useRef<HTMLDivElement>(null)
  // al abrir la confirmación de 12/12 (también desde la Semana) que quede a la vista
  useEffect(() => { if (tab === 'hoy' && confirmFlower) flowerRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [tab, confirmFlower])
  const advice = mentorAdvice(c, guide)
  const showTraining = c.stage === 'veg' && canTrain(guide)
  // autoflorecientes: la poda apical solo en avanzado, y con su ventana (4–5 nudos, planta sana:
  // los días 14–21 de la curva típica, escalados a su ciclo). Si ya se anotó, el botón sigue a la
  // vista para poder quitarla.
  const isAuto = c.seedType === 'auto'
  const techniques = TECHNIQUES.filter((t) => t.id !== 'apical' || !isAuto || guide === 'avanzado' || c.training === 'apical')
  const autoTopping = isAuto && techniques.some((t) => t.id === 'apical')
  const ventana = ventanaApicalAuto(c)
  const toppingOff = autoTopping && c.training !== 'apical' && (c.day < ventana.desde || c.day > ventana.hasta) // fuera de su ventana
  // defoliar: en vegetativo o floración (nivel medio/avanzado); la imagen lo muestra unos días
  const showDefol = (c.stage === 'veg' || c.stage === 'flor') && canTrain(guide)
  // fotoperiódicas en veg: aquí se anota el cambio real de luz a 12/12
  const showFlowering = c.stage === 'veg' && c.seedType === 'foto' && !c.flowerTs
  const living = c.stage === 'plantula' || c.stage === 'veg' || c.stage === 'flor' || c.stage === 'cosecha'

  function onPlan(kind: PlanKind) {
    // el plan no manda regar: abre la revisión de la maceta (o del depósito)
    if (kind === 'riego' || kind === 'abono' || kind === 'deposito') onCheck()
    else if (kind === 'solucion') onCheck('solucion')
    else if (kind === 'ph') onMeasure('ph')
    else if (kind === 'foto') onPhoto()
    else if (kind === 'flip') { setTab('hoy'); setConfirmFlower(true) }
    else if (kind === 'defol') setHowto('defoliacion')
    else onClose() // tricomas: a mirar las plantas
  }

  return (
    <div className="absolute inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(3,6,9,.55)', backdropFilter: 'blur(2px)' }} />
      <div className="absolute left-0 right-0 bottom-0 glass rounded-t-3xl px-5 pt-3 pb-7 max-h-[82%] flex flex-col"
        onClick={(e) => e.stopPropagation()} style={{ animation: 'sheetUp .28s ease-out' }}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full flex-none" style={{ background: 'var(--glass-bd)' }} />
        <div className="flex gap-[7px] mb-3 flex-none" role="tablist">
          {(['hoy', 'semana'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`ttab ${tab === t ? 'on' : ''}`}>
              {t === 'hoy' ? 'Hoy' : 'Semana'}
            </button>
          ))}
        </div>
        <div className="flex items-baseline justify-between mb-3 flex-none">
          <h3 className="display font-bold text-[1.05rem]">{tab === 'hoy' ? 'Consejos' : 'Esta semana'}</h3>
          <span className="text-[.74rem]" style={{ color: 'var(--faint)' }}>{stageLabel[c.stage]} · día {c.day}</span>
        </div>

        {tab === 'semana' ? (
          // key distinta en cada pestaña: React no reutiliza el mismo div ni su scroll
          <div key="semana" className="overflow-y-auto -mx-1 px-1">
            <WeekPlan onAction={onPlan} />
          </div>
        ) : (
        <div key="hoy" className="overflow-y-auto -mx-1 px-1 space-y-2">
          {/* diagnóstico por foto: la entrada vive aquí, arriba, para cuando algo se ve raro */}
          {living && (
            <div className="flex items-center gap-3 rounded-2xl pl-3.5 pr-2 py-2" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--glass-bd)' }}>
              <div className="flex-1 min-w-0 text-[.86rem] font-bold leading-tight">¿Algo raro en una hoja?</div>
              <button onClick={onDiagnose} className="flex-none h-11 px-3.5 text-[.82rem] font-semibold"
                style={{ borderRadius: 5, background: 'transparent', border: '1px solid rgba(255,255,255,.4)', color: '#fff' }}>
                Revisar con foto
              </button>
            </div>
          )}
          {advice.map((a, i) => (
            <div key={i} className="flex items-start gap-3 rounded-2xl px-3.5 py-3"
              style={{ background: 'rgba(255,255,255,.04)', border: `1px solid ${a.tone && a.tone !== 'ok' ? STATUS_COLOR[a.tone] : 'var(--glass-bd)'}` }}>
              <span className="w-1.5 h-1.5 rounded-full mt-[7px] flex-none" style={{ background: a.tone && a.tone !== 'ok' ? STATUS_COLOR[a.tone] : 'var(--blue)' }} />
              <div className="min-w-0 flex-1">
                <div className="text-[.86rem] font-bold leading-tight mb-0.5">{a.title}</div>
                <div className="text-[.8rem] leading-relaxed" style={{ color: 'var(--muted)' }}>{a.body}</div>
                {/* el aviso de revisar lleva a la revisión (el riego viene después, si hace falta) */}
                {a.action && (
                  <button onClick={() => (a.action === 'luz' ? onLight() : onCheck(a.action === 'solucion' ? 'solucion' : undefined))}
                    className="mt-2.5 w-full h-11 text-[.82rem] font-semibold"
                    style={{ borderRadius: 5, background: 'transparent', border: '1px solid rgba(255,255,255,.4)', color: '#fff' }}>
                    {a.action === 'solucion' ? 'Cambiar la solución' : a.action === 'luz' ? 'Cambiar el horario de luz' : 'Revisar ahora'}
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* fotoperiódicas: anotar el cambio de luz a 12/12 (dispara la floración real) */}
          {showFlowering && (
            <div className="pt-1" ref={flowerRef}>
              {confirmFlower ? (
                <div className="rounded-2xl px-3.5 py-3" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--acc)' }}>
                  <div className="text-[.82rem] font-bold mb-1">¿Ya pusiste la luz en 12/12?</div>
                  <p className="text-[.76rem] leading-snug mb-2.5" style={{ color: 'var(--muted)' }}>
                    Desde hoy cuentan {c.flowerWeeks ? `las ${c.flowerWeeks} semanas de floración de tu variedad` : 'unas 8–9 semanas de floración'}. Los objetivos y consejos cambian a modo flor.
                    {c.lightHours != null && c.lightHours !== 12 && ` Tu horario de ${c.lightHours} h vuelve a automático: 12 h de luz.`}
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
              <div className={`grid ${techniques.length === 3 ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                {techniques.map((t) => (
                  <button key={t.id} onClick={() => t.id === 'apical' && c.training !== 'apical' ? setHowto('apical') : applyTraining(t.id)}
                    className="text-center rounded-2xl min-h-[44px] py-2.5 text-[.82rem] font-semibold"
                    style={c.training === t.id
                      ? { background: '#fff', color: '#000', border: '1px solid #fff' }
                      : { background: 'rgba(255,255,255,.04)', border: '1px solid var(--glass-bd)', color: 'var(--text)' }}>
                    {t.label}
                  </button>
                ))}
              </div>
              {autoTopping && (
                <p className="text-[.76rem] leading-snug mt-2" style={{ color: toppingOff ? 'var(--warn)' : 'var(--muted)' }}>
                  Autofloreciente: poda apical solo con 4–5 nudos (hacia los días {ventana.desde}–{ventana.hasta}) y con la planta sana.
                  {toppingOff && (c.day < ventana.desde ? ` Tu planta va por el día ${c.day}: espera al día ${ventana.desde}.` : ` Tu planta va por el día ${c.day}: ya es tarde, mejor no cortes la punta.`)}
                </p>
              )}
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
        )}

        <p className="text-[.74rem] mt-3 text-center leading-snug flex-none" style={{ color: 'var(--faint)' }}>
          Guía de referencia general. No sustituye tu criterio ni el consejo profesional.
        </p>
      </div>
      {/* los toques del how-to (avanzar, cerrar) no suben al fondo de esta hoja, que la cerraría */}
      {howto && (
        <div onClick={(e) => e.stopPropagation()}>
          {howto === 'apical' && (
            <HowTo def={isAuto ? HOWTOS.apicalAuto : HOWTOS.apical} actionLabel="Ya la podé"
              onAction={() => { setHowto(null); applyTraining('apical') }} onClose={() => setHowto(null)} />
          )}
          {howto === 'defoliacion' && (
            <HowTo def={isAuto ? HOWTOS.defoliacionAuto : HOWTOS.defoliacion} actionLabel="Ya defolié"
              onAction={() => { setHowto(null); defoliate() }} onClose={() => setHowto(null)} />
          )}
        </div>
      )}
      <style>{`
        @keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        .ttab{flex:1;height:44px;text-align:center;background:transparent;border:1px solid rgba(255,255,255,.18);border-radius:5px;cursor:pointer;color:var(--muted);font-weight:500;font-size:.86rem;font-family:'Instrument Sans',system-ui,sans-serif}
        .ttab.on{border-color:#fff;color:#fff;background:rgba(255,255,255,.06)}
      `}</style>
    </div>
  )
}
