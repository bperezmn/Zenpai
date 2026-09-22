// ===== plan de la semana: hoy y los 6 días siguientes, con las tareas reales del cultivo =====
// Nada de relleno: cada tarea sale del estado del cultivo (sed, abono, lecturas, fotos, fechas).
import { nextWaterTs, stageAt, harvestEta, DEFOLIATION_DAYS, type Cultivo, type GrowEvent, type Guide } from './lib'
import { litrosRiego, semanaFlor, targetFor, fmtRange, canTrain } from './mentor'
import { lineaPorId, faseActual, dosisRiego } from './data/nutrientes'
import { readingSeries } from './readings'

export type PlanKind = 'riego' | 'abono' | 'ph' | 'flip' | 'foto' | 'defol' | 'tricomas'
export interface PlanTask {
  id: string
  dayTs: number        // medianoche local del día de la tarea
  kind: PlanKind
  title: string
  detail: string
  done: boolean
  important?: boolean
}

const DAY = 86400000
const ORDER: PlanKind[] = ['riego', 'abono', 'ph', 'flip', 'defol', 'tricomas', 'foto']
export const DOW_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
export const DOW_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const fmtDay = (ts: number) => { const d = new Date(ts); return `${d.getDate()} ${MES[d.getMonth()]}` }

// guide: sin él no se filtra por nivel; con 'novato' no se propone defoliar (igual que Consejos)
export function weekPlan(c: Cultivo, events: GrowEvent[], now = Date.now(), guide?: Guide): { dayTs: number; tasks: PlanTask[] }[] {
  const t = new Date(now)
  const dayStart = (k: number) => new Date(t.getFullYear(), t.getMonth(), t.getDate() + k).getTime()
  const days = Array.from({ length: 7 }, (_, i) => dayStart(i))
  const end = dayStart(7)
  const week = days.map((dayTs) => ({ dayTs, tasks: [] as PlanTask[] }))
  const living = c.stage === 'plantula' || c.stage === 'veg' || c.stage === 'flor' || c.stage === 'cosecha'
  if (!c.id || !c.germTs || c.harvestedTs || c.finishedTs || !living) return week

  // índice del día de un instante (antes de hoy → hoy; más allá de la semana → -1)
  const idxOf = (ts: number) => { if (ts >= end) return -1; for (let i = 6; i > 0; i--) if (ts >= days[i]) return i; return 0 }
  const dayEnd = (i: number) => (i < 6 ? days[i + 1] : end)
  // semana de calendario lunes–domingo: el día de la semana que toca, u hoy si ya pasó
  const pos = (dow: number) => (dow + 6) % 7
  const weekday = (dow: number) => Math.max(0, pos(dow) - pos(t.getDay()))
  // ¿ya se hizo en los 6 días previos al día i? Se mira desde el día de la tarea, no desde hoy:
  // así la tarea se ve toda la semana y lo hecho el miércoles vuelve a tocar el miércoles siguiente.
  // Lo de hoy no cuenta aquí: marca la tarea como hecha.
  const recent = (ts: number[], i: number) => ts.some((x) => x >= dayStart(i - 6) && x < days[0])
  // el cultivo proyectado al día i (la etapa y la semana de flor avanzan con el reloj)
  const at = (i: number): Cultivo => { const day = c.day + i; return { ...c, day, stage: stageAt(c, day) } }
  const add = (i: number, kind: PlanKind, title: string, detail: string, done: boolean, important = false) => {
    week[i].tasks.push({ id: `${kind}-${days[i]}`, dayTs: days[i], kind, title, detail, done, ...(important && !done ? { important: true } : {}) })
  }

  // ---- riego / abono: desde el próximo riego, repitiendo cada intervalo de sed ----
  const linea = lineaPorId(c.nutrientesId)
  const porMaceta = c.pots > 1 ? ' por maceta' : ''
  const watered = (i: number) => events.some((e) => e.type === 'riego' && e.ts >= days[i] && e.ts < dayEnd(i))
  const waterDays = new Set<number>()
  const next = nextWaterTs(c)
  const ref = c.lastWaterTs ?? c.germTs
  const overdue = next != null && next < now && !watered(0)
  if (next != null && next > ref) {
    const step = next - ref
    for (let ts = overdue ? now : next; ts < end; ts += step) { const i = idxOf(ts); if (i >= 0) waterDays.add(i) }
  }
  if (watered(0)) waterDays.add(0)
  for (const i of [...waterDays].sort((a, b) => a - b)) {
    const cd = at(i)
    const L = litrosRiego(cd)
    // mismas etapas que la ficha de riego (WaterRecipe): plántula también usa la tabla del fabricante
    const fase = linea && (cd.stage === 'plantula' || cd.stage === 'veg' || cd.stage === 'flor') ? faseActual(linea, cd.stage, cd.day, semanaFlor(cd)) : null
    if (linea && fase && dosisRiego(linea, fase, L).length > 0) {
      const f = cd.stage === 'flor' ? `semana ${semanaFlor(cd)} de flor` : cd.stage === 'plantula' ? 'plántula' : fase.tardia ? 'veg tardío' : 'veg temprano'
      add(i, 'abono', 'Riega con abono', `${linea.marca} · ${f} · ${L} L${porMaceta}`, watered(i), i === 0 && overdue)
    } else {
      add(i, 'riego', 'Riega', `Solo agua · ${L} L${porMaceta}`, watered(i), i === 0 && overdue)
    }
  }

  // ---- pH: una vez a mitad de semana si no se midió en la semana previa a ese día ----
  // (en el primer día de riego de miércoles a domingo si lo hay: se mide en el agua que vas a dar)
  const phTs = readingSeries(events, 'ph').map((p) => p.ts)
  const mid = weekday(3)
  const sun = weekday(0)
  const phWater = [...waterDays].sort((a, b) => a - b).filter((i) => i >= mid && i <= sun)
  const phDay = (phWater.length ? phWater : [mid]).find((i) => !recent(phTs, i))
  if (phDay !== undefined) {
    const doneToday = phTs.some((ts) => ts >= days[0])
    const r = targetFor('ph', c.stage, c.substrate)
    add(doneToday ? 0 : phDay, 'ph', 'Mide el pH', `En el agua de riego · objetivo ${fmtRange(r, 1)}`, doneToday)
  }

  // ---- fotoperiódicas maduras en veg: pasar a 12/12 (el sábado, u hoy si ya pasó) ----
  if (c.seedType === 'foto') {
    const flippedToday = c.flowerTs != null && c.flowerTs >= days[0]
    const sat = weekday(6)
    if (flippedToday || (c.stage === 'veg' && !c.flowerTs && at(sat).day >= 30)) {
      add(flippedToday ? 0 : sat, 'flip', 'Pasa la luz a 12/12', 'Si ya llenan la mitad de la carpa. En floración suelen crecer entre la mitad y el doble de su altura.', flippedToday, true)
    }
  }

  // ---- defoliación: una vez en la semana 3 de flor (nivel medio/avanzado, con la planta recuperada) ----
  if (!guide || canTrain(guide)) {
    const detail = 'Semana 3 de flor. Te mostramos cómo antes de cortar.'
    if (c.defoliatedTs != null && c.defoliatedTs >= days[0] && semanaFlor(c) === 3) {
      add(0, 'defol', 'Defoliación ligera', detail, true)
    } else {
      const i = days.findIndex((_, k) => semanaFlor(at(k)) === 3)
      const rested = c.defoliatedTs == null || days[Math.max(0, i)] - c.defoliatedTs >= DEFOLIATION_DAYS * DAY
      if (i >= 0 && rested) add(i, 'defol', 'Defoliación ligera', detail, false)
    }
  }

  // ---- tricomas: la cosecha estimada cae esta semana o ya pasó ----
  if (c.stage === 'flor' || c.stage === 'cosecha') {
    const eta = harvestEta(c)
    if (eta != null && eta < end) {
      add(idxOf(eta), 'tricomas', 'Revisa los tricomas con lupa',
        eta < days[0] ? 'La cosecha estimada ya llegó. Si siguen transparentes, espera.' : `Cosecha estimada el ${fmtDay(eta)}. Si siguen transparentes, espera.`, false)
    }
  }

  // ---- foto semanal para el timelapse: el domingo, si no hubo foto en los 6 días previos ----
  const fotoTs = events.filter((e) => e.type === 'foto').map((e) => e.ts)
  if (!recent(fotoTs, sun)) {
    const doneToday = fotoTs.some((ts) => ts >= days[0])
    add(doneToday ? 0 : sun, 'foto', 'Haz la foto de la semana', 'Para tu timelapse', doneToday)
  }

  for (const d of week) d.tasks.sort((a, b) => Number(!!b.important) - Number(!!a.important) || ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))
  return week
}
