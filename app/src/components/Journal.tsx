import { useEffect, useRef, useState } from 'react'
import { useStore, selectActive } from '../store'
import { EVENT_META, fmtWhen, type EventType, type GrowEvent } from '../lib'
import { getPhoto } from '../db'
import { compressImage } from '../img'

// Solo se pueden borrar registros "de diario". Los estructurales (sembrado, trasplante,
// floración, cosecha, terminado) definen el estado del cultivo: borrarlos dejaría la
// bitácora mintiendo (p.ej. un cultivo "secando" sin ninguna cosecha registrada).
const DELETABLE = new Set<EventType>(['riego', 'nota', 'medicion', 'sed', 'foto'])

const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 7h16" /><path d="M10 11v6" /><path d="M14 11v6" />
    <path d="M6 7l1 13h10l1-13" /><path d="M9 7V4h6v3" />
  </svg>
)

export default function Journal({ onClose }: { onClose: () => void }) {
  const events = useStore((s) => s.events)
  const grow = useStore((s) => selectActive(s).grow)
  const addNote = useStore((s) => s.addNote)
  const addPhoto = useStore((s) => s.addPhoto)
  const removeEvent = useStore((s) => s.removeEvent)
  const [writing, setWriting] = useState(false)
  const [text, setText] = useState('')
  const [delId, setDelId] = useState<number | null>(null)
  const [viewing, setViewing] = useState<number | null>(null) // photoId a pantalla completa
  const [busyPhoto, setBusyPhoto] = useState(false)
  const [photoError, setPhotoError] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const rows = [...events].reverse() // más reciente primero

  // miniaturas: cargar los blobs de los eventos con foto → object URLs (revocados al cerrar)
  const [urls, setUrls] = useState<Record<number, string>>({})
  useEffect(() => {
    let dead = false
    const created: string[] = []
    const ids = events.filter((e): e is GrowEvent & { photoId: number } => e.type === 'foto' && e.photoId != null).map((e) => e.photoId)
    Promise.all(ids.map(async (pid) => {
      const p = await getPhoto(pid).catch(() => undefined)
      return p ? ([pid, URL.createObjectURL(p.blob)] as const) : null
    })).then((pairs) => {
      if (dead) { pairs.forEach((p) => p && URL.revokeObjectURL(p[1])); return }
      const m: Record<number, string> = {}
      pairs.forEach((p) => { if (p) { m[p[0]] = p[1]; created.push(p[1]) } })
      setUrls(m)
    })
    return () => { dead = true; created.forEach((u) => URL.revokeObjectURL(u)) }
  }, [events])

  function saveNote() {
    addNote(text)
    setText('')
    setWriting(false)
  }

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = '' // permitir elegir la misma foto otra vez
    if (!f) return
    setBusyPhoto(true)
    setPhotoError(false)
    try {
      const blob = await compressImage(f) // re-encode = fuera EXIF/GPS
      addPhoto(blob)
    } catch {
      setPhotoError(true) // el toast global queda detrás de esta hoja: el aviso va aquí
    }
    setBusyPhoto(false)
  }

  return (
    <div className="absolute inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(2px)' }} />
      <div className="absolute left-0 right-0 bottom-0 glass rounded-t-3xl px-5 pt-3 pb-6 max-h-[72%] flex flex-col"
        onClick={(e) => e.stopPropagation()} style={{ animation: 'sheetUp .28s ease-out' }}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: 'var(--glass-bd)' }} />
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="display font-bold text-[1.05rem] leading-tight">Bitácora</h3>
            <div className="text-[.74rem] mt-0.5 truncate" style={{ color: 'var(--faint)' }}>
              {grow} · {events.length} {events.length === 1 ? 'evento' : 'eventos'}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-none">
            <button onClick={() => fileRef.current?.click()} className="jbtn-note" disabled={busyPhoto} style={{ opacity: busyPhoto ? 0.5 : 1 }}>
              {busyPhoto ? '…' : '+ Foto'}
            </button>
            {!writing && <button onClick={() => setWriting(true)} className="jbtn-note">+ Nota</button>}
          </div>
        </div>
        {/* sin `capture`: el selector nativo ya ofrece cámara O galería */}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
        {photoError && (
          <p className="text-[.74rem] mb-2" style={{ color: 'var(--warn)' }}>
            No pudimos leer esa imagen. Prueba con otra foto.
          </p>
        )}

        {writing && (
          <div className="mb-3 rounded-[5px] p-3" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--glass-bd)' }}>
            <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={3}
              placeholder="Apunta lo que quieras: «vi hojas amarillas», «cambié la lámpara»…"
              className="w-full bg-transparent resize-none outline-none text-[.85rem]"
              style={{ color: 'var(--text)' }} />
            <div className="flex gap-2 justify-end mt-1.5">
              <button onClick={() => { setWriting(false); setText('') }} className="jbtn-ghost">Cancelar</button>
              <button onClick={saveNote} disabled={!text.trim()} className="jbtn-save" style={{ opacity: text.trim() ? 1 : 0.45 }}>Guardar nota</button>
            </div>
          </div>
        )}

        {rows.length === 0 ? (
          <p className="text-[.82rem] py-8 text-center" style={{ color: 'var(--muted)' }}>
            Aún no hay registros. Riega o cuida tu cultivo y aparecerán aquí.
          </p>
        ) : (
          <div className="overflow-y-auto min-h-0 -mx-1 px-1 space-y-1.5">
            {rows.map((ev) => {
              const m = EVENT_META[ev.type]
              const confirming = delId != null && delId === ev.id
              const thumb = ev.type === 'foto' && ev.photoId != null ? urls[ev.photoId] : undefined
              return (
                <div key={ev.id} className="flex items-center gap-3 rounded-[5px] px-3 py-2.5"
                  style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--glass-bd)' }}>
                  {thumb && (
                    <button onClick={() => setViewing(ev.photoId!)} className="flex-none">
                      <img src={thumb} alt="foto del cultivo" className="w-12 h-12 rounded-[5px] object-cover" style={{ border: '1px solid var(--glass-bd)' }} />
                    </button>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[.85rem] font-semibold leading-tight">{ev.note || m.label}</div>
                    <div className="text-[.74rem] mt-0.5" style={{ color: 'var(--faint)' }}>{fmtWhen(ev.ts)} · {ev.type === 'sembrado' ? 'en remojo' : `día ${ev.day}`}</div>
                  </div>
                  {confirming ? (
                    <div className="flex items-center gap-1.5 flex-none">
                      <button onClick={() => { setDelId(null); if (ev.id != null) removeEvent(ev.id) }}
                        className="text-[.82rem] font-semibold px-2.5 py-1.5 rounded-[5px]" style={{ background: 'var(--danger)', color: '#fff' }}>Borrar</button>
                      <button onClick={() => setDelId(null)}
                        className="text-[.82rem] font-semibold px-2.5 py-1.5 rounded-[5px]" style={{ border: '1px solid rgba(255,255,255,.4)', color: 'var(--text)' }}>No</button>
                    </div>
                  ) : DELETABLE.has(ev.type) ? (
                    <button onClick={() => setDelId(ev.id ?? null)} title="Borrar registro" aria-label="Borrar registro"
                      className="flex-none w-8 h-8 rounded-[5px] flex items-center justify-center" style={{ color: 'var(--faint)' }}>
                      <TrashIcon />
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* visor de foto a pantalla completa */}
      {viewing != null && urls[viewing] && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center" onClick={(e) => { e.stopPropagation(); setViewing(null) }}
          style={{ background: 'rgba(0,0,0,.92)' }}>
          <img src={urls[viewing]} alt="foto del cultivo" className="max-w-full max-h-full object-contain" />
          <button onClick={() => setViewing(null)} className="absolute top-4 right-4 h-9 px-3.5 rounded-[5px] glass text-white/85"
            style={{ fontFamily: "'Instrument Sans', system-ui, sans-serif", fontWeight: 600, fontSize: '.82rem' }}>Cerrar</button>
        </div>
      )}

      <style>{`
        @keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        .jbtn-note{height:32px;padding:0 .75rem;border:1px solid rgba(255,255,255,.4);border-radius:5px;font-family:'Instrument Sans',system-ui,sans-serif;font-weight:600;font-size:.82rem;cursor:pointer;background:transparent;color:var(--text);white-space:nowrap}
        .jbtn-save{height:34px;padding:0 .9rem;border:none;border-radius:5px;font-family:'Instrument Sans',system-ui,sans-serif;font-weight:600;font-size:.82rem;cursor:pointer;background:#fff;color:#000}
        .jbtn-ghost{height:34px;padding:0 .8rem;border:1px solid rgba(255,255,255,.4);border-radius:5px;font-family:'Instrument Sans',system-ui,sans-serif;font-weight:600;font-size:.82rem;cursor:pointer;background:transparent;color:var(--text)}
      `}</style>
    </div>
  )
}
