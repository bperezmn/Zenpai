import { useState } from 'react'
import type { LineaNutrientes } from '../data/nutrientes'

// Logo de la marca si existe el archivo oficial en assets/marcas/{logo}.webp; si no, un
// monograma con el color de la marca. Así el usuario reconoce la botella de un vistazo.
export default function BrandMark({ linea, size = 32 }: { linea: LineaNutrientes; size?: number }) {
  const [broken, setBroken] = useState(false)
  const src = linea.logo ? `${import.meta.env.BASE_URL}assets/marcas/${linea.logo}.webp` : null
  const initials = linea.marca.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  if (src && !broken) {
    return (
      <span style={{ width: size, height: size, borderRadius: 5, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flex: 'none' }}>
        <img src={src} alt={linea.marca} onError={() => setBroken(true)} style={{ width: '86%', height: '86%', objectFit: 'contain' }} />
      </span>
    )
  }
  return (
    <span aria-hidden="true" className="display" style={{ width: size, height: size, borderRadius: 5, background: linea.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 700, letterSpacing: '.02em', flex: 'none' }}>
      {initials}
    </span>
  )
}
