// ===== plan de la semana: hoy y los 6 días siguientes, con las tareas reales del cultivo =====
// Nada de relleno: cada tarea sale del estado del cultivo (revisiones, abono, lecturas, fotos, fechas).
// El calendario nunca manda regar: dice cuándo revisar la maceta, y la maceta decide.
import { nextCheckTs, checkIntervalH, nextSolutionTs, solutionLate, stageAt, harvestEta, revisaConDedo, dedoCm, DEFOLIATION_DAYS, type Cultivo, type EventType, type GrowEvent, type Guide } from './lib'
import { litrosRiego, semanaFlor, targetFor, fmtRange, canTrain, abonoDe } from './mentor'
import { readingSeries } from './readings'

// riego/abono = revisar la maceta (y regar si pesa poco); deposito/solucion = hidro
export type PlanKind = 'riego' | 'abono' | 'deposito' | 'solucion' | 'ph' | 'flip' | 'foto' | 'defol' | 'tricomas'
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
const ORDER: PlanKind[] = ['riego', 'abono', 'deposito', 'solucion', 'ph', 'flip', 'defol', 'tricomas', 'foto']
export const DOW_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
export const DOW_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const fmtDay = (ts: number) => { const d = new Date(ts); return `${d.getDate()} ${MES[d.getMonth()]}` }

