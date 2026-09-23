import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { FOTO_W, FOTO_H } from '../lib'

// Lienzo con la proporción exacta de las fotos de la carpa (3:4), centrado en su contenedor.
// cover = llena el contenedor recortando lo que sobre (como object-cover); contain = cabe entero.
// Todo lo que va encima de la foto (tinte de la abertura, zona de riego, etiquetas de macetas)
// se posiciona en % DE LA FOTO dentro del lienzo, así cae en el mismo sitio en cualquier pantalla.
// El tamaño se mide con ResizeObserver (funciona en iOS 15, sin unidades de contenedor); hasta
// la primera medida el lienzo ocupa el contenedor entero y las fotos se ven con object-cover.
export default function Lienzo({ fit = 'cover', children }: { fit?: 'cover' | 'contain'; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const W = el.clientWidth, H = el.clientHeight
      if (!W || !H) return
      const k = fit === 'cover' ? Math.max(W / FOTO_W, H / FOTO_H) : Math.min(W / FOTO_W, H / FOTO_H)
      setSize({ w: FOTO_W * k, h: FOTO_H * k })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [fit])
  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden">
      <div className="absolute" style={size
        ? { width: size.w, height: size.h, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
        : { inset: 0 }}>
        {children}
      </div>
    </div>
  )
}
