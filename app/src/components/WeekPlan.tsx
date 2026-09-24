import { useStore, selectActive } from '../store'
import { weekPlan, DOW_SHORT, DOW_LONG, type PlanKind, type PlanTask } from '../plan'
import { ritmoTexto } from '../mentor'
import { revisaConDedo, dedoCm } from '../lib'

// "Esta semana": hoy y los 6 días siguientes con las tareas reales del cultivo.
// Marcar una tarea pendiente abre su acción (regar, medir, foto…); se da por hecha
// cuando la acción queda en la bitácora.
export default function WeekPlan({ onAction }: { onAction: (kind: PlanKind) => void }) {
  const c = useStore(selectActive)
  const events = useStore((s) => s.events)
  const guide = useStore((s) => s.guide)
  const week = weekPlan(c, events, Date.now(), guide)
  const withTasks = week.map((d, i) => ({ ...d, i })).filter((d) => d.tasks.length > 0)
  const hasWater = week.some((d) => d.tasks.some((t) => (t.kind === 'riego' || t.kind === 'abono' || t.kind === 'deposito') && !t.done))
  const ritmo = ritmoTexto(c)

  const dayTitle = (ts: number, i: number) => {
    if (i === 0) return 'Hoy'
    if (i === 1) return 'Mañana'
    const d = new Date(ts)
    return `${DOW_LONG[d.getDay()]} ${d.getDate()}`
  }

  return (
    <div>
      <div className="flex gap-[5px] mb-4" aria-hidden="true">
        {week.map((d, i) => {
          const dt = new Date(d.dayTs)
          const important = d.tasks.some((t) => t.important)
          const pending = d.tasks.some((t) => !t.done)
          return (
            <div key={d.dayTs} className="flex-1 min-w-0 flex flex-col items-center pt-2 pb-1.5"
              style={{
                borderRadius: 5,
                border: `1px solid ${important ? 'var(--warn)' : i === 0 ? '#fff' : 'rgba(255,255,255,.14)'}`,
                background: i === 0 ? 'rgba(255,255,255,.06)' : 'transparent',
              }}>
              <span className="label" style={{ color: i === 0 ? '#fff' : undefined }}>{i === 0 ? 'Hoy' : DOW_SHORT[dt.getDay()]}</span>
              <span className="mono text-[.95rem] mt-1 leading-none">{dt.getDate()}</span>
              <span className="w-1 h-1 rounded-full mt-1.5"
                style={{ background: d.tasks.length === 0 ? 'transparent' : pending ? '#fff' : 'var(--faint)' }} />
            </div>
          )
        })}
      </div>

      {withTasks.length === 0 ? (
        <p className="text-[.8rem] leading-relaxed py-2" style={{ color: 'var(--muted)' }}>Esta semana no hay tareas para este cultivo.</p>
      ) : (
        <div className="space-y-3">
          {withTasks.map((d) => (
            <section key={d.dayTs}>
              <div className="label mb-1.5">{dayTitle(d.dayTs, d.i)}</div>
              <div className="space-y-2">
                {d.tasks.map((t) => <TaskRow key={t.id} t={t} onAction={onAction} />)}
              </div>
            </section>
          ))}
          {/* el plan dice cuándo MIRAR, no cuándo regar. En plántula y mientras el agua sube por
              semanas la maceta grande casi no cambia de peso: se comprueba con el dedo a unos 3 cm
              del tallo (como la revisión). Hidro: el nivel del depósito */}
          {hasWater && (
            <p className="text-[.74rem] leading-snug pt-1" style={{ color: 'var(--faint)' }}>
              {c.substrate === 'hidro'
                ? 'Las revisiones son una estimación: el nivel baja más rápido con plantas grandes y calor.'
                : revisaConDedo(c)
                ? `Son revisiones, no riegos fijos. Mete el dedo a unos 3 cm del tallo: si los primeros ${dedoCm(c)} cm siguen húmedos, espera y te avisamos al día siguiente.`
                : ritmo
                ? `Son revisiones, no riegos fijos: ${ritmo} y el plan sigue ese ritmo. Si la maceta aún pesa, espera y te avisamos al día siguiente.`
                : 'Son revisiones, no riegos fijos. Levanta la maceta: si aún pesa, espera y te avisamos al día siguiente.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function TaskRow({ t, onAction }: { t: PlanTask; onAction: (kind: PlanKind) => void }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5"
      style={{
        borderRadius: 5,
        border: `1px solid ${t.important ? 'var(--warn)' : 'rgba(255,255,255,.14)'}`,
        background: t.important ? 'rgba(229,168,59,.06)' : 'rgba(255,255,255,.02)',
      }}>
      <button onClick={() => { if (!t.done) onAction(t.kind) }} disabled={t.done}
        aria-label={t.done ? `${t.title}: hecho` : t.title}
        className="w-11 h-11 flex-none flex items-center justify-center"
        style={{
          borderRadius: 5,
          border: `1px solid ${t.done ? '#fff' : 'rgba(255,255,255,.4)'}`,
          background: t.done ? '#fff' : 'transparent',
          color: '#000',
          cursor: t.done ? 'default' : 'pointer',
        }}>
        {t.done && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="text-[.9rem] font-medium leading-tight" style={{ color: t.done ? 'var(--muted)' : '#fff' }}>{t.title}</div>
        <div className="text-[.78rem] leading-snug mt-0.5" style={{ color: 'var(--muted)' }}>{t.detail}</div>
      </div>
    </div>
  )
}