// guide: sin él no se filtra por nivel; con 'novato' no se propone defoliar (igual que Consejos).
// La fuerza del abono sale del nivel: sin guide, la del novato (la más prudente).
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

  // ---- revisar la maceta (hidro: el depósito): desde la próxima revisión, repitiendo cada
  // intervalo (el ritmo aprendido de este cultivo si ya lo hay). Un día pasado se da por hecho si
  // ese día se regó o se revisó ("aún pesa"; en hidro, nivel revisado, rellenado o solución nueva).
  // Hoy, solo si además no queda otra revisión para hoy: con un ritmo corto (coco) la siguiente
  // puede caer más tarde el mismo día, y entonces el plan dice lo mismo que Home y Consejos.
  const hidro = c.substrate === 'hidro'
  const nivel = guide ?? 'novato'
  const porMaceta = c.pots > 1 ? ' por maceta' : ''
  const checkTypes: EventType[] = hidro ? ['revision', 'deposito', 'solucion'] : ['riego', 'revision']
  const checked = (i: number) => events.some((e) => checkTypes.includes(e.type) && e.ts >= days[i] && e.ts < dayEnd(i))
  const waterDays = new Set<number>()
  const next = nextCheckTs(c)
  const iv = checkIntervalH(c)
  const overdue = next != null && next < now
  const doneOn = (i: number) => checked(i) && (i > 0 || next == null || next >= dayEnd(0))
  if (next != null && iv) {
    const step = iv * 3600000
    for (let ts = overdue ? now : next; ts < end; ts += step) { const i = idxOf(ts); if (i >= 0) waterDays.add(i) }
  }
  if (checked(0)) waterDays.add(0)
  for (const i of [...waterDays].sort((a, b) => a - b)) {
    const important = i === 0 && overdue
    const cd = at(i)
    const plantula = cd.stage === 'plantula'
    if (hidro) {
      // plántula: sus raíces aún no llegan al agua, el nivel tiene que tocar la cestita
      add(i, 'deposito', 'Revisa el nivel del depósito', plantula ? 'Que el agua toque la base de la cestita; si bajó, rellénalo con agua de pH ajustado' : 'Si bajó, rellénalo con agua de pH ajustado', doneOn(i), important)
      continue
    }
    const L = litrosRiego(cd)
    // la condición va delante: la tarea es MIRAR; regar solo si la maceta lo pide (con el dedo en
    // plántula y mientras el agua sube por semanas; después, por el peso)
    const si = revisaConDedo(cd) ? `Si los primeros ${dedoCm(cd)} cm están secos` : 'Si pesa poco'
    const cantidad = plantula ? '1 vaso · 0.2 L' : `${L} L${porMaceta}`
    // lo que lleva el agua ese día: la misma regla que la ficha de riego y Consejos (abonoDe):
    // fuerza según el nivel, tierra que ya trae abono, tabla repartida y lavado final
    const ab = abonoDe(cd, nivel)
    if (ab?.abona) {
      const pct = `${Math.round(ab.factor * 100)} %`
      const cual = ab.linea
        ? `con abono al ${pct} · ${ab.linea.marca} · ${ab.motivo === 'lavado' ? 'lavado final' : cd.stage === 'flor' ? `semana ${semanaFlor(cd)} de flor` : plantula ? 'plántula' : ab.fase?.tardia ? 'veg tardío' : 'veg temprano'}`
        : `con tu abono al ${pct}${ab.ec ? ` · hasta EC ${fmtRange(ab.ec, 1)}` : ''}`
      add(i, 'abono', 'Revisa la maceta', `${si}: riega ${cual} · ${cantidad}`, doneOn(i), important)
    } else {
      // el porqué, como en Consejos: "quizá" si no sabe si su tierra trae abono; si eligió solo agua
      // y ya toca abonar, se lo recuerda
      const por = ab?.motivo === 'tierra' ? (c.tierraAbonada === 'nose' ? ' · tu tierra quizá trae abono' : ' · tu tierra ya trae abono')
        : ab?.motivo === 'lavado' ? ' · lavado final'
        : ab?.motivo === 'falta' ? ' · toca empezar a abonar (elige tu abono en Editar, en Nutrientes)' : ''
      add(i, 'riego', 'Revisa la maceta', `${si}: riega ${cantidad} · solo agua${por}`, doneOn(i), important)
    }
  }

  // ---- hidro: cambiar la solución entera cada 7–10 días ----
  if (hidro) {
    // en el lavado final la solución nueva va sin abono (o con el producto de lavado de la marca)
    const detail = (i: number) => {
      const ab = abonoDe(at(i), nivel)
      if (ab?.motivo === 'lavado') return ab.abona ? `Lavado final: agua limpia, el lavado de ${ab.linea?.marca ?? 'tu marca'} y pH` : 'Lavado final: agua limpia y pH, sin abono'
      return `Cada 7–10 días: vacía el depósito, agua limpia, abono${ab?.abona ? ` al ${Math.round(ab.factor * 100)} %` : ''} y pH`
    }
    if (c.lastSolutionTs != null && c.lastSolutionTs >= days[0]) add(0, 'solucion', 'Cambia la solución', detail(0), true)
    else {
      const sol = nextSolutionTs(c)
      if (sol != null && sol < end) { const i = idxOf(sol); add(i, 'solucion', 'Cambia la solución', detail(i), false, solutionLate(c, now)) }
    }
  }

  // ---- pH: una vez a mitad de semana si no se midió en la semana previa a ese día ----
  // (en el primer día de revisión de miércoles a domingo si lo hay: se mide en el agua que vas a dar)
  const phTs = readingSeries(events, 'ph').map((p) => p.ts)
  const mid = weekday(3)
  const sun = weekday(0)
  const phWater = [...waterDays].sort((a, b) => a - b).filter((i) => i >= mid && i <= sun)
  const phDay = (phWater.length ? phWater : [mid]).find((i) => !recent(phTs, i))
  if (phDay !== undefined) {
    const doneToday = phTs.some((ts) => ts >= days[0])
    const r = targetFor('ph', c.stage, c.substrate)
    add(doneToday ? 0 : phDay, 'ph', 'Mide el pH', `${hidro ? 'En el depósito' : 'En el agua de riego'} · objetivo ${fmtRange(r, 1)}`, doneToday)
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
  // (autoflorecientes: igual de ligera o más, solo unas pocas hojas; se recuperan poco)
  if (!guide || canTrain(guide)) {
    const detail = c.seedType === 'auto'
      ? 'Semana 3 de flor. En una autofloreciente, solo unas pocas hojas grandes. Te mostramos cómo antes de cortar.'
      : 'Semana 3 de flor. Te mostramos cómo antes de cortar.'
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
