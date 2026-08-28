import { useState } from 'react'
import { useStore } from '../store'
import { Logo } from '../App'
import { stageAt, stageLabel, type Substrate, type SeedType } from '../lib'

const SIZES = [
  { cm: '40 × 40 cm', plants: 1, cap: '1 planta' },
  { cm: '60 × 60 cm', plants: 2, cap: '2 plantas' },
  { cm: '80 × 80 cm', plants: 3, cap: '3 plantas' },
  { cm: '100 × 100 cm', plants: 4, cap: '4 plantas · muestra 3' },
  { cm: '120 × 120 cm', plants: 5, cap: '5 plantas · muestra 3' },
]
const SUBS: { id: Substrate; label: string }[] = [
  { id: 'tierra', label: '🟤 Tierra' },
  { id: 'coco', label: '🥥 Coco' },
  { id: 'hidro', label: '💧 Hidro' },
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
    if (!existing) { createGrow({ grow: name, plants, substrate: sub, potL, seedType }); return }
    registerExisting({
      grow: name, plants, substrate: sub, potL, seedType, weeksAgo,
      flowerWeeksAgo: seedType === 'foto' ? flowerWeeks : null,
    })
  }

  return (
    <div className="absolute inset-0"
      style={{ background: 'radial-gradient(80% 45% at 50% 14%, rgba(52,211,153,.12), transparent 60%), linear-gradient(180deg,#0a1210,#05080b)' }}>
      {/* el Volver vive FUERA del scroller: siempre a mano aunque el formulario sea largo */}
      <button onClick={cancelNew} className="absolute left-4 top-5 z-10 h-9 px-3.5 rounded-2xl glass text-white/85"
        style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: '.72rem' }}>Volver</button>
      <div className="absolute inset-0 overflow-y-auto px-6 pb-8 pt-14 flex flex-col">
      <div className="mx-auto mb-3"><Logo size={50} /></div>
      <h2 className="display text-center text-[1.45rem] font-bold">Nuevo cultivo</h2>

      {/* ¿de cero o ya en marcha? */}
      <div className="flex gap-[7px] mt-3 mb-4">
        <button onClick={() => setMode('semilla')} className={`sub ${!existing ? 'on' : ''}`}>🫘 Desde semilla</button>
        <button onClick={() => setMode('planta')} className={`sub ${existing ? 'on' : ''}`}>🌱 Ya tengo una planta</button>
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
        <button onClick={() => setSeedType('foto')} className={`sub ${seedType === 'foto' ? 'on' : ''}`}>🌞 Fotoperiódica</button>
        <button onClick={() => { setSeedType('auto'); setFlowerWeeks(null) }} className={`sub ${seedType === 'auto' ? 'on' : ''}`}>⚡ Autofloreciente</button>
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

      <button className="cbtn mt-5" onClick={submit}>{existing ? '🌱 Registrar mi planta' : '🌱 Germinar'}</button>
      <p className="text-center text-[.66rem] mt-2.5" style={{ color: 'var(--faint)' }}>
        {existing
          ? `Tu carpa abrirá en el día ~${prevDay} · ${stageLabel[prevStage]}.`
          : `Pondremos ${plants} ${plants === 1 ? 'semilla' : 'semillas'} a germinar en agua.`}
      </p>
      </div>

      <style>{`
        .lbl{font-size:.62rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);font-family:'Space Grotesk';display:block;margin-bottom:6px}
        .inp{background:rgba(255,255,255,.05);border:1px solid var(--glass-bd);border-radius:12px;padding:.6rem .75rem;color:var(--text);width:100%;font-size:.9rem}
        .size{display:flex;align-items:center;justify-content:space-between;width:100%;background:rgba(255,255,255,.04);border:1px solid var(--glass-bd);border-radius:13px;padding:.7rem .9rem;cursor:pointer;color:var(--text);font-weight:600;font-size:.86rem;font-family:'Space Grotesk';transition:.15s}
        .size.on{background:linear-gradient(135deg,rgba(52,211,153,.22),rgba(190,242,100,.1));border-color:var(--acc)}
        .size .cap{font-size:.68rem;color:var(--faint);font-weight:600}
        .size.on .cap{color:var(--acc)}
        .sub{flex:1;text-align:center;background:rgba(255,255,255,.04);border:1px solid var(--glass-bd);border-radius:12px;padding:.6rem .3rem;cursor:pointer;color:var(--text);font-weight:600;font-size:.8rem;font-family:'Space Grotesk';transition:.15s}
        .sub.on{background:linear-gradient(135deg,rgba(52,211,153,.22),rgba(190,242,100,.1));border-color:var(--acc);color:var(--acc)}
        .cbtn{width:100%;border:none;border-radius:15px;font-weight:700;padding:.85rem;font-family:'Space Grotesk';font-size:.92rem;cursor:pointer;background:linear-gradient(135deg,var(--acc),var(--acc2));color:#04150c}
      `}</style>
    </div>
  )
}
