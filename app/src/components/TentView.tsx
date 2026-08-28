import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore, selectActive } from '../store'
import { frontImg, nightImg, statusText, stageLabel, stageAt, previewStage, MAX_DAY, type Cultivo, type MetricKey } from '../lib'
import { metricsFor, targetFor, evalMetric, fmtRange, STATUS_COLOR, needsAttention, overwaterGuard, wateringGuide } from '../mentor'
import { useBackClose } from '../useBackClose'
import Intro from './Intro'
import Journal from './Journal'
import Today from './Today'
import Measure from './Measure'
import HowTo from './HowTo'
import WaterRecipe from './WaterRecipe'
import FinishGrow from './FinishGrow'
import EditGrow from './EditGrow'
import { HOWTOS } from '../howtos'

export default function TentView() {
  const c = useStore(selectActive)
  const guide = useStore((s) => s.guide)
  const firstWaterTipDone = useStore((s) => s.firstWaterTipDone)
  const markFirstWaterTip = useStore((s) => s.markFirstWaterTip)
  const coachDone = useStore((s) => s.coachDone)
  const markCoachDone = useStore((s) => s.markCoachDone)
  const pendingUndo = useStore((s) => s.pendingUndo)
  const { view, toast, setToast, setPreview, previewDay, water, wilt, harvest, runUndo, setView, goHome, startNew } = useStore(
    useShallow((s) => ({
      view: s.view,
      toast: s.toast,
      setToast: s.setToast,
      setPreview: s.setPreview,
      previewDay: s.previewDay,
      water: s.water,
      wilt: s.wilt,
      harvest: s.harvest,
      runUndo: s.runUndo,
      setView: s.setView,
      goHome: s.goHome,
      startNew: s.startNew,
    })),
  )
  const [intro, setIntro] = useState(() => useStore.getState().justCreated)
  useEffect(() => { if (intro) useStore.setState({ justCreated: false }) }, [])
  const [showJournal, setShowJournal] = useState(false)
  const [showToday, setShowToday] = useState(false)
  const [wateringHow, setWateringHow] = useState(false)
  const [showRecipe, setShowRecipe] = useState(false)
  const [measureKey, setMeasureKey] = useState<MetricKey | null>(null)
  const [confirmHarvest, setConfirmHarvest] = useState(false)
  const [showFinish, setShowFinish] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showCoach, setShowCoach] = useState(false)
  const sceneRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  function dayFromX(e: React.PointerEvent) {
    const r = trackRef.current!.getBoundingClientRect()
    return Math.max(0, Math.min(MAX_DAY, Math.round(((e.clientX - r.left) / r.width) * MAX_DAY)))
  }

  // el toast dura más cuando trae "Deshacer" (hay que darle tiempo al dedo)
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), pendingUndo ? 5200 : 2600); return () => clearTimeout(t) }, [toast, pendingUndo, setToast])

  const preview = previewDay !== null
  const done = c.stage === 'secando'
  const overlayOpen = showJournal || showToday || wateringHow || showRecipe || showFinish || showEdit || measureKey !== null

  // gesto atrás del sistema: cierra la capa superior (una a la vez), nunca mata la app.
  // El booleano compuesto mantiene UNA entrada de historial mientras haya alguna abierta
  // (las transiciones how-to → ficha no la alternan → sin carreras de history).
  useBackClose(overlayOpen, () => {
    if (measureKey !== null) setMeasureKey(null)
    else if (showEdit) setShowEdit(false)
    else if (showFinish) setShowFinish(false)
    else if (showRecipe) setShowRecipe(false)
    else if (wateringHow) setWateringHow(false)
    else if (showToday) setShowToday(false)
    else if (showJournal) setShowJournal(false)
  })

  // el caption y los avisos dependen del reloj: un tick por minuto los mantiene honestos
  const [, setClock] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setClock((n) => n + 1), 60000)
    return () => clearInterval(t)
  }, [])

  // coach mark de primera visita: cómo regar + qué es el dock (una sola vez,
  // nunca debajo/encima de otro overlay ni en preview)
  useEffect(() => {
    if (coachDone || intro || done || preview || overlayOpen) return
    const t = setTimeout(() => setShowCoach(true), 700)
    return () => clearTimeout(t)
  }, [coachDone, intro, done, preview, overlayOpen])
  function dismissCoach() { setShowCoach(false); markCoachDone() }

  // la previsualización sale sola tras unos segundos sin tocar (no es un modo para quedarse);
  // lastTouch re-arma el timer cuando el dedo se suelta sin haber cambiado de día
  const [lastTouch, setLastTouch] = useState(0)
  useEffect(() => {
    if (previewDay === null) return
    const t = setTimeout(() => { if (!dragging.current) setPreview(null) }, 8000)
    return () => clearTimeout(t)
  }, [previewDay, lastTouch, setPreview])

  // la confirmación de cosecha actúa sobre el cultivo REAL: no debe sobrevivir a la preview
  useEffect(() => { if (preview) setConfirmHarvest(false) }, [preview])
  const effDay = preview ? previewDay! : c.day
  const effStage = preview ? previewStage(c, previewDay!) : c.stage
  const dc: Cultivo = preview
    ? { ...c, day: effDay, stage: effStage, thirst: effStage === 'veg' ? 0.2 : 0 }
    : c

  function doWater(e?: React.PointerEvent, toastOverride?: string, force?: boolean) {
    if (e && sceneRef.current) {
      const r = sceneRef.current.getBoundingClientRect()
      const rp = document.createElement('div')
      rp.className = 'ripple'
      rp.style.left = e.clientX - r.left + 'px'
      rp.style.top = e.clientY - r.top + 'px'
      sceneRef.current.appendChild(rp)
      setTimeout(() => rp.remove(), 800)
    }
    water(toastOverride, force)
  }
  // "receta" de la etapa para el toast (avanzado riega directo pero ve los números)
  function recipeText() {
    const w = wateringGuide(c)
    const ph = targetFor('ph', c.stage, c.substrate)
    const ec = targetFor('ec', c.stage, c.substrate)
    return ['💧 ' + (w ? w.amount : 'a fondo'), 'pH ' + fmtRange(ph, 1), ec ? 'EC ' + fmtRange(ec, 1) : null].filter(Boolean).join(' · ')
  }
  function onWater(e?: React.PointerEvent) {
    // encontró el hotspot por su cuenta: el coach ya no tiene nada que enseñarle ahí
    if (showCoach) setShowCoach(false)
    if (!coachDone) markCoachDone()
    if (guide === 'avanzado') {
      // guardarraíl activo → abrir la ficha (ahí vive el aviso y el "Regar igualmente":
      // si el sustrato está seco de verdad, siempre hay salida)
      const guard = overwaterGuard(c)
      if (guard) { setShowRecipe(true); return }
      // la receta viaja como toast de water(): así el Deshacer se arma sobre SU propio toast
      doWater(e, recipeText())
      return
    }
    // primer riego: enseñar cómo (una sola vez); después, la ficha de riego con la receta
    if (!firstWaterTipDone) { markFirstWaterTip(); setWateringHow(true); return }
    setShowRecipe(true)
  }

  const isVeg = !preview && c.stage === 'veg'
  const plantable = !preview && !done && view === 'front' && effStage !== 'vacia'
  const names = Array.from({ length: Math.min(c.pots, 3) }, (_, i) => `${c.grow} · #${i + 1}`)
  const tops = c.pots === 1 ? ['47%'] : c.pots === 2 ? ['30%', '66%'] : ['21%', '47%', '73%']
  const pct = Math.min(100, (effDay / MAX_DAY) * 100)

  const tiles = metricsFor(guide)
  const attention = !preview && needsAttention(c)
  const fmtVal = (v: number, dec: number) => (dec ? v.toFixed(dec) : Math.round(v).toString())

  return (
    <div className="absolute inset-0 select-none">
      {/* escena */}
      <div ref={sceneRef} className="absolute inset-0 overflow-hidden">
        <img src={frontImg(dc, view)} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <img src={nightImg(dc)} alt="" className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500" style={{ opacity: c.light ? 0 : 1 }} />
        <div className="absolute top-0 left-0 right-0 h-28 pointer-events-none" style={{ background: 'linear-gradient(180deg,rgba(4,7,10,.7),transparent)' }} />
        <div className="absolute bottom-0 left-0 right-0 h-36 pointer-events-none" style={{ background: 'linear-gradient(0deg,rgba(4,7,10,.82),rgba(4,7,10,.28) 60%,transparent)' }} />
        {plantable && (
          <button aria-label="Regar las plantas" onPointerDown={onWater}
            onClick={(e) => { if (e.detail === 0) onWater() }} /* Enter/Espacio: click sin pointerdown */
            className="absolute bg-transparent border-0 p-0 cursor-pointer"
            style={{ left: '12%', top: '42%', width: '64%', height: '46%' }} />
        )}
        {view === 'cenital' && names.map((n, i) => (
          <div key={i} className="cenname" style={{ top: tops[i] }}>🌿 {n}</div>
        ))}
      </div>

      {/* arriba-izquierda: volver + chip día/etapa (ámbar al previsualizar, toca para volver a hoy) */}
      <div className="absolute left-3.5 top-4 z-30 flex items-center gap-2">
        <button onClick={goHome} title="Mis cultivos" className="tbtn">Volver</button>
        <button onClick={() => preview && setPreview(null)}
          className="glass rounded-full pl-3 pr-1 h-9 flex items-center gap-2"
          style={preview ? { borderColor: 'var(--warn)' } : undefined}>
          {preview && <span className="text-[.7rem] leading-none" style={{ color: 'var(--warn)' }}>👁</span>}
          <span className="display font-bold text-[.74rem] leading-none">Día {effDay}</span>
          <span className="display font-bold text-[.58rem] px-2 py-1 rounded-full leading-none"
            style={{ background: preview ? 'var(--warn)' : 'linear-gradient(135deg,var(--acc),var(--acc2))', color: '#04150c' }}>{stageLabel[effStage]}</span>
        </button>
      </div>

      {/* arriba-derecha: Consejos del mentor (según etapa y nivel) */}
      <button onClick={() => setShowToday(true)} disabled={preview} className="tbtn absolute right-3.5 top-4 z-30 flex items-center gap-1.5">
        Consejos
        {attention && <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--warn)' }} />}
      </button>

      {/* borde derecho (vertical): vista superior + bitácora + (sed en veg) — solo texto */}
      <div className="absolute right-3.5 top-[42%] z-30 flex flex-col items-end gap-2">
        <button onClick={() => setView(view === 'cenital' ? 'front' : 'cenital')}
          className="tbtn" style={view === 'cenital' ? { color: '#8ad2ff', borderColor: '#8ad2ff' } : undefined}>
          {view === 'cenital' ? 'Frente' : 'Arriba'}
        </button>
        <button onClick={() => setShowJournal(true)} className="tbtn">Bitácora</button>
        {!done && <button onClick={() => setShowEdit(true)} className="tbtn">Editar</button>}
        {/* demo de sed: solo en desarrollo — en producción la sed llega sola con el tiempo */}
        {import.meta.env.DEV && isVeg && <button onClick={wilt} className="tbtn">Sed</button>}
      </div>

      {/* línea de tiempo HORIZONTAL (arriba) = previsualización del ciclo */}
      {!done && (
        <div className="absolute left-4 right-4 top-[58px] z-20">
          <div ref={trackRef} className="relative h-6 flex items-center cursor-pointer touch-none"
            onPointerDown={(e) => { dragging.current = true; try { (e.target as HTMLElement).setPointerCapture(e.pointerId) } catch {}; setPreview(dayFromX(e)) }}
            onPointerMove={(e) => { if (dragging.current) setPreview(dayFromX(e)) }}
            onPointerUp={() => { dragging.current = false; setLastTouch(Date.now()) }}
            onPointerCancel={() => { dragging.current = false; setLastTouch(Date.now()) }}
            onLostPointerCapture={() => { dragging.current = false; setLastTouch(Date.now()) }}>
            <div className="absolute left-0 right-0" style={{ height: '6px', borderRadius: '9px', background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.14)', boxShadow: '0 1px 6px rgba(0,0,0,.35)' }} />
            <div className="absolute left-0" style={{ width: `${pct}%`, height: '6px', borderRadius: '9px', background: preview ? 'var(--warn)' : 'linear-gradient(90deg,var(--acc),var(--acc2))', boxShadow: '0 0 10px var(--glow)' }} />
            <div className="absolute" style={{ left: `calc(${pct}% - 9px)`, width: '18px', height: '18px', borderRadius: '50%', background: '#fff', border: `3px solid ${preview ? 'var(--warn)' : 'var(--acc)'}`, boxShadow: '0 2px 10px rgba(0,0,0,.6)' }} />
          </div>
        </div>
      )}

      {/* saliste del presente: pill explícita para volver (la única salida no puede ser secreta) */}
      {preview && (
        <button onClick={() => setPreview(null)}
          className="absolute left-1/2 -translate-x-1/2 top-[88px] z-30 glass rounded-full h-9 px-4 flex items-center gap-2 whitespace-nowrap"
          style={{ borderColor: 'var(--warn)' }}>
          <span className="text-[.72rem] leading-none" style={{ color: 'var(--warn)' }}>👁 Día {effDay}</span>
          <span className="display font-bold text-[.72rem] leading-none" style={{ color: 'var(--warn)' }}>· Volver a hoy ✕</span>
        </button>
      )}

      {/* toast (con "Deshacer" cuando la última acción se puede revertir) */}
      <div className={`absolute left-1/2 -translate-x-1/2 top-[92px] z-40 glass rounded-xl px-4 py-2 text-[.78rem] font-semibold text-center transition-all duration-300 ${toast ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3 pointer-events-none'}`} style={{ maxWidth: '82%' }}>
        {toast}
        {toast && pendingUndo && (
          <button onClick={runUndo} className="ml-2.5 display font-bold underline underline-offset-2" style={{ color: 'var(--acc2)' }}>Deshacer</button>
        )}
      </div>

      {/* panel inferior: cosechar · estado · dock de vitales
          (pointer-events-none en el contenedor: sus zonas transparentes no deben
          robarle taps al hotspot de riego; cada hijo interactivo re-activa los suyos) */}
      <div className="absolute left-4 right-4 bottom-3 z-20 flex flex-col gap-2 pointer-events-none">
        {!preview && (c.stage === 'cosecha' || done) && (
          confirmHarvest && c.stage === 'cosecha' ? (
            <div className="glass rounded-2xl px-4 py-3 text-center self-center pointer-events-auto" style={{ maxWidth: 360 }}>
              <div className="display font-bold text-[.85rem] mb-1">¿Cortamos ya?</div>
              <p className="text-[.7rem] mb-2.5" style={{ color: 'var(--muted)' }}>
                Mira los tricomas con lupa: lechosos = potencia · ámbar = relax. Esto termina el cultivo.
              </p>
              <div className="flex gap-2 justify-center">
                <button onClick={() => setConfirmHarvest(false)} className="tbtn">Todavía no</button>
                <button onClick={() => { setConfirmHarvest(false); harvest() }}
                  className="btn-glow rounded-2xl px-5 display font-bold text-[.78rem]" style={{ height: 34 }}>🌾 Sí, cosechar</button>
              </div>
            </div>
          ) : done && !c.finishedTs ? (
            // secando: el ciclo aún no cierra — Terminar es la acción principal
            <div className="flex gap-2 self-center pointer-events-auto">
              <button onClick={startNew} className="tbtn">🌱 Nuevo cultivo</button>
              <button onClick={() => setShowFinish(true)}
                className="btn-glow rounded-2xl px-5 py-2.5 display font-bold text-[.85rem]">🫙 Terminar cultivo</button>
            </div>
          ) : done ? (
            <button onClick={startNew}
              className="btn-glow self-center rounded-2xl px-6 py-2.5 display font-bold text-[.85rem] pointer-events-auto">🌱 Nuevo cultivo</button>
          ) : (
            <button onClick={() => setConfirmHarvest(true)}
              className="btn-glow self-center rounded-2xl px-6 py-2.5 display font-bold text-[.85rem] pointer-events-auto">🌾 Cosechar</button>
          )
        )}

        {/* caption de estado: qué pasa y qué se puede tocar (el texto vive en statusText) */}
        {!preview && (
          <div className="text-center text-[.7rem] font-medium pointer-events-none"
            style={{ color: 'rgba(255,255,255,.78)', textShadow: '0 1px 8px rgba(0,0,0,.85)' }}>
            {statusText(c, view)}
          </div>
        )}

        {/* dock: objetivos por etapa (toca una métrica para registrar tu medición) */}
        <div className="dock-row flex gap-[7px] overflow-x-auto pointer-events-auto">
            {tiles.map((m) => {
              const range = targetFor(m.key, effStage, c.substrate)
              const noTarget = range === null
              const reading = c.readings[m.key]
              const rDay = c.readingDays[m.key]
              // una lectura solo es "fresca" si se tomó en la etapa actual (el pH no depende de la etapa)
              const fresh = reading != null && (m.key === 'ph' || (rDay != null && stageAt(c, rDay) === effStage))
              const showReading = !preview && fresh && !noTarget
              const ev = showReading ? evalMetric(m.key, reading!, effStage, c.substrate) : null
              const color = ev ? STATUS_COLOR[ev.status] : 'var(--text)'
              return (
                <button key={m.key} disabled={preview || noTarget} onClick={() => setMeasureKey(m.key)}
                  className="glass rounded-2xl py-1.5 text-center relative flex-1 min-w-[30%]"
                  style={{ opacity: preview ? 0.45 : noTarget ? 0.5 : 1 }}>
                  {ev && <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />}
                  <div className="text-[.46rem] font-bold uppercase tracking-wider" style={{ color: showReading ? color : 'var(--faint)' }}>
                    {noTarget ? '—' : showReading ? 'tu lectura' : 'objetivo'}
                  </div>
                  <div className="display font-bold text-[.9rem] leading-none mt-0.5" style={{ color: showReading ? color : 'var(--text)' }}>
                    {showReading ? fmtVal(reading!, m.dec) : fmtRange(range, m.dec)}
                  </div>
                  <div className="text-[.5rem] font-bold uppercase mt-0.5" style={{ color: 'var(--faint)' }}>{m.label}</div>
                </button>
              )
            })}
        </div>
      </div>

      {/* coach de primera visita: los dos controles que nada delata (regar + dock) */}
      {showCoach && !overlayOpen && (
        <div className="absolute inset-0 z-50 select-none" onClick={dismissCoach}
          style={{ background: 'rgba(3,6,9,.5)', backdropFilter: 'blur(2px)' }}>
          <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ top: '70%' }}>
            <span className="coach-ring" />
          </div>
          <div className="absolute left-8 right-8 text-center pointer-events-none" style={{ top: '38%' }}>
            <div className="coach-tip">💧 <b>Toca las plantas</b> para regar</div>
          </div>
          <div className="absolute left-6 right-6 text-center pointer-events-none" style={{ bottom: '112px' }}>
            <div className="coach-tip">Abajo, los <b>objetivos de la etapa</b> · toca una métrica para anotar tu lectura</div>
          </div>
          <button onClick={dismissCoach} className="coach-ok">Entendido</button>
        </div>
      )}

      {wateringHow && (
        <HowTo def={HOWTOS.riego} actionLabel="Continuar →"
          onAction={() => { setWateringHow(false); setShowRecipe(true) }}
          onClose={() => setWateringHow(false)} />
      )}
      {showRecipe && (
        <WaterRecipe
          onConfirm={(force) => { setShowRecipe(false); doWater(undefined, guide === 'avanzado' ? recipeText() : undefined, force) }}
          onHow={() => { setShowRecipe(false); setWateringHow(true) }}
          onClose={() => setShowRecipe(false)} />
      )}
      {showFinish && <FinishGrow onClose={() => setShowFinish(false)} />}
      {showEdit && <EditGrow onClose={() => setShowEdit(false)} />}
      {showJournal && <Journal onClose={() => setShowJournal(false)} />}
      {showToday && <Today onClose={() => setShowToday(false)} />}
      {measureKey && <Measure metric={measureKey} onClose={() => setMeasureKey(null)} />}
      {intro && <Intro onDone={() => setIntro(false)} />}

      <style>{`
        .cenname{position:absolute;left:50%;transform:translateX(-50%);background:rgba(8,14,11,.7);backdrop-filter:blur(8px);border:1px solid var(--glass-bd);color:var(--text);font-family:'Space Grotesk';font-weight:700;font-size:.74rem;padding:.28rem .7rem;border-radius:999px;white-space:nowrap}
        .tbtn{height:34px;padding:0 .8rem;border-radius:13px;background:rgba(8,14,11,.55);backdrop-filter:blur(14px);border:1px solid var(--glass-bd);color:rgba(255,255,255,.88);font-family:'Space Grotesk';font-weight:700;font-size:.72rem;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap}
        .tbtn:active{background:rgba(255,255,255,.14)}
        .tbtn:disabled{opacity:.45}
        .dock-row{scrollbar-width:none;-ms-overflow-style:none;scroll-snap-type:x proximity}
        .dock-row::-webkit-scrollbar{display:none}
        .dock-row>button{scroll-snap-align:start}
        .coach-ring{display:block;width:64px;height:64px;border-radius:50%;border:2px solid var(--acc);box-shadow:0 0 24px var(--glow);animation:coachPulse 1.6s ease-out infinite}
        @keyframes coachPulse{0%{transform:scale(.7);opacity:.95}70%{transform:scale(1.25);opacity:.18}100%{transform:scale(1.35);opacity:0}}
        .coach-tip{display:inline-block;background:rgba(8,14,11,.8);backdrop-filter:blur(14px);border:1px solid var(--glass-bd);border-radius:14px;padding:.6rem .95rem;font-size:.8rem;line-height:1.45;color:var(--text)}
        .coach-tip b{color:var(--acc2);font-weight:700}
        .coach-ok{position:absolute;left:50%;transform:translateX(-50%);bottom:40px;height:38px;padding:0 1.5rem;border:none;border-radius:999px;font-family:'Space Grotesk';font-weight:700;font-size:.8rem;cursor:pointer;background:linear-gradient(135deg,var(--acc),var(--acc2));color:#04150c;box-shadow:0 8px 22px -6px var(--glow)}
        @media (prefers-reduced-motion: reduce){.coach-ring{animation:none}}
      `}</style>
    </div>
  )
}
