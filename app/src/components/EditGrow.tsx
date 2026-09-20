import { useState } from 'react'
import { useStore, selectActive } from '../store'
import type { Substrate, SeedType } from '../lib'

const SUBS: { id: Substrate; label: string }[] = [
  { id: 'tierra', label: 'Tierra'},
  { id: 'coco', label: 'Coco'},
  { id: 'hidro', label: 'Hidro'},
]
const POTS = [4, 7, 11, 19, 25]

// Editar los datos del cultivo tras crearlo: lo que se apuntó mal el día uno
// no debería perseguirte todo el ciclo.
export default function EditGrow({ onClose }: { onClose: () => void }) {
  const c = useStore(selectActive)
  const updateGrow = useStore((s) => s.updateGrow)
  const [name, setName] = useState(c.grow)
  const [potL, setPotL] = useState(c.potL)
  const [sub, setSub] = useState<Substrate>(c.substrate)
  const [seedType, setSeedType] = useState<SeedType>(c.seedType)
  // con la floración en marcha (12/12 anotado o auto ya en flor) el tipo ya no se toca:
  // cambiarlo reescribiría la historia del cultivo
  const seedEditable = !c.flowerTs && !c.harvestedTs && (c.stage === 'plantula' || c.stage === 'veg' || c.stage === 'remojo')

  function save() {
    updateGrow({ grow: name, potL, substrate: sub, seedType })
    onClose()
  }

  return (
    <div className="absolute inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(3,6,9,.55)', backdropFilter: 'blur(2px)' }} />
      <div className="absolute left-0 right-0 bottom-0 glass rounded-t-3xl px-5 pt-3 pb-7"
        onClick={(e) => e.stopPropagation()} style={{ animation: 'sheetUp .28s ease-out' }}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: 'var(--glass-bd)' }} />
        <h3 className="display font-bold text-[1.05rem] mb-3">Editar cultivo</h3>

        <label className="elbl">Nombre</label>
        <input className="einp mb-3" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />

        <label className="elbl">Tamaño de maceta <span className="esub">→ recalcula el riego</span></label>
        <div className="flex gap-[7px] mb-3">
          {POTS.map((L) => (
            <button key={L} onClick={() => setPotL(L)} className={`echip ${potL === L ? 'on' : ''}`}>{L} L</button>
          ))}
        </div>

        <label className="elbl">Sustrato <span className="esub">→ ajusta pH y guardarraíl</span></label>
        <div className="flex gap-[7px] mb-3">
          {SUBS.map((s) => (
            <button key={s.id} onClick={() => setSub(s.id)} className={`echip ${sub === s.id ? 'on' : ''}`}>{s.label}</button>
          ))}
        </div>

        <label className="elbl">Tipo de semilla {!seedEditable && <span className="esub">· fijado (floración en marcha)</span>}</label>
        <div className="flex gap-[7px] mb-1">
          <button disabled={!seedEditable} onClick={() => setSeedType('foto')}
            className={`echip ${seedType === 'foto'? 'on': ''}`} style={{ opacity: seedEditable ? 1 : 0.45 }}>Fotoperiódica</button>
          <button disabled={!seedEditable} onClick={() => setSeedType('auto')}
            className={`echip ${seedType === 'auto'? 'on': ''}`} style={{ opacity: seedEditable ? 1 : 0.45 }}>Autofloreciente</button>
        </div>
        {seedEditable && seedType !== c.seedType && (
          <p className="text-[.66rem] mb-1" style={{ color: 'var(--warn)' }}>
            Cambiar el tipo recalcula la etapa según su ciclo real.
          </p>
        )}

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="ebtn-ghost flex-1">Cancelar</button>
          <button onClick={save} className="ebtn flex-[2]">Guardar cambios</button>
        </div>

        <style>{`
          @keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
          .elbl{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:.6rem;letter-spacing:.16em;text-transform:uppercase;color:var(--faint);display:block;margin-bottom:6px}
          .esub{color:var(--faint);text-transform:none;letter-spacing:0;font-weight:500;font-family:'Instrument Sans',system-ui,sans-serif}
          .einp{background:transparent;border:1px solid rgba(255,255,255,.28);border-radius:5px;padding:.65rem .8rem;color:var(--text);width:100%;font-size:1rem;font-family:'Instrument Sans',system-ui,sans-serif}
          .einp:focus{outline:none;border-color:#fff}
          .echip{flex:1;text-align:center;background:transparent;border:1px solid rgba(255,255,255,.18);border-radius:5px;padding:.6rem .3rem;cursor:pointer;color:var(--muted);font-weight:500;font-size:.78rem;font-family:'Instrument Sans',system-ui,sans-serif;transition:.15s}
          .echip.on{border-color:#fff;color:#fff;background:rgba(255,255,255,.06)}
          .ebtn{border:none;border-radius:5px;font-weight:600;height:50px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:.92rem;cursor:pointer;background:#fff;color:#000}
          .ebtn-ghost{border:1px solid rgba(255,255,255,.4);border-radius:5px;font-weight:600;height:50px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:.88rem;cursor:pointer;background:transparent;color:var(--text)}
        `}</style>
      </div>
    </div>
  )
}
