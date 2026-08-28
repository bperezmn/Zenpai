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

  return (
    <div className="absolute inset-0 z-[60] overflow-y-auto px-6 py-10 flex flex-col justify-center"
      style={{ background: 'radial-gradient(80% 45% at 50% 12%, rgba(52,211,153,.12), transparent 60%), linear-gradient(180deg,#0a1210,#05080b)' }}>
      <div className="mx-auto mb-3"><Logo size={52} /></div>
      <h1 className="display grad-text text-center text-[1.7rem] font-bold leading-none">zenpai</h1>
      <p className="text-center text-[.8rem] mt-1.5 mb-5" style={{ color: 'var(--muted)' }}>tu mentor de cultivo</p>

      <div className="glass rounded-2xl p-4 space-y-3">
        <button onClick={() => setAge((v) => !v)} className="chk">
          <span className={`box ${age ? 'on' : ''}`}>{age ? '✓' : ''}</span>
          <span>Confirmo que soy <b>mayor de edad</b> según la ley de mi país (18+ / 21+).</span>
        </button>
        <button onClick={() => setTerms((v) => !v)} className="chk">
          <span className={`box ${terms ? 'on' : ''}`}>{terms ? '✓' : ''}</span>
          <span>
            Entiendo que zenpai es una <b>herramienta educativa</b>, no consejo legal ni médico; soy
            responsable de cumplir la legislación de mi territorio, y zenpai <b>no facilita la compra ni venta</b> de cannabis.
          </span>
        </button>
      </div>

      <p className="text-center text-[.66rem] mt-3 px-2" style={{ color: 'var(--faint)' }}>
        Tus datos se guardan <b>solo en este dispositivo</b>. No pedimos nombre real ni ubicación.
      </p>

      <button className="gbtn mt-5" disabled={!ok} onClick={acceptConsent}>
        Entrar a zenpai
      </button>

      <style>{`
        .chk{display:flex;gap:.6rem;align-items:flex-start;text-align:left;width:100%;cursor:pointer;color:var(--text);font-size:.8rem;line-height:1.35}
        .chk .box{flex:none;width:22px;height:22px;border-radius:7px;border:1.5px solid var(--glass-bd);background:rgba(255,255,255,.04);display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:800;color:#04150c;transition:.15s}
        .chk .box.on{background:linear-gradient(135deg,var(--acc),var(--acc2));border-color:var(--acc)}
        .gbtn{width:100%;border:none;border-radius:15px;font-weight:700;padding:.9rem;font-family:'Space Grotesk';font-size:.95rem;cursor:pointer;background:linear-gradient(135deg,var(--acc),var(--acc2));color:#04150c;transition:.15s}
        .gbtn:disabled{opacity:.4;cursor:not-allowed;filter:grayscale(.3)}
      `}</style>
    </div>
  )
}
