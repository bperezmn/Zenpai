import { useState } from 'react'
import { useStore, selectActive } from '../store'
import type { Substrate, SeedType, PotType, TierraAbonada } from '../lib'
import NutrientesPicker from './NutrientesPicker'
import EquipoSheet from './EquipoSheet'
import { CATEGORIAS, nombreEquipo } from '../data/equipos'
import { nutrientesPara } from '../data/nutrientes'

const SUBS: { id: Substrate; label: string }[] = [
  { id: 'tierra', label: 'Tierra'},
  { id: 'coco', label: 'Coco'},
  { id: 'hidro', label: 'Hidro'},
]
const POTS = [4, 7, 11, 19, 25]
// ¿la tierra del saco ya trae abono? "No sé" se trata como abonada (lo seguro)
const ABONADA: { id: TierraAbonada; label: string }[] = [
  { id: 'si', label: 'Sí' },
  { id: 'no', label: 'No' },
  { id: 'nose', label: 'No sé' },
]
// semanas de la variedad (vienen en el paquete o en la web del banco); null = no sé
const FLOWER_WEEKS = [7, 8, 9, 10, 11, 12]
const AUTO_WEEKS = [8, 9, 10, 11, 12, 13, 14]

// Editar los datos del cultivo tras crearlo: lo que se apuntó mal el día uno
// no debería perseguirte todo el ciclo.
export default function EditGrow({ onClose }: { onClose: () => void }) {
  const c = useStore(selectActive)
  const updateGrow = useStore((s) => s.updateGrow)
  const [name, setName] = useState(c.grow)
  const [potL, setPotL] = useState(c.potL)
  const [sub, setSub] = useState<Substrate>(c.substrate)
  const [potType, setPotType] = useState<PotType>(c.potType ?? 'tela')
  const [nut, setNut] = useState<string | null>(c.nutrientesId ?? null)
  const [abonada, setAbonada] = useState<TierraAbonada>(c.tierraAbonada ?? 'nose')
  const [seedType, setSeedType] = useState<SeedType>(c.seedType)
  // con la floración en marcha (12/12 anotado o auto ya en flor) el tipo ya no se toca:
  // cambiarlo reescribiría la historia del cultivo
  const seedEditable = !c.flowerTs && !c.harvestedTs && (c.stage === 'plantula' || c.stage === 'veg' || c.stage === 'remojo')
  const setGenetics = useStore((s) => s.setGenetics)
  const [strain, setStrain] = useState(c.strain ?? '')
  const [breeder, setBreeder] = useState(c.breeder ?? '')
  const [flowerWeeks, setFlowerWeeks] = useState<number | null>(c.flowerWeeks)
  const [autoWeeks, setAutoWeeks] = useState<number | null>(c.autoWeeks)
  const [showEquipo, setShowEquipo] = useState(false)
  const auto = seedType === 'auto'
  const weeks = auto ? autoWeeks : flowerWeeks
  const setWeeks = auto ? setAutoWeeks : setFlowerWeeks
  const equipo = CATEGORIAS.map((k) => nombreEquipo(c.equipment[k.id])).filter(Boolean).join(' · ')

  function save() {
    // el abono va con el resto de datos: un solo cambio (y una sola nota) aunque cambie el sustrato
    updateGrow({ grow: name, potL, potType, substrate: sub, seedType, tierraAbonada: abonada, nutrientesId: nut })
    setGenetics({ strain: strain.trim() || null, breeder: breeder.trim() || null, flowerWeeks, autoWeeks })
    onClose()
  }

  return (
    <div className="absolute inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(3,6,9,.55)', backdropFilter: 'blur(2px)' }} />
      <div className="absolute left-0 right-0 bottom-0 glass rounded-t-3xl px-5 pt-3 pb-7 max-h-[88%] flex flex-col"
        onClick={(e) => e.stopPropagation()} style={{ animation: 'sheetUp .28s ease-out' }}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full flex-none" style={{ background: 'var(--glass-bd)' }} />
        <h3 className="display font-bold text-[1.05rem] mb-3 flex-none">Editar cultivo</h3>

        <div className="overflow-y-auto -mx-1 px-1" style={{ minHeight: 0 }}>
          <label className="elbl">Nombre</label>
          <input className="einp mb-4" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />

          <label className="elbl">Tipo de maceta</label>
          <div className="flex gap-[7px] mb-4">
            <button onClick={() => setPotType('tela')} className={`echip ${potType === 'tela' ? 'on' : ''}`}>Tela</button>
            <button onClick={() => setPotType('plastico')} className={`echip ${potType === 'plastico' ? 'on' : ''}`}>Plástico</button>
          </div>

          <label className="elbl">Tamaño de maceta</label>
          <div className="flex gap-[7px] mb-4">
            {POTS.map((L) => (
              <button key={L} onClick={() => setPotL(L)} className={`echip ${potL === L ? 'on' : ''}`}>{L} L</button>
            ))}
          </div>

          <label className="elbl">Sustrato</label>
          <p className="text-[.76rem] mb-2" style={{ color: 'var(--muted)' }}>Cambia el pH objetivo y los avisos de riego.</p>
          <div className="flex gap-[7px] mb-4">
            {SUBS.map((s) => (
              // en coco e hidro no hay "solo agua"; una línea que no es de ese sustrato pasa a "otra marca"
              <button key={s.id} onClick={() => { setSub(s.id); setNut(nutrientesPara(nut, s.id)) }} className={`echip ${sub === s.id ? 'on' : ''}`}>{s.label}</button>
            ))}
          </div>

          {sub === 'tierra' && (
            <>
              <label className="elbl">Tierra abonada</label>
              <p className="text-[.76rem] mb-2" style={{ color: 'var(--muted)' }}>¿Tu tierra viene abonada? Mira el saco: si dice abonada, NPK o All-Mix, sí. Si trae abono, solo agua unas 3 semanas desde el trasplante.</p>
              <div className="flex gap-[7px] mb-4">
                {ABONADA.map((a) => (
                  <button key={a.id} onClick={() => setAbonada(a.id)} className={`echip ${abonada === a.id ? 'on' : ''}`}>{a.label}</button>
                ))}
              </div>
            </>
          )}

          <label className="elbl">Nutrientes</label>
          <div className="mb-4"><NutrientesPicker value={nut} onChange={setNut} substrate={sub} chipClass="echip" /></div>

          <label className="elbl">Tipo de semilla</label>
          <div className="flex gap-[7px] mb-2">
            <button disabled={!seedEditable} onClick={() => setSeedType('foto')}
              className={`echip ${seedType === 'foto'? 'on': ''}`} style={{ opacity: seedEditable ? 1 : 0.45 }}>Fotoperiódica</button>
            <button disabled={!seedEditable} onClick={() => setSeedType('auto')}
              className={`echip ${seedType === 'auto'? 'on': ''}`} style={{ opacity: seedEditable ? 1 : 0.45 }}>Autofloreciente</button>
          </div>
          {!seedEditable && (
            <p className="text-[.76rem] mb-1" style={{ color: 'var(--muted)' }}>Con la floración en marcha el tipo ya no se cambia.</p>
          )}
          {seedEditable && seedType !== c.seedType && (
            <p className="text-[.76rem] mb-1" style={{ color: 'var(--warn)' }}>
              Cambiar el tipo recalcula la etapa según su ciclo real.
            </p>
          )}

          <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,.12)' }}>
            <h4 className="display font-semibold text-[.92rem] mb-3">Genética</h4>
            <label className="elbl" htmlFor="eg-strain">Variedad</label>
            <input id="eg-strain" className="einp mb-4" value={strain} maxLength={40} placeholder="Ej. Northern Lights" onChange={(e) => setStrain(e.target.value)} />
            <label className="elbl" htmlFor="eg-breeder">Banco de semillas</label>
            <input id="eg-breeder" className="einp mb-4" value={breeder} maxLength={40} onChange={(e) => setBreeder(e.target.value)} />
            <label className="elbl">{auto ? 'Semanas de ciclo' : 'Semanas de floración'}</label>
            <p className="text-[.76rem] mb-2" style={{ color: 'var(--muted)' }}>{auto ? 'De semilla a cosecha. ' : ''}Viene en el paquete o en la web del banco.</p>
            <div className="grid grid-cols-4 gap-[7px] mb-4">
              <button onClick={() => setWeeks(null)} className={`echip ${weeks === null ? 'on' : ''}`}>No sé</button>
              {(auto ? AUTO_WEEKS : FLOWER_WEEKS).map((w) => (
                <button key={w} onClick={() => setWeeks(w)} className={`echip ${weeks === w ? 'on' : ''}`}>{w}</button>
              ))}
            </div>
          </div>

          <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,.12)' }}>
            <label className="elbl">Equipo</label>
            <div className="flex items-center gap-3">
              <p className="min-w-0 flex-1 truncate text-[.78rem]" style={{ color: equipo ? 'var(--muted)' : 'var(--faint)' }}>{equipo || 'Sin equipo'}</p>
              <button onClick={() => setShowEquipo(true)} className="ebtn-ghost flex-none" style={{ height: 44, padding: '0 .9rem', fontSize: '.84rem' }}>Editar equipo</button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-4 flex-none">
          <button onClick={onClose} className="ebtn-ghost flex-1">Cancelar</button>
          <button onClick={save} className="ebtn flex-1">Guardar cambios</button>
        </div>

        <style>{`
          @keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
          .elbl{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:var(--faint);display:block;margin-bottom:6px}
          .einp{background:transparent;border:1px solid rgba(255,255,255,.28);border-radius:5px;padding:.65rem .8rem;color:var(--text);width:100%;font-size:1rem;font-family:'Instrument Sans',system-ui,sans-serif}
          .einp:focus{outline:none;border-color:#fff}
          .echip{flex:1;min-height:44px;text-align:center;background:transparent;border:1px solid rgba(255,255,255,.18);border-radius:5px;padding:.6rem .3rem;cursor:pointer;color:var(--muted);font-weight:500;font-size:.82rem;font-family:'Instrument Sans',system-ui,sans-serif;transition:.15s}
          .echip.on{border-color:#fff;color:#fff;background:rgba(255,255,255,.06)}
          .ebtn{border:none;border-radius:5px;font-weight:600;height:50px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:.92rem;cursor:pointer;background:#fff;color:#000}
          .ebtn-ghost{border:1px solid rgba(255,255,255,.4);border-radius:5px;font-weight:600;height:50px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:.92rem;cursor:pointer;background:transparent;color:var(--text)}
        `}</style>
      </div>
      {showEquipo && <EquipoSheet onClose={() => setShowEquipo(false)} />}
    </div>
  )
}
