import { useRef, useState } from 'react'
import { useStore } from '../store'
import { CONSENT_VERSION } from '../lib'
import { GUIDES } from './Onboarding'
import { useBackClose } from '../useBackClose'

// Ajustes: experiencia, recordatorios, datos y privacidad (respaldo/borrado) y aviso legal.
export default function Settings({ onClose }: { onClose: () => void }) {
  const guide = useStore((s) => s.guide)
  const setGuide = useStore((s) => s.setGuide)
  const notifyEnabled = useStore((s) => s.notifyEnabled)
  const setNotify = useStore((s) => s.setNotify)
  const exportBackup = useStore((s) => s.exportBackup)
  const importBackup = useStore((s) => s.importBackup)
  const wipeAll = useStore((s) => s.wipeAll)
  const growsCount = useStore((s) => s.grows.length)
  const [denied, setDenied] = useState(false)
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)
  const [dataMsg, setDataMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [confirmImport, setConfirmImport] = useState<{ data: unknown; cultivos: number; fotos: number } | null>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [showLegal, setShowLegal] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const canNotify = typeof Notification !== 'undefined'

  // dos capas de atrás: la confirmación abierta (si la hay) se cierra primero;
  // el siguiente atrás sí cierra Ajustes (cada una con su entrada propia, ver useBackClose)
  useBackClose(true, onClose)
  useBackClose(confirmImport != null || confirmWipe, () => { setConfirmImport(null); setConfirmWipe(false) })

  async function toggleNotify() {
    if (notifyEnabled) { setNotify(false); return }
    setDenied(false)
    const p = await Notification.requestPermission()
    if (p === 'granted') setNotify(true)
    else setDenied(true)
  }

  async function doExport() {
    setBusy('export')
    setDataMsg(null)
    try {
      const blob = await exportBackup()
      const stamp = new Date().toISOString().slice(0, 10)
      const name = `zenpai-respaldo-${stamp}.json`
      // en PWA instalada (iOS sobre todo) la descarga clásica puede no funcionar:
      // si hay hoja de compartir con archivos, es la vía fiable
      const file = new File([blob], name, { type: 'application/json' })
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        try {
          await navigator.share({ files: [file], title: 'Respaldo de zenpai' })
          setDataMsg({ ok: true, text: 'Respaldo compartido ✓ Guárdalo donde no se pierda.' })
          setBusy(null)
          return
        } catch (err) {
          if ((err as Error)?.name === 'AbortError') { setBusy(null); return } // canceló: sin drama
          /* share falló → intentar descarga clásica */
        }
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
      // la plataforma no permite confirmar que la descarga ocurrió: copy honesto
      setDataMsg({ ok: true, text: `Respaldo generado (${name}) — comprueba tus descargas/Archivos y guárdalo a salvo.` })
    } catch {
      setDataMsg({ ok: false, text: 'No se pudo generar el respaldo. Vuelve a intentar.' })
    }
    setBusy(null)
  }

  async function onPickBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setDataMsg(null)
    try {
      const data = JSON.parse(await f.text()) as { app?: string; schema?: number; grows?: unknown[]; photos?: unknown[] } | null
      // validación barata ANTES de la confirmación: no llamar "respaldo" a cualquier JSON
      if (!data || data.app !== 'zenpai' || !Array.isArray(data.grows)) {
        setDataMsg({ ok: false, text: 'Ese archivo no es un respaldo de zenpai.' })
        return
      }
      if ((data.schema ?? 1) > 1) {
        setDataMsg({ ok: false, text: 'El respaldo es de una versión más nueva de zenpai. Actualiza la app.' })
        return
      }
      setConfirmImport({ data, cultivos: data.grows.length, fotos: Array.isArray(data.photos) ? data.photos.length : 0 })
    } catch {
      setDataMsg({ ok: false, text: 'Ese archivo no se pudo leer como respaldo.' })
    }
  }

  async function doImport() {
    if (confirmImport == null) return
    setBusy('import')
    const err = await importBackup(confirmImport.data)
    setBusy(null)
    setConfirmImport(null)
    setDataMsg(err ? { ok: false, text: err } : { ok: true, text: 'Respaldo importado ✓ Tus cultivos ya están aquí.' })
  }

  return (
    <div className="absolute inset-0 z-50 overflow-y-auto px-6 py-10"
      style={{ background: 'radial-gradient(80% 45% at 50% 12%, rgba(52,211,153,.1), transparent 60%), linear-gradient(180deg,#0a1210,#05080b)' }}>
      <button onClick={onClose} className="h-9 px-3.5 rounded-2xl glass text-white/85"
        style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: '.72rem' }}>Volver</button>

      <h2 className="display text-[1.4rem] font-bold mt-5">Ajustes</h2>

      <label className="olbl mt-6 mb-2 block">Tu experiencia <span className="osub">→ cuánto te guío</span></label>
      <div className="space-y-[9px]">
        {GUIDES.map((g) => (
          <button key={g.id} onClick={() => setGuide(g.id)} className={`olevel ${guide === g.id ? 'on' : ''}`}>
            <span className="oname">{g.label}</span>
            <span className="odesc">{g.desc}</span>
          </button>
        ))}
      </div>

      {canNotify && (
        <>
          <label className="olbl mt-7 mb-2 block">Recordatorios</label>
          <button onClick={toggleNotify} className={`olevel ${notifyEnabled ? 'on' : ''}`}>
            <span className="oname flex items-center justify-between w-full">
              💧 Aviso de riego
              <span className="text-[.72rem] font-bold px-2 py-1 rounded-full"
                style={notifyEnabled ? { background: 'linear-gradient(135deg,var(--acc),var(--acc2))', color: '#04150c' } : { background: 'rgba(255,255,255,.08)', color: 'var(--muted)' }}>
                {notifyEnabled ? 'Activado' : 'Desactivado'}
              </span>
            </span>
            <span className="odesc">
              Máx. 1 notificación al día cuando a un cultivo le toque regar. Funciona mientras zenpai
              esté abierta o en segundo plano; los avisos con la app cerrada llegarán en una próxima versión.
            </span>
          </button>
          {denied && (
            <p className="text-[.68rem] mt-2" style={{ color: 'var(--warn)' }}>
              El navegador bloqueó el permiso. Actívalo en los ajustes del sitio y vuelve a intentar.
            </p>
          )}
        </>
      )}

      <label className="olbl mt-7 mb-2 block">Datos y privacidad</label>
      <div className="olevel" style={{ cursor: 'default' }}>
        <span className="oname">📦 Tus datos viven aquí</span>
        <span className="odesc">
          Todo se guarda SOLO en este dispositivo: sin cuentas, sin nube, sin rastreo. Las fotos
          se limpian de metadatos (GPS incluido) antes de guardarse. Por eso mismo, si pierdes el
          dispositivo o borras el navegador, se pierden — descarga un respaldo de vez en cuando.
        </span>
        <div className="flex gap-2 mt-2.5">
          <button onClick={doExport} disabled={busy !== null} className="dbtn flex-1" style={{ opacity: busy === 'export' ? 0.6 : 1 }}>
            {busy === 'export' ? '⬇️ Generando…' : '⬇️ Exportar respaldo'}
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={busy !== null} className="dbtn-ghost flex-1">⬆️ Importar</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onPickBackup} />
        {dataMsg && (
          <p className="text-[.7rem] mt-2" style={{ color: dataMsg.ok ? 'var(--acc)' : 'var(--warn)' }}>{dataMsg.text}</p>
        )}
      </div>

      {confirmImport != null && (
        <div className="olevel mt-2" style={{ borderColor: 'var(--warn)', cursor: 'default' }}>
          <span className="oname">¿Importar este respaldo?</span>
          <span className="odesc">
            Contiene {confirmImport.cultivos} {confirmImport.cultivos === 1 ? 'cultivo' : 'cultivos'} y {confirmImport.fotos} {confirmImport.fotos === 1 ? 'foto' : 'fotos'}.
            Reemplaza lo que hay ahora ({growsCount} {growsCount === 1 ? 'cultivo' : 'cultivos'} y su bitácora).
          </span>
          <div className="flex gap-2 mt-2.5">
            <button onClick={() => setConfirmImport(null)} className="dbtn-ghost flex-1">Cancelar</button>
            <button onClick={doImport} disabled={busy === 'import'} className="dbtn flex-1">{busy === 'import' ? 'Importando…' : 'Sí, reemplazar'}</button>
          </div>
        </div>
      )}

      <div className="olevel mt-2" style={{ cursor: 'default' }}>
        {confirmWipe ? (
          <>
            <span className="oname" style={{ color: '#f87171' }}>¿Borrar TODO?</span>
            <span className="odesc">Cultivos, bitácoras, fotos y ajustes. No hay vuelta atrás (salvo un respaldo exportado).</span>
            <div className="flex gap-2 mt-2.5">
              <button onClick={() => setConfirmWipe(false)} className="dbtn flex-1">No, conservar</button>
              <button onClick={() => wipeAll()} className="dbtn-danger flex-1">Sí, borrar todo</button>
            </div>
          </>
        ) : (
          <button onClick={() => setConfirmWipe(true)} className="text-left w-full" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            <span className="oname" style={{ color: '#f87171' }}>🗑 Borrar todos mis datos</span>
            <span className="odesc block mt-1">Elimina cultivos, bitácoras, fotos y ajustes de este dispositivo.</span>
          </button>
        )}
      </div>

      <label className="olbl mt-7 mb-2 block">Aviso legal</label>
      <div className="olevel" style={{ cursor: 'default' }}>
        <button onClick={() => setShowLegal((v) => !v)} className="text-left w-full" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
          <span className="oname flex items-center justify-between w-full">⚖️ Lo que aceptaste al entrar
            <span style={{ color: 'var(--faint)', fontSize: '.8rem' }}>{showLegal ? '▾' : '▸'}</span>
          </span>
        </button>
        {showLegal && (
          <span className="odesc mt-1.5">
            · Confirmaste ser mayor de edad según la ley de tu país (18+/21+).<br />
            · zenpai es una <b>herramienta educativa</b>: no es consejo legal ni médico, y no sustituye tu criterio.<br />
            · Eres responsable de cumplir la legislación de tu territorio; cultivar puede no ser legal donde vives.<br />
            · zenpai <b>no facilita la compra ni venta</b> de cannabis, semillas ni insumos.<br />
            · Privacidad por diseño: sin cuentas ni rastreo; datos y fotos solo en tu dispositivo, fotos sin GPS.<br />
            <span style={{ color: 'var(--faint)' }}>Términos v{CONSENT_VERSION} · si cambian, te los volveremos a mostrar.</span>
          </span>
        )}
      </div>

      <style>{`
        .olbl{font-size:.62rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);font-family:'Space Grotesk'}
        .osub{color:var(--faint);text-transform:none;letter-spacing:0}
        .olevel{width:100%;display:flex;flex-direction:column;gap:4px;text-align:left;background:rgba(255,255,255,.04);border:1px solid var(--glass-bd);border-radius:15px;padding:.85rem 1rem;cursor:pointer;color:var(--text);font-family:'Space Grotesk';transition:.15s}
        .olevel.on{background:linear-gradient(135deg,rgba(52,211,153,.22),rgba(190,242,100,.1));border-color:var(--acc)}
        .olevel .oname{font-weight:700;font-size:1rem}
        .olevel.on .oname{color:var(--acc)}
        .olevel .odesc{font-size:.72rem;color:var(--faint);line-height:1.45;font-family:'Inter'}
        .olevel .odesc b{color:var(--muted)}
        .dbtn{height:38px;border:none;border-radius:12px;font-family:'Space Grotesk';font-weight:700;font-size:.74rem;cursor:pointer;background:linear-gradient(135deg,var(--acc),var(--acc2));color:#04150c;white-space:nowrap}
        .dbtn-ghost{height:38px;border:1px solid var(--glass-bd);border-radius:12px;font-family:'Space Grotesk';font-weight:600;font-size:.74rem;cursor:pointer;background:rgba(255,255,255,.05);color:var(--text);white-space:nowrap}
        .dbtn-danger{height:38px;border:none;border-radius:12px;font-family:'Space Grotesk';font-weight:700;font-size:.74rem;cursor:pointer;background:#f87171;color:#1a0606;white-space:nowrap}
      `}</style>
    </div>
  )
}
