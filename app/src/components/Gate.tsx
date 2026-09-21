import { useState } from 'react'
import { useStore } from '../store'
import { Logo } from '../App'

// Control de edad + consentimiento legal (bloqueante, versionado).
// Sin esto la app no es publicable: es la barrera mínima y más barata.
export default function Gate() {
  const acceptConsent = useStore((s) => s.acceptConsent)
  const [age, setAge] = useState(false)
  const [terms, setTerms] = useState(false)
  const ok = age && terms

  const Check = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )

  return (
    <div className="absolute inset-0 z-[60] overflow-y-auto px-6 py-10 flex flex-col justify-center" style={{ background: '#000' }}>
      <div className="mx-auto mb-3"><Logo size={52} /></div>
      <h1 className="display grad-text text-center text-[1.7rem] font-bold leading-none">zenpai</h1>
      <p className="text-center text-[.8rem] mt-1.5 mb-5" style={{ color: 'var(--muted)' }}>tu mentor de cultivo</p>

      <div className="glass rounded-[5px] p-4 space-y-3">
        <button onClick={() => setAge((v) => !v)} className="chk" aria-pressed={age}>
          <span className={`box ${age ? 'on' : ''}`}>{age && <Check />}</span>
          <span>Confirmo que soy <b>mayor de edad</b> según la ley de mi país (18+ / 21+).</span>
        </button>
        <button onClick={() => setTerms((v) => !v)} className="chk" aria-pressed={terms}>
          <span className={`box ${terms ? 'on' : ''}`}>{terms && <Check />}</span>
          <span>
            Entiendo que zenpai es una <b>herramienta educativa</b>, no consejo legal ni médico; soy
            responsable de cumplir la legislación de mi territorio, y zenpai <b>no facilita la compra ni venta</b> de cannabis.
          </span>
        </button>
      </div>

      <p className="text-center text-[.74rem] mt-3 px-2" style={{ color: 'var(--faint)' }}>
        Tus datos se guardan <b>solo en este dispositivo</b>. No pedimos nombre real ni ubicación.
      </p>

      <button className="gbtn mt-5" disabled={!ok} onClick={acceptConsent}>
        Entrar a zenpai
      </button>

      <style>{`
        .chk{display:flex;gap:.6rem;align-items:flex-start;text-align:left;width:100%;cursor:pointer;color:var(--text);font-size:.8rem;line-height:1.4}
        .chk .box{flex:none;width:22px;height:22px;border-radius:5px;border:1px solid rgba(255,255,255,.4);background:transparent;display:flex;align-items:center;justify-content:center;color:#000;transition:.15s}
        .chk .box.on{background:#fff;border-color:#fff}
        .gbtn{width:100%;border:none;border-radius:5px;font-weight:600;height:50px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:.95rem;cursor:pointer;background:#fff;color:#000;transition:.15s}
        .gbtn:disabled{opacity:.4;cursor:not-allowed}
      `}</style>
    </div>
  )
}
