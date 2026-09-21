import { useEffect, useRef, useState } from 'react'
import SceneFx from './SceneFx'
import LightSheet from './LightSheet'
import { useShallow } from 'zustand/react/shallow'
import { useStore, selectActive } from '../store'
import { frontImg, cenitalTops, statusText, stageLabel, stageAt, previewStage, MAX_DAY, TIMELAPSE_URL, TIMELAPSE_DAYS, HAS_TIMELAPSE, type Cultivo, type MetricKey, type SceneState } from '../lib'

// La escena cambia de render (luz, tinte, vista, preview) con un fundido: la imagen anterior
// queda debajo y la nueva aparece encima. Ambas viven dentro del mismo contenedor que
// "respira" (zoom lentísimo), así el fundido no salta de escala.
function SceneImg({ src }: { src: string }) {
  const last = useRef(src)
  const prev = useRef<string | null>(null)
  if (src !== last.current) { prev.current = last.current; last.current = src }
  return (
    <>
      {prev.current && <img src={prev.current} alt="" className="absolute inset-0 w-full h-full object-cover" />}
      <img key={src} src={src} alt="" className="absolute inset-0 w-full h-full object-cover aparece" />
    </>
  )
}
import { metricsFor, targetFor, evalMetric, fmtRange, STATUS_COLOR, needsAttention, overwaterGuard, wateringGuide, sceneState } from '../mentor'
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
  const [showLight, setShowLight] = useState(false)
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
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const v = videoRef.current
    if (!v || !preview) return
    const d = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 10
    v.currentTime = Math.min(1, Math.max(0, previewDay! / TIMELAPSE_DAYS)) * d
  }, [preview, previewDay])
  const done = c.stage === 'secando'
  const overlayOpen = showJournal || showToday || wateringHow || showRecipe || showFinish || showEdit || measureKey !== null || showLight

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
  const scene: SceneState = preview ? 'dia' : sceneState(c)

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
    return [w ? w.amount : 'a fondo', 'pH ' + fmtRange(ph, 1), ec ? 'EC ' + fmtRange(ec, 1) : null].filter(Boolean).join(' · ')
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
  const tops = cenitalTops(dc)
  const pct = Math.min(100, (effDay / MAX_DAY) * 100)

  const tiles = metricsFor(guide)
  const attention = !preview && needsAttention(c)
  const fmtVal = (v: number, dec: number) => (dec ? v.toFixed(dec) : Math.round(v).toString())

  return (
    <div className="absolute inset-0 select-none">
      {/* escena: la escena 3D reacciona a tus datos (luz, temperatura); en preview siempre "día" */}
      <div ref={sceneRef} className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 escena-viva">
          <SceneImg src={frontImg(dc, view, scene)} />
          {/* timelapse: mientras arrastras la línea de tiempo, el vídeo va al día que señalas */}
          {HAS_TIMELAPSE && view === 'front' && (
            <video ref={videoRef} src={TIMELAPSE_URL} muted playsInline preload="auto"
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
              style={{ opacity: preview ? 1 : 0, pointerEvents: 'none' }} />
          )}
          {/* tinte por temperatura dentro de la abertura de la puerta (frío azul / calor rojo) */}
          <div className={`tinte ${scene === 'calor' ? 'tinte-calor' : 'tinte-frio'}`}
            style={{ opacity: view === 'front' && (scene === 'frio' || scene === 'calor') ? 1 : 0 }} />
          {/* vida en la carpa: vapor hacia el filtro, aspas del ventilador y halo de la LED */}
          <SceneFx active={!preview && !intro && view === 'front'} fan={c.fan} exhaust={c.exhaust} light={c.light} state={scene} humidity={c.readings.hr ?? null} />
        </div>
        <div className="absolute top-0 left-0 right-0 h-28 pointer-events-none" style={{ background: 'linear-gradient(180deg,rgba(4,7,10,.7),transparent)' }} />
        <div className="absolute bottom-0 left-0 right-0 h-36 pointer-events-none" style={{ background: 'linear-gradient(0deg,rgba(4,7,10,.82),rgba(4,7,10,.28) 60%,transparent)' }} />
        {plantable && (
          <button aria-label="Regar las plantas" onPointerDown={onWater}
            onClick={(e) => { if (e.detail === 0) onWater() }} /* Enter/Espacio: click sin pointerdown */
            className="absolute bg-transparent border-0 p-0 cursor-pointer"
            style={{ left: '12%', top: '42%', width: '64%', height: '46%' }} />
        )}
        {view === 'cenital' && names.map((n, i) => (
          <div key={i} className="cenname" style={{ top: tops[i] }}>{n}</div>
        ))}
      </div>

      {/* arriba-izquierda: volver + día/etapa (ámbar al previsualizar, toca para volver a hoy) */}
      <div className="absolute left-3.5 top-4 z-30 flex items-center gap-2">
        <button onClick={goHome} title="Mis cultivos" aria-label="Volver a mis cultivos" className="tbtn tbtn-ico">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <button onClick={() => preview && setPreview(null)} className="tbtn"
          style={preview ? { borderColor: 'var(--warn)', color: 'var(--warn)' } : undefined}>
          Día {effDay} · {stageLabel[effStage]}
        </button>
      </div>

      {/* arriba-derecha: Consejos del mentor (según etapa y nivel) */}
      <button onClick={() => setShowToday(true)} disabled={preview} className="tbtn absolute right-3.5 top-4 z-30 flex items-center gap-1.5">
        Hoy
        {attention && <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--blue)' }} />}
      </button>

      {/* borde derecho (vertical): vista superior + bitácora + (sed en veg) — solo texto */}
      <div className="absolute right-3.5 top-[42%] z-30 flex flex-col items-end gap-2">
        <button onClick={() => setView(view === 'cenital' ? 'front' : 'cenital')}
          className="tbtn" style={view === 'cenital' ? { color: '#8ad2ff', borderColor: '#8ad2ff' } : undefined}>
          {view === 'cenital' ? 'Frente' : 'Arriba'}
        </button>
        <button onClick={() => setShowJournal(true)} className="tbtn">Bitácora</button>
        {!done && <button onClick={() => setShowEdit(true)} className="tbtn">Editar</button>}
        {!done && !preview && (
          <button onClick={() => setShowLight(true)} className="tbtn" style={!c.light ? { color: 'var(--water)', borderColor: 'var(--water)' } : undefined}>
            {c.light ? 'Luz' : 'Noche'}
          </button>
        )}
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
            <div className="absolute left-0 right-0" style={{ top: 11, height: 1, background: 'rgba(255,255,255,.3)' }} />
            <div className="absolute left-0 right-0" style={{ top: 8, height: 7, background: 'repeating-linear-gradient(90deg, rgba(255,255,255,.35) 0 1px, transparent 1px 8.333%)' }} />
            <div className="absolute left-0" style={{ top: 11, width: `${pct}%`, height: 1, background: preview ? 'var(--warn)' : '#fff' }} />
            <div className="absolute" style={{ left: `calc(${pct}% - 1px)`, top: 3, width: 2, height: 17, background: preview ? 'var(--warn)' : '#fff' }} />
          </div>
        </div>
      )}

      {/* saliste del presente: pill explícita para volver (la única salida no puede ser secreta) */}
      {preview && !toast && (
        <button onClick={() => setPreview(null)}
          className="absolute left-1/2 -translate-x-1/2 top-[88px] z-30 glass rounded-[5px] h-9 px-4 flex items-center whitespace-nowrap text-[.78rem] font-medium leading-none"
          style={{ borderColor: 'var(--warn)', color: 'var(--warn)' }}>
          Día {effDay} · Volver a hoy
        </button>
      )}

      {/* toast (con "Deshacer" cuando la última acción se puede revertir) */}
      <div className={`absolute left-1/2 -translate-x-1/2 top-[92px] z-40 glass rounded-[5px] pl-4 text-[.78rem] font-semibold text-center flex items-center transition-all duration-300 ${toast ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3 pointer-events-none'} ${toast && pendingUndo ? 'pr-0' : 'pr-4 py-2'}`} style={{ maxWidth: '82%' }}>
        <span className={toast && pendingUndo ? 'py-2' : undefined}>{toast}</span>
        {toast && pendingUndo && (
          <button onClick={runUndo} className="ml-3 px-3 font-semibold self-stretch flex items-center"
            style={{ color: 'var(--blue)', minHeight: 36, borderLeft: '1px solid rgba(255,255,255,.16)', background: 'none' }}>Deshacer</button>
        )}
      </div>

      {/* panel inferior: cosechar · estado · dock de vitales
          (pointer-events-none en el contenedor: sus zonas transparentes no deben
          robarle taps al hotspot de riego; cada hijo interactivo re-activa los suyos) */}
      <div className="absolute left-4 right-4 bottom-3 z-20 flex flex-col gap-2 pointer-events-none">
        {!preview && (c.stage === 'cosecha' || done) && (
          confirmHarvest && c.stage === 'cosecha' ? (
            <div className="glass rounded-[5px] px-4 py-3 text-center self-center pointer-events-auto" style={{ maxWidth: 360 }}>
              <div className="display font-semibold text-[.9rem] mb-1">¿Cortamos ya?</div>
              <p className="text-[.8rem] mb-3 leading-snug" style={{ color: 'var(--muted)' }}>
                Mira los tricomas con lupa: lechosos dan más potencia, ámbar un efecto más relajado. Al cosechar se cierra el cultivo.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmHarvest(false)} className="abtn ghost flex-1">Todavía no</button>
                <button onClick={() => { setConfirmHarvest(false); harvest() }} className="abtn flex-1">Sí, cosechar</button>
              </div>
            </div>
          ) : done && !c.finishedTs ? (
            // secando: el ciclo aún no cierra — Terminar es la acción principal
            <div className="flex gap-2 self-center pointer-events-auto">
              <button onClick={startNew} className="abtn ghost">Nuevo cultivo</button>
              <button onClick={() => setShowFinish(true)} className="abtn">Terminar cultivo</button>
            </div>
          ) : done ? (
            <button onClick={startNew} className="abtn self-center pointer-events-auto">Nuevo cultivo</button>
          ) : (
            <button onClick={() => setConfirmHarvest(true)} className="abtn self-center pointer-events-auto">Cosechar</button>
          )
        )}

        {/* caption de estado: qué pasa y qué se puede tocar (el texto vive en statusText) */}
        {!preview && (
          <div className="flex items-center justify-center gap-2 text-[.8rem] font-medium pointer-events-none"
            style={{ color: '#fff', textShadow: '0 1px 8px rgba(0,0,0,.85)' }}>
            <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: 'var(--blue)' }} />
            <span>{statusText(c, view)}</span>
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
                const markerPct = showReading && range ? Math.min(98, Math.max(2, 28 + (44 * (reading! - range.lo)) / (range.hi - range.lo || 1))) : 50
                return (
                <button key={m.key} disabled={preview || noTarget} onClick={() => setMeasureKey(m.key)}
                  className="tile relative flex-1 min-w-[30%] text-left"
                  style={{ opacity: preview ? 0.45 : noTarget ? 0.5 : 1 }}>
                  <div className="label">{m.label}</div>
                  <div className="mono text-[1.2rem] font-medium leading-none mt-1.5" style={{ color: showReading ? color : 'var(--text)' }}>
                    {noTarget ? '—' : showReading ? fmtVal(reading!, m.dec) : fmtRange(range, m.dec)}
                  </div>
                  <div className="relative mt-2" style={{ height: 2, background: 'rgba(255,255,255,.14)' }}>
                    {!noTarget && <div className="absolute" style={{ left: '28%', width: '44%', height: 2, background: 'rgba(255,255,255,.35)' }} />}
                    {showReading && <div className="absolute" style={{ left: `calc(${markerPct}% - 2px)`, top: -2, width: 4, height: 6, background: color }} />}
                  </div>
                  {showReading && <div className="label mt-1.5">meta {fmtRange(range, m.dec)}</div>}
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
            <div className="coach-tip"><b>Toca las plantas</b> para regar.</div>
          </div>
          <div className="absolute left-6 right-6 text-center pointer-events-none" style={{ bottom: '112px' }}>
            <div className="coach-tip">Abajo tienes los <b>objetivos de la etapa</b>. Toca una métrica para anotar tu lectura.</div>
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
      {showLight && <LightSheet onClose={() => setShowLight(false)} />}
      {measureKey && <Measure metric={measureKey} onClose={() => setMeasureKey(null)} />}
      {intro && <Intro onDone={() => setIntro(false)} />}

      <style>{`
        .escena-viva{animation:respira 16s ease-in-out infinite alternate;transform-origin:50% 62%;will-change:transform}
        .tinte{position:absolute;inset:0;pointer-events:none;mix-blend-mode:multiply;transition:opacity .8s ease;clip-path:polygon(5% 5.5%,69% 5.5%,76% 7.5%,80.5% 12%,80.5% 93.5%,5% 93.5%)}
        .tinte-frio{background:radial-gradient(ellipse at 50% 38%,rgba(150,195,255,.95),rgba(90,140,255,.85) 75%)}
        .tinte-calor{background:radial-gradient(ellipse at 50% 38%,rgba(255,170,110,.95),rgba(255,110,60,.85) 75%)}
        @keyframes respira{from{transform:scale(1)}to{transform:scale(1.035)}}
        .aparece{animation:aparece .7s ease-out both}
        @keyframes aparece{from{opacity:0}to{opacity:1}}
        @media (prefers-reduced-motion:reduce){.escena-viva,.aparece{animation:none}}
        .cenname{position:absolute;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.6);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.3);color:#fff;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:.6rem;letter-spacing:.14em;text-transform:uppercase;padding:.3rem .7rem;border-radius:5px;white-space:nowrap}
        .tbtn{height:36px;padding:0 .75rem;border-radius:5px;background:rgba(0,0,0,.5);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.3);color:#fff;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap}
        .tbtn-ico{width:36px;padding:0}
        .abtn{height:40px;padding:0 1.25rem;border-radius:5px;border:1px solid #fff;background:#fff;color:#000;font-family:'Sora',system-ui,sans-serif;font-weight:600;font-size:.85rem;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;cursor:pointer}
        .abtn.ghost{background:rgba(0,0,0,.5);backdrop-filter:blur(12px);border-color:rgba(255,255,255,.4);color:#fff;font-family:'Instrument Sans',system-ui,sans-serif;font-weight:500}
        .tile{background:rgba(0,0,0,.6);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.14);border-radius:5px;padding:10px 12px}
        .tbtn:active{background:rgba(255,255,255,.14)}
        .tbtn:disabled{opacity:.45}
        .dock-row{scrollbar-width:none;-ms-overflow-style:none;scroll-snap-type:x proximity}
        .dock-row::-webkit-scrollbar{display:none}
        .dock-row>button{scroll-snap-align:start}
        .coach-ring{display:block;width:64px;height:64px;border-radius:50%;border:2px solid var(--acc);box-shadow:0 0 24px var(--glow);animation:coachPulse 1.6s ease-out infinite}
        @keyframes coachPulse{0%{transform:scale(.7);opacity:.95}70%{transform:scale(1.25);opacity:.18}100%{transform:scale(1.35);opacity:0}}
        .coach-tip{display:inline-block;background:rgba(8,14,11,.8);backdrop-filter:blur(14px);border:1px solid var(--glass-bd);border-radius:5px;padding:.6rem .95rem;font-size:.8rem;line-height:1.45;color:var(--text)}
        .coach-tip b{color:var(--acc2);font-weight:700}
        .coach-ok{position:absolute;left:50%;transform:translateX(-50%);bottom:40px;height:40px;padding:0 1.5rem;border:none;border-radius:5px;font-family:'Sora',system-ui,sans-serif;font-weight:600;font-size:.85rem;cursor:pointer;background:#fff;color:#000}
        @media (prefers-reduced-motion: reduce){.coach-ring{animation:none}}
      `}</style>
    </div>
  )
}
