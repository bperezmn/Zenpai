import { useState } from 'react'
import { useStore } from '../store'
import { stageAt, stageLabel, type Substrate, type SeedType } from '../lib'
import NutrientesPicker from './NutrientesPicker'

const SIZES = [
  { cm: '40 × 40 cm', plants: 1, cap: '1 planta' },
  { cm: '60 × 60 cm', plants: 2, cap: '2 plantas' },
  { cm: '80 × 80 cm', plants: 3, cap: '3 plantas' },
  { cm: '100 × 100 cm', plants: 4, cap: '4 plantas · muestra 3' },
  { cm: '120 × 120 cm', plants: 5, cap: '5 plantas · muestra 3' },
]
const SUBS: { id: Substrate; label: string }[] = [
  { id: 'tierra', label: 'Tierra'},
  { id: 'coco', label: 'Coco'},
  { id: 'hidro', label: 'Hidro'},
]
const POTS = [4, 7, 11, 19, 25] // litros por maceta

// "¿hace cuánto germinó?" para registrar una planta que ya crece
const AGES = [
  { w: 1, label: '1 sem' }, { w: 2, label: '2 sem' }, { w: 4, label: '1 mes' },
  { w: 6, label: '6 sem' }, { w: 9, label: '2 meses' }, { w: 13, label: '3 meses' },
]
const FLOWER_AGES = [
  { w: 1, label: '~1 sem' }, { w: 2, label: '~2 sem' }, { w: 3, label: '~3 sem' },
  { w: 4, label: '~1 mes' }, { w: 6, label: '~6 sem' }, { w: 8, label: '~2 meses' },
]

function nextName(n: number): string {
  return n < 26 ? 'Carpa ' + String.fromCharCode(65 + n) : 'Carpa ' + (n + 1)
}

