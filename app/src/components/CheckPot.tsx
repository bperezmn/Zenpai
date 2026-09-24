import { useState } from 'react'
import { useStore, selectActive } from '../store'
import { stageLabel, nextCheckTs, nextSolutionTs, solutionLate, whenText, revisaConDedo, dedoCm } from '../lib'
import { wateringGuide, ritmoTexto, targetFor, fmtRange, overwaterGuard } from '../mentor'
import YaRegue from './YaRegue'

// Revisión de la maceta. El reloj solo avisa de que toca MIRAR; lo que ve el usuario decide:
// - tierra/coco: "¿cómo pesa la maceta?" o, en plántula y mientras el agua sube por semanas, el
//   dedo a unos 3 cm del tallo (con poca agua en una maceta grande el peso apenas cambia: ver
//   revisaConDedo). Seca o pesa poco → la ficha de riego; aún húmeda o aún pesa → a la bitácora y
//   la próxima revisión, 24 h después; hojas caídas → ¿sed o exceso de agua? Las hojas caídas se
//   anotan (y cambian la foto hasta el siguiente riego) al contestar, no antes: "Volver" no deja nada.
// - hidro: no hay riego ni sed. Se mira el nivel del depósito y se cambia la solución entera. Con
//   la plántula el nivel tiene que tocar la cestita: sus raíces aún no llegan al agua.
// Las respuestas no llevan un botón destacado: ninguna empuja a regar (el exceso de riego es el
// error nº 1). Es una capa de TentView: su "atrás" lo gestiona la carpa.
export default function CheckPot({ onDry, onSolution, onClose }: { onDry: () => void; onSolution: () => void; onClose: () => void }) {
  const c = useStore(selectActive)
  const guide = useStore((s) => s.guide)
  const checkPot = useStore((s) => s.checkPot)
  const reportDroop = useStore((s) => s.reportDroop)
  const refillReservoir = useStore((s) => s.refillReservoir)
  const [step, setStep] = useState<'ask' | 'droop' | 'low'>('ask')
  const hidro = c.substrate === 'hidro'
  const plantula = c.stage === 'plantula' || c.stage === 'germinacion'
  const dedo = revisaConDedo(c)
  const cm = dedoCm(c)
  const w = wateringGuide(c)
  const ritmo = ritmoTexto(c)
  const now = Date.now()
  // cuándo avisaríamos si ahora no hace falta regar (o el nivel está bien)
  const later = nextCheckTs({ ...c, lastCheckTs: now })
  const laterTxt = later ? whenText(later, now) : 'mañana'
  const ph = targetFor('ph', c.stage, c.substrate)
  const sol = nextSolutionTs(c)
  const late = solutionLate(c, now)
  // avanzado: "pesa poco" anota el riego en el acto (sin ficha), salvo con el guardarraíl activo
  const directo = guide === 'avanzado' && !overwaterGuard(c)
  const drySub = directo ? `Se anota el riego: ${w ? `${w.amount} · ` : ''}pH ${fmtRange(ph, 1)}` : w ? `Toca regar: ${w.amount}` : 'Toca regar'

  // un riego estimado (planta registrada, datos viejos) no se presenta como anotado
  const sub = hidro ? `${stageLabel[c.stage]} · hidro`
    : c.lastWaterTs && !c.lastWaterEstimated ? `${stageLabel[c.stage]} · riego anotado ${hace(c.lastWaterTs, now)}`
    : stageLabel[c.stage]

  return (
    <div className="absolute inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(3,6,9,.55)', backdropFilter: 'blur(2px)' }} />
      <div className="absolute left-0 right-0 bottom-0 glass rounded-t-3xl px-5 pt-3 pb-6 max-h-[88%] overflow-y-auto"
        onClick={(e) => e.stopPropagation()} style={{ animation: 'sheetUp .28s ease-out' }}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: 'var(--glass-bd)' }} />
        <div className="mb-3">
          <h3 className="display font-bold text-[1.05rem] leading-tight">{hidro ? 'Revisa el depósito' : 'Revisa la maceta'}</h3>
          <div className="text-[.74rem] mt-0.5" style={{ color: 'var(--faint)' }}>{sub}</div>
        </div>

        {hidro ? (
          step === 'low' ? (
            <>
              <p className="text-[.92rem] font-medium">Rellena el depósito</p>
              <p className="text-[.78rem] leading-snug mt-1" style={{ color: 'var(--muted)' }}>
                {plantula
                  ? `Rellénalo con agua con el pH ajustado (${fmtRange(ph, 1)}) hasta que toque la base de la cestita: mientras las raíces no lleguen al agua, el taco tiene que seguir húmedo.`
                  : `Rellénalo con agua con el pH ajustado (${fmtRange(ph, 1)}), dejando 2–3 cm de aire bajo la cestita.`}
              </p>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setStep('ask')} className="kbtn-ghost flex-1">Volver</button>
                <button onClick={() => { refillReservoir(); onClose() }} className="kbtn flex-1">Ya lo rellené</button>
              </div>
            </>
          ) : (
            <>
              <p className="text-[.92rem] font-medium">¿Cómo está el nivel del agua?</p>
              <p className="text-[.78rem] leading-snug mt-1" style={{ color: 'var(--muted)' }}>
                {plantula
                  ? 'Mientras las raíces no cuelguen dentro del agua, el nivel tiene que tocar la base de la cestita. Si no llega, está bajo.'
                  : 'Míralo en el depósito. Con plantas grandes y calor baja más rápido.'}
              </p>
              <div className="space-y-2 mt-4">
                <Answer title="Está bajo" sub="Te decimos cómo rellenarlo" onClick={() => setStep('low')} />
                <Answer title="Está bien" sub={`Te avisamos ${laterTxt}`} onClick={() => { checkPot(); onClose() }} />
              </div>
              <div className="label mt-5 mb-1.5">Solución</div>
              <p className="text-[.78rem] leading-snug" style={{ color: late ? 'var(--warn)' : 'var(--muted)' }}>
                {late ? 'Toca cambiarla: se cambia entera cada 7–10 días.'
                  : `Se cambia entera cada 7–10 días.${sol ? ` La próxima, ${whenText(sol, now)}.` : ''}`}
              </p>
              <button onClick={onSolution} className="kbtn-ghost w-full mt-2.5">Cambiar la solución</button>
            </>
          )
        ) : step === 'droop' ? (
          <>
            <p className="text-[.92rem] font-medium">Hojas caídas: ¿sed o exceso de agua?</p>
            <p className="text-[.78rem] leading-snug mt-1" style={{ color: 'var(--muted)' }}>
              {dedo
                ? `Mete el dedo ${cm} cm a unos 3 cm del tallo. Si está seca, es sed: riega ${plantula ? 'un vaso' : w ? w.amount : 'poca agua'}. Si está húmeda, es exceso de agua: no riegues hasta que se seque.`
                : 'Levanta la maceta. Si pesa poco, es sed: riega. Si aún pesa, es exceso de agua: no riegues hasta que pese menos.'}
            </p>
            {/* en el orden del texto: primero la sed, luego el exceso de agua. Las hojas caídas
                se anotan al contestar */}
            <div className="flex gap-2 mt-4">
              <button onClick={() => { reportDroop(); onDry() }} className="kbtn-ghost flex-1">{dedo ? 'Está seca' : 'Pesa poco'}</button>
              <button onClick={() => { reportDroop(); checkPot(true); onClose() }} className="kbtn-ghost flex-1">{dedo ? 'Está húmeda' : 'Aún pesa'}</button>
            </div>
            <button onClick={() => setStep('ask')} className="kbtn-link mt-1">Volver</button>
            <p className="text-[.74rem] leading-snug mt-1" style={{ color: 'var(--faint)' }}>Al contestar, las hojas caídas quedan en la bitácora.</p>
          </>
        ) : (
          <>
            <p className="text-[.92rem] font-medium">{dedo ? `Mete el dedo ${cm} cm a unos 3 cm del tallo: ¿está seca?` : '¿Cómo pesa la maceta?'}</p>
            <p className="text-[.78rem] leading-snug mt-1" style={{ color: 'var(--muted)' }}>
              {plantula
                ? 'Mira solo la tierra de arriba: con una planta tan pequeña, la maceta grande pesa aunque arriba ya esté seca.'
                : dedo
                ? 'Aún riegas poca agua: mira la tierra cerca del tallo, no el peso de la maceta.'
                : 'Levántala un poco por un lado. Recién regada pesa mucho; seca, casi nada.'}
            </p>
            <div className="space-y-2 mt-4">
              <Answer title={dedo ? 'Está seca' : 'Pesa poco'} sub={drySub} onClick={onDry} />
              <Answer title={dedo ? 'Aún está húmeda' : 'Aún pesa'} sub={`No riegues todavía. Te avisamos ${laterTxt}.`} onClick={() => { checkPot(); onClose() }} />
              <Answer title="Las hojas se ven caídas" sub="Te ayudamos a saber si es sed o exceso de agua" onClick={() => setStep('droop')} />
            </div>
            {ritmo && (
              <p className="text-[.78rem] leading-snug mt-3" style={{ color: 'var(--muted)' }}>
                {ritmo.charAt(0).toUpperCase() + ritmo.slice(1)}: te avisamos con ese ritmo.
              </p>
            )}
            <YaRegue onDone={onClose} />
          </>
        )}

        <style>{`
          @keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
          .kans{display:block;width:100%;min-height:56px;text-align:left;padding:.6rem .95rem;border-radius:5px;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.04);color:var(--text);cursor:pointer;font-family:'Instrument Sans',system-ui,sans-serif}
          .kans:active{background:rgba(255,255,255,.1)}
          .kbtn{border:none;border-radius:5px;font-weight:600;height:48px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:.9rem;cursor:pointer;background:#fff;color:#000}
          .kbtn-ghost{border:1px solid rgba(255,255,255,.4);border-radius:5px;font-weight:600;height:48px;padding:0 8px;font-family:'Instrument Sans',system-ui,sans-serif;font-size:.88rem;cursor:pointer;background:transparent;color:var(--text)}
          .kbtn-link{display:block;width:100%;min-height:44px;background:none;border:none;color:var(--muted);font-family:'Instrument Sans',system-ui,sans-serif;font-size:.82rem;text-decoration:underline;text-underline-offset:4px;cursor:pointer}
        `}</style>
      </div>
    </div>
  )
}

function Answer({ title, sub, onClick }: { title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="kans">
      <span className="block text-[.92rem] font-semibold leading-tight">{title}</span>
      <span className="block text-[.76rem] leading-snug mt-0.5" style={{ color: 'var(--muted)' }}>{sub}</span>
    </button>
  )
}

// "hoy", "ayer", "hace 3 días" (por días del calendario)
function hace(ts: number, now: number): string {
  const d0 = new Date(now); d0.setHours(0, 0, 0, 0)
  const d1 = new Date(ts); d1.setHours(0, 0, 0, 0)
  const n = Math.round((d0.getTime() - d1.getTime()) / 86400000)
  return n <= 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} días`
}
