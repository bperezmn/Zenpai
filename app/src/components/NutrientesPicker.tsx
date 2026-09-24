import { useState } from 'react'
import { LINEAS, OTRA_MARCA, type LineaNutrientes } from '../data/nutrientes'
import type { Substrate } from '../lib'
import BrandMark from './BrandMark'
import NutrientesInfo from './NutrientesInfo'

// Elegir la línea de nutrientes del catálogo (filtrada por sustrato). Cada fila lleva el logo
// o monograma de la marca y un acceso a su tabla completa. Arriba, sin tabla: "Otra marca"
// (OTRA_MARCA: su abono, guiado por la EC de la etapa) y, solo en tierra, "Solo agua" (null):
// en coco e hidro el sustrato no trae comida y la planta pasaría hambre en 1–2 semanas.
export default function NutrientesPicker({ value, onChange, substrate }: {
  value: string | null
  onChange: (id: string | null) => void
  substrate: Substrate
  chipClass?: string
}) {
  const lineas = LINEAS.filter((l) => l.sustratos.includes(substrate))
  const [info, setInfo] = useState<LineaNutrientes | null>(null)
  const tierra = substrate === 'tierra'
  return (
    <div className="flex flex-col">
      {tierra ? (
        <button onClick={() => onChange(null)} className={`nrow ${value === null ? 'on' : ''}`}>
          <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 5, border: '1px dashed rgba(255,255,255,.35)', flex: 'none' }} />
          <span className="min-w-0 flex-1">
            <span className="block text-[.86rem] font-medium">Solo agua</span>
            <span className="block text-[.74rem]" style={{ color: 'var(--muted)' }}>Sin abono · te decimos cuándo empezar</span>
          </span>
        </button>
      ) : (
        <p className="text-[.74rem] leading-snug mb-2" style={{ color: 'var(--muted)' }}>
          En {substrate === 'coco' ? 'coco' : 'hidro'} no hay «Solo agua»: la planta solo come lo que le das con el {substrate === 'coco' ? 'riego' : 'depósito'}.
        </p>
      )}
      <button onClick={() => onChange(OTRA_MARCA)} className={`nrow ${value === OTRA_MARCA ? 'on' : ''}`}>
        <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 5, border: '1px dashed rgba(255,255,255,.35)', flex: 'none' }} />
        <span className="min-w-0 flex-1">
          <span className="block text-[.86rem] font-medium">Otra marca</span>
          <span className="block text-[.74rem]" style={{ color: 'var(--muted)' }}>Tu abono, guiado por la EC de cada etapa</span>
        </span>
      </button>
      {lineas.map((l) => (
        <div key={l.id} className={`nrow ${value === l.id ? 'on' : ''}`} role="button" tabIndex={0}
          onClick={() => onChange(l.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(l.id) } }}>
          <BrandMark linea={l} size={32} />
          <span className="min-w-0 flex-1">
            <span className="block text-[.86rem] font-medium truncate">{l.marca}</span>
            <span className="block truncate text-[.74rem]" style={{ color: 'var(--muted)' }}>{l.linea}</span>
          </span>
          <button onClick={(e) => { e.stopPropagation(); setInfo(l) }} aria-label={`Ver la tabla de ${l.marca}`} className="ninfo">Tabla</button>
        </div>
      ))}
      {info && <NutrientesInfo linea={info} onClose={() => setInfo(null)} />}
      <style>{`
        .nrow{display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:10px 10px;border:1px solid rgba(255,255,255,.14);border-radius:5px;background:transparent;color:#fff;cursor:pointer;margin-bottom:7px;font-family:'Instrument Sans',system-ui,sans-serif}
        .nrow.on{border-color:#fff;background:rgba(255,255,255,.06)}
        .ninfo{flex:none;height:32px;padding:0 10px;border:1px solid rgba(255,255,255,.28);border-radius:5px;background:transparent;color:#fff;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:.66rem;letter-spacing:.14em;text-transform:uppercase;cursor:pointer}
      `}</style>
    </div>
  )
}
