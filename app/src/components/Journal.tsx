import { useEffect, useRef, useState } from 'react'
import { useStore, selectActive } from '../store'
import { EVENT_META, fmtWhen, type EventType, type GrowEvent } from '../lib'
import { getPhoto } from '../db'
import { compressImage } from '../img'

// Solo se pueden borrar registros "de diario". Los estructurales (sembrado, transplante,
// floración, cosecha, terminado) definen el estado del cultivo: borrarlos dejaría la
// bitácora mintiendo (p.ej. un cultivo "secando" sin ninguna cosecha registrada).
const DELETABLE = new Set<EventType>(['riego', 'nota', 'medicion', 'sed', 'foto'])

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
      <div className="absolute inset-0" style={{ background: 'rgba(3,6,9,.55)', backdropFilter: 'blur(2px)' }} />
      <div className="absolute left-0 right-0 bottom-0 glass rounded-t-3xl px-5 pt-3 pb-6 max-h-[72%] flex flex-col"
        onClick={(e) => e.stopPropagation()} style={{ animation: 'sheetUp .28s ease-out' }}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: 'var(--glass-bd)' }} />
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="display font-bold text-[1.05rem] flex-none">Bitácora</h3>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[.7rem] mr-0.5 min-w-0 truncate" style={{ color: 'var(--faint)' }}>{grow} · {events.length} {events.length === 1 ? 'evento' : 'eventos'}</span>
            <button onClick={() => fileRef.current?.click()} className="jbtn-note" disabled={busyPhoto} style={{ opacity: busyPhoto ? 0.5 : 1 }}>
              {busyPhoto ? '📷 …' : '+ Foto'}
            </button>
            {!writing && <button onClick={() => setWriting(true)} className="jbtn-note">+ Nota</button>}
          </div>
        </div>
        {/* sin `capture`: el selector nativo ya ofrece cámara O galería */}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
        {photoError && (
          <p className="text-[.7rem] mb-2" style={{ color: 'var(--warn)' }}>
            📷 No pudimos leer esa imagen. Prueba con otra foto.
          </p>
        )}

        {writing && (
          <div className="mb-3 rounded-2xl p-3" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--glass-bd)' }}>
            <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={3}
              placeholder="Apunta lo que quieras: «vi hojas amarillas», «cambié la lámpara»…"
              className="w-full bg-transparent resize-none outline-none text-[.85rem]"
              style={{ color: 'var(--text)' }} />
            <div className="flex gap-2 justify-end mt-1.5">
              <button onClick={() => { setWriting(false); setText('') }} className="jbtn-ghost">Cancelar</button>
              <button onClick={saveNote} disabled={!text.trim()} className="jbtn-save" style={{ opacity: text.trim() ? 1 : 0.45 }}>📝 Guardar nota</button>
            </div>
          </div>
        )}

        {rows.length === 0 ? (
          <p className="text-[.82rem] py-8 text-center" style={{ color: 'var(--muted)' }}>
            Aún no hay registros. Riega o cuida tu cultivo y aparecerán aquí 🌿
          </p>
        ) : (
          <div className="overflow-y-auto min-h-0 -mx-1 px-1 space-y-1.5">
            {rows.map((ev) => {
              const m = EVENT_META[ev.type]
              const confirming = delId != null && delId === ev.id
              const thumb = ev.type === 'foto' && ev.photoId != null ? urls[ev.photoId] : undefined
              return (
                <div key={ev.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
                  style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--glass-bd)' }}>
                  {thumb ? (
                    <button onClick={() => setViewing(ev.photoId!)} className="flex-none">
                      <img src={thumb} alt="foto del cultivo" className="w-12 h-12 rounded-xl object-cover" style={{ border: '1px solid var(--glass-bd)' }} />
                    </button>
                  ) : (
                    <span className="text-[1.15rem] leading-none">{m.icon}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[.85rem] font-semibold leading-tight">{ev.note || m.label}</div>
                    <div className="text-[.66rem]" style={{ color: 'var(--faint)' }}>{fmtWhen(ev.ts)} · {ev.type === 'sembrado' ? 'en remojo' : `día ${ev.day}`}</div>
                  </div>
                  {confirming ? (
                    <div className="flex items-center gap-1.5 flex-none">
                      <button onClick={() => { setDelId(null); if (ev.id != null) removeEvent(ev.id) }}
                        className="text-[.68rem] font-bold px-2.5 py-1.5 rounded-xl" style={{ background: '#f87171', color: '#1a0606' }}>Borrar</button>
                      <button onClick={() => setDelId(null)}
                        className="text-[.68rem] font-semibold px-2 py-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,.08)', color: 'var(--muted)' }}>No</button>
                    </div>
                  ) : DELETABLE.has(ev.type) ? (
                    <button onClick={() => setDelId(ev.id ?? null)} title="Borrar registro" aria-label="Borrar registro"
                      className="flex-none w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60" style={{ fontSize: '.85rem' }}>✕</button>
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
          style={{ background: 'rgba(3,6,9,.92)' }}>
          <img src={urls[viewing]} alt="foto del cultivo" className="max-w-full max-h-full object-contain" />
          <button onClick={() => setViewing(null)} className="absolute top-4 right-4 h-9 px-3.5 rounded-2xl glass text-white/85"
            style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: '.72rem' }}>Cerrar</button>
        </div>
      )}

      <style>{`
        @keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        .jbtn-note{height:28px;padding:0 .7rem;border:none;border-radius:999px;font-family:'Space Grotesk';font-weight:700;font-size:.68rem;cursor:pointer;background:linear-gradient(135deg,var(--acc),var(--acc2));color:#04150c;white-space:nowrap}
        .jbtn-save{height:30px;padding:0 .8rem;border:none;border-radius:11px;font-family:'Space Grotesk';font-weight:700;font-size:.72rem;cursor:pointer;background:linear-gradient(135deg,var(--acc),var(--acc2));color:#04150c}
        .jbtn-ghost{height:30px;padding:0 .7rem;border:1px solid var(--glass-bd);border-radius:11px;font-weight:600;font-size:.72rem;cursor:pointer;background:rgba(255,255,255,.05);color:var(--muted)}
      `}</style>
    </div>
  )
}
