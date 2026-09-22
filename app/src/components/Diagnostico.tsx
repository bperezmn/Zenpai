import { useEffect, useRef, useState } from 'react'
import { useStore, selectActive } from '../store'
import { compressImage } from '../img'
import { diagnoseLeaf, type Diagnosis } from '../diagnose'
import Premium from './Premium'

type Step = 'pick' | 'analyzing' | 'result' | 'error'

// Revisar una hoja (Premium): foto → Claude (vía la función diagnose) → lo más probable,
// qué se ve y tres pasos. Es una orientación: nunca mostramos porcentajes de certeza.
// Hoja de la carpa: su "atrás" lo gestiona TentView; Premium local gestiona el suyo.
export default function Diagnostico({ onClose, onPremium }: { onClose: () => void; onPremium?: () => void }) {
  const c = useStore(selectActive)
  const premium = useStore((s) => s.premium)
  const addDiagnosis = useStore((s) => s.addDiagnosis)
  const [step, setStep] = useState<Step>('pick')
  const [blob, setBlob] = useState<Blob | null>(null)       // foto ya comprimida (la que va a la bitácora)
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<Diagnosis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPremium, setShowPremium] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const run = useRef(0) // descarta respuestas de un análisis anterior (otra foto o cierre)

  useEffect(() => () => { run.current++ }, [])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  async function analyze(b: Blob) {
    const id = ++run.current
    setStep('analyzing')
    setError(null)
    setResult(null)
    // nunca se queda en "Revisando": cualquier fallo inesperado acaba en el estado de error
    const r = await diagnoseLeaf(b, { stage: c.stage, substrate: c.substrate, day: c.day, strain: c.strain })
      .catch(() => ({ ok: false as const, error: 'No pudimos analizar la foto. Prueba de nuevo en un rato.' }))
    if (id !== run.current) return
    if (r.ok === true) { setResult(r.result); setStep('result') }
    else { setError(r.error); setStep('error') }
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const b = await compressImage(f)
      setBlob(b)
      setPreview(URL.createObjectURL(b))
      analyze(b)
    } catch {
      setBlob(null)
      setPreview(null)
      setError('No pudimos leer esa imagen. Prueba con otra foto.')
      setStep('error')
    }
  }

  function otraFoto() {
    run.current++
    setStep('pick')
    setResult(null)
    setError(null)
    setBlob(null)
    setPreview(null)
    fileRef.current?.click()
  }

  function toJournal() {
    if (!blob || !result) return
    addDiagnosis(blob, `${result.probable} · confianza ${result.confianza}`)
    onClose()
  }

  const sano = !!result && /^sin problemas/i.test(result.probable)

  return (
    <div className="absolute inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(2px)' }} />
      <div className="absolute left-0 right-0 bottom-0 glass rounded-t-3xl px-5 pt-3 pb-7 max-h-[88%] flex flex-col"
        onClick={(e) => e.stopPropagation()} style={{ animation: 'sheetUp .28s ease-out' }}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full flex-none" style={{ background: 'var(--glass-bd)' }} />
        <div className="flex items-center gap-2 mb-3 flex-none">
          <span className="label flex-1" style={{ color: '#fff' }}>Revisar una hoja</span>
          <span className="label" style={{ color: '#000', background: '#fff', padding: '4px 7px', borderRadius: 5 }}>Premium</span>
          <button onClick={onClose} aria-label="Cerrar" className="w-11 h-11 flex items-center justify-center flex-none" style={{ border: '1px solid rgba(255,255,255,.28)', borderRadius: 5, color: '#fff', background: 'transparent' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {!premium ? (
          <>
            <div className="overflow-y-auto -mx-1 px-1" style={{ minHeight: 0 }}>
              <h2 className="display text-[1.5rem] font-semibold leading-tight">Revisa una hoja con una foto</h2>
              <p className="text-[.875rem] leading-snug mt-2" style={{ color: 'var(--muted)' }}>
                Haz una foto de la hoja y te decimos lo más probable (carencias, riego, pH, calor, plagas u hongos) y tres pasos para corregirlo.
              </p>
              <p className="text-[.76rem] leading-snug mt-2" style={{ color: 'var(--faint)' }}>
                Es una orientación, no un diagnóstico seguro. Viene con Premium.
              </p>
            </div>
            <button onClick={() => (onPremium ? onPremium() : setShowPremium(true))} className="dgbtn w-full mt-5 flex-none">Ver Premium</button>
          </>
        ) : (
          <>
            <div className="overflow-y-auto -mx-1 px-1 flex flex-col gap-3" style={{ minHeight: 0 }}>
              <div className="flex-none flex items-center justify-center overflow-hidden" style={{ height: 190, border: '1px solid rgba(255,255,255,.16)', borderRadius: 5, background: 'var(--panel)' }}>
                {preview ? (
                  <img src={preview} alt="Foto de la hoja" className="w-full h-full object-cover" />
                ) : (
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 19c8 0 14-6 14-14-8 0-14 6-14 14z" /><path d="M5 19l7-7" /></svg>
                )}
              </div>

              {step === 'analyzing' && (
                <div className="flex items-center gap-2.5">
                  <span className="dgpulse w-1.5 h-1.5 rounded-full flex-none" style={{ background: 'var(--blue)' }} />
                  <p className="text-[.875rem]" style={{ color: 'var(--muted)' }}>Revisando la hoja. Puede tardar un poco.</p>
                </div>
              )}

              {step === 'error' && error && (
                <p className="text-[.875rem] leading-snug" style={{ color: 'var(--warn)' }}>{error}</p>
              )}

              {step === 'result' && result && (
                <>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      {result.ok ? (
                        <>
                          <span className="label" style={{ color: sano ? 'var(--blue)' : 'var(--warn)', border: `1px solid ${sano ? 'var(--blue)' : 'var(--warn)'}`, padding: '3px 7px', borderRadius: 5 }}>Probable</span>
                          <span className="label" style={{ color: 'var(--muted)' }}>Confianza {result.confianza}</span>
                        </>
                      ) : (
                        <span className="label" style={{ color: 'var(--muted)', border: '1px solid rgba(255,255,255,.3)', padding: '3px 7px', borderRadius: 5 }}>Foto no válida</span>
                      )}
                    </div>
                    <h2 className="display text-[1.5rem] font-semibold" style={{ lineHeight: 1.2 }}>{result.probable}</h2>
                    <p className="text-[.875rem]" style={{ color: 'var(--muted)', lineHeight: 1.45 }}>{result.observado}</p>
                  </div>

                  <div className="flex flex-col gap-3 px-4 py-3.5" style={{ border: '1px solid rgba(255,255,255,.14)', borderRadius: 5, background: 'var(--panel)' }}>
                    <span className="label" style={{ color: 'var(--muted)' }}>Qué hacer</span>
                    {result.pasos.map((p, i) => (
                      <div key={i} className="flex gap-3">
                        <span className="mono text-[.8rem] flex-none" style={{ color: 'var(--faint)', lineHeight: 1.6 }}>{String(i + 1).padStart(2, '0')}</span>
                        <span className="text-[.875rem]" style={{ lineHeight: 1.4 }}>{p}</span>
                      </div>
                    ))}
                  </div>

                  {result.aviso && (
                    <p className="text-[.76rem]" style={{ color: 'var(--faint)', lineHeight: 1.45 }}>{result.aviso}</p>
                  )}
                </>
              )}
            </div>

            <div className="flex-none mt-4">
              {step === 'pick' && (
                <>
                  <button onClick={() => fileRef.current?.click()} className="dgbtn w-full">Tomar foto de la hoja</button>
                  <p className="text-[.76rem] text-center mt-2" style={{ color: 'var(--faint)' }}>Hoja entera, con buena luz, sin flash.</p>
                </>
              )}
              {step === 'error' && (
                blob ? (
                  <div className="flex gap-2">
                    <button onClick={otraFoto} className="dgbtn-ghost flex-1">Otra foto</button>
                    <button onClick={() => analyze(blob)} className="dgbtn flex-1">Reintentar</button>
                  </div>
                ) : (
                  <button onClick={otraFoto} className="dgbtn w-full">Otra foto</button>
                )
              )}
              {step === 'result' && result && (
                result.ok ? (
                  <div className="flex gap-2">
                    <button onClick={otraFoto} className="dgbtn-ghost flex-1">Otra foto</button>
                    <button onClick={toJournal} className="dgbtn flex-1">A la bitácora</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={onClose} className="dgbtn-ghost flex-1">Cerrar</button>
                    <button onClick={otraFoto} className="dgbtn flex-1">Otra foto</button>
                  </div>
                )
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
          </>
        )}
      </div>

      {showPremium && <Premium onClose={() => setShowPremium(false)} />}

      <style>{`
        @keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        .dgbtn{height:52px;border:none;border-radius:5px;background:#fff;color:#000;font-family:'Instrument Sans',system-ui,sans-serif;font-weight:600;font-size:.94rem;cursor:pointer}
        .dgbtn-ghost{height:52px;border:1px solid rgba(255,255,255,.4);border-radius:5px;background:transparent;color:#fff;font-family:'Instrument Sans',system-ui,sans-serif;font-weight:600;font-size:.94rem;cursor:pointer}
        @keyframes dgpulse{0%,100%{opacity:1}50%{opacity:.3}}
        .dgpulse{animation:dgpulse 1.4s ease-in-out infinite}
        @media (prefers-reduced-motion:reduce){.dgpulse{animation:none}}
      `}</style>
    </div>
  )
}
