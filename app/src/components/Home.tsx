import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { Logo } from '../App'
import { frontImg, stageLabel, type Cultivo } from '../lib'
import { needsAttention, wateringGuide } from '../mentor'
import Settings from './Settings'

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

export default function Home() {
  const grows = useStore((s) => s.grows)
  const openGrow = useStore((s) => s.openGrow)
  const startNew = useStore((s) => s.startNew)
  const deleteGrow = useStore((s) => s.deleteGrow)
  const seedDemo = useStore((s) => s.seedDemo)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  // los chips "Riega hoy / Al día" dependen del reloj: un tick por minuto los mantiene al día
  const [, setClock] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setClock((n) => n + 1), 60000)
    return () => clearInterval(t)
  }, [])

  // creciendo primero, cosechados (secando) al final; dentro, más reciente arriba
  const sorted = [...grows].sort((a, b) => {
    const an = a.stage === 'secando' ? 1 : 0
    const bn = b.stage === 'secando' ? 1 : 0
    if (an !== bn) return an - bn
    // más reciente arriba; los de remojo (germTs null) usan soakTs para no caer al fondo
    return (b.germTs ?? b.soakTs ?? 0) - (a.germTs ?? a.soakTs ?? 0)
  })
  const [hero, ...rest] = sorted
  const now = new Date()
  const fecha = `${DIA[now.getDay()]} ${now.getDate()} ${MES[now.getMonth()]}`
  const activos = grows.filter((g) => g.stage !== 'secando').length

  return (
    <div className="absolute inset-0 overflow-y-auto pb-28" style={{ background: '#000' }}>
      <div className="flex items-center justify-between px-6 pt-12">
        <div className="flex items-center gap-2.5">
          <Logo size={26} />
          <span className="display text-[.8rem] font-semibold uppercase" style={{ letterSpacing: '.14em' }}>zenpai</span>
        </div>
        <button onClick={() => setShowSettings(true)} aria-label="Ajustes" title="Ajustes"
          className="w-11 h-11 flex items-center justify-center" style={{ color: 'var(--muted)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
      </div>

      {showSettings && <Settings onClose={() => setShowSettings(false)} />}

      <div className="px-6 pt-8 flex flex-col gap-2">
        <div className="label">{fecha} · {activos === 0 ? 'sin cultivos activos' : `${activos} ${activos === 1 ? 'cultivo activo' : 'cultivos activos'}`}</div>
        <h1 className="display text-[2rem] font-semibold leading-tight">Tus cultivos</h1>
      </div>

      {grows.length === 0 ? (
        <div className="flex flex-col items-center text-center mt-16 px-8">
          <h2 className="display text-[1.05rem] font-semibold">Aún no tienes cultivos</h2>
          <p className="text-[.85rem] mt-2 mb-7" style={{ color: 'var(--muted)' }}>
            Crea tu carpa virtual y zenpai te guía de la germinación a la cosecha.
          </p>
          <button className="cbtn" onClick={startNew}>Crear mi primer cultivo</button>
          <button onClick={seedDemo} className="mt-5 label" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
            O explora con cultivos de ejemplo
          </button>
        </div>
      ) : (
        <>
          <Hero g={hero} onOpen={() => openGrow(hero.id)}
            confirming={confirmId === hero.id}
            onAskDelete={() => setConfirmId(hero.id)}
            onCancelDelete={() => setConfirmId(null)}
            onConfirmDelete={() => { setConfirmId(null); deleteGrow(hero.id) }} />
          <div className="px-6">
            {rest.map((g) => (
              <Row key={g.id} g={g}
                onOpen={() => openGrow(g.id)}
                confirming={confirmId === g.id}
                onAskDelete={() => setConfirmId(g.id)}
                onCancelDelete={() => setConfirmId(null)}
                onConfirmDelete={() => { setConfirmId(null); deleteGrow(g.id) }}
              />
            ))}
          </div>
        </>
      )}

      {grows.length > 0 && (
        <button className="cbtn-fixed" onClick={startNew}>Nuevo cultivo</button>
      )}

      <style>{`
        .cbtn{width:100%;max-width:320px;border:none;border-radius:5px;font-weight:600;height:52px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:.95rem;letter-spacing:.02em;cursor:pointer;background:#fff;color:#000}
        .cbtn-fixed{position:absolute;left:24px;right:24px;bottom:22px;border:none;border-radius:5px;font-weight:600;height:52px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:.95rem;letter-spacing:.02em;cursor:pointer;background:#fff;color:#000}
        .hrow{display:flex;align-items:center;gap:14px;padding:13px 0;border-bottom:1px solid rgba(255,255,255,.12);width:100%;text-align:left;background:none;border-top:0;border-left:0;border-right:0;color:inherit;cursor:pointer}
        .xbtn{width:44px;height:44px;display:flex;align-items:center;justify-content:center;color:var(--faint);background:none;border:0;cursor:pointer;flex:none}
        .xbtn:hover{color:#fff}
        .dbtn{height:34px;padding:0 12px;border-radius:5px;font-size:.72rem;font-weight:600;cursor:pointer;border:1px solid rgba(255,255,255,.3);background:transparent;color:#fff;font-family:'Instrument Sans',system-ui,sans-serif}
        .dbtn.rojo{background:var(--danger);border-color:var(--danger);color:#fff}
      `}</style>
    </div>
  )
}

// estado de un cultivo en una palabra, para las filas y la portada
function estado(g: Cultivo): { text: string; color: string } {
  if (g.stage === 'remojo') return { text: 'Germinando', color: 'var(--muted)' }
  if (g.finishedTs) return { text: 'Terminado', color: 'var(--faint)' }
  if (g.stage === 'secando') return { text: 'Secando', color: 'var(--muted)' }
  return needsAttention(g) ? { text: 'Riego', color: 'var(--danger)' } : { text: 'OK', color: 'var(--muted)' }
}
function meta(g: Cultivo): string {
  if (g.stage === 'remojo') return `${g.plants} ${g.plants === 1 ? 'semilla' : 'semillas'} en agua`
  if (g.finishedTs && g.dryWeight) return `${g.dryWeight} g secos · ${g.substrate}`
  return `Día ${g.day} · ${stageLabel[g.stage]} · ${g.plants} ${g.plants === 1 ? 'planta' : 'plantas'}`
}

type CardProps = { g: Cultivo; onOpen: () => void; confirming: boolean; onAskDelete: () => void; onCancelDelete: () => void; onConfirmDelete: () => void }

function Hero({ g, onOpen, confirming, onAskDelete, onCancelDelete, onConfirmDelete }: CardProps) {
  const st = estado(g)
  const gauged = g.stage !== 'remojo' && g.stage !== 'secando'
  const attention = gauged && needsAttention(g)
  const w = gauged ? wateringGuide(g) : null
  return (
    <div className="mt-5">
      <button onClick={onOpen} className="relative block w-full text-left overflow-hidden" style={{ height: 400, background: '#000' }}>
        <img src={frontImg(g, 'front')} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: '50% 42%' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,.35) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 55%, rgba(0,0,0,.94) 100%)' }} />
        <div className="absolute left-6 top-5 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: g.light && gauged ? 'var(--blue)' : 'var(--faint)' }} />
          <span className="label" style={{ color: '#fff' }}>{g.stage === 'remojo' ? 'En remojo' : g.stage === 'secando' ? 'Cosechado' : g.light ? 'Luz encendida' : 'Luz apagada'}</span>
        </div>
        <div className="absolute left-6 right-6 bottom-5 flex items-end justify-between gap-4">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="label" style={{ color: 'var(--muted)' }}>{meta(g)}</div>
            <div className="display text-[1.75rem] font-semibold leading-none truncate">{g.grow}</div>
          </div>
          {g.stage !== 'remojo' && (
            <div className="flex flex-col items-end gap-1 flex-none">
              <div className="mono text-[2.1rem] font-medium leading-none">{g.day}</div>
              <div className="label">días</div>
            </div>
          )}
        </div>
      </button>
      <div className="px-6">
        <div className="flex items-center gap-2.5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,.12)' }}>
          {attention ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" /></svg>
              <span className="text-[.88rem] font-medium">Riega hoy</span>
              {w && <span className="label ml-auto">{w.amount}</span>}
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.text === 'OK' ? 'var(--blue)' : 'var(--faint)' }} />
              <span className="text-[.88rem] font-medium">{st.text === 'OK' ? 'Al día' : st.text}</span>
            </>
          )}
          <span className="ml-auto flex items-center gap-1.5">
            {confirming ? (
              <>
                <button onClick={onConfirmDelete} className="dbtn rojo">Eliminar</button>
                <button onClick={onCancelDelete} className="dbtn">No</button>
              </>
            ) : (
              <button onClick={onAskDelete} aria-label="Eliminar cultivo" title="Eliminar" className="xbtn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

function Row({ g, onOpen, confirming, onAskDelete, onCancelDelete, onConfirmDelete }: CardProps) {
  const st = estado(g)
  return (
    <div className="flex items-center" style={{ opacity: g.stage === 'secando' ? 0.8 : 1 }}>
      <button onClick={onOpen} className="hrow min-w-0">
        <img src={frontImg(g, 'front')} alt="" className="w-[54px] h-[54px] object-cover flex-none" style={{ borderRadius: 5, objectPosition: '50% 45%' }} />
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <div className="display font-semibold text-[1rem] truncate">{g.grow}</div>
          <div className="label truncate">{meta(g)}</div>
        </div>
        <span className="label flex-none" style={{ color: st.color }}>{st.text}</span>
      </button>
      {confirming ? (
        <div className="flex items-center gap-1.5 flex-none pl-2" style={{ borderBottom: '1px solid rgba(255,255,255,.12)', alignSelf: 'stretch' }}>
          <button onClick={onConfirmDelete} className="dbtn rojo">Eliminar</button>
          <button onClick={onCancelDelete} className="dbtn">No</button>
        </div>
      ) : (
        <span style={{ borderBottom: '1px solid rgba(255,255,255,.12)', alignSelf: 'stretch', display: 'flex', alignItems: 'center' }}>
          <button onClick={onAskDelete} aria-label="Eliminar cultivo" title="Eliminar" className="xbtn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </span>
      )}
    </div>
  )
}
