import { useState } from 'react'
import { useStore } from '../store'
import { Logo } from '../App'
import type { Guide } from '../lib'

export const GUIDES: { id: Guide; label: string; desc: string }[] = [
  { id: 'novato', label: 'Novato', desc: 'Te llevamos de la mano: cuánto y cómo regar, qué es el pH/EC, paso a paso. Sin podas ni técnicas.' },
  { id: 'medio', label: 'Medio', desc: 'Ya conoces lo básico: añadimos técnicas (LST) y más métricas (VPD, EC).' },
  { id: 'avanzado', label: 'Avanzado', desc: 'Todo: todas las métricas y técnicas, con consejos concisos y al grano.' },
]

// Se muestra una sola vez (tras aceptar términos): define el nivel de guía del usuario.
export default function Onboarding() {
  const completeOnboarding = useStore((s) => s.completeOnboarding)
  const [sel, setSel] = useState<Guide>('novato')

  return (
    <div className="absolute inset-0 overflow-y-auto px-6 py-10 flex flex-col justify-center" style={{ background: '#000' }}>
      <div className="mx-auto mb-3"><Logo size={50} /></div>
      <h2 className="display text-center text-[1.4rem] font-bold">¿Cuánta experiencia tienes?</h2>
      <p className="text-center text-[.82rem] mt-1.5 mb-5" style={{ color: 'var(--muted)' }}>
        Para guiarte justo a tu nivel. Lo puedes cambiar cuando quieras en Ajustes.
      </p>

      <div className="space-y-[9px]">
        {GUIDES.map((g) => (
          <button key={g.id} onClick={() => setSel(g.id)} className={`olevel ${sel === g.id ? 'on' : ''}`}>
            <span className="oname">{g.label}</span>
            <span className="odesc">{g.desc}</span>
          </button>
        ))}
      </div>

      <button className="cbtn mt-6" onClick={() => completeOnboarding(sel)}>Empezar →</button>

      <style>{`
        .olevel{width:100%;display:flex;flex-direction:column;gap:4px;text-align:left;background:rgba(255,255,255,.04);border:1px solid var(--glass-bd);border-radius:5px;padding:.85rem 1rem;cursor:pointer;color:var(--text);font-family:'Instrument Sans',system-ui,sans-serif;transition:.15s}
        .olevel.on{background:rgba(31,115,183,.12);border-color:var(--blue)}
        .olevel .oname{font-weight:600;font-size:1rem}
        .olevel .odesc{font-size:.74rem;color:var(--muted);line-height:1.4}
        .cbtn{width:100%;border:none;border-radius:5px;font-weight:600;height:50px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:.95rem;cursor:pointer;background:#fff;color:#000}
      `}</style>
    </div>
  )
}
