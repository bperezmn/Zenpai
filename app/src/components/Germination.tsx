import { useEffect, useState } from 'react'
import { useStore, selectActive } from '../store'
import { waterImg, soakDays, hasSprouted, preloadIntro } from '../lib'
import { HOWTOS, transplanteHowTo, abreSola, cerroSola } from '../howtos'
import { useBackClose } from '../useBackClose'
import HowTo from './HowTo'
import EditGrow from './EditGrow'
import GuiasSheet from './Guias'

// Pantalla de germinación: las semillas flotan en agua → el usuario trasplanta
// indicando cuántas brotaron (eso fija el nº de plantas y arranca el reloj del cultivo).
// El remojo tiene reloj real: mensajes escalonados por día y salida digna si nada germina.
export default function Germination() {
  const c = useStore(selectActive)
  const markHowtoSeen = useStore((s) => s.markHowtoSeen)
  const transplant = useStore((s) => s.transplant)
  const resoak = useStore((s) => s.resoak)
  const deleteGrow = useStore((s) => s.deleteGrow)
  const goHome = useStore((s) => s.goHome)
  const seeds = Math.max(1, c.plants)
  const [picking, setPicking] = useState(false)
  const [confirmEarly, setConfirmEarly] = useState(false)
  const [failed, setFailed] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [showHow, setShowHow] = useState(false)       // how-to de trasplante
  const [showEdit, setShowEdit] = useState(false)
  const [showGuias, setShowGuias] = useState(false)   // todas las guías (se abren solo para leer)
  // la de germinar se abre sola al llegar si toca (abreSola: novato que aún no la vio); si no, está en Guías
  const [showGermHow, setShowGermHow] = useState(() => {
    const s = useStore.getState()
    return abreSola(HOWTOS.germinacion.id, s.guide, s.howtoSeen)
  })
  const [count, setCount] = useState(Math.min(seeds, 3))

  // el brote sigue el TIEMPO REAL de remojo (nada de simularlo): re-evaluar cada minuto
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60000)
    return () => clearInterval(t)
  }, [])
  // la apertura de la carpa (tras trasplantar, en plántula) ya tendrá sus fotos en caché
  useEffect(() => { preloadIntro(count, c.substrate, ['plantula']) }, [count, c.substrate])
  const brote = hasSprouted(c)
  const sd = soakDays(c)

  // la que se abrió sola cuenta como vista también si la cierra antes del final: si no, se
  // re-abriría en cada visita
  function closeGermHow() { markHowtoSeen(HOWTOS.germinacion.id); setShowGermHow(false) }
  // trasplantar: la guía se abre sola si toca (abreSola); si no, directo a elegir cuántas
  const elegir = () => { setCount(Math.min(seeds, 3)); setPicking(true) }
  function trasplantar() {
    const s = useStore.getState()
    if (abreSola(transplanteHowTo(c.substrate).id, s.guide, s.howtoSeen)) setShowHow(true)
    else elegir()
  }
  // cerrada antes del final: el siguiente «Trasplantar» va directo a elegir cuántas (sigue en Guías)
  function closeHow() { cerroSola(transplanteHowTo(c.substrate).id); setShowHow(false) }

  // atrás del sistema cierra la capa superior; la pantalla la maneja App (y Guías, la suya).
  // El germ how-to se cierra por su vía oficial (closeGermHow), por lo de arriba.
  useBackClose(showHow || showGermHow || showEdit, () => {
    if (showEdit) { setShowEdit(false); return }
    if (showHow) closeHow()
    if (showGermHow) closeGermHow()
  })

  // mensaje de la tarjeta: los escalones por DÍAS mandan sobre el reloj del brote —
  // la app no puede saber si de verdad brotaron, y a partir del día 2 (48 h en agua) urge actuar
  const soakMsg = sd >= 2
    ? 'Trasplanta hoy las que tengan raíz: con más tiempo en agua se ahogan. Las que no se abrieron, pásalas a servilleta húmeda o directo a la tierra, a 1 cm.'
    : brote
      ? 'Ya deberían asomar las raíces. En cuanto las veas, pásalas a las macetas.'
      : 'En remojo. En 1–2 días se abren y asoma la raíz blanca.'
  const soakMsgColor = sd >= 2 ? 'var(--warn)' : 'var(--muted)'

  return (
    <div className="absolute inset-0 select-none">
      {/* indicador del cultivo */}
      <div className="absolute top-0 left-0 right-0 z-30 flex justify-end px-6 pt-3.5 text-[.74rem] font-semibold" style={{ color: 'var(--muted)' }}>
        <span className="flex items-center gap-1.5"><span className="w-[7px] h-[7px] rounded-full" style={{ background: 'var(--blue)' }} />{c.grow} · germinando</span>
      </div>

      {/* semillas en agua (crossfade remojo → raíz) */}
      <div className="absolute inset-0 overflow-hidden">
        <img src={waterImg(seeds, false)} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <img src={waterImg(seeds, true)} alt="" className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000" style={{ opacity: brote ? 1 : 0 }} />
        <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none" style={{ background: 'linear-gradient(180deg,rgba(0,0,0,.7),transparent)' }} />
        <div className="absolute bottom-0 left-0 right-0 h-80 pointer-events-none" style={{ background: 'linear-gradient(0deg,rgba(0,0,0,.94),transparent)' }} />
      </div>

      {/* volver */}
      <button onClick={goHome} className="absolute left-3.5 top-11 z-30 h-9 px-3.5 rounded-[5px] glass text-white/85"
        style={{ fontFamily: "'Instrument Sans', system-ui, sans-serif", fontWeight: 600, fontSize: '.82rem' }}>Volver</button>

      {/* chip etapa */}
      <div className="absolute right-3.5 top-11 z-20 glass rounded-[5px] px-3 h-9 flex items-center">
        <span className="label" style={{ color: 'var(--text)' }}>Germinando</span>
      </div>

      {/* tarjeta inferior */}
      <div className="absolute left-4 right-4 bottom-6 z-20">
        {failed ? (
          <div className="glass rounded-[5px] p-5 text-center">
            <h2 className="display text-[1.05rem] font-bold">No germinaron</h2>
            <p className="text-[.78rem] mt-1.5 mb-4" style={{ color: 'var(--muted)' }}>
              Pasa hasta en las mejores manos: semillas viejas, agua muy fría o demasiados días en remojo.
              Reintenta con semillas nuevas (la bitácora sigue) o cierra el cultivo, que lo borra con su bitácora.
            </p>
            {confirmClose ? (
              <div className="flex gap-2">
                <button onClick={() => setConfirmClose(false)} className="gbtn-ghost flex-1">No, volver</button>
                <button onClick={() => deleteGrow(c.id)} className="gbtn flex-1" style={{ background: 'var(--danger)', color: '#fff' }}>Sí, borrar todo</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setConfirmClose(true)} className="gbtn-ghost flex-1">Cerrar cultivo</button>
                <button onClick={() => { setFailed(false); setPicking(false); resoak() }} className="gbtn flex-1">Reintentar remojo</button>
              </div>
            )}
          </div>
        ) : confirmEarly ? (
          <div className="glass rounded-[5px] p-5 text-center">
            <h2 className="display text-[1.05rem] font-bold">¿Ya tienen raíz?</h2>
            <p className="text-[.8rem] mt-1.5 mb-4" style={{ color: 'var(--muted)' }}>
              Según el reloj aún es pronto. Trasplanta solo si ya ves asomar la raíz blanca;
              si no la tienen, se pueden quedar enterradas sin nacer.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmEarly(false)} className="gbtn-ghost flex-1">Aún no</button>
              <button onClick={() => { setConfirmEarly(false); trasplantar() }} className="gbtn flex-1">Sí, ya la veo</button>
            </div>
          </div>
        ) : !picking ? (
          <div className="glass rounded-[5px] p-5 text-center">
            <h2 className="display text-[1.15rem] font-bold">{seeds} {seeds === 1 ? 'semilla' : 'semillas'} en remojo</h2>
            <p className="text-[.82rem] mt-1.5 mb-1.5" style={{ color: soakMsgColor }}>{soakMsg}</p>
            <p className="text-[.74rem] mb-4" style={{ color: 'var(--faint)' }}>
              {sd === 0 ? 'Recién puestas en agua. Revísalas mañana.' : `Llevan ${sd} ${sd === 1 ? 'día' : 'días'} en agua.`}
            </p>
            {/* hasSprouted se recalcula EN el tap: entre ticks del minutero el render puede estar viejo */}
            <button onClick={() => (hasSprouted(c) ? trasplantar() : setConfirmEarly(true))} className="gbtn">Trasplantar</button>
            <div className="flex items-center justify-center gap-4 mt-2">
              <button onClick={() => setShowGuias(true)} className="text-[.74rem] font-semibold py-2 px-1" style={{ color: 'var(--faint)' }}>Guías</button>
              <button onClick={() => setShowEdit(true)} className="text-[.74rem] font-semibold py-2 px-1" style={{ color: 'var(--faint)' }}>Editar cultivo</button>
            </div>
            {sd >= 7 && (
              <div className="flex justify-center">
                <button onClick={() => setFailed(true)} className="text-[.74rem] font-semibold py-2 px-1" style={{ color: 'var(--warn)' }}>No germinaron</button>
              </div>
            )}
          </div>
        ) : (
          <div className="glass rounded-[5px] p-5 text-center">
            <h2 className="display text-[1.1rem] font-bold">¿Cuántas brotaron?</h2>
            <p className="text-[.74rem] mt-1 mb-3" style={{ color: 'var(--muted)' }}>No todas germinan; cuenta solo las que sacaron raíz.</p>
            <div className="flex items-center justify-center gap-6 my-1">
              <button className="step" onClick={() => setCount((v) => Math.max(0, v - 1))}>–</button>
              <div className="display font-bold text-[2.6rem] leading-none" style={{ color: count === 0 ? 'var(--warn)' : 'var(--text)' }}>{count}</div>
              <button className="step" onClick={() => setCount((v) => Math.min(seeds, v + 1))}>+</button>
            </div>
            <div className="label mb-4">de {seeds}</div>
            <div className="flex gap-2">
              <button onClick={() => setPicking(false)} className="gbtn-ghost flex-1">Atrás</button>
              {count === 0 ? (
                <button onClick={() => setFailed(true)} className="gbtn flex-1" style={{ background: 'var(--warn)', color: '#000' }}>No brotó ninguna</button>
              ) : (
                <button onClick={() => transplant(count)} className="gbtn flex-1">Trasplantar {count}</button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* how-to de germinar en agua: se abre sola la primera vez (novato); después, en Guías */}
      {showGermHow && (
        <HowTo def={HOWTOS.germinacion} actionLabel="Ya están en el agua"
          onAction={closeGermHow}
          onClose={closeGermHow} />
      )}

      {showEdit && <EditGrow onClose={() => setShowEdit(false)} />}
      {showGuias && <GuiasSheet c={c} onClose={() => setShowGuias(false)} />}

      {/* "muéstrame cómo" trasplantar: secuencia de fotos → al terminar, elegir cuántas */}
      {showHow && (
        <HowTo def={transplanteHowTo(c.substrate)} actionLabel="Trasplantar"
          onAction={() => { setShowHow(false); elegir() }}
          onClose={closeHow} />
      )}

      <style>{`
        .gbtn{width:100%;border:none;border-radius:5px;font-weight:600;height:50px;padding:0 .5rem;font-family:'Instrument Sans',system-ui,sans-serif;font-size:.9rem;cursor:pointer;background:#fff;color:#000}
        .gbtn-ghost{border:1px solid rgba(255,255,255,.4);border-radius:5px;font-weight:600;height:50px;padding:0 .5rem;font-family:'Instrument Sans',system-ui,sans-serif;font-size:.88rem;cursor:pointer;background:transparent;color:var(--text)}
        .step{width:46px;height:46px;border-radius:5px;border:1px solid rgba(255,255,255,.4);background:transparent;color:var(--text);font-size:1.5rem;font-weight:300;display:flex;align-items:center;justify-content:center;cursor:pointer}
        .step:active{background:rgba(255,255,255,.12)}
      `}</style>
    </div>
  )
}
