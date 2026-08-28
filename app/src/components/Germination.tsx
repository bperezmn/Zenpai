import { useEffect, useState } from 'react'
import { useStore, selectActive } from '../store'
import { waterImg, soakDays, hasSprouted } from '../lib'
import { HOWTOS } from '../howtos'
import { useBackClose } from '../useBackClose'
import HowTo from './HowTo'
import EditGrow from './EditGrow'

// Pantalla de germinación: las semillas flotan en agua → el usuario transplanta
// indicando cuántas brotaron (eso fija el nº de plantas y arranca el reloj del cultivo).
// El remojo tiene reloj real: mensajes escalonados por día y salida digna si nada germina.
export default function Germination() {
  const c = useStore(selectActive)
  const guide = useStore((s) => s.guide)
  const firstGermTipDone = useStore((s) => s.firstGermTipDone)
  const markFirstGermTip = useStore((s) => s.markFirstGermTip)
  const transplant = useStore((s) => s.transplant)
  const resoak = useStore((s) => s.resoak)
  const deleteGrow = useStore((s) => s.deleteGrow)
  const goHome = useStore((s) => s.goHome)
  const seeds = Math.max(1, c.plants)
  const [picking, setPicking] = useState(false)
  const [confirmEarly, setConfirmEarly] = useState(false)
  const [failed, setFailed] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [showHow, setShowHow] = useState(false)       // how-to de transplante
  const [showEdit, setShowEdit] = useState(false)
  const [showGermHow, setShowGermHow] = useState(() => !useStore.getState().firstGermTipDone && useStore.getState().guide !== 'avanzado')
  const [count, setCount] = useState(Math.min(seeds, 3))

  // el brote sigue el TIEMPO REAL de remojo (nada de simularlo): re-evaluar cada minuto
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60000)
    return () => clearInterval(t)
  }, [])
  const brote = hasSprouted(c)
  const sd = soakDays(c)

  function closeGermHow() { setShowGermHow(false); if (!firstGermTipDone) markFirstGermTip() }

  // atrás del sistema cierra la capa superior; la pantalla la maneja App.
  // El germ how-to se cierra por su vía oficial: si no, no marcaría firstGermTipDone
  // y se re-abriría solo en cada visita.
  useBackClose(showHow || showGermHow || showEdit, () => {
    if (showEdit) { setShowEdit(false); return }
    setShowHow(false)
    if (showGermHow) closeGermHow()
  })

  // mensaje de la tarjeta: los escalones por DÍAS mandan sobre el reloj del brote —
  // la app no puede saber si de verdad brotaron, y a partir del día 4 urge actuar
  const soakMsg = sd >= 4
    ? '⚠️ Trasplanta HOY las que tengan raíz — con más días en agua se ahogan. Si ninguna la sacó, pásalas a servilleta húmeda o reintenta.'
    : brote
      ? 'Ya deberían asomar las raíces 🌱 Cuando midan ~1–2 cm, pásalas a las macetas.'
      : 'En remojo… en 1–3 días saldrá la raíz blanca (taproot).'
  const soakMsgColor = sd >= 4 ? 'var(--warn)' : 'var(--muted)'

  return (
    <div className="absolute inset-0 select-none">
      {/* indicador del cultivo */}
      <div className="absolute top-0 left-0 right-0 z-30 flex justify-end px-6 pt-3.5 text-[11px] font-semibold" style={{ color: 'var(--muted)' }}>
        <span className="flex items-center gap-1.5"><span className="w-[7px] h-[7px] rounded-full" style={{ background: 'var(--acc)', boxShadow: '0 0 8px var(--acc)' }} />{c.grow} · germinando</span>
      </div>

      {/* semillas en agua (crossfade remojo → raíz) */}
      <div className="absolute inset-0 overflow-hidden">
        <img src={waterImg(seeds, false)} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <img src={waterImg(seeds, true)} alt="" className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000" style={{ opacity: brote ? 1 : 0 }} />
        <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none" style={{ background: 'linear-gradient(180deg,rgba(4,7,10,.7),transparent)' }} />
        <div className="absolute bottom-0 left-0 right-0 h-80 pointer-events-none" style={{ background: 'linear-gradient(0deg,rgba(4,7,10,.94),transparent)' }} />
      </div>

      {/* volver */}
      <button onClick={goHome} className="absolute left-3.5 top-11 z-30 h-9 px-3.5 rounded-2xl glass text-white/85"
        style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: '.72rem' }}>Volver</button>

      {/* chip etapa */}
      <div className="absolute right-3.5 top-11 z-20 glass rounded-full px-2.5 h-9 flex items-center gap-1.5">
        <span className="text-[.8rem] leading-none">🫘</span>
        <span className="display font-bold text-[.6rem] px-2 py-1 rounded-full leading-none" style={{ background: 'linear-gradient(135deg,var(--acc),var(--acc2))', color: '#04150c' }}>Germinando</span>
      </div>

      {/* tarjeta inferior */}
      <div className="absolute left-4 right-4 bottom-6 z-20">
        {failed ? (
          <div className="glass rounded-3xl p-5 text-center">
            <h2 className="display text-[1.05rem] font-bold">No germinaron 😞</h2>
            <p className="text-[.78rem] mt-1.5 mb-4" style={{ color: 'var(--muted)' }}>
              Pasa hasta en las mejores manos: semillas viejas, agua muy fría o demasiados días en remojo.
              Reintenta con semillas nuevas (la bitácora sigue) — o cierra el cultivo, que lo borra con su bitácora.
            </p>
            {confirmClose ? (
              <div className="flex gap-2">
                <button onClick={() => setConfirmClose(false)} className="gbtn-ghost flex-1 whitespace-nowrap">No, volver</button>
                <button onClick={() => deleteGrow(c.id)} className="gbtn flex-[2] whitespace-nowrap" style={{ background: '#f87171' }}>Sí, borrar todo</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setConfirmClose(true)} className="gbtn-ghost flex-1 whitespace-nowrap">Cerrar cultivo</button>
                <button onClick={() => { setFailed(false); setPicking(false); resoak() }} className="gbtn flex-[2] whitespace-nowrap">🫘 Reintentar remojo</button>
              </div>
            )}
          </div>
        ) : confirmEarly ? (
          <div className="glass rounded-3xl p-5 text-center">
            <h2 className="display text-[1.05rem] font-bold">¿Ya tienen raíz?</h2>
            <p className="text-[.8rem] mt-1.5 mb-4" style={{ color: 'var(--muted)' }}>
              Según el reloj aún es pronto. Trasplanta solo si ya ves la raíz blanca de ~1–2 cm;
              si no la tienen, se pueden quedar enterradas sin nacer.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmEarly(false)} className="gbtn-ghost flex-1 whitespace-nowrap">Aún no</button>
              <button onClick={() => { setConfirmEarly(false); setShowHow(true) }} className="gbtn flex-[2] whitespace-nowrap">Sí, ya la veo →</button>
            </div>
          </div>
        ) : !picking ? (
          <div className="glass rounded-3xl p-5 text-center">
            <h2 className="display text-[1.15rem] font-bold">{seeds} {seeds === 1 ? 'semilla' : 'semillas'} en remojo</h2>
            <p className="text-[.82rem] mt-1.5 mb-1.5" style={{ color: soakMsgColor }}>{soakMsg}</p>
            <p className="text-[.66rem] mb-4" style={{ color: 'var(--faint)' }}>
              {sd === 0 ? 'Recién puestas en agua · revísalas mañana' : `Llevan ${sd} ${sd === 1 ? 'día' : 'días'} en agua`}
            </p>
            {/* hasSprouted se recalcula EN el tap: entre ticks del minutero el render puede estar viejo */}
            <button onClick={() => (hasSprouted(c) ? setShowHow(true) : setConfirmEarly(true))} className="gbtn">🪴 Transplantar</button>
            <div className="flex items-center justify-center gap-3 mt-2">
              <button onClick={() => setShowGermHow(true)} className="text-[.62rem] font-semibold" style={{ color: 'var(--faint)' }}>Ver cómo germinar 👀</button>
              <button onClick={() => setShowEdit(true)} className="text-[.62rem] font-semibold" style={{ color: 'var(--faint)' }}>Editar cultivo ✏️</button>
              {sd >= 7 && (
                <button onClick={() => setFailed(true)} className="text-[.62rem] font-semibold" style={{ color: 'var(--warn)' }}>No germinaron 😞</button>
              )}
            </div>
          </div>
        ) : (
          <div className="glass rounded-3xl p-5 text-center">
            <h2 className="display text-[1.1rem] font-bold">¿Cuántas brotaron?</h2>
            <p className="text-[.74rem] mt-1 mb-3" style={{ color: 'var(--muted)' }}>No todas germinan; cuenta solo las que sacaron raíz.</p>
            <div className="flex items-center justify-center gap-6 my-1">
              <button className="step" onClick={() => setCount((v) => Math.max(0, v - 1))}>–</button>
              <div className="display font-bold text-[2.6rem] leading-none" style={{ color: count === 0 ? 'var(--warn)' : 'var(--acc)' }}>{count}</div>
              <button className="step" onClick={() => setCount((v) => Math.min(seeds, v + 1))}>+</button>
            </div>
            <div className="text-[.6rem] uppercase font-bold tracking-wide mb-4" style={{ color: 'var(--faint)' }}>de {seeds}</div>
            <div className="flex gap-2">
              <button onClick={() => setPicking(false)} className="gbtn-ghost flex-1">Atrás</button>
              {count === 0 ? (
                <button onClick={() => setFailed(true)} className="gbtn flex-[2] whitespace-nowrap" style={{ background: 'var(--warn)' }}>No brotó ninguna 😞</button>
              ) : (
                <button onClick={() => transplant(count)} className="gbtn flex-[2]">Transplantar {count} →</button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* how-to de germinar en agua: automático la primera vez (salvo avanzado) + bajo demanda */}
      {showGermHow && (
        <HowTo def={HOWTOS.germinacion} actionLabel="Ya están en el agua ✓"
          onAction={closeGermHow}
          onClose={closeGermHow} />
      )}

      {showEdit && <EditGrow onClose={() => setShowEdit(false)} />}

      {/* "muéstrame cómo" transplantar: secuencia de fotos → al terminar, elegir cuántas */}
      {showHow && (
        <HowTo def={HOWTOS.transplante} actionLabel="Sí, transplantar →"
          onAction={() => { setShowHow(false); setCount(Math.min(seeds, 3)); setPicking(true) }}
          onClose={() => setShowHow(false)} />
      )}

      <style>{`
        .gbtn{width:100%;border:none;border-radius:15px;font-weight:700;padding:.85rem;font-family:'Space Grotesk';font-size:.92rem;cursor:pointer;background:linear-gradient(135deg,var(--acc),var(--acc2));color:#04150c}
        .gbtn-ghost{border:1px solid var(--glass-bd);border-radius:15px;font-weight:600;padding:.85rem;font-family:'Space Grotesk';font-size:.9rem;cursor:pointer;background:rgba(255,255,255,.05);color:var(--text)}
        .step{width:46px;height:46px;border-radius:16px;border:1px solid var(--glass-bd);background:rgba(255,255,255,.05);color:var(--text);font-size:1.5rem;font-weight:300;display:flex;align-items:center;justify-content:center;cursor:pointer}
        .step:active{background:rgba(255,255,255,.12)}
      `}</style>
    </div>
  )
}
