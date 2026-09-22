import { useState } from 'react'
import { useStore, selectActive } from '../store'
import type { Equipment } from '../lib'
import { CATEGORIAS, equipoPorId, porCategoria, nombreEquipo, type EquipoCat } from '../data/equipos'
import { useBackClose } from '../useBackClose'

const LADOS = [40, 60, 80, 100, 120] // lado de la carpa en cm

// elección por categoría: id del catálogo, 'otro' (texto libre) o null (ninguno)
type Eleccion = { id: string | null; texto: string }

function desde(cat: EquipoCat, v?: string): Eleccion {
  if (!v) return { id: null, texto: '' }
  if (equipoPorId(v)?.cat === cat) return { id: v, texto: '' }
  return { id: 'otro', texto: v }
}
function valor(e: Eleccion): string | undefined {
  if (e.id === 'otro') return e.texto.trim() || undefined
  return e.id ?? undefined
}
const m2 = (lado: number) => String(Math.round((lado / 100) ** 2 * 100) / 100).replace('.', ',')

// Tu equipo: lado de la carpa y qué luz, extracción, controlador y ventilador usas.
// Se abre encima de Editar cultivo (capa propia para el gesto atrás).
export default function EquipoSheet({ onClose }: { onClose: () => void }) {
  useBackClose(true, onClose)
  const c = useStore(selectActive)
  const setEquipment = useStore((s) => s.setEquipment)
  const [lado, setLado] = useState<number | null>(c.tentCm)
  const [sel, setSel] = useState<Record<EquipoCat, Eleccion>>(() => ({
    luz: desde('luz', c.equipment.luz),
    aire: desde('aire', c.equipment.aire),
    ctrl: desde('ctrl', c.equipment.ctrl),
    vent: desde('vent', c.equipment.vent),
  }))
  const [open, setOpen] = useState<EquipoCat | null>(null)

  const elegir = (cat: EquipoCat, id: string | null) => {
    setSel((s) => ({ ...s, [cat]: { ...s[cat], id } }))
    if (id !== 'otro') setOpen(null)
  }
  const luz = equipoPorId(sel.luz.id)
  const ctrl = equipoPorId(sel.ctrl.id)
  const wm2 = luz?.watts && lado ? Math.round(luz.watts / (lado / 100) ** 2) : null

  function save() {
    const eq: Equipment = {}
    for (const k of ['luz', 'aire', 'ctrl', 'vent'] as const) { const v = valor(sel[k]); if (v) eq[k] = v }
    setEquipment(eq, lado)
    onClose()
  }

  return (
    <div className="absolute inset-0 z-[60]" onClick={(e) => { e.stopPropagation(); onClose() }}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(2px)' }} />
      <div className="absolute left-0 right-0 bottom-0 glass rounded-t-3xl px-5 pt-3 pb-7 max-h-[88%] flex flex-col"
        onClick={(e) => e.stopPropagation()} style={{ animation: 'sheetUp .28s ease-out' }}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full flex-none" style={{ background: 'var(--glass-bd)' }} />
        <h3 className="display font-bold text-[1.05rem] mb-3 flex-none">Tu equipo</h3>

        <div className="overflow-y-auto -mx-1 px-1" style={{ minHeight: 0 }}>
          <label className="qlbl">Lado de carpa</label>
          <div className="flex gap-[7px] mb-4">
            {LADOS.map((l) => (
              <button key={l} onClick={() => setLado(l)} className={`qchip ${lado === l ? 'on' : ''}`}>{l} cm</button>
            ))}
          </div>

          {CATEGORIAS.map(({ id: cat, label }) => {
            const e = sel[cat]
            const nombre = e.id === 'otro' ? (e.texto.trim() || null) : nombreEquipo(e.id)
            const watts = cat === 'luz' ? luz?.watts : undefined
            const abierta = open === cat
            return (
              <div key={cat} className="mb-[7px]">
                <button onClick={() => setOpen(abierta ? null : cat)} aria-expanded={abierta} className={`qcat ${abierta ? 'on' : ''}`}>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-[.86rem] font-medium">{label}</span>
                    <span className="block truncate text-[.76rem]" style={{ color: nombre ? 'var(--muted)' : 'var(--faint)' }}>
                      {nombre ? `${nombre}${watts ? ` · ${watts} W` : ''}` : 'Sin elegir'}
                    </span>
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
                    style={{ flex: 'none', transform: abierta ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }}><path d="M6 9l6 6 6-6" /></svg>
                </button>

                {abierta && (
                  <div className="mt-[6px]" role="radiogroup" aria-label={label}>
                    {porCategoria(cat).map((it) => (
                      <Opcion key={it.id} on={e.id === it.id} onClick={() => elegir(cat, it.id)}
                        text={it.marca ? `${it.marca} ${it.modelo}` : it.modelo} extra={it.watts ? `${it.watts} W` : undefined} />
                    ))}
                    <Opcion on={e.id === 'otro'} onClick={() => elegir(cat, 'otro')} text="Otro" />
                    {e.id === 'otro' && (
                      <input className="qinp mb-[6px]" value={e.texto} maxLength={40} placeholder="Marca y modelo" aria-label={`${label}: marca y modelo`} autoFocus
                        onChange={(ev) => { const t = ev.target.value; setSel((s) => ({ ...s, [cat]: { id: 'otro', texto: t } })) }} />
                    )}
                    <Opcion on={e.id === null} onClick={() => elegir(cat, null)} text="Ninguno" />
                  </div>
                )}

                {cat === 'luz' && wm2 != null && luz?.watts && lado && (
                  <div className="mt-[7px] px-3.5 py-3" style={{ border: '1px solid rgba(255,255,255,.14)', borderRadius: 5, background: 'var(--panel)' }}>
                    <div className="text-[.78rem]" style={{ color: 'var(--muted)' }}>Tu luz en esta carpa</div>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="mono text-[1.6rem] font-medium leading-none">{wm2}</span>
                      <span className="text-[.78rem]" style={{ color: 'var(--muted)' }}>W/m²</span>
                    </div>
                    <p className="text-[.76rem] mt-2 leading-snug" style={{ color: 'var(--muted)' }}>
                      {luz.watts} W en {m2(lado)} m². Cuelga la luz a la altura que indica su fabricante para cada etapa.
                    </p>
                  </div>
                )}

                {cat === 'ctrl' && ctrl?.controlaLuz && (
                  <p className="text-[.76rem] mt-[6px]" style={{ color: 'var(--blue)' }}>Con él no te avisamos de encender ni apagar la luz.</p>
                )}
                {cat === 'ctrl' && ctrl && !ctrl.controlaLuz && ctrl.nota && (
                  <p className="text-[.76rem] mt-[6px]" style={{ color: 'var(--muted)' }}>{ctrl.nota}</p>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex gap-2 mt-4 flex-none">
          <button onClick={onClose} className="qbtn-ghost flex-1">Cancelar</button>
          <button onClick={save} className="qbtn flex-1">Guardar equipo</button>
        </div>

        <style>{`
          @keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
          .qlbl{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:var(--faint);display:block;margin-bottom:6px}
          .qchip{flex:1;min-height:44px;text-align:center;background:transparent;border:1px solid rgba(255,255,255,.18);border-radius:5px;padding:.5rem .2rem;cursor:pointer;color:var(--muted);font-weight:500;font-size:.82rem;font-family:'Instrument Sans',system-ui,sans-serif;white-space:nowrap;transition:.15s}
          .qchip.on{border-color:#fff;color:#fff;background:rgba(255,255,255,.06)}
          .qcat{display:flex;align-items:center;gap:12px;width:100%;min-height:56px;background:transparent;border:1px solid rgba(255,255,255,.18);border-radius:5px;padding:.6rem .9rem;cursor:pointer;color:#fff;font-family:'Instrument Sans',system-ui,sans-serif;transition:.15s}
          .qcat.on{border-color:rgba(255,255,255,.4)}
          .qopt{display:flex;align-items:center;gap:12px;width:100%;min-height:44px;text-align:left;background:transparent;border:1px solid rgba(255,255,255,.14);border-radius:5px;padding:0 .8rem;margin-bottom:6px;cursor:pointer;color:#fff;font-family:'Instrument Sans',system-ui,sans-serif}
          .qopt.on{border-color:#fff;background:rgba(255,255,255,.06)}
          .qinp{background:transparent;border:1px solid rgba(255,255,255,.28);border-radius:5px;padding:.65rem .8rem;color:var(--text);width:100%;font-size:1rem;font-family:'Instrument Sans',system-ui,sans-serif}
          .qinp:focus{outline:none;border-color:#fff}
          .qbtn{border:none;border-radius:5px;font-weight:600;height:50px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:.92rem;cursor:pointer;background:#fff;color:#000}
          .qbtn-ghost{border:1px solid rgba(255,255,255,.4);border-radius:5px;font-weight:600;height:50px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:.92rem;cursor:pointer;background:transparent;color:var(--text)}
        `}</style>
      </div>
    </div>
  )
}

// fila de opción tipo radio (44 px): círculo + nombre + dato a la derecha
function Opcion({ on, onClick, text, extra }: { on: boolean; onClick: () => void; text: string; extra?: string }) {
  return (
    <button role="radio" aria-checked={on} onClick={onClick} className={`qopt ${on ? 'on' : ''}`}>
      <span aria-hidden="true" className="flex-none flex items-center justify-center" style={{ width: 16, height: 16, borderRadius: 8, border: `1.5px solid ${on ? '#fff' : 'rgba(255,255,255,.4)'}` }}>
        {on && <span style={{ width: 8, height: 8, borderRadius: 4, background: '#fff' }} />}
      </span>
      <span className="min-w-0 flex-1 truncate text-[.86rem]">{text}</span>
      {extra && <span className="mono flex-none text-[.76rem]" style={{ color: 'var(--muted)' }}>{extra}</span>}
    </button>
  )
}
