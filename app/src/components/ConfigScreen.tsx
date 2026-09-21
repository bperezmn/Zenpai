import { useState } from 'react'
import { useStore } from '../store'
import { stageAt, stageLabel, fmtHour, type Substrate, type SeedType, type PotType } from '../lib'
import { lineaPorId } from '../data/nutrientes'
import NutrientesPicker from './NutrientesPicker'

const SIZES = [
  { cm: '40 × 40 cm', plants: 1, cap: '1 planta' },
  { cm: '60 × 60 cm', plants: 2, cap: '2 plantas' },
  { cm: '80 × 80 cm', plants: 3, cap: '3 plantas' },
  { cm: '100 × 100 cm', plants: 4, cap: '4 plantas · muestra 3' },
  { cm: '120 × 120 cm', plants: 5, cap: '5 plantas · muestra 3' },
]
const SUBS: { id: Substrate; label: string }[] = [
  { id: 'tierra', label: 'Tierra' },
  { id: 'coco', label: 'Coco' },
  { id: 'hidro', label: 'Hidro' },
]
const POTS = [4, 7, 11, 19, 25] // litros por maceta
const POT_TYPES: { id: PotType; label: string; hint: string }[] = [
  { id: 'tela', label: 'Tela', hint: 'respira y seca rápido' },
  { id: 'plastico', label: 'Plástico', hint: 'retiene más agua' },
]

// "¿hace cuánto germinó?" para registrar una planta que ya crece
const AGES = [
  { w: 1, label: '1 sem' }, { w: 2, label: '2 sem' }, { w: 4, label: '1 mes' },
  { w: 6, label: '6 sem' }, { w: 9, label: '2 meses' }, { w: 13, label: '3 meses' },
]
const FLOWER_AGES = [
  { w: 1, label: '~1 sem' }, { w: 2, label: '~2 sem' }, { w: 3, label: '~3 sem' },
  { w: 4, label: '~1 mes' }, { w: 6, label: '~6 sem' }, { w: 8, label: '~2 meses' },
]
const PASOS = ['Cómo empezamos', 'Tu carpa', 'Maceta y sustrato', 'Nutrientes', 'Luz', 'Semilla']

function nextName(n: number): string {
  return n < 26 ? 'Carpa ' + String.fromCharCode(65 + n) : 'Carpa ' + (n + 1)
}

