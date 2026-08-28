import { useEffect, useState } from 'react'
import { useStore, selectActive } from '../store'
import { closedImg, ajarImg } from '../lib'

export default function Intro({ onDone }: { onDone: () => void }) {
  const c = useStore(selectActive)
  const [phase, setPhase] = useState(0) // 0 cerrada, 1 entreabierta, 2 fin

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 850)
    const t2 = setTimeout(() => setPhase(2), 1750)
    const t3 = setTimeout(onDone, 2650)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDone])

  return (
    <div className="absolute inset-0 z-50 cursor-pointer" onClick={onDone}>
      <img src={ajarImg(c)} alt="" className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700" style={{ opacity: phase >= 2 ? 0 : 1 }} />
      <img src={closedImg} alt="" className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700" style={{ opacity: phase >= 1 ? 0 : 1 }} />
      <div className="absolute bottom-16 left-0 right-0 text-center text-[.74rem] font-semibold" style={{ color: '#cfe3d7', textShadow: '0 2px 10px rgba(0,0,0,.9)' }}>
        {phase < 2 ? 'abriendo tu carpa…' : 'bienvenido 🌿'}
      </div>
    </div>
  )
}
