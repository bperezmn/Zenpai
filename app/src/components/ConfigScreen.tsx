import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { stageAt, stageLabel, fmtHour, preloadIntro, harvestEta, autoDaysOf, autoFlowerDayOf, type Substrate, type SeedType, type PotType, type TierraAbonada } from '../lib'
import { lineaPorId, nutrientesPara, OTRA_MARCA } from '../data/nutrientes'
import { fuerzaAbono } from '../mentor'
import NutrientesPicker from './NutrientesPicker'

const SIZES = [
  { side: 40, cm: '40 × 40 cm', plants: 1, cap: '1 planta' },
  { side: 60, cm: '60 × 60 cm', plants: 2, cap: '2 plantas' },
  { side: 80, cm: '80 × 80 cm', plants: 3, cap: '3 plantas' },
  { side: 100, cm: '100 × 100 cm', plants: 4, cap: '4 plantas · muestra 3' },
  { side: 120, cm: '120 × 120 cm', plants: 5, cap: '5 plantas · muestra 3' },
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
// ¿la tierra del saco ya trae abono? "No sé" se trata como abonada (lo seguro)
const ABONADA: { id: TierraAbonada; label: string }[] = [
  { id: 'si', label: 'Sí' },
  { id: 'no', label: 'No' },
  { id: 'nose', label: 'No sé' },
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
// la semilla va antes que la luz: el horario depende de ella (una auto no pasa nunca a 12/12)
const PASOS = ['Cómo empezamos', 'Tu carpa', 'Maceta y sustrato', 'Nutrientes', 'Semilla', 'Luz']
// semanas de la variedad (vienen en el paquete o en la web del banco); null = no sé
const FLOWER_WEEKS = [7, 8, 9, 10, 11, 12]
const AUTO_WEEKS = [8, 9, 10, 11, 12, 13, 14]
const DIA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtFecha = (ts: number) => { const d = new Date(ts); return `${DIA[d.getDay()]} ${d.getDate()} ${MES[d.getMonth()]}` }

function nextName(n: number): string {
  return n < 26 ? 'Carpa ' + String.fromCharCode(65 + n) : 'Carpa ' + (n + 1)
}

// Alta de un cultivo en pasos (uno por pantalla, sin amontonar): modo → carpa → maceta y
// sustrato → nutrientes → semilla (con la cosecha estimada) → luz, con resumen y el botón final.
export default function ConfigScreen() {
  const createGrow = useStore((s) => s.createGrow)
  const registerExisting = useStore((s) => s.registerExisting)
  const cancelNew = useStore((s) => s.cancelNew)
  const [step, setStep] = useState(0)
  // cada paso empieza arriba (el de la semilla es largo; sin esto, Luz abriría a media página)
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => { scroller.current?.scrollTo(0, 0) }, [step])
  const [mode, setMode] = useState<'semilla' | 'planta'>('semilla')
  const [name, setName] = useState(() => nextName(useStore.getState().grows.length))
  const [plants, setPlants] = useState(3)
  const [tentCm, setTentCm] = useState(80)
  const [sub, setSub] = useState<Substrate>('tierra')
  // las fotos de la puerta (según macetas y sustrato) se descargan mientras rellena el alta
  useEffect(() => { preloadIntro(plants, sub) }, [plants, sub])
  const [seedType, setSeedType] = useState<SeedType>('foto')
  const [potL, setPotL] = useState(11)
  const [potType, setPotType] = useState<PotType>('tela')
  const [nut, setNut] = useState<string | null>(null)
  const [abonada, setAbonada] = useState<TierraAbonada>('nose')
  const guide = useStore((s) => s.guide)
  const [lightOn, setLightOn] = useState(6)
  const [ctrl, setCtrl] = useState(false)
  const [weeksAgo, setWeeksAgo] = useState(4)
  const [flipAgo, setFlipAgo] = useState<number | null>(null) // semanas desde el 12/12; null = aún en veg
  const [strain, setStrain] = useState('')
  const [breeder, setBreeder] = useState('')
  const [flowerWeeks, setFlowerWeeks] = useState<number | null>(null) // genética: semanas de flor (foto)
  const [autoWeeks, setAutoWeeks] = useState<number | null>(null)     // genética: semilla a cosecha (auto)

  const existing = mode === 'planta'
  const last = step === PASOS.length - 1
  // vista previa honesta de dónde aterrizará la carpa al registrar
  const prevDay = weeksAgo * 7
  const prevGerm = Date.now() - prevDay * 86400000
  const prevFlower = seedType === 'foto' && flipAgo != null ? Date.now() - flipAgo * 7 * 86400000 : null
  const prevStage = stageAt({ seedType, germTs: prevGerm, flowerTs: prevFlower, flowerWeeks, autoWeeks }, prevDay)
  // cosecha estimada: auto desde su germinación (semilla nueva: tras ~2 días de remojo, como
  // asume registerExisting) o desde su edad; foto solo con el 12/12 hecho
  const auto = seedType === 'auto'
  const weeks = auto ? autoWeeks : flowerWeeks
  const setWeeks = auto ? setAutoWeeks : setFlowerWeeks
  const eta = harvestEta({ seedType, germTs: existing ? prevGerm : Date.now() + 2 * 86400000, flowerTs: existing ? prevFlower : null, flowerWeeks, autoWeeks })
  // el 12/12 no puede ser anterior a la germinación
  const flowerOptions = FLOWER_AGES.filter((f) => f.w < weeksAgo)
  const linea = lineaPorId(nut)
  // la fuerza del abono según el nivel (gratis): en tierra sobre la tabla; en coco e hidro, la EC manda
  const fuerza = fuerzaAbono(guide, 'veg', sub)
  // (la regla es gratis y funciona sin Premium: la fuerza sobre la dosis de la etiqueta)
  const fuerzaTxt = sub !== 'tierra'
    ? `En ${sub === 'coco' ? 'coco' : 'hidro'} manda la EC: empiezas con ${fuerza <= 0.5 ? 'la mitad' : 'tres cuartos'} de la dosis de la etiqueta y subes midiendo.`
    : fuerza <= 0.5 ? 'Como vas empezando, usa la mitad de la dosis de la etiqueta (menos aún en plántula): es lo seguro. En cada riego te decimos qué fuerza usar.'
    : fuerza < 1 ? 'Usa tres cuartos de la dosis de la etiqueta. En cada riego te decimos qué fuerza usar.' : 'Usa la dosis de la etiqueta. En cada riego te decimos qué fuerza usar.'
  const abonoTxt = linea ? linea.marca : nut === OTRA_MARCA ? 'otra marca' : 'solo agua'
  // horas de luz con las que arranca (el horario automático de la carpa): auto = 18 h siempre;
  // una fotoperiódica ya en 12/12 empieza en 12 h
  const inFlower = existing && !auto && flipAgo != null
  const luzH = inFlower ? 12 : 18
  const luzTxt = auto
    ? 'Autofloreciente: 18 h de luz todo el ciclo; no la bajes a 12 h. Si prefieres 20 h, lo cambias con el botón Luz de la carpa.'
    : inFlower
      ? 'Ya está en floración: 12 h de luz y 12 h de oscuridad seguidas. Lo puedes cambiar en la carpa.'
      : '18 h mientras crece. Cuando la pases a floración, 12 h. Lo puedes cambiar en la carpa.'

  function submit() {
    const base = {
      grow: name, plants, substrate: sub, potL, potType, seedType, nutrientesId: nut, tierraAbonada: abonada, lightOnHour: lightOn, hasController: ctrl, tentCm,
      strain: strain.trim() || null, breeder: breeder.trim() || null,
      flowerWeeks: auto ? null : flowerWeeks, autoWeeks: auto ? autoWeeks : null,
    }
    if (!existing) { createGrow(base); return }
    registerExisting({ ...base, weeksAgo, flowerWeeksAgo: seedType === 'foto' ? flipAgo : null })
  }
  // ayuda de cada paso: una línea de texto normal debajo del título, nunca dentro de la etiqueta
  const help = (t: string) => <p className="text-[.78rem] mb-3" style={{ color: 'var(--muted)' }}>{t}</p>

  return (
    <div className="absolute inset-0" style={{ background: '#000' }}>
      <button onClick={() => (step === 0 ? cancelNew() : setStep(step - 1))} aria-label={step === 0 ? 'Volver a tus cultivos' : 'Paso anterior'} title="Atrás" className="back">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <div ref={scroller} className="absolute inset-0 overflow-y-auto px-6 pb-36 pt-[104px] flex flex-col">
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
              {existing ? 'Registramos una planta que ya está creciendo: te preguntaremos su edad junto con la semilla.' : 'Empezamos poniendo las semillas a germinar en agua; el resto llega solo.'}
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
                <button key={s.side} onClick={() => { setPlants(s.plants); setTentCm(s.side) }} className={`size ${tentCm === s.side ? 'on' : ''}`}>
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
                // en coco e hidro no hay "solo agua"; una línea que no es de ese sustrato pasa a "otra marca"
                <button key={s.id} onClick={() => { setSub(s.id); setNut(nutrientesPara(nut, s.id)) }} className={`sub ${sub === s.id ? 'on' : ''}`}>{s.label}</button>
              ))}
            </div>
            {/* la mayoría de las tierras comerciales ya alimentan 2–4 semanas: abonar encima quema */}
            {sub === 'tierra' && (
              <>
                <label className="lbl mt-5 block">Tierra abonada</label>
                {help('¿Tu tierra viene abonada? Mira el saco: si dice abonada, NPK o All-Mix, sí.')}
                <div className="flex gap-[7px]">
                  {ABONADA.map((a) => (
                    <button key={a.id} onClick={() => setAbonada(a.id)} className={`sub ${abonada === a.id ? 'on' : ''}`}>{a.label}</button>
                  ))}
                </div>
                <p className="text-[.78rem] mt-2" style={{ color: 'var(--muted)' }}>
                  {abonada === 'no' ? 'Sin abono en el saco: tendrás que abonar tú, a poca dosis. Elige tu abono en el paso siguiente.'
                    : abonada === 'si' ? 'Solo agua unas 3 semanas desde el trasplante: abonar encima quema las puntas de las hojas.'
                    : 'La tratamos como abonada, que es lo seguro: solo agua unas 3 semanas desde el trasplante.'}
                </p>
              </>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <label className="lbl block">Tu línea de nutrientes</label>
            {help(`Con ella calculamos el abono de cada riego. ${fuerzaTxt}`)}
            <NutrientesPicker value={nut} onChange={setNut} substrate={sub} chipClass="sub" />
            <p className="text-[.78rem] mt-3" style={{ color: 'var(--faint)' }}>¿Tu marca no está? Elige «Otra marca» y te guiamos por la EC.</p>
          </>
        )}

        {step === 4 && (
          <>
            <label className="lbl block">Tipo de semilla</label>
            {help('Define cuándo florece y cuántas horas de luz necesita.')}
            <div className="flex gap-[7px]">
              <button onClick={() => setSeedType('foto')} className={`sub ${seedType === 'foto' ? 'on' : ''}`}>Fotoperiódica</button>
              <button onClick={() => { setSeedType('auto'); setFlipAgo(null) }} className={`sub ${seedType === 'auto' ? 'on' : ''}`}>Autofloreciente</button>
            </div>
            <p className="text-[.78rem] mt-2" style={{ color: 'var(--muted)' }}>
              {seedType === 'foto'
                ? 'Florece cuando tú pasas la luz a 12 h de luz y 12 de oscuridad (12/12). Mira el paquete: si dice Auto o Autofloreciente, es auto.'
                : `Florece sola hacia el día ${autoFlowerDayOf({ autoWeeks })}, sin cambiar la luz: 18 h todo el ciclo. Ciclo corto, unos ${autoDaysOf({ autoWeeks })} días en total.`}
            </p>

            <label className="lbl mt-4 block" htmlFor="cfg-strain">Variedad</label>
            <input id="cfg-strain" className="inp mb-3" value={strain} maxLength={40} placeholder="Ej. Northern Lights" onChange={(e) => setStrain(e.target.value)} />
            <label className="lbl block" htmlFor="cfg-breeder">Banco de semillas</label>
            <input id="cfg-breeder" className="inp mb-4" value={breeder} maxLength={40} onChange={(e) => setBreeder(e.target.value)} />
            <label className="lbl block">{auto ? 'Semanas de ciclo' : 'Semanas de floración'}</label>
            {help(auto ? 'De semilla a cosecha. Viene en el paquete o en la web del banco.' : 'Viene en el paquete o en la web del banco.')}
            <div className="grid grid-cols-4 gap-[7px]">
              <button onClick={() => setWeeks(null)} className={`sub ${weeks === null ? 'on' : ''}`}>No sé</button>
              {(auto ? AUTO_WEEKS : FLOWER_WEEKS).map((w) => (
                <button key={w} onClick={() => setWeeks(w)} className={`sub ${weeks === w ? 'on' : ''}`}>{w}</button>
              ))}
            </div>

            {existing && (
              <>
                <label className="lbl mt-4 block">¿Hace cuánto germinó?</label>
                {help('Aproximado está bien.')}
                <div className="grid grid-cols-3 gap-[7px]">
                  {AGES.map((a) => (
                    <button key={a.w} onClick={() => { setWeeksAgo(a.w); if (flipAgo != null && flipAgo >= a.w) setFlipAgo(null) }}
                      className={`sub ${weeksAgo === a.w ? 'on' : ''}`}>{a.label}</button>
                  ))}
                </div>
                {seedType === 'foto' && flowerOptions.length > 0 && (
                  <>
                    <label className="lbl mt-4 mb-2 block">¿Ya está en floración (12/12)?</label>
                    <div className="grid grid-cols-3 gap-[7px]">
                      <button onClick={() => setFlipAgo(null)} className={`sub ${flipAgo === null ? 'on' : ''}`}>Aún no</button>
                      {flowerOptions.map((f) => (
                        <button key={f.w} onClick={() => setFlipAgo(f.w)} className={`sub ${flipAgo === f.w ? 'on' : ''}`}>{f.label}</button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            <div className="mt-5 px-3.5 py-3" style={{ border: '1px solid rgba(255,255,255,.14)', borderRadius: 5, background: 'var(--panel)' }}>
              <div className="label mb-1">Cosecha estimada</div>
              {eta != null ? (
                <>
                  <div className="display font-semibold text-[1.05rem]">{fmtFecha(eta)}</div>
                  <p className="text-[.78rem] mt-1" style={{ color: 'var(--muted)' }}>
                    {eta < Date.now()
                      ? 'Por fecha ya estaría lista: revisa los tricomas antes de cortar.'
                      : auto
                        ? (autoWeeks ? `${autoWeeks} semanas de semilla a cosecha.` : 'Con un ciclo típico de unos 75 días. Elige las semanas de tu variedad para afinarla.')
                        : (flowerWeeks ? `${flowerWeeks} semanas desde el 12/12.` : 'Con una floración típica de unos 60 días desde el 12/12. Elige las semanas de tu variedad para afinarla.')}
                  </p>
                </>
              ) : (
                <>
                  <div className="display font-semibold text-[1.05rem]">Unas {flowerWeeks ?? '8 o 9'} semanas después de pasar a 12/12</div>
                  <p className="text-[.78rem] mt-1" style={{ color: 'var(--muted)' }}>
                    {flowerWeeks ? 'Te damos la fecha cuando pases a 12/12.' : 'Es lo habitual. Elige las semanas de tu variedad para afinarla.'}
                  </p>
                </>
              )}
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <label className="lbl mb-2 block">Hora de encendido</label>
            <div className="flex items-center gap-3 mb-2">
              <input type="time" step={3600} value={`${String(lightOn).padStart(2, '0')}:00`}
                onChange={(e) => { const h = parseInt(e.target.value.slice(0, 2), 10); if (!Number.isNaN(h)) setLightOn(h) }} className="inp" style={{ width: 150, fontFamily: "'IBM Plex Mono', monospace", colorScheme: 'dark' }} />
              <div className="mono text-[.82rem]" style={{ color: 'var(--muted)' }}>{fmtHour(lightOn)} → {fmtHour((lightOn + luzH) % 24)} · {luzH} h</div>
            </div>
            <p className="text-[.78rem] mb-5" style={{ color: 'var(--muted)' }}>{luzTxt}</p>
            <label className="size cursor-pointer" style={{ borderColor: ctrl ? '#fff' : undefined }}>
              <span className="flex items-center gap-3">
                <input type="checkbox" checked={ctrl} onChange={(e) => setCtrl(e.target.checked)} style={{ width: 20, height: 20, margin: 0, accentColor: '#1F73B7' }} />
                Tengo temporizador o controlador
              </span>
            </label>
            <p className="text-[.78rem] mt-3" style={{ color: 'var(--muted)' }}>{ctrl ? 'Con temporizador no te avisamos de la luz.' : 'Sin temporizador, te avisamos a la hora de encender y de apagar la luz.'}</p>

            <div className="mt-6 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,.12)' }}>
              <div className="label mb-2">Resumen</div>
              <div className="text-[.8rem] leading-relaxed" style={{ color: 'var(--muted)' }}>
                {name || 'Carpa'}{strain.trim() ? ` · ${strain.trim()}` : ''} · {plants} {plants === 1 ? 'planta' : 'plantas'} · maceta de {POT_TYPES.find((t) => t.id === potType)!.label.toLowerCase()} de {potL} L · {SUBS.find((s) => s.id === sub)!.label.toLowerCase()}{sub === 'tierra' ? (abonada === 'si' ? ' abonada' : abonada === 'no' ? ' sin abono' : ' quizá abonada') : ''} · {abonoTxt} · luz de {fmtHour(lightOn)} a {fmtHour((lightOn + luzH) % 24)}{ctrl ? ' con controlador' : ''}.
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
        .sub{flex:1;min-height:44px;text-align:center;background:transparent;border:1px solid rgba(255,255,255,.18);border-radius:5px;padding:.65rem .3rem;cursor:pointer;color:var(--muted);font-weight:500;font-size:.82rem;font-family:'Instrument Sans',system-ui,sans-serif;transition:.15s}
        .sub.on{border-color:#fff;color:#fff;background:rgba(255,255,255,.06)}
        .cbtn{border:none;border-radius:5px;font-weight:600;height:52px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:.92rem;cursor:pointer;background:#fff;color:#000}
        .cbtn:disabled{opacity:.4}
        .gbtn{border:1px solid rgba(255,255,255,.4);border-radius:5px;font-weight:600;height:52px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:.92rem;cursor:pointer;background:rgba(0,0,0,.6);color:var(--text)}
      `}</style>
    </div>
  )
}
