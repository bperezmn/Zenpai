import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { getPhoto } from '../db'
import { fmtWhen } from '../lib'
import { photoFrames, frameForDay, type PhotoFrame } from '../timelapse'

// Caché de object URLs (photoId → URL) compartida por las instancias montadas.
// Se revoca ENTERA al desmontarse la última: fuera de la vista no queda ninguna viva.
const cache = new Map<number, string>()
const pending = new Map<number, Promise<string | null>>()
let mounted = 0

// URL de la foto ya decodificada: el fundido arranca con la imagen lista, sin parpadeo
function urlFor(photoId: number): Promise<string | null> {
  const hit = cache.get(photoId)
  if (hit) return Promise.resolve(hit)
  const inflight = pending.get(photoId)
  if (inflight) return inflight
  const p = getPhoto(photoId)
    .then(async (ph) => {
      if (!ph || mounted === 0) return null
      const url = URL.createObjectURL(ph.blob)
      cache.set(photoId, url)
      const img = new Image()
      img.src = url
      await img.decode().catch(() => {})
      return url
    })
    .catch(() => null)
    .finally(() => { pending.delete(photoId) })
  pending.set(photoId, p)
  return p
}

// Tu timelapse: la foto de tu bitácora que corresponde al día señalado, a pantalla completa
// sobre la escena. Arrastrar la línea de tiempo pasa de una foto a otra con un fundido corto;
// las vecinas se precargan para que el paso sea inmediato.
// La etiqueta de abajo a la izquierda se puede subir con la variable CSS --scrub-meta-bottom.
export default function PhotoScrub({ day, className }: { day: number; className?: string }) {
  const events = useStore((s) => s.events)
  const frames = useMemo(() => photoFrames(events), [events])
  const target = frameForDay(frames, day)
  const [shown, setShown] = useState<{ url: string; prev: string | null; frame: PhotoFrame } | null>(null)
  const req = useRef(0)

  useEffect(() => {
    mounted++
    return () => {
      mounted--
      if (mounted === 0) {
        cache.forEach((u) => URL.revokeObjectURL(u))
        cache.clear()
      }
    }
  }, [])

  useEffect(() => {
    if (!target) return
    const my = ++req.current
    urlFor(target.photoId).then((url) => {
      if (!url || my !== req.current) return // llegó tarde: ya se pidió otro día
      setShown((s) => (s?.url === url ? { ...s, frame: target } : { url, prev: s?.url ?? null, frame: target }))
    })
    const i = frames.indexOf(target)
    ;[frames[i - 1], frames[i + 1]].forEach((n) => { if (n) urlFor(n.photoId) })
  }, [target, frames])

  if (!target || !shown) return null
  const f = shown.frame
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className ?? ''}`}>
      {shown.prev && <img src={shown.prev} alt="" className="absolute inset-0 w-full h-full object-cover" />}
      <img key={shown.url} src={shown.url} alt={`Tu foto del día ${f.day}`} className="absolute inset-0 w-full h-full object-cover pscrub-in" />
      <div className="absolute left-4 right-4 flex items-center gap-2" style={{ bottom: 'var(--scrub-meta-bottom, 16px)' }}>
        <span className="pscrub-tag">Día {f.day}</span>
        <span className="text-[.78rem] font-medium truncate" style={{ color: '#fff', textShadow: '0 1px 8px rgba(0,0,0,.85)' }}>{fmtWhen(f.ts)}</span>
      </div>
      <style>{`
        .pscrub-in{animation:pscrubIn .25s ease-out both}
        @keyframes pscrubIn{from{opacity:0}to{opacity:1}}
        @media (prefers-reduced-motion:reduce){.pscrub-in{animation:none}}
        .pscrub-tag{flex:none;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.3);border-radius:5px;padding:.3rem .6rem;color:#fff;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap}
      `}</style>
    </div>
  )
}