// Alta de un cultivo en pasos (uno por pantalla, sin amontonar): modo → carpa → maceta y
// sustrato → nutrientes → luz → semilla, con resumen y el botón final.
export default function ConfigScreen() {
  const createGrow = useStore((s) => s.createGrow)
  const registerExisting = useStore((s) => s.registerExisting)
  const cancelNew = useStore((s) => s.cancelNew)
  const [step, setStep] = useState(0)
  const [mode, setMode] = useState<'semilla' | 'planta'>('semilla')
  const [name, setName] = useState(() => nextName(useStore.getState().grows.length))
  const [plants, setPlants] = useState(3)
  const [sub, setSub] = useState<Substrate>('tierra')
  const [seedType, setSeedType] = useState<SeedType>('foto')
  const [potL, setPotL] = useState(11)
  const [potType, setPotType] = useState<PotType>('tela')
  const [nut, setNut] = useState<string | null>(null)
  const [lightOn, setLightOn] = useState(6)
  const [ctrl, setCtrl] = useState(false)
  const [weeksAgo, setWeeksAgo] = useState(4)
  const [flowerWeeks, setFlowerWeeks] = useState<number | null>(null) // null = aún en veg

  const existing = mode === 'planta'
  const last = step === PASOS.length - 1
  // vista previa honesta de dónde aterrizará la carpa al registrar
  const prevDay = weeksAgo * 7
  const prevGerm = Date.now() - prevDay * 86400000
  const prevStage = stageAt(
    { seedType, germTs: prevGerm, flowerTs: seedType === 'foto' && flowerWeeks != null ? Date.now() - flowerWeeks * 7 * 86400000 : null },
    prevDay,
  )
  // el 12/12 no puede ser anterior a la germinación
  const flowerOptions = FLOWER_AGES.filter((f) => f.w < weeksAgo)
  const linea = lineaPorId(nut)

  function submit() {
    const base = { grow: name, plants, substrate: sub, potL, potType, seedType, nutrientesId: nut, lightOnHour: lightOn, hasController: ctrl }
    if (!existing) { createGrow(base); return }
    registerExisting({ ...base, weeksAgo, flowerWeeksAgo: seedType === 'foto' ? flowerWeeks : null })
  }
  // ayuda de cada paso: una línea de texto normal debajo del título, nunca dentro de la etiqueta
  const help = (t: string) => <p className="text-[.78rem] mb-3" style={{ color: 'var(--muted)' }}>{t}</p>

  return (
    <div className="absolute inset-0" style={{ background: '#000' }}>
      <button onClick={() => (step === 0 ? cancelNew() : setStep(step - 1))} aria-label={step === 0 ? 'Volver a tus cultivos' : 'Paso anterior'} title="Atrás" className="back">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <div className="absolute inset-0 overflow-y-auto px-6 pb-36 pt-[104px] flex flex-col">
        <div className="label mb-2">Paso {step + 1} de {PASOS.length} · Nuevo cultivo</div>
        <h2 className="display text-[1.75rem] font-semibold leading-tight mb-1">{PASOS[step]}</h2>
        <div className="flex gap-1 mt-3 mb-6">
          {PASOS.map((_, i) => <span key={i} style={{ flex: 1, height: 2, background: i <= step ? '#fff' : 'rgba(255,255,255,.18)' }} />)}
        </div>

        {step === 0 && (
          <>
            <div className="flex gap-[7px] mb-5">
              <button onClick={() => setMode('semilla')} className={`sub ${!existing ? 'on' : ''}`}>Desde semilla</button>
              <button onClick={() => setMode('planta')} className={`sub ${existing ? 'on' : ''}`}>Ya tengo una planta</button>
            </div>
            <p className="text-[.8rem] mb-5" style={{ color: 'var(--muted)' }}>
              {existing ? 'Registramos una planta que ya está creciendo: te preguntaremos su edad al final.' : 'Empezamos poniendo las semillas a germinar en agua; el resto llega solo.'}
            </p>
            <label className="lbl">Nombre del cultivo</label>
            <input className="inp" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
          </>
        )}

        {step === 1 && (
          <>
            <label className="lbl block">Tamaño de tu carpa</label>
            {help('Define cuántas plantas caben.')}
            <div className="space-y-[7px]">
              {SIZES.map((s) => (
                <button key={s.plants} onClick={() => setPlants(s.plants)} className={`size ${plants === s.plants ? 'on' : ''}`}>
                  <span>{s.cm}</span><span className="cap">{s.cap}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <label className="lbl block">Tipo de maceta</label>
            {help('Cambia cada cuánto se riega.')}
            <div className="space-y-[7px] mb-5">
              {POT_TYPES.map((t) => (
                <button key={t.id} onClick={() => setPotType(t.id)} className={`size ${potType === t.id ? 'on' : ''}`}>
                  <span>{t.label}</span><span className="cap">{t.hint}</span>
                </button>
              ))}
            </div>
            <label className="lbl block">Tamaño de maceta</label>
            {help('Con esto calculamos el riego.')}
            <div className="flex gap-[7px] mb-5">
              {POTS.map((L) => (
                <button key={L} onClick={() => setPotL(L)} className={`sub ${potL === L ? 'on' : ''}`}>{L} L</button>
              ))}
            </div>
            <label className="lbl mb-2 block">Sustrato</label>
            <div className="flex gap-[7px]">
              {SUBS.map((s) => (
                <button key={s.id} onClick={() => { setSub(s.id); if (linea && !linea.sustratos.includes(s.id)) setNut(null) }} className={`sub ${sub === s.id ? 'on' : ''}`}>{s.label}</button>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <label className="lbl block">Tu línea de nutrientes</label>
            {help('Con ella te damos la dosis exacta en cada riego.')}
            <NutrientesPicker value={nut} onChange={setNut} substrate={sub} chipClass="sub" />
            <p className="text-[.78rem] mt-3" style={{ color: 'var(--faint)' }}>Si tu marca no está, elige «Solo agua / otra marca»: la ficha de riego te dará agua, pH y EC objetivo.</p>
          </>
        )}

        {step === 4 && (
          <>
            <label className="lbl mb-2 block">Hora de encendido</label>
            <div className="flex items-center gap-3 mb-2">
              <input type="time" step={3600} value={`${String(lightOn).padStart(2, '0')}:00`}
                onChange={(e) => { const h = parseInt(e.target.value.slice(0, 2), 10); if (!Number.isNaN(h)) setLightOn(h) }} className="inp" style={{ width: 150, fontFamily: "'IBM Plex Mono', monospace", colorScheme: 'dark' }} />
              <div className="mono text-[.82rem]" style={{ color: 'var(--muted)' }}>{fmtHour(lightOn)} → {fmtHour((lightOn + 18) % 24)}</div>
            </div>
            <p className="text-[.78rem] mb-5" style={{ color: 'var(--muted)' }}>Se apaga sola según la etapa: 18 h en crecimiento, 12 h en floración. Lo puedes cambiar en la carpa.</p>
            <label className="size cursor-pointer" style={{ borderColor: ctrl ? '#fff' : undefined }}>
              <span className="flex items-center gap-3">
                <input type="checkbox" checked={ctrl} onChange={(e) => setCtrl(e.target.checked)} style={{ width: 20, height: 20, margin: 0, accentColor: '#1F73B7' }} />
                Tengo temporizador o controlador
              </span>
            </label>
            <p className="text-[.78rem] mt-3" style={{ color: 'var(--muted)' }}>{ctrl ? 'Con temporizador no te avisamos de la luz.' : 'Sin temporizador, te avisamos a la hora de encender y de apagar la luz.'}</p>
          </>
        )}

        {step === 5 && (
          <>
            <label className="lbl block">Tipo de semilla</label>
            {help('Define cuándo florece.')}
            <div className="flex gap-[7px]">
              <button onClick={() => setSeedType('foto')} className={`sub ${seedType === 'foto' ? 'on' : ''}`}>Fotoperiódica</button>
              <button onClick={() => { setSeedType('auto'); setFlowerWeeks(null) }} className={`sub ${seedType === 'auto' ? 'on' : ''}`}>Autofloreciente</button>
            </div>
            <p className="text-[.78rem] mt-2" style={{ color: 'var(--muted)' }}>
              {seedType === 'foto'
                ? 'Florece cuando tú cambias la luz a 12/12. Si no sabes cuál es, casi seguro es esta.'
                : 'Florece sola hacia el día 32, sin cambiar la luz. Ciclo corto, unos 75 días en total.'}
            </p>

            {existing && (
              <>
                <label className="lbl mt-4 block">¿Hace cuánto germinó?</label>
                {help('Aproximado está bien.')}
                <div className="grid grid-cols-3 gap-[7px]">
                  {AGES.map((a) => (
                    <button key={a.w} onClick={() => { setWeeksAgo(a.w); if (flowerWeeks != null && flowerWeeks >= a.w) setFlowerWeeks(null) }}
                      className={`sub ${weeksAgo === a.w ? 'on' : ''}`}>{a.label}</button>
                  ))}
                </div>
                {seedType === 'foto' && flowerOptions.length > 0 && (
                  <>
                    <label className="lbl mt-4 mb-2 block">¿Ya está en floración (12/12)?</label>
                    <div className="grid grid-cols-3 gap-[7px]">
                      <button onClick={() => setFlowerWeeks(null)} className={`sub ${flowerWeeks === null ? 'on' : ''}`}>Aún no</button>
                      {flowerOptions.map((f) => (
                        <button key={f.w} onClick={() => setFlowerWeeks(f.w)} className={`sub ${flowerWeeks === f.w ? 'on' : ''}`}>{f.label}</button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            <div className="mt-6 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,.12)' }}>
              <div className="label mb-2">Resumen</div>
              <div className="text-[.8rem] leading-relaxed" style={{ color: 'var(--muted)' }}>
                {name || 'Carpa'} · {plants} {plants === 1 ? 'planta' : 'plantas'} · maceta de {POT_TYPES.find((t) => t.id === potType)!.label.toLowerCase()} de {potL} L · {SUBS.find((s) => s.id === sub)!.label.toLowerCase()} · {linea ? linea.marca : 'solo agua'} · luz {fmtHour(lightOn)}{ctrl ? ' con controlador' : ''}.
                {existing ? ` Tu carpa abrirá en el día ${prevDay} aproximadamente, en ${stageLabel[prevStage].toLowerCase()}.` : ` Pondremos ${plants} ${plants === 1 ? 'semilla' : 'semillas'} a germinar en agua.`}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="absolute left-0 right-0 bottom-0 px-6 pt-3 pb-8 flex gap-2" style={{ background: '#000' }}>
        {step > 0 && <button onClick={() => setStep(step - 1)} className="gbtn flex-1">Atrás</button>}
        {last
          ? <button className="cbtn flex-1" onClick={submit}>{existing ? 'Registrar mi planta' : 'Germinar'}</button>
          : <button className="cbtn flex-1" onClick={() => setStep(step + 1)} disabled={step === 0 && !name.trim()}>Siguiente</button>}
      </div>

      <style>{`
        .back{position:absolute;left:16px;top:52px;z-index:10;width:44px;height:44px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.28);border-radius:5px;background:#000;color:#fff;cursor:pointer}
        .lbl{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:var(--faint);display:block;margin-bottom:6px}
        .inp{background:transparent;border:1px solid rgba(255,255,255,.28);border-radius:5px;padding:.7rem .8rem;color:var(--text);width:100%;font-size:1rem;font-family:'Instrument Sans',system-ui,sans-serif}
        .inp:focus{outline:none;border-color:#fff}
        .size{display:flex;align-items:center;justify-content:space-between;width:100%;background:transparent;border:1px solid rgba(255,255,255,.18);border-radius:5px;padding:.75rem .9rem;cursor:pointer;color:var(--text);font-weight:500;font-size:.9rem;font-family:'Instrument Sans',system-ui,sans-serif;transition:.15s}
        .size.on{border-color:#fff;background:rgba(255,255,255,.06)}
        .size .cap{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;color:var(--faint)}
        .size.on .cap{color:#fff}
        .sub{flex:1;text-align:center;background:transparent;border:1px solid rgba(255,255,255,.18);border-radius:5px;padding:.65rem .3rem;cursor:pointer;color:var(--muted);font-weight:500;font-size:.82rem;font-family:'Instrument Sans',system-ui,sans-serif;transition:.15s}
        .sub.on{border-color:#fff;color:#fff;background:rgba(255,255,255,.06)}
        .cbtn{border:none;border-radius:5px;font-weight:600;height:52px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:.92rem;cursor:pointer;background:#fff;color:#000}
        .cbtn:disabled{opacity:.4}
        .gbtn{border:1px solid rgba(255,255,255,.4);border-radius:5px;font-weight:600;height:52px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:.92rem;cursor:pointer;background:rgba(0,0,0,.6);color:var(--text)}
      `}</style>
    </div>
  )
}