export default function ConfigScreen() {
  const createGrow = useStore((s) => s.createGrow)
  const registerExisting = useStore((s) => s.registerExisting)
  const cancelNew = useStore((s) => s.cancelNew)
  const [mode, setMode] = useState<'semilla' | 'planta'>('semilla')
  const [name, setName] = useState(() => nextName(useStore.getState().grows.length))
  const [plants, setPlants] = useState(3)
  const [sub, setSub] = useState<Substrate>('tierra')
  const [seedType, setSeedType] = useState<SeedType>('foto')
  const [potL, setPotL] = useState(11)
  const [nut, setNut] = useState<string | null>(null)
  const [weeksAgo, setWeeksAgo] = useState(4)
  const [flowerWeeks, setFlowerWeeks] = useState<number | null>(null) // null = aún en veg

  const existing = mode === 'planta'
  // vista previa honesta de dónde aterrizará la carpa al registrar
  const prevDay = weeksAgo * 7
  const prevGerm = Date.now() - prevDay * 86400000
  const prevStage = stageAt(
    { seedType, germTs: prevGerm, flowerTs: seedType === 'foto' && flowerWeeks != null ? Date.now() - flowerWeeks * 7 * 86400000 : null },
    prevDay,
  )
  // el 12/12 no puede ser anterior a la germinación
  const flowerOptions = FLOWER_AGES.filter((f) => f.w < weeksAgo)

  function submit() {
    if (!existing) { createGrow({ grow: name, plants, substrate: sub, potL, seedType, nutrientesId: nut }); return }
    registerExisting({
      grow: name, plants, substrate: sub, potL, seedType, weeksAgo, nutrientesId: nut,
      flowerWeeksAgo: seedType === 'foto' ? flowerWeeks : null,
    })
  }

  return (
    <div className="absolute inset-0" style={{ background: '#000' }}>
      {/* el Volver vive FUERA del scroller: siempre a mano aunque el formulario sea largo */}
      <button onClick={cancelNew} aria-label="Volver a tus cultivos" title="Volver" className="back">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <div className="absolute inset-0 overflow-y-auto px-6 pb-8 pt-[104px] flex flex-col">
      <div className="label mb-2">Configura tu carpa</div>
      <h2 className="display text-[1.75rem] font-semibold leading-tight mb-1">Nuevo cultivo</h2>

      {/* ¿de cero o ya en marcha? */}
      <div className="flex gap-[7px] mt-3 mb-4">
        <button onClick={() =>setMode( 'semilla')} className={`sub ${!existing ? 'on': ''}`}>Desde semilla</button>
        <button onClick={() =>setMode( 'planta')} className={`sub ${existing ? 'on': ''}`}>Ya tengo una planta</button>
      </div>

      <label className="lbl">Nombre del cultivo</label>
      <input className="inp mb-4" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />

      <label className="lbl mb-2 block">Tamaño de tu carpa <span style={{ color: 'var(--faint)', textTransform: 'none', letterSpacing: 0 }}>→ nº de plantas</span></label>
      <div className="space-y-[7px]">
        {SIZES.map((s) => (
          <button key={s.plants} onClick={() => setPlants(s.plants)}
            className={`size ${plants === s.plants ? 'on' : ''}`}>
            <span>{s.cm}</span><span className="cap">{s.cap}</span>
          </button>
        ))}
      </div>

      <label className="lbl mt-4 mb-2 block">Tipo de semilla <span style={{ color: 'var(--faint)', textTransform: 'none', letterSpacing: 0 }}>→ define cuándo florece</span></label>
      <div className="flex gap-[7px]">
        <button onClick={() =>setSeedType( 'foto')} className={`sub ${seedType === 'foto'? 'on': ''}`}>Fotoperiódica</button>
        <button onClick={() =>{ setSeedType( 'auto'); setFlowerWeeks(null) }} className={`sub ${seedType === 'auto'? 'on': ''}`}>Autofloreciente</button>
      </div>
      <p className="text-[.64rem] mt-1.5" style={{ color: 'var(--faint)' }}>
        {seedType === 'foto'
          ? 'Florece cuando TÚ cambias la luz a 12 h de luz / 12 h de oscuridad. Si no sabes cuál es, casi seguro es esta.'
          : 'Florece sola (~día 32) sin cambiar la luz. Ciclo corto, ~75 días en total.'}
      </p>

      <label className="lbl mt-4 mb-2 block">Sustrato</label>
      <div className="flex gap-[7px]">
        {SUBS.map((s) => (
          <button key={s.id} onClick={() => setSub(s.id)} className={`sub ${sub === s.id ? 'on' : ''}`}>{s.label}</button>
        ))}
      </div>

      <label className="lbl mt-4 mb-2 block">Nutrientes <span style={{ color: 'var(--faint)', textTransform: 'none', letterSpacing: 0 }}>→ tu plan de abono, dosis por riego</span></label>
      <NutrientesPicker value={nut} onChange={setNut} substrate={sub} chipClass="sub" />

      <label className="lbl mt-4 mb-2 block">Tamaño de maceta <span style={{ color: 'var(--faint)', textTransform: 'none', letterSpacing: 0 }}>→ para calcular el riego</span></label>
      <div className="flex gap-[7px]">
        {POTS.map((L) => (
          <button key={L} onClick={() => setPotL(L)} className={`sub ${potL === L ? 'on' : ''}`}>{L} L</button>
        ))}
      </div>

      {existing && (
        <>
          <label className="lbl mt-4 mb-2 block">¿Hace cuánto germinó? <span style={{ color: 'var(--faint)', textTransform: 'none', letterSpacing: 0 }}>→ aproximado está bien</span></label>
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

      <button className="cbtn mt-5" onClick={submit}>{existing ? 'Registrar mi planta': 'Germinar'}</button>
      <p className="text-center text-[.66rem] mt-2.5" style={{ color: 'var(--faint)' }}>
        {existing
          ? `Tu carpa abrirá en el día ~${prevDay} · ${stageLabel[prevStage]}.`
          : `Pondremos ${plants} ${plants === 1 ? 'semilla' : 'semillas'} a germinar en agua.`}
      </p>
      </div>

      <style>{`
        .back{position:absolute;left:16px;top:52px;z-index:10;width:44px;height:44px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.28);border-radius:5px;background:transparent;color:#fff;cursor:pointer}
        .lbl{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:var(--faint);display:block;margin-bottom:6px}
        .inp{background:transparent;border:1px solid rgba(255,255,255,.28);border-radius:5px;padding:.7rem .8rem;color:var(--text);width:100%;font-size:1rem;font-family:'Instrument Sans',system-ui,sans-serif}
        .inp:focus{outline:none;border-color:#fff}
        .size{display:flex;align-items:center;justify-content:space-between;width:100%;background:transparent;border:1px solid rgba(255,255,255,.18);border-radius:5px;padding:.75rem .9rem;cursor:pointer;color:var(--text);font-weight:500;font-size:.9rem;font-family:'Instrument Sans',system-ui,sans-serif;transition:.15s}
        .size.on{border-color:#fff;background:rgba(255,255,255,.06)}
        .size .cap{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;color:var(--faint)}
        .size.on .cap{color:#fff}
        .sub{flex:1;text-align:center;background:transparent;border:1px solid rgba(255,255,255,.18);border-radius:5px;padding:.65rem .3rem;cursor:pointer;color:var(--muted);font-weight:500;font-size:.82rem;font-family:'Instrument Sans',system-ui,sans-serif;transition:.15s}
        .sub.on{border-color:#fff;color:#fff;background:rgba(255,255,255,.06)}
        .cbtn{width:100%;border:none;border-radius:5px;font-weight:600;height:52px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:.95rem;letter-spacing:.02em;cursor:pointer;background:#fff;color:#000}
      `}</style>
    </div>
  )
}
