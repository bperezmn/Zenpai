import { useRef, useState } from 'react'
import { useStore } from '../store'
import { CONSENT_VERSION } from '../lib'
import { cloudAvailable } from '../sync'
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
  const cloudOn = useStore((s) => s.cloudOn)
  const cloudBusy = useStore((s) => s.cloudBusy)
  const cloudError = useStore((s) => s.cloudError)
  const lastCloudSyncTs = useStore((s) => s.lastCloudSyncTs)
  const enableCloud = useStore((s) => s.enableCloud)
  const disableCloud = useStore((s) => s.disableCloud)
  const syncCloudNow = useStore((s) => s.syncCloudNow)
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
          setDataMsg({ ok: true, text: 'Respaldo compartido. Guárdalo donde no se pierda.' })
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
      setDataMsg({ ok: true, text: `Respaldo generado (${name}). Comprueba tus descargas o Archivos y guárdalo a salvo.` })
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
    setDataMsg(err ? { ok: false, text: err } : { ok: true, text: 'Respaldo importado. Tus cultivos ya están aquí.' })
  }

  const pill = (on: boolean) => (on
    ? { background: 'var(--blue)', color: '#fff' }
    : { background: 'rgba(255,255,255,.08)', color: 'var(--muted)' })

  return (
    <div className="absolute inset-0 z-50 overflow-y-auto px-6 py-10" style={{ background: '#000' }}>
      <button onClick={onClose} className="h-9 px-3.5 rounded-[5px] glass text-white/85"
        style={{ fontFamily: "'Instrument Sans', system-ui, sans-serif", fontWeight: 600, fontSize: '.82rem' }}>Volver</button>

      <h2 className="display text-[1.4rem] font-bold mt-5">Ajustes</h2>

      <div className="label mt-6 mb-2">Tu experiencia</div>
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
          <div className="label mt-7 mb-2">Recordatorios</div>
          <button onClick={toggleNotify} className={`olevel ${notifyEnabled ? 'on' : ''}`}>
            <span className="oname flex items-center justify-between w-full">
              Aviso de riego
              <span className="text-[.72rem] font-semibold px-2 py-1 rounded-[5px]" style={pill(notifyEnabled)}>
                {notifyEnabled ? 'Activado' : 'Desactivado'}
              </span>
            </span>
            <span className="odesc">
              Como mucho una notificación al día cuando a un cultivo le toque regar. Funciona mientras zenpai
              esté abierta o en segundo plano; los avisos con la app cerrada llegarán en una próxima versión.
            </span>
          </button>
          {denied && (
            <p className="text-[.74rem] mt-2" style={{ color: 'var(--warn)' }}>
              El navegador bloqueó el permiso. Actívalo en los ajustes del sitio y vuelve a intentar.
            </p>
          )}
        </>
      )}

      {cloudAvailable && (
        <>
          <div className="label mt-7 mb-2">Nube</div>
          <div className={`olevel ${cloudOn ? 'on' : ''}`} style={{ cursor: 'default' }}>
            <span className="oname flex items-center justify-between w-full">
              Respaldo en la nube
              <span className="text-[.72rem] font-semibold px-2 py-1 rounded-[5px]" style={pill(cloudOn)}>
                {cloudBusy ? 'Sincronizando…' : cloudOn ? 'Activado' : 'Desactivado'}
              </span>
            </span>
            <span className="odesc">
              Copia privada y anónima de tus cultivos, bitácoras y fotos, sin email ni nombre.
              Mientras no vincules un correo (próximamente), la copia queda ligada a este
              navegador: el respaldo por archivo sigue siendo tu red principal.
              {cloudOn && lastCloudSyncTs && (
                <> Última sincronización: {new Date(lastCloudSyncTs).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}.</>
              )}
            </span>
            <div className="flex gap-2 mt-2.5">
              {cloudOn ? (
                <>
                  <button onClick={() => syncCloudNow()} disabled={cloudBusy} className="dbtn flex-1" style={{ opacity: cloudBusy ? 0.6 : 1 }}>
                    {cloudBusy ? '…' : 'Sincronizar ahora'}
                  </button>
                  <button onClick={disableCloud} disabled={cloudBusy} className="dbtn-ghost flex-1">Pausar</button>
                </>
              ) : (
                <button onClick={() => enableCloud()} disabled={cloudBusy} className="dbtn flex-1" style={{ opacity: cloudBusy ? 0.6 : 1 }}>
                  {cloudBusy ? 'Conectando…' : 'Activar respaldo'}
                </button>
              )}
            </div>
            {cloudError && (
              <p className="text-[.74rem] mt-2" style={{ color: 'var(--warn)' }}>{cloudError}</p>
            )}
          </div>
        </>
      )}

      <div className="label mt-7 mb-2">Datos y privacidad</div>
      <div className="olevel" style={{ cursor: 'default' }}>
        <span className="oname">Tus datos viven aquí</span>
        <span className="odesc">
          Tus datos se guardan en este dispositivo: sin cuentas ni rastreo. Si activas la nube, se sube
          una copia anónima. Las fotos se limpian de metadatos (GPS incluido) antes de guardarse.
          Si pierdes el dispositivo o borras el navegador, se pierden: descarga un respaldo de vez en cuando.
        </span>
        <div className="flex gap-2 mt-2.5">
          <button onClick={doExport} disabled={busy !== null} className="dbtn flex-1" style={{ opacity: busy === 'export' ? 0.6 : 1 }}>
            {busy === 'export' ? 'Generando…' : 'Exportar respaldo'}
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={busy !== null} className="dbtn-ghost flex-1">Importar</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onPickBackup} />
        {dataMsg && (
          <p className="text-[.74rem] mt-2" style={{ color: dataMsg.ok ? 'var(--text)' : 'var(--warn)' }}>{dataMsg.text}</p>
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
            <span className="oname">¿Borrar todos tus datos?</span>
            <span className="odesc">
              Cultivos, bitácoras, fotos y ajustes. No hay vuelta atrás (salvo un respaldo exportado).
              {cloudOn && <> Además, tu copia en la nube es anónima: al borrar este dispositivo quedará inaccesible para siempre.</>}
            </span>
            <div className="flex gap-2 mt-2.5">
              <button onClick={() => setConfirmWipe(false)} className="dbtn-ghost flex-1">No, conservar</button>
              <button onClick={() => wipeAll()} className="dbtn-danger flex-1">Sí, borrar todo</button>
            </div>
          </>
        ) : (
          <button onClick={() => setConfirmWipe(true)} className="text-left w-full" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            <span className="oname" style={{ color: 'var(--danger)' }}>Borrar todos mis datos</span>
            <span className="odesc block mt-1">Elimina cultivos, bitácoras, fotos y ajustes de este dispositivo.</span>
          </button>
        )}
      </div>

      <div className="label mt-7 mb-2">Aviso legal</div>
      <div className="olevel" style={{ cursor: 'default' }}>
        <button onClick={() => setShowLegal((v) => !v)} className="text-left w-full" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
          <span className="oname flex items-center justify-between w-full">Lo que aceptaste al entrar
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
              style={{ transform: showLegal ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </button>
        {showLegal && (
          <span className="odesc mt-1.5">
            · Confirmaste ser mayor de edad según la ley de tu país (18+ / 21+).<br />
            · zenpai es una <b>herramienta educativa</b>: no es consejo legal ni médico, y no sustituye tu criterio.<br />
            · Eres responsable de cumplir la legislación de tu territorio; cultivar puede no ser legal donde vives.<br />
            · zenpai <b>no facilita la compra ni venta</b> de cannabis, semillas ni insumos.<br />
            · Privacidad por diseño: sin cuentas ni rastreo; datos y fotos en tu dispositivo, fotos sin GPS.<br />
            <span style={{ color: 'var(--faint)' }}>Términos v{CONSENT_VERSION}. Si cambian, te los volveremos a mostrar.</span>
          </span>
        )}
      </div>

      <style>{`
        .olevel{width:100%;display:flex;flex-direction:column;gap:4px;text-align:left;background:rgba(255,255,255,.04);border:1px solid var(--glass-bd);border-radius:5px;padding:.85rem 1rem;cursor:pointer;color:var(--text);font-family:'Instrument Sans',system-ui,sans-serif;transition:.15s}
        .olevel.on{background:rgba(31,115,183,.12);border-color:var(--blue)}
        .olevel .oname{font-weight:600;font-size:1rem}
        .olevel .odesc{font-size:.74rem;color:var(--muted);line-height:1.45}
        .olevel .odesc b{color:var(--text)}
        .dbtn{height:42px;padding:0 .5rem;border:none;border-radius:5px;font-family:'Instrument Sans',system-ui,sans-serif;font-weight:600;font-size:.82rem;cursor:pointer;background:#fff;color:#000}
        .dbtn-ghost{height:42px;padding:0 .5rem;border:1px solid rgba(255,255,255,.4);border-radius:5px;font-family:'Instrument Sans',system-ui,sans-serif;font-weight:600;font-size:.82rem;cursor:pointer;background:transparent;color:var(--text)}
        .dbtn-danger{height:42px;padding:0 .5rem;border:none;border-radius:5px;font-family:'Instrument Sans',system-ui,sans-serif;font-weight:600;font-size:.82rem;cursor:pointer;background:var(--danger);color:#fff}
      `}</style>
    </div>
  )
}
