import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, selectActive } from '../store'
import { getPhoto } from '../db'
import { compressImage } from '../img'
import { useBackClose } from '../useBackClose'
import { photoFrames } from '../timelapse'

type Mode = 'starting' | 'live' | 'denied' | 'unavailable'

const MAX_SIDE = 1600

// Cámara de "Tu timelapse": la foto del día con la última foto de la bitácora encima, en
// transparencia (piel de cebolla), para encuadrar igual cada día. Sin cámara (no hay
// getUserMedia o no hay permiso) queda la galería. Al cerrar no queda ninguna pista encendida.
export default function TimelapseCamera({ onClose }: { onClose: () => void }) {
  useBackClose(true, onClose)
  const day = useStore((s) => selectActive(s).day)
  const events = useStore((s) => s.events)
  const addPhoto = useStore((s) => s.addPhoto)
  const setToast = useStore((s) => s.setToast)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<Mode>('starting')
  const [ready, setReady] = useState(false) // el vídeo ya trae fotogramas
  const [guide, setGuide] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // guía: la foto más reciente de la bitácora
  const lastId = useMemo(() => {
    const f = photoFrames(events)
    return f.length ? f[f.length - 1].photoId : null
  }, [events])
  const [ghost, setGhost] = useState<string | null>(null)
  useEffect(() => {
    if (lastId == null) return
    let dead = false
    let url: string | null = null
    getPhoto(lastId).then((p) => {
      if (dead || !p) return
      url = URL.createObjectURL(p.blob)
      setGhost(url)
    }).catch(() => {})
    return () => { dead = true; if (url) URL.revokeObjectURL(url) }
  }, [lastId])

  // cámara trasera en vivo; al desmontar se paran TODAS las pistas
  useEffect(() => {
    const md = navigator.mediaDevices
    if (!md?.getUserMedia) { setMode('unavailable'); return }
    const v = videoRef.current
    let dead = false
    let stream: MediaStream | null = null
    // ideal (no exacto): sin tamaño, muchos móviles entregan 640×480
    md.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
      .then((s) => {
        if (dead) { s.getTracks().forEach((t) => t.stop()); return }
        stream = s
        // si la cámara se corta (otra app la toma, se retira el permiso) queda la galería:
        // un visor congelado guardaría fotos en negro. stop() no dispara 'ended'.
        s.getVideoTracks().forEach((t) => t.addEventListener('ended', () => { if (!dead) setMode('unavailable') }))
        if (v) {
          v.muted = true
          v.srcObject = s
          v.play().catch(() => {})
        }
        setMode('live')
      })
      .catch((e: unknown) => {
        if (dead) return
        const name = (e as { name?: string } | null)?.name
        setMode(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable')
      })
    return () => {
      dead = true
      stream?.getTracks().forEach((t) => t.stop())
      if (v) v.srcObject = null
    }
  }, [])

  function save(blob: Blob) {
    addPhoto(blob) // registra el evento 'foto' en la bitácora
    setToast(`Foto del día ${day} guardada`)
    onClose()
  }

  async function capture() {
    const v = videoRef.current
    if (!v || busy || !v.videoWidth || !v.videoHeight) return
    setBusy(true)
    setError(null)
    const scale = Math.min(1, MAX_SIDE / Math.max(v.videoWidth, v.videoHeight))
    const cv = document.createElement('canvas')
    cv.width = Math.max(1, Math.round(v.videoWidth * scale))
    cv.height = Math.max(1, Math.round(v.videoHeight * scale))
    const ctx = cv.getContext('2d')
    let blob: Blob | null = null
    if (ctx) {
      ctx.drawImage(v, 0, 0, cv.width, cv.height)
      blob = await new Promise<Blob | null>((res) => cv.toBlob(res, 'image/jpeg', 0.82))
    }
    if (!blob) {
      setBusy(false)
      setError('No pudimos guardar la foto. Prueba otra vez.')
      return
    }
    save(blob)
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = '' // permitir elegir la misma foto otra vez
    if (!f) return
    setBusy(true)
    setError(null)
    try {
      save(await compressImage(f)) // re-encode = fuera EXIF/GPS
    } catch {
      setBusy(false)
      setError('No pudimos leer esa imagen. Prueba con otra foto.')
    }
  }

  const live = mode === 'live'
  const noCamera = mode === 'denied' || mode === 'unavailable'
  const pickGallery = () => fileRef.current?.click()

  return (
    <div className="absolute inset-0 z-[60] tlc-in" style={{ background: '#000' }} onClick={(e) => e.stopPropagation()}>
      {/* visor: vídeo en vivo + la última foto encima al 35 % */}
      <video ref={videoRef} playsInline muted autoPlay
        onLoadedMetadata={(e) => setReady(e.currentTarget.videoWidth > 0)}
        onPlaying={(e) => setReady(e.currentTarget.videoWidth > 0)}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: live && ready ? 1 : 0 }} />
      {live && ghost && (
        <img src={ghost} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none tlc-onion"
          style={{ opacity: guide ? 0.35 : 0 }} />
      )}

      {/* barra superior */}
      <div className="absolute left-0 right-0 top-0 px-3.5 flex items-center gap-3" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <button onClick={onClose} aria-label="Cerrar" className="tlc-ico">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <span className="tlc-pill">Foto · día {day}</span>
      </div>

      {mode === 'starting' && (
        <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[.8rem]" style={{ color: 'var(--muted)' }}>
          Abriendo la cámara…
        </p>
      )}

      {/* sin cámara: mensaje tranquilo y la galería */}
      {noCamera && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-8 flex flex-col items-center text-center">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--muted)' }}>
            <path d="M4 8h3l2-2.5h6L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.5" />
          </svg>
          <h3 className="display font-semibold text-[1.05rem] mt-3">
            {mode === 'denied' ? 'La cámara no tiene permiso' : 'No pudimos abrir la cámara'}
          </h3>
          <p className="text-[.8rem] mt-1.5 leading-snug" style={{ color: 'var(--muted)', maxWidth: 300 }}>
            {mode === 'denied'
              ? 'Puedes darle permiso en los ajustes del navegador. Mientras, elige una foto de la galería.'
              : 'Elige una foto de la galería y la sumamos a tu timelapse.'}
          </p>
          <button onClick={pickGallery} disabled={busy} className="tlc-btn mt-5" style={{ opacity: busy ? 0.5 : 1 }}>
            {busy ? 'Guardando…' : 'Elegir de la galería'}
          </button>
          {error && <p className="text-[.76rem] mt-3" style={{ color: 'var(--warn)' }}>{error}</p>}
        </div>
      )}

      {/* abajo: consejo + galería · disparador · guía */}
      {!noCamera && (
        <div className="absolute left-0 right-0 bottom-0 px-5 pt-3" style={{ background: 'rgba(0,0,0,.6)', paddingBottom: 'max(28px, env(safe-area-inset-bottom))' }}>
          {error ? (
            <p className="text-[.76rem] text-center mb-3" style={{ color: 'var(--warn)' }}>{error}</p>
          ) : (
            <p className="text-[.76rem] text-center leading-snug mb-3" style={{ color: 'var(--muted)' }}>
              Misma hora y misma posición cada día: así el timelapse sale limpio.
            </p>
          )}
          <div className="flex items-center">
            <div className="flex-1 flex justify-start">
              <button onClick={pickGallery} disabled={busy} className="tlc-ghost">Galería</button>
            </div>
            <button onClick={capture} disabled={!live || !ready || busy} aria-label="Tomar foto" className="tlc-shutter"
              style={{ opacity: live && ready && !busy ? 1 : 0.4 }}>
              <span />
            </button>
            <div className="flex-1 flex justify-end">
              {live && ghost && (
                <button onClick={() => setGuide((g) => !g)} aria-pressed={guide} className={`tlc-ghost ${guide ? 'on' : 'off'}`}>Guía</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* sin `capture`: el selector nativo ofrece galería Y cámara del sistema */}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />

      <style>{`
        .tlc-in{animation:tlcIn .2s ease-out both}
        @keyframes tlcIn{from{opacity:0}to{opacity:1}}
        .tlc-onion{transition:opacity .2s ease}
        @media (prefers-reduced-motion:reduce){.tlc-in{animation:none}.tlc-onion{transition:none}}
        .tlc-ico{flex:none;width:44px;height:44px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.3);border-radius:5px;background:rgba(0,0,0,.5);color:#fff;cursor:pointer}
        .tlc-pill{height:32px;display:inline-flex;align-items:center;padding:0 .75rem;border:1px solid rgba(255,255,255,.3);border-radius:5px;background:rgba(0,0,0,.5);color:#fff;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:.66rem;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap}
        .tlc-btn{height:52px;width:100%;max-width:300px;border:none;border-radius:5px;background:#fff;color:#000;font-family:'Instrument Sans',system-ui,sans-serif;font-weight:600;font-size:.92rem;cursor:pointer}
        .tlc-ghost{height:44px;padding:0 .9rem;border:1px solid rgba(255,255,255,.4);border-radius:5px;background:transparent;color:var(--text);font-family:'Instrument Sans',system-ui,sans-serif;font-weight:600;font-size:.84rem;cursor:pointer;white-space:nowrap}
        .tlc-ghost.off{color:var(--muted)}
        .tlc-ghost.on{border-color:#fff;color:#fff;background:rgba(255,255,255,.08)}
        .tlc-ghost:disabled{opacity:.5}
        .tlc-shutter{flex:none;width:72px;height:72px;border-radius:50%;border:3px solid #fff;background:transparent;padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer}
        .tlc-shutter span{display:block;width:58px;height:58px;border-radius:50%;background:#fff}
        .tlc-shutter:active span{transform:scale(.92)}
      `}</style>
    </div>
  )
}
