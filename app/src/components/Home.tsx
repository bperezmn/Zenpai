import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { Logo } from '../App'
import { frontImg, stageLabel, dateForDay, type Cultivo } from '../lib'
import { needsAttention } from '../mentor'
import Settings from './Settings'

const SUB_ICON: Record<string, string> = { tierra: '🟤', coco: '🥥', hidro: '💧' }

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

  return (
    <div className="absolute inset-0 overflow-y-auto px-5 pb-28 pt-12"
      style={{ background: 'radial-gradient(80% 40% at 50% 10%, rgba(52,211,153,.12), transparent 60%), linear-gradient(180deg,#0a1210,#05080b)' }}>
      <div className="flex items-center gap-3 mb-1">
        <Logo size={38} />
        <div className="flex-1">
          <h1 className="display text-[1.4rem] font-bold leading-none">Mis cultivos</h1>
          <p className="text-[.72rem] mt-1" style={{ color: 'var(--muted)' }}>
            {grows.length === 0 ? 'Empieza tu primer cultivo' : `${grows.length} ${grows.length === 1 ? 'cultivo' : 'cultivos'}`}
          </p>
        </div>
        <button onClick={() => setShowSettings(true)} className="h-9 px-3.5 rounded-2xl glass text-white/85"
          style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: '.72rem' }}>Ajustes</button>
      </div>

      {showSettings && <Settings onClose={() => setShowSettings(false)} />}

      {grows.length === 0 ? (
        <div className="flex flex-col items-center text-center mt-20 px-4">
          <div className="text-[3rem] mb-3">🌱</div>
          <h2 className="display text-[1.15rem] font-bold">Aún no tienes cultivos</h2>
          <p className="text-[.85rem] mt-2 mb-7" style={{ color: 'var(--muted)' }}>
            Crea tu carpa virtual y zenpai te guía de la germinación a la cosecha.
          </p>
          <button className="cbtn" onClick={startNew}>🌱 Crear mi primer cultivo</button>
          <button onClick={seedDemo} className="mt-4 text-[.74rem] font-semibold underline underline-offset-4"
            style={{ color: 'var(--faint)', background: 'none', border: 'none', cursor: 'pointer' }}>
            👀 O explora con cultivos de ejemplo
          </button>
        </div>
      ) : (
        <div className="space-y-2.5 mt-5">
          {sorted.map((g) => (
            <Card key={g.id} g={g}
              onOpen={() => openGrow(g.id)}
              confirming={confirmId === g.id}
              onAskDelete={() => setConfirmId(g.id)}
              onCancelDelete={() => setConfirmId(null)}
              onConfirmDelete={() => { setConfirmId(null); deleteGrow(g.id) }}
            />
          ))}
        </div>
      )}

      {grows.length > 0 && (
        <button className="cbtn-fixed" onClick={startNew}>+ Nuevo cultivo</button>
      )}

      <style>{`
        .cbtn{width:100%;max-width:320px;border:none;border-radius:15px;font-weight:700;padding:.9rem;font-family:'Space Grotesk';font-size:.92rem;cursor:pointer;background:linear-gradient(135deg,var(--acc),var(--acc2));color:#04150c}
        .cbtn-fixed{position:absolute;left:20px;right:20px;bottom:20px;border:none;border-radius:15px;font-weight:700;padding:.9rem;font-family:'Space Grotesk';font-size:.92rem;cursor:pointer;background:linear-gradient(135deg,var(--acc),var(--acc2));color:#04150c;box-shadow:0 10px 26px -8px var(--glow)}
      `}</style>
    </div>
  )
}

function Card({ g, onOpen, confirming, onAskDelete, onCancelDelete, onConfirmDelete }: {
  g: Cultivo
  onOpen: () => void
  confirming: boolean
  onAskDelete: () => void
  onCancelDelete: () => void
  onConfirmDelete: () => void
}) {
  const done = g.stage === 'secando'
  const finished = g.finishedTs != null
  const remojo = g.stage === 'remojo'
  const badge = remojo ? '🫘 Germinando' : finished ? '🫙 Terminado' : done ? '🌾 Cosechado' : `Día ${g.day} · ${stageLabel[g.stage]}`
  const sub = remojo ? '' : finished && g.dryWeight ? `⚖️ ${g.dryWeight} g secos` : `${SUB_ICON[g.substrate]} ${dateForDay(g.germTs, 0).replace('· ', '')}`
  // la respuesta a "¿qué hago hoy?" sin entrar a la carpa (needsAttention ya evalúa
  // el riego en plántula/veg/flor/cosecha con umbral propio por etapa)
  const gauged = !done && !remojo
  const attention = gauged && needsAttention(g)
  return (
    <div className="glass rounded-2xl p-2.5 flex items-center gap-3 relative" style={{ opacity: done ? 0.82 : 1 }}>
      <button onClick={onOpen} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <img src={frontImg(g, 'front')} alt="" className="w-14 h-14 rounded-xl object-cover flex-none"
          style={{ border: '1px solid var(--glass-bd)' }} />
        <div className="min-w-0 flex-1">
          <div className="display font-bold text-[.95rem] truncate">{g.grow}</div>
          <div className="text-[.72rem] mt-0.5 flex items-center gap-1.5 flex-wrap" style={{ color: 'var(--muted)' }}>
            <span className="font-semibold px-1.5 py-0.5 rounded-full text-[.62rem] whitespace-nowrap"
              style={{ background: remojo || !done ? 'linear-gradient(135deg,var(--acc),var(--acc2))' : 'rgba(255,255,255,.08)', color: done && !remojo ? 'var(--muted)' : '#04150c' }}>
              {badge}
            </span>
            {sub && <span className="whitespace-nowrap">{sub}</span>}
            {gauged && (
              <span className="flex-none font-bold px-1.5 py-0.5 rounded-full text-[.6rem] whitespace-nowrap"
                style={attention
                  ? { background: 'rgba(232,179,75,.16)', color: 'var(--warn)' }
                  : { background: 'rgba(52,211,153,.13)', color: 'var(--acc)' }}>
                {attention ? '💧 Riega hoy' : '✓ Al día'}
              </span>
            )}
          </div>
        </div>
      </button>

      {confirming ? (
        <div className="flex items-center gap-1.5 flex-none">
          <button onClick={onConfirmDelete} className="text-[.7rem] font-bold px-2.5 py-1.5 rounded-xl" style={{ background: '#f87171', color: '#1a0606' }}>Eliminar</button>
          <button onClick={onCancelDelete} className="text-[.7rem] font-semibold px-2 py-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,.08)', color: 'var(--muted)' }}>No</button>
        </div>
      ) : (
        <button onClick={onAskDelete} title="Eliminar" className="flex-none w-8 h-8 rounded-xl flex items-center justify-center text-white/40 hover:text-white/70" style={{ fontSize: '1rem' }}>✕</button>
      )}
    </div>
  )
}
