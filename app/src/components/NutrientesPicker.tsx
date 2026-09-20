import { LINEAS } from '../data/nutrientes'
import type { Substrate } from '../lib'

// Elegir la línea de nutrientes del catálogo (filtrada por sustrato). null = solo agua / otra marca.
export default function NutrientesPicker({ value, onChange, substrate, chipClass }: {
  value: string | null
  onChange: (id: string | null) => void
  substrate: Substrate
  chipClass: string   // la clase de chip de la pantalla que lo usa ('sub' | 'echip')
}) {
  const lineas = LINEAS.filter((l) => l.sustratos.includes(substrate))
  return (
    <div className="grid grid-cols-2 gap-[7px]">
      <button onClick={() => onChange(null)} className={`${chipClass} ${value === null ? 'on' : ''}`} style={{ textAlign: 'left', padding: '.6rem .7rem' }}>
        <div style={{ fontSize: '.8rem' }}>Solo agua / otra</div>
        <div className="label" style={{ marginTop: 3, color: 'inherit', opacity: .7 }}>sin plan de abono</div>
      </button>
      {lineas.map((l) => (
        <button key={l.id} onClick={() => onChange(l.id)} className={`${chipClass} ${value === l.id ? 'on' : ''}`} style={{ textAlign: 'left', padding: '.6rem .7rem' }}>
          <div style={{ fontSize: '.8rem' }}>{l.marca}</div>
          <div className="label" style={{ marginTop: 3, color: 'inherit', opacity: .7, whiteSpace: 'normal', lineHeight: 1.3 }}>{l.linea}</div>
        </button>
      ))}
    </div>
  )
}
