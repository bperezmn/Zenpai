// ===== motor del mentor: rangos agronómicos + guía contextual =====
// Rangos de referencia general (sin CO₂), verificados en investigación. NO son consejo absoluto.
import { GUARD_HOURS, stageAt, lightHoursFor, autoFlowerDayOf, ventanaApicalAuto, type Stage, type Substrate, type MetricKey, type Cultivo, type Guide, type SceneState, type SeedType,
  checkDue, checkIntervalH, learnedIntervalH, droopPending, solutionLate, vegStartOf, flipDayOf, harvestEta, whenText, rampaRiego, revisaConDedo, dedoCm } from './lib'
import { lineaPorId, faseActual, enLavado, OTRA_MARCA, LAVADO_DIAS, type LineaNutrientes, type FaseDosis } from './data/nutrientes'
import type { HowToId } from './howtos'

// nivel de experiencia (creciente): novato → medio → avanzado
export const LEVELS: Guide[] = ['novato', 'medio', 'avanzado']
export const levelIdx = (g: Guide) => LEVELS.indexOf(g)
export const canTrain = (g: Guide) => g !== 'novato' // podas/entrenamiento solo desde "medio"

export interface Range { lo: number; hi: number }
// unit: la corta de los chips y la bitácora; unitLong: la de las frases (Medir, consejos)
export interface MetricDef { key: MetricKey; label: string; unit: string; unitLong?: string; dec: number; min: Guide; step: number }

// cada métrica aparece desde cierto nivel (novato ve lo básico; avanzado ve todo)
export const METRICS: MetricDef[] = [
  { key: 'temp', label: 'Temp', unit: '°C', dec: 0, min: 'novato', step: 1 },
  { key: 'hr', label: 'HR', unit: '%', dec: 0, min: 'novato', step: 1 },
  { key: 'ph', label: 'pH', unit: '', dec: 1, min: 'novato', step: 0.1 },
  { key: 'vpd', label: 'VPD', unit: 'kPa', dec: 1, min: 'medio', step: 0.1 },
  { key: 'ec', label: 'EC', unit: 'mS', unitLong: 'mS/cm', dec: 1, min: 'medio', step: 0.1 },
  { key: 'ppfd', label: 'PPFD', unit: 'µmol', unitLong: 'µmol/m²/s', dec: 0, min: 'avanzado', step: 50 },
]
export const metricDef = (k: MetricKey) => METRICS.find((m) => m.key === k)!
export const metricsFor = (g: Guide) => METRICS.filter((m) => levelIdx(g) >= levelIdx(m.min))

// una planta o varias: los consejos dicen "tu planta" o "tus plantas" (sin saberlo, en plural)
const una = (c: Pick<Cultivo, 'plants'>) => c.plants === 1
const tusPlantas = (c: Pick<Cultivo, 'plants'>) => (una(c) ? 'tu planta' : 'tus plantas')

// ===== riego =====
// La subida gradual del agua (rampaRiego) y cuándo se revisa con el dedo (revisaConDedo) viven en
// lib.ts: la caption de la carpa también los usa.
const r1 = (v: number) => Math.round(v * 10) / 10
// cantidad completa de la etapa: ~18 % de la maceta en vegetativo y ~22 % en floración (también
// pasada la fecha estimada: la misma cantidad de siempre, ahora del lavado)
const litrosCompletos = (c: Cultivo) => r1((c.potL || 11) * (c.stage === 'flor' || c.stage === 'cosecha' ? 0.22 : 0.18))

// litros de un riego (la misma regla que wateringGuide, en número: base del cálculo de abono).
// Plántula: un vaso (0.2 L); después sube por semanas hasta la cantidad completa.
export function litrosRiego(c: Cultivo): number {
  const L = c.potL || 11
  if (c.stage === 'plantula' || c.stage === 'germinacion') return 0.2
  const r = rampaRiego(c)
  if (r) return r1(Math.max(0.3, litrosCompletos(c) * r.f))
  if (c.stage === 'cosecha') return litrosCompletos(c)
  return r1(L * 0.25)
}

// "cada 2–3 días", sacado del MISMO reloj que las revisiones: el texto y el aviso no se contradicen
export function cadaTexto(c: Cultivo): string | null {
  const h = checkIntervalH(c)
  if (!h) return null
  const lo = Math.max(1, Math.floor(h / 24))
  const hi = Math.max(1, Math.ceil(h / 24))
  if (lo === hi) return lo === 1 ? 'cada día' : `cada ${lo} días`
  return `cada ${lo}–${hi} días`
}
// el ritmo aprendido en palabras ("tus plantas beben más o menos cada 3 días"); null mientras aprende
export function ritmoTexto(c: Cultivo): string | null {
  const h = learnedIntervalH(c)
  if (!h) return null
  const n = Math.max(1, Math.round(h / 24))
  return `${c.plants === 1 ? 'tu planta bebe' : 'tus plantas beben'} ${n === 1 ? 'más o menos cada día' : `más o menos cada ${n} días`}`
}

// ¿cuánto y cuándo regar? por etapa y tamaño de maceta (litros).
// Regla práctica con la planta ya grande: ~15–25 % del volumen de la maceta por riego, con
// 10–20 % de drenaje. En plántula NO: un vaso cerca del tallo y sin drenaje (en una maceta grande,
// que drene son litros sobre una planta de días). En tierra, mientras sube la cantidad, tampoco
// drena, y se mira con el dedo (poca agua en una maceta grande: el peso apenas cambia). En coco sí
// drena desde el vegetativo: cada riego lleva abono y sin drenaje se acumulan las sales.
// Pasada la fecha estimada, la misma cantidad que en floración (lo que lleva el agua lo dice abonoDe).
// En hidro no se riega (las raíces están en el agua): null, se cuida el depósito.
// amount = valor corto para filas y chips ("2 L", "1 vaso · 0.2 L"); when = frase de ayuda que sigue a "Riega …";
// vasos = " (unos 8 vasos)" para leer detrás de la cantidad; drain = ya toca regar hasta que drene;
// full = la cantidad completa a la que sube (null si ya llegó o si manda el drenaje).
export function wateringGuide(c: Cultivo): { amount: string; vasos: string; when: string; drain: boolean; full: number | null } | null {
  if (c.substrate === 'hidro') return null
  if (c.stage === 'plantula') return { amount: '1 vaso · 0.2 L', vasos: '', when: 'en círculo cerca del tallo, sin que salga agua por abajo, y solo cuando los primeros 2 cm estén secos', drain: false, full: null }
  if (c.stage === 'veg' || c.stage === 'flor' || c.stage === 'cosecha') {
    const n = litrosRiego(c)
    const r = rampaRiego(c)
    const dedo = revisaConDedo(c)
    const vasos = n < 3 ? ` (unos ${Math.max(1, Math.round(n / 0.25))} vasos)` : ''
    const ritmo = ritmoTexto(c)
    const cada = cadaTexto(c)
    const cuando = dedo ? `cuando los primeros ${dedoCm(c)} cm cerca del tallo estén secos` : 'cuando la maceta pese poco al levantarla'
    return {
      amount: `${n} L`,
      vasos,
      when: `${cuando}${ritmo ? `; ${ritmo}` : cada ? `; revísala ${cada}` : ''}`,
      drain: !dedo,
      full: dedo && r && r.f < 1 ? litrosCompletos(c) : null,
    }
  }
  return null
}
// cómo regar con drenaje: en coco, aunque la cantidad sea poca (el coco húmedo drena enseguida)
export function drenajeTexto(c: Pick<Cultivo, 'substrate' | 'plants'>): string {
  return c.substrate === 'coco'
    ? `En coco, riega hasta que drene un 10–20\u00a0% en cada riego, aunque sea poca agua. Mientras ${una(c) ? 'sea pequeña' : 'sean pequeñas'}, riega menos cantidad y más seguido.`
    : 'Despacio, en círculo, hasta que drene un 10–20\u00a0% por abajo.'
}

// semana de floración (1 = la del cambio a 12/12); null si no está en floración.
// Autoflorecientes: la floración empieza sola hacia el día 32 de la curva típica (flipDayOf).
export function semanaFlor(c: Cultivo): number | null {
  if (c.stage !== 'flor') return null
  return Math.max(1, Math.floor((c.day - flipDayOf(c)) / 7) + 1)
}

// objetivos por etapa (temp/HR/VPD/PPFD/EC). pH va por sustrato (abajo).
const STAGE: Record<string, Partial<Record<MetricKey, Range>>> = {
  germinacion: { temp: { lo: 22, hi: 26 }, hr: { lo: 70, hi: 85 }, vpd: { lo: 0.4, hi: 0.8 }, ppfd: { lo: 100, hi: 300 }, ec: { lo: 0.2, hi: 0.6 } },
  plantula: { temp: { lo: 22, hi: 26 }, hr: { lo: 65, hi: 80 }, vpd: { lo: 0.4, hi: 0.8 }, ppfd: { lo: 200, hi: 400 }, ec: { lo: 0.4, hi: 0.8 } },
  veg: { temp: { lo: 22, hi: 28 }, hr: { lo: 55, hi: 70 }, vpd: { lo: 0.8, hi: 1.2 }, ppfd: { lo: 400, hi: 600 }, ec: { lo: 1.0, hi: 1.6 } },
  flor: { temp: { lo: 20, hi: 26 }, hr: { lo: 40, hi: 55 }, vpd: { lo: 1.0, hi: 1.5 }, ppfd: { lo: 700, hi: 900 }, ec: { lo: 1.4, hi: 2.0 } },
  cosecha: { temp: { lo: 18, hi: 24 }, hr: { lo: 40, hi: 50 }, vpd: { lo: 1.2, hi: 1.6 }, ppfd: { lo: 600, hi: 900 }, ec: { lo: 0.0, hi: 0.4 } },
  secando: { temp: { lo: 18, hi: 21 }, hr: { lo: 55, hi: 62 }, vpd: { lo: 0.8, hi: 1.0 } },
}
const PH: Record<Substrate, Range> = {
  tierra: { lo: 6.2, hi: 7.0 },
  coco: { lo: 5.5, hi: 6.2 },
  hidro: { lo: 5.5, hi: 6.2 },
}

export function targetFor(key: MetricKey, stage: Stage, sub: Substrate): Range | null {
  if (key === 'ph') return PH[sub]
  return STAGE[stage as string]?.[key] ?? null
}

export type Status = 'ok' | 'warn' | 'bad'
export function evalMetric(key: MetricKey, value: number, stage: Stage, sub: Substrate): { status: Status; range: Range | null } {
  return evalRange(key, value, targetFor(key, stage, sub))
}
// lo mismo contra un objetivo dado (la EC de HOY: ver ecHoy). Sin objetivo no se juzga ('ok').
export function evalRange(key: MetricKey, value: number, r: Range | null): { status: Status; range: Range | null } {
  if (!r) return { status: 'ok', range: null }
  if (value >= r.lo && value <= r.hi) return { status: 'ok', range: r }
  const pad = Math.max((r.hi - r.lo) * 0.25, key === 'ph' ? 0.2 : 0)
  if (value >= r.lo - pad && value <= r.hi + pad) return { status: 'warn', range: r }
  return { status: 'bad', range: r }
}

export const STATUS_COLOR: Record<Status, string> = { ok: 'var(--acc)', warn: 'var(--warn)', bad: 'var(--danger)' }

export function fmtRange(r: Range | null, dec: number): string {
  if (!r) return '—'
  const f = (n: number) => (dec ? n.toFixed(dec) : Math.round(n).toString())
  return `${f(r.lo)}–${f(r.hi)}`
}

// consejo del mentor para una medición (incluye el guardarraíl de pH), en frases completas: qué
// pasa, qué hacer ahora y hasta dónde (el objetivo, con su unidad).
// range: el objetivo contra el que se juzgó (la EC de hoy); sin él, el de la etapa.
// factor: la fuerza del abono de su nivel (ecHoy), para decir cuánta dosis usar si la EC se sale.
export function metricTip(key: MetricKey, value: number, status: Status, c: Pick<Cultivo, 'stage' | 'substrate' | 'plants'>,
  range?: Range | null, factor = 1): { titulo: string; texto: string } {
  const r = range !== undefined ? range : targetFor(key, c.stage, c.substrate)
  if (!r || status === 'ok') return { titulo: 'Dentro del objetivo', texto: key === 'ph' ? `Está en el rango para ${c.substrate}.` : 'Está en el rango de esta etapa.' }
  const high = value > r.hi
  const def = metricDef(key)
  const u = def.unitLong ?? def.unit
  // "pH 6.2–7.0", "EC 1.0–1.6 mS/cm", "22–26 °C", "40–55 %"
  const obj = `${key === 'ph' || key === 'ec' || key === 'vpd' ? `${def.label} ` : ''}${fmtRange(r, def.dec)}${u ? `\u00a0${u}` : ''}`
  const n = una(c)
  const secando = c.stage === 'secando'
  const hidro = c.substrate === 'hidro'
  if (key === 'ph') return {
    titulo: high ? 'El pH está alto' : 'El pH está bajo',
    texto: `Fuera de rango, las raíces no absorben el abono aunque lo tenga. ${high ? 'Bájalo poco a poco con gotas de «pH-»' : 'Súbelo poco a poco con gotas de «pH+»'} ${hidro ? 'en el depósito' : 'en el agua, antes de regar,'} hasta ${obj} y vuelve a medir.`,
  }
  if (key === 'vpd') return high
    ? { titulo: 'El VPD está alto', texto: `El aire está muy seco para esta temperatura y las hojas pierden agua de más. Sube la humedad o baja la temperatura hasta ${obj}.` }
    : { titulo: 'El VPD está bajo', texto: `El aire está muy húmedo para esta temperatura y pueden salir hongos. Baja la humedad con la extracción o sube un poco la temperatura hasta ${obj}.` }
  if (key === 'temp') return high
    ? { titulo: 'Hace demasiado calor', texto: `${secando ? 'Con calor, los cogollos se secan demasiado rápido y pierden aroma. Ventila o enciende la extracción' : `El calor estresa a ${tusPlantas(c)} y atrae plagas. Deja la extracción encendida, ventila o sube la lámpara`} hasta bajar a ${obj}.` }
    : { titulo: 'Hace frío', texto: `${secando ? 'Con frío, el secado se alarga.' : `Con frío, ${tusPlantas(c)} ${n ? 'crece' : 'crecen'} lento.`} Sube la temperatura hasta ${obj}; si usas un calefactor, que no apunte a ${secando ? 'las ramas' : 'las hojas'}.` }
  if (key === 'hr') {
    const cogollos = c.stage === 'flor' || c.stage === 'cosecha' || secando
    return high
      ? { titulo: 'La humedad está alta', texto: `Con humedad alta sale moho${cogollos ? ' en los cogollos' : ''}. Deja la extracción encendida todo el día y abre la carpa unos 10 minutos hasta bajar a ${obj}.` }
      : { titulo: 'El aire está seco', texto: `${secando ? 'Con el aire seco, los cogollos se secan demasiado rápido y pierden aroma.' : `Con el aire seco, ${tusPlantas(c)} se ${n ? 'estresa' : 'estresan'}.`} Sube la humedad hasta ${obj}: un humidificador o un recipiente con agua dentro de la carpa ayudan.` }
  }
  if (key === 'ppfd') return high
    ? { titulo: 'Hay demasiada luz', texto: `Las hojas de arriba se ponen amarillas o blancas. Sube la lámpara o baja la potencia hasta ${obj}.` }
    : { titulo: 'Falta luz', texto: `Con poca luz, los tallos salen largos y flojos. Acerca la lámpara o sube la potencia hasta ${obj}.` }
  if (key === 'ec') {
    // si se pasó, vuelve a la fracción de SU nivel (la de la tarjeta del abono); si le falta,
    // sube midiendo, con la etiqueta como techo (como dice esa tarjeta)
    const fr = fraccion(factor)
    return high
      ? { titulo: 'La EC está alta', texto: `Puede quemar las puntas de las hojas. Agrega agua sin abono ${hidro ? 'al depósito ' : ''}hasta bajar a ${obj} y ${hidro ? 'en la próxima solución' : 'en el próximo riego'} usa ${fr ? `${fr}la dosis` : 'un poco menos de abono'}.` }
      : { titulo: 'La EC está baja', texto: `${n ? 'Le' : 'Les'} falta comida. Sube el abono poco a poco hasta ${obj}, sin pasar de la dosis de la etiqueta.` }
  }
  return { titulo: '', texto: '' }
}

// ===== abono seguro =====
// Fuerza del abono según el nivel, sobre la dosis de la tabla de la marca (o de la etiqueta): el
// novato a la mitad, el medio a tres cuartos y el avanzado con la dosis completa. En coco e hidro
// manda la EC objetivo: se empieza al 50–75 % y se sube midiendo. En plántula, con marca, la mitad
// de su fila de plántula (que ya es la reducida del fabricante: un cuarto encima serían 1/16); sin
// tabla, un cuarto de la etiqueta en todos los niveles (la dosis de la etiqueta es la de una planta
// hecha: la mitad daría una EC de ~1.3 a una plántula que pide 0.4–0.8).
// La regla es gratis; los mililitros exactos de la marca son Premium.
export function fuerzaAbono(guide: Guide, stage: Stage, sub: Substrate, modo: ModoAbono = 'marca'): number {
  const plantula = stage === 'plantula' || stage === 'germinacion'
  if (plantula && modo !== 'marca') return 0.25
  const f = guide === 'novato' ? 0.5 : guide === 'medio' ? 0.75 : 1
  return sub === 'tierra' ? f : Math.min(0.75, f)
}
// "la mitad de " / "tres cuartos de "… ('' con la dosis completa), delante de "la dosis …"
const fraccion = (f: number) => (f >= 1 ? '' : f <= 0.25 ? 'un cuarto de ' : f <= 0.5 ? 'la mitad de ' : 'tres cuartos de ')

// Tierra que ya trae abono (o "no sé", que se trata igual: es lo seguro). Las tierras comerciales
// abonadas alimentan unas 2–4 semanas (una Light-Mix, ~2) y abonar encima quema las puntas de las
// hojas: solo agua unas 3 semanas desde el trasplante (el día 21, o antes si el vegetativo empieza
// pronto: como mucho una semana dentro de él). Devuelve el día del cultivo en que toca empezar a
// abonar (null: no aplica).
export function tierraCargadaHasta(c: Cultivo): number | null {
  if (c.substrate !== 'tierra' || c.tierraAbonada === 'no') return null
  return Math.min(21, vegStartOf(c) + 7)
}

// Lo que lleva el riego de hoy (o la solución del depósito): la fuente ÚNICA de la ficha de riego,
// la tarjeta de Hoy y el plan de la semana. modo: línea del catálogo, otra marca (guiada por
// la EC) o solo agua (solo en tierra). motivo: por qué hoy no se abona (o toca el lavado):
// tierra = la del saco aún alimenta; lavado = los últimos días; eleccion = eligió solo agua y aún
// no hace falta; falta = eligió solo agua y ya toca abonar; tabla = una semana sin abono de la tabla.
export type ModoAbono = 'marca' | 'otra' | 'agua'
export interface Abono {
  modo: ModoAbono
  linea: LineaNutrientes | null
  fase: FaseDosis | null      // marca: la fila de la tabla que toca hoy (null si hoy no toca abono)
  abona: boolean              // el agua de hoy lleva abono (o el producto de lavado de la marca)
  motivo: 'tierra' | 'lavado' | 'eleccion' | 'falta' | 'tabla' | null
  factor: number              // fuerza sobre la tabla o la etiqueta (0.25–1)
  ec: Range | null            // EC objetivo del agua de hoy (null si va solo agua o el abono es orgánico)
  titulo: string              // tarjeta de Hoy (y el arranque de la regla en la ficha de riego)
  texto: string               // la regla en palabras
}
export function abonoDe(c: Cultivo, guide: Guide): Abono | null {
  const s = c.stage
  const vivo = s === 'plantula' || s === 'germinacion' || s === 'veg' || s === 'flor' || s === 'cosecha'
  if (!vivo || !c.germTs || c.harvestedTs) return null
  const sub = c.substrate
  const plantula = s === 'plantula' || s === 'germinacion'
  const linea = lineaPorId(c.nutrientesId)
  // sin línea: "otra marca" (en coco e hidro siempre: ahí no se cultiva solo con agua)
  const modo: ModoAbono = linea ? 'marca' : c.nutrientesId === OTRA_MARCA || sub !== 'tierra' ? 'otra' : 'agua'
  // la fuerza del nivel; una marca que en tierra pide menos que su tabla (GH Flora, tabla de
  // hidro: la mitad en tierra) la limita
  const nivel = fuerzaAbono(guide, s, sub, modo)
  const tope = sub === 'tierra' && linea?.tierraMax ? linea.tierraMax : 1
  const factor = Math.min(nivel, tope)
  const pct = Math.round(factor * 100)
  const frac = fraccion(factor)
  const base = { modo, linea, factor }
  // de qué dosis se habla: la de la marca (en plántula, su dosis de plántula) o la de tu etiqueta
  const dosisDe = linea ? `la dosis ${plantula ? 'de plántula' : 'de la etiqueta'} de ${linea.marca}` : 'la dosis de la etiqueta'
  const quema = 'quema las puntas de las hojas'
  // la fecha de un día del cultivo con la misma cuenta que el plan de la semana (ese día a esta
  // misma hora): así "desde el sábado" y la tarea del sábado dicen lo mismo
  const cuando = (dia: number) => whenText(Date.now() + (dia - c.day) * 86400000)
  const agua = (motivo: Abono['motivo'], titulo: string, texto: string): Abono =>
    ({ ...base, fase: null, abona: false, motivo, ec: null, titulo, texto })

  // pasada la fecha estimada: el mismo lavado que en los últimos días de flor (con el producto de la
  // marca si su tabla lo trae) hasta cortar, y la cosecha la deciden los tricomas
  if (s === 'cosecha') {
    const f = linea ? faseActual(linea, { ...c, stage: 'flor' }) : null
    const conProducto = !!f && Object.keys(f.dosis).length > 0
    const sigue = conProducto ? `sigue con el lavado final de ${linea!.marca}` : sub === 'hidro' ? 'solución sin abono en el depósito' : 'solo agua'
    const texto = `Ya pasó la fecha estimada: revisa los tricomas con lupa cada 2–3 días. Si la mayoría están lechosos, ${sigue} hasta cortar. Si siguen casi todos transparentes, aún ${una(c) ? 'le' : 'les'} falta: vuelve a abonar a la mitad de la dosis de floración y deja el lavado para los últimos ${LAVADO_DIAS} días antes de cortar.`
    return { ...base, fase: conProducto ? f : null, abona: conProducto, motivo: 'lavado', ec: conProducto ? targetFor('ec', 'cosecha', sub) : null, titulo: 'Lavado final', texto }
  }
  // la tierra del saco ya alimenta: solo agua unas 3 semanas desde el trasplante (también en
  // plántula), con salida si la planta pide comida antes
  const hasta = tierraCargadaHasta(c)
  if (hasta != null && c.day < hasta) {
    const nose = c.tierraAbonada === 'nose'
    const salida = modo === 'agua'
      ? 'elige tu abono en Editar, en Nutrientes'
      : `empieza ya con ${frac}${dosisDe}`
    return agua('tierra', nose ? 'Tu tierra quizá trae abono' : 'Tu tierra ya trae abono',
      `${nose ? 'Por si acaso, solo agua' : 'Solo agua'}: abonar encima de una tierra abonada ${quema}. Desde ${cuando(hasta)} toca empezar a abonar; si antes ves las hojas de abajo verde claro, ${salida}.`)
  }
  // eligió regar solo con agua (en tierra): cuando la tierra se agota, toca abonar
  if (modo === 'agua') {
    const desde = hasta ?? vegStartOf(c)
    if (c.day < desde) {
      return agua('eleccion', 'Solo agua', `Tu tierra no trae abono: ${una(c) ? 'la plántula aún vive de sus reservas, pero desde el vegetativo tendrá' : 'las plántulas aún viven de sus reservas, pero desde el vegetativo tendrán'} que comer. Elige tu abono en Editar, en Nutrientes.`)
    }
    const texto = hasta != null
      ? 'La tierra del saco se va agotando; la señal son las hojas de abajo verde claro. Elige tu abono en Editar, en Nutrientes, y te guiamos.'
      : `Tu tierra no trae abono y ${una(c) ? 'tu planta ya tiene' : 'tus plantas ya tienen'} que comer. Elige tu abono en Editar, en Nutrientes, y te guiamos.`
    return agua('falta', c.day >= desde + 14 ? (una(c) ? 'Tu planta necesita abono' : 'Tus plantas necesitan abono') : 'Toca empezar a abonar', texto)
  }
  // lavado final: los últimos 10 días antes de la cosecha estimada, nunca más largo.
  // Con abono orgánico en tierra es opcional.
  if (s === 'flor' && enLavado(c)) {
    const f = linea ? faseActual(linea, c) : null
    const conProducto = !!f && Object.keys(f.dosis).length > 0
    const eta = harvestEta(c)
    const opcional = sub === 'tierra' && linea?.organico ? ' Con abono orgánico en tierra es opcional.'
      : sub === 'tierra' && modo === 'otra' ? ' Si tu abono es orgánico, es opcional.' : ''
    const sinAbono = sub === 'hidro' ? 'Solución sin abono en el depósito' : 'Solo agua'
    const texto = `${conProducto ? `Toca el lavado final de ${linea!.marca}` : sinAbono} los últimos ${LAVADO_DIAS} días, hasta la cosecha estimada${eta ? `, ${whenText(eta)}` : ''}. Muchas marcas lo recomiendan; no hace daño si ${una(c) ? 'la planta está sana' : 'las plantas están sanas'}.${opcional}`
    return { ...base, fase: conProducto ? f : null, abona: conProducto, motivo: 'lavado', ec: conProducto ? targetFor('ec', 'cosecha', sub) : null, titulo: 'Lavado final', texto }
  }
  // una semana de la tabla sin abono (no pasa en el catálogo actual, pero una tabla leída podría traerla)
  const fase = linea ? faseActual(linea, c) : null
  if (linea && (!fase || Object.keys(fase.dosis).length === 0)) {
    return agua('tabla', 'Semana sin abono', `Esta semana la tabla de ${linea.marca} no lleva abono: solo agua.`)
  }
  // abona. La EC objetivo: la de la etapa; una marca en tierra a menos de la dosis completa sale más
  // baja (es lo esperado), así que el objetivo baja en proporción por abajo; con abono orgánico la
  // EC marca poco y no sirve para dosificarlo (sin objetivo).
  const ecEtapa = targetFor('ec', s, sub)
  const ec = linea?.organico || !ecEtapa ? null
    : modo === 'marca' && sub === 'tierra' && factor < 1 ? { lo: r1(ecEtapa.lo * factor), hi: ecEtapa.hi } : ecEtapa
  const ecTxt = ec ? `EC ${fmtRange(ec, 1)} mS/cm` : 'la EC de la etapa'
  const sinMedidor = guide === 'novato' ? ` Sin medidor de EC, quédate en ${factor <= 0.25 ? 'ese cuarto' : factor <= 0.5 ? 'la mitad' : 'esa dosis'}.` : ''
  let texto: string
  if (linea?.organico) {
    texto = `Es un abono orgánico: la EC marca poco y no sirve para dosificarlo. ${factor < 1
      ? `Usa ${frac}${dosisDe} y no pases de la dosis de la etiqueta: sube si ves hojas pálidas, baja si se queman las puntas de las hojas.`
      : `Usa ${dosisDe}, sin pasarte: baja si se queman las puntas de las hojas.`}`
  } else if (!linea && plantula) {
    // otra marca con una plántula: un cuarto de la etiqueta (o su dosis de plántulas)
    texto = `En plántula, empieza con un cuarto de la dosis de la etiqueta (o con su dosis de plántulas, si la trae) y no pases de ${ecTxt}.${sinMedidor}`
  } else if (!linea) {
    texto = `Usa tu abono hasta llegar a ${ecTxt}, sin pasar de la dosis de la etiqueta${factor < 1 ? `: empieza con ${frac}esa dosis y sube poco a poco` : ''}. Si es orgánico, guíate solo por la etiqueta: la EC marca poco.${sinMedidor}`
  } else if (sub !== 'tierra') {
    texto = `En ${sub === 'coco' ? 'coco' : 'hidro'} manda la EC: empieza con ${frac}${dosisDe} y sube poco a poco hasta ${ecTxt}, sin pasar de la dosis de la etiqueta. Si te pasas, agrega agua.${sinMedidor}`
  } else if (factor < nivel) {
    // la marca pide menos en tierra: ese es el tope, aunque el nivel diera más
    texto = `Usa ${frac}${dosisDe}: en tierra, ${linea.marca} pide ${frac}su tabla. Baja si se queman las puntas de las hojas.`
  } else {
    texto = factor < 1
      ? `Usa ${frac}${dosisDe}: sube si ves hojas pálidas, baja si se queman las puntas de las hojas.`
      : `Usa ${dosisDe}: baja si se queman las puntas de las hojas.`
  }
  // coco: atrapa el calcio y el magnesio; un abono que no es de coco no lo compensa
  const deCoco = !!linea && linea.sustratos.length === 1 && linea.sustratos[0] === 'coco'
  if (sub === 'coco' && !deCoco) {
    texto += linea
      ? ` ${linea.marca} no es específico para coco: agrega Cal-Mag (0.5–1 ml/L) antes que el resto, sobre todo con agua blanda o de ósmosis.`
      : ' En coco, si tu abono no es específico para coco, agrega Cal-Mag (0.5–1 ml/L) antes que el resto, sobre todo con agua blanda o de ósmosis.'
  }
  // recién acabada la carga de la tierra abonada (dos semanas): el aviso de empezar a abonar
  const empieza = hasta != null && c.day < hasta + 14
  return {
    ...base, fase, abona: true, motivo: null, ec,
    titulo: empieza ? 'Toca empezar a abonar' : `Abono al ${pct} %`,
    texto: empieza ? `La tierra del saco se va agotando; la señal son las hojas de abajo verde claro. ${texto}` : texto,
  }
}

// La EC objetivo del agua de HOY, para juzgar lo que mide el usuario (Medir, el panel de la carpa,
// la ficha de riego). Los días de solo agua no hay objetivo: lo que marca es su agua de la llave
// y no hay que subirla. Con abono orgánico, tampoco (la EC no sirve para dosificarlo). nota: lo que
// se le dice en vez del semáforo (o junto a él, con una marca en tierra a menos de la dosis completa).
// factor: la fuerza del abono de su nivel, la que Medir le pide usar si la EC se sale.
export function ecHoy(c: Cultivo, guide: Guide): { range: Range | null; nota: string | null; soloAgua: boolean; factor: number } {
  const ab = abonoDe(c, guide)
  if (!ab) return { range: targetFor('ec', c.stage, c.substrate), nota: null, soloAgua: false, factor: fuerzaAbono(guide, c.stage, c.substrate) }
  const factor = ab.factor
  // eligió solo agua y ya toca abonar: la EC de hoy tampoco se juzga, pero no se le dice que no la suba
  if (!ab.abona) return { range: null, soloAgua: true, factor, nota: ab.motivo === 'falta'
    ? 'Aún riegas solo agua: esta EC es la de tu agua de la llave. Cuando elijas tu abono, te damos la EC objetivo.'
    : 'Hoy va solo agua: esta EC es la de tu agua de la llave. No hace falta subirla.' }
  if (ab.linea?.organico) return { range: null, nota: 'Con abono orgánico la EC marca poco y no sirve para dosificarlo: sigue la tabla y no pases de la dosis de la etiqueta.', soloAgua: false, factor }
  if (ab.modo === 'marca' && c.substrate === 'tierra' && ab.factor < 1) {
    return { range: ab.ec, nota: `Con ${fraccion(ab.factor)}la dosis, tu EC saldrá más baja que con la dosis completa: es lo esperado.`, soloAgua: false, factor }
  }
  return { range: ab.ec, nota: null, soloAgua: false, factor }
}
// el objetivo de una métrica para HOY: la EC según lo que lleva el agua; el resto, el de la etapa
export function targetHoy(key: MetricKey, c: Cultivo, guide: Guide): Range | null {
  return key === 'ec' ? ecHoy(c, guide).range : targetFor(key, c.stage, c.substrate)
}

// El pH de la marca frente al de la app. La marca da el de su solución (casi siempre pensado para
// coco e hidro); el de la app es el que absorben las raíces en TU sustrato. Si no son el mismo, se
// dice dónde quedarse: donde coinciden (o, si no coinciden, el del sustrato). null: no hay choque
// (el de la marca es igual o más amplio que el de la app).
export function phDeMarca(linea: Pick<LineaNutrientes, 'marca' | 'ph'>, sub: Substrate): string | null {
  const app = PH[sub]
  const [lo, hi] = linea.ph
  const a = Math.max(lo, app.lo)
  const b = Math.min(hi, app.hi)
  if (a === app.lo && b === app.hi) return null
  const dos = `${linea.marca} pide pH ${fmtRange({ lo, hi }, 1)} y en ${sub} las raíces absorben bien con ${fmtRange(app, 1)}`
  if (a > b) return `${dos}: quédate en el de tu sustrato.`
  if (a === b) return `${dos}: quédate cerca de ${a.toFixed(1)}, donde coinciden.`
  return `${dos}: apunta a ${fmtRange({ lo: a, hi: b }, 1)}, donde coinciden.`
}

// ===== consejos del mentor: enseñan según etapa Y nivel =====
// novato = de la mano (cómo/cuándo regar, qué es el pH/EC, sin podas);
// medio = añade técnicas (LST); avanzado = todo, más conciso.
// action: la tarjeta lleva un botón (revisar la maceta o el depósito / cambiar la solución / la luz)
// howto: la guía que lo enseña (la tarjeta lleva «Ver cómo»)
export interface Advice { title: string; body: string; tone?: Status; action?: 'check' | 'solucion' | 'luz'; howto?: HowToId }
// un texto fijo o armado con el cultivo (su sustrato, sus rangos, una planta o varias)
type Txt = string | ((c: Cultivo) => string)
const txt = (t: Txt, c: Cultivo) => (typeof t === 'function' ? t(c) : t)
interface AdviceDef {
  levels: Guide[]
  title: Txt
  body: Txt
  tone?: Status
  seed?: SeedType        // solo para ese tipo de semilla
  subs?: Substrate[]     // solo en esos sustratos
  bodyAgua?: Txt         // el cuerpo los días de solo agua (tierra abonada…): la EC y el abono, cuando toquen
  sinLavado?: boolean    // no sale durante el lavado final
  howto?: HowToId        // «Ver cómo»: la guía que lo enseña
}

// los números de los consejos salen de las mismas tablas que Medir (un solo sitio que cambiar)
const rango = (st: Stage, k: MetricKey, dec = 0) => fmtRange(STAGE[st as string]?.[k] ?? null, dec)

// los tricomas, explicados igual en Hoy, la Semana y «¿Cortamos ya?»
export const TRICOMAS = 'Transparentes: aún no. Lechosos: el punto de más potencia. Con algo de ámbar: un efecto más relajante.'

// cuándo pasar a 12/12, la misma regla en Hoy y en la Semana: en floración se estiran hasta el
// doble, así que se cambia con un tercio del espacio entre la maceta y la lámpara (el resto queda
// para el estirón y la distancia a la luz)
export function cuandoFlip(c: Pick<Cultivo, 'plants'>): string {
  const n = una(c)
  return `cuando ${tusPlantas(c)} ${n ? 'mida' : 'midan'} un tercio del espacio entre la maceta y la lámpara: en floración ${n ? 'se estira' : 'se estiran'} hasta el doble`
}

const ADVICE: Partial<Record<Stage, AdviceDef[]>> = {
  plantula: [
    // en hidro no se riega: el depósito lo cuenta su tarjeta
    { levels: ['novato'], subs: ['tierra', 'coco'], title: 'Riega muy poco',
      body: (c) => `${una(c) ? 'Tu plántula casi no toma' : 'Tus plántulas casi no toman'} agua. Regar de más ahoga las raíces: es el error más común. Si dudas, espera un día más.` },
    { levels: ['novato'], title: 'Qué es el pH y cómo medirlo',
      body: (c) => `El pH dice si el agua está ácida o alcalina. En ${c.substrate}, las raíces solo absorben bien con pH ${fmtRange(PH[c.substrate], 1)}. Mídelo con tiras o con un medidor en el agua ${c.substrate === 'hidro' ? 'del depósito y ajústalo al preparar la solución' : 'de riego y ajústalo antes de regar, nunca después'}.` },
    { levels: ['novato', 'medio'], title: 'Ambiente',
      body: (c) => `Mantén ${rango('plantula', 'temp')}\u00a0°C y la humedad alta, ${rango('plantula', 'hr')}\u00a0%. Luz suave y no muy cerca, para no ${una(c) ? 'quemarla' : 'quemarlas'}.` },
    // el abono (cuánto según el nivel, la tierra abonada) lo cuenta la tarjeta de abonoDe()
    { levels: ['novato'], title: 'Sin podas todavía',
      body: (c) => (una(c) ? 'Es muy pequeña: no la podes ni la entrenes aún, solo déjala crecer sana.' : 'Son muy pequeñas: no las podes ni las entrenes aún, solo déjalas crecer sanas.') },
  ],
  veg: [
    { levels: ['novato'], title: 'Qué es la EC',
      body: `La EC mide cuánto alimento (sales) lleva el agua: más EC es más comida, pero demasiada quema las raíces. En vegetativo apunta a EC ${rango('veg', 'ec', 1)} mS/cm y súbela poco a poco.`,
      bodyAgua: `La EC mide cuánto alimento (sales) lleva el agua. Mientras riegues solo agua no hace falta medirla; cuando empieces a abonar, apunta a EC ${rango('veg', 'ec', 1)} mS/cm y súbela poco a poco.` },
    { levels: ['novato', 'medio', 'avanzado'], title: (c) => (una(c) ? 'Ahora crece rápido' : 'Ahora crecen rápido'),
      body: (c) => `${una(c) ? 'Dale' : 'Dales'} más luz poco a poco y un abono con más nitrógeno. Mantén el aire moviéndose para que los tallos salgan fuertes.`,
      bodyAgua: (c) => `${una(c) ? 'Dale' : 'Dales'} más luz poco a poco y mantén el aire moviéndose para que los tallos salgan fuertes. El abono, cuando toque: te avisamos.` },
    { levels: ['medio', 'avanzado'], title: 'Abre la copa con LST',
      body: 'LST es entrenamiento de bajo estrés: dobla con cuidado las ramas hacia afuera y átalas para que la copa quede plana. Llega luz a más cogollos y hay más cosecha, sin cortar nada. Cuando lo hagas, anótalo con el botón LST de abajo.' },
    { levels: ['avanzado'], seed: 'foto', title: 'Poda apical', howto: 'apical',
      body: (c) => `Corta la punta principal por encima de un nudo (donde nacen las hojas del tallo): salen 2 puntas y la copa queda más pareja. Combínala con LST. Solo en vegetativo y con ${una(c) ? 'la planta sana' : 'las plantas sanas'}.` },
    // autos: la poda apical va aparte (mentorAdvice), con su ventana escalada a su ciclo
  ],
  flor: [
    { levels: ['novato', 'medio', 'avanzado'], sinLavado: true, title: 'Abono de floración',
      body: `Aparecen los cogollos: el abono lleva menos nitrógeno y más fósforo y potasio (P-K). En los últimos ${LAVADO_DIAS} días, solo el lavado.` },
    { levels: ['novato', 'medio', 'avanzado'], title: 'Cuida la humedad',
      body: `Baja la humedad a ${rango('flor', 'hr')}\u00a0% y mantén el aire circulando: en floración, el moho (botrytis) arruina los cogollos.` },
    { levels: ['novato'], title: (c) => (una(c) ? 'No la estreses' : 'No las estreses'),
      body: (c) => `Ya no se poda ni se entrena fuerte: ${una(c) ? 'está concentrada' : 'están concentradas'} en engordar los cogollos.` },
    { levels: ['medio', 'avanzado'], seed: 'foto', title: 'Defoliación selectiva', howto: 'defoliacion',
      body: 'Hacia la semana 3 de floración, quita las hojas grandes que tapan los cogollos de abajo para que entre luz y aire. Poco a poco.' },
    { levels: ['medio', 'avanzado'], seed: 'auto', title: 'Defoliación selectiva', howto: 'defoliacionAuto',
      body: 'Hacia la semana 3 de floración, quita solo unas pocas hojas grandes que tapen los cogollos de abajo. Una autofloreciente se recupera poco: mejor quédate corto.' },
    { levels: ['avanzado'], title: 'Vigila los tricomas',
      body: `Hacia el final, míralos con lupa en los cogollos, no en las hojitas. ${TRICOMAS}` },
  ],
  cosecha: [
    // el lavado (solo agua o el producto de la marca, y qué hacer si los tricomas no están) lo
    // cuenta la tarjeta de abonoDe(), la misma que la ficha de riego
    { levels: ['novato', 'medio', 'avanzado'], title: 'Cuándo cortar',
      body: `Mira con lupa los tricomas de los cogollos. ${TRICOMAS} Corta según el efecto que busques.` },
  ],
  secando: [
    { levels: ['novato', 'medio', 'avanzado'], title: 'Secado',
      body: `Cuelga las ramas a ${rango('secando', 'temp')}\u00a0°C y ${rango('secando', 'hr')}\u00a0% de humedad, a oscuras y con aire suave, sin viento directo. Tarda unos 7–14 días.` },
    { levels: ['novato', 'medio', 'avanzado'], title: 'Curado',
      body: 'Cuando los tallos finos crujan al doblarlos, mete los cogollos en frascos de vidrio y ábrelos un rato cada día durante 2–3 semanas.' },
  ],
}

export function mentorAdvice(c: Cultivo, guide: Guide): Advice[] {
  const out: Advice[] = []
  const hidro = c.substrate === 'hidro'
  const plantula = c.stage === 'plantula' || c.stage === 'germinacion'
  // la maceta se revisa con el dedo en plántula y mientras el agua sube por semanas (poca agua en
  // una maceta grande: el peso apenas cambia); después, por el peso
  const dedo = revisaConDedo(c)
  const w = wateringGuide(c)
  const dedoTxt = `Mete el dedo ${dedoCm(c)} cm a unos 3 cm del tallo`
  const riegoDedo = plantula ? 'un vaso' : w ? w.amount : 'poca agua'
  // atención primero. El reloj solo dice cuándo mirar; lo que anotó el usuario manda:
  // hojas caídas después del último riego (puede ser sed… o exceso de agua)
  if (droopPending(c)) {
    out.push({ title: 'Hojas caídas', tone: 'warn', action: 'check', body: dedo
      ? `Puede ser sed o exceso de agua. ${dedoTxt}: si está seca, riega ${riegoDedo}; si está húmeda, no riegues hasta que se seque.`
      : 'Puede ser sed o exceso de agua. Levanta la maceta: si pesa poco, riega; si aún pesa, no riegues hasta que pese menos.' })
  } else if (hidro && solutionLate(c)) {
    out.push({ title: 'Cambia la solución', tone: 'warn', action: 'solucion',
      body: 'Toca cada 7–10 días: vacía el depósito y prepara solución nueva con agua limpia, el abono y el pH ajustado.' })
  } else if (checkDue(c)) {
    out.push({ title: hidro ? 'Revisa el depósito' : 'Revisa la maceta', tone: 'warn', action: 'check', body: hidro
      ? plantula
        ? 'Mira el nivel del agua: mientras las raíces no lleguen a ella, tiene que tocar la base de la cestita. Si bajó, rellénalo con agua de pH ajustado.'
        : 'Mira el nivel del agua. Si bajó, rellénalo con agua de pH ajustado, dejando 2–3 cm de aire bajo la cestita.'
      : dedo
      ? `${dedoTxt}: si está seca, riega ${riegoDedo}; si aún está húmeda, espera y te avisamos mañana.`
      : 'Levántala un poco: si pesa poco, riega; si aún pesa, espera y te avisamos mañana.' })
  }
  // fotoperiodo: la flor no llega sola — recuérdaselo cuando la veg ya está madura
  if (c.stage === 'veg' && c.seedType === 'foto' && !c.flowerTs && c.day >= 30) {
    out.push({ title: '¿Pasamos a floración?', body: `Cambia tu luz a 12 h de luz y 12 h de oscuridad ${cuandoFlip(c)}. Ese cambio dispara la floración; cuando lo hagas, márcalo abajo con «Pasar a floración».` })
  }
  // autoflorecientes: la luz no se toca en todo el ciclo. Sale también en floración (cuando más
  // tienta bajarla a 12 h) y en todos los niveles; si el horario anotado da menos de 18 h, avisa
  // (y la tarjeta abre la hoja de Luz: la app no controla la lámpara, solo el horario anotado).
  if ((c.stage === 'veg' || c.stage === 'flor') && c.seedType === 'auto') {
    const h = lightHoursFor(c)
    const n = una(c)
    const body = c.stage === 'veg'
      ? `${n ? 'Florecerá sola' : 'Florecerán solas'} hacia el día ${autoFlowerDayOf(c)}, sin cambiar la luz. ${n ? 'Déjale' : 'Déjales'} 18 h de luz todo el ciclo (20 h también sirve) y no la bajes a 12 h.`
      : `${n ? 'Ya florece sola' : 'Ya florecen solas'}. Sigue con 18 h de luz hasta la cosecha y no la bajes a 12 h: ${n ? 'perdería luz justo cuando forma' : 'perderían luz justo cuando forman'} los cogollos.`
    out.push(h < 18
      ? { title: 'Autofloreciente', body: `${body} El horario que anotaste da ${h} h: cámbialo a 18 h, y también en tu temporizador si lo tienes.`, tone: 'warn', action: 'luz' }
      : { title: 'Autofloreciente', body })
  }
  // RIEGO concreto: cuánto (según litros de maceta) y cuándo mirar.
  // Plántula: un vaso sin drenaje, aunque la maceta sea grande (sus raíces aún no llegan al resto).
  // En tierra, mientras la cantidad sube por semanas, tampoco se busca que drene (en coco, sí).
  // Hidro: el depósito. Con la plántula el nivel tiene que tocar la cestita (sus raíces aún no
  // llegan al agua: si baja, el taco se seca y la plántula muere en 1–2 días).
  if (hidro && (plantula || c.stage === 'veg' || c.stage === 'flor' || c.stage === 'cosecha')) {
    out.push({ title: 'Cuida el depósito', body: plantula
      ? 'Mientras las raíces no cuelguen dentro del agua, el nivel tiene que tocar la base de la cestita (o moja el taco por arriba con un chorrito de la solución): revísalo cada día. Cuando las raíces lleguen al agua, baja el nivel y deja 2–3 cm de aire bajo la cestita. Cambia toda la solución cada 7–10 días.'
      : 'Las raíces ya están en el agua: no se riega. Revisa el nivel cada 2–3 días y rellénalo con agua de pH ajustado, dejando 2–3 cm de aire bajo la cestita. Comprueba que la bomba de aire burbujea. Cambia toda la solución cada 7–10 días.' })
  } else if (w) out.push({ title: 'Cuánto y cuándo regar', howto: plantula ? 'riegoPlantula' : 'riego', body: c.stage === 'plantula'
    ? `Maceta de ${c.potL || 11} L, pero sus raíces aún están junto al tallo: riega 1 vaso (0.2 L) ${w.when}. Mete el dedo a unos 3 cm del tallo para comprobarlo.`
    : `Maceta de ${c.potL || 11} L: riega ${c.substrate === 'coco' ? 'unos ' : ''}${w.amount}${w.vasos} ${w.when}. ${w.drain
      ? drenajeTexto(c)
      : `Despacio, en círculo alrededor del tallo. Aún no hace falta que drene: sus raíces no llenan la maceta y la cantidad sube cada semana, hasta unos ${w.full} L.`}` })
  // ABONO: cuánto según el nivel (gratis, con o sin marca), la tierra que ya trae abono y el
  // lavado final (también pasada la fecha estimada: la misma tarjeta que la ficha de riego)
  const ab = abonoDe(c, guide)
  if (ab) out.push({ title: ab.titulo, body: ab.texto })
  // los días de solo agua (tierra abonada, lavado) la EC y el abono esperan; si eligió solo agua y
  // ya toca abonar, no: ahí sí hay que empezar
  const soloAgua = !!ab && !ab.abona && ab.motivo !== 'falta'
  // contenido por etapa filtrado por nivel (y semilla y sustrato)
  for (const a of ADVICE[c.stage] ?? []) {
    if (!a.levels.includes(guide) || (a.seed && a.seed !== c.seedType) || (a.subs && !a.subs.includes(c.substrate))) continue
    if (a.sinLavado && ab?.motivo === 'lavado') continue
    out.push({ title: txt(a.title, c), body: txt(soloAgua && a.bodyAgua ? a.bodyAgua : a.body, c), tone: a.tone, howto: a.howto })
  }
  // autos en avanzado: la poda apical solo en su ventana (escalada a su ciclo) — vive 8–11 semanas
  // y no recupera lo que pierde por un corte
  if (c.stage === 'veg' && c.seedType === 'auto' && guide === 'avanzado') {
    const v = ventanaApicalAuto(c)
    out.push({ title: 'Poda apical en autos', howto: 'apicalAuto', body: `Solo con 4–5 nudos (un nudo es donde nacen las hojas del tallo), hacia los días ${v.desde}–${v.hasta}, y con ${una(c) ? 'la planta sana: después no le queda' : 'las plantas sanas: después no les queda'} tiempo para recuperarse. Si dudas, quédate con el LST, que no corta nada.` })
  }
  return out
}

// ===== estado visual de la carpa 3D: el interior reacciona a TUS datos =====
// luz apagada → noche; temperatura registrada (fresca) fuera de rango → frío/calor.
export function sceneState(c: Cultivo): SceneState {
  if (!c.light) return 'noche'
  const t = c.readings.temp
  const d = c.readingDays.temp
  if (t != null && d != null && stageAt(c, d) === c.stage) {
    const r = targetFor('temp', c.stage, c.substrate)
    if (r) {
      if (t < r.lo - 1) return 'frio'
      if (t > r.hi + 1) return 'calor'
    }
  }
  return 'dia'
}

// ¿hay algo que requiera atención? (punto del botón Hoy, chip de Home, aviso local)
// Toca revisar la maceta (o el depósito), hay hojas caídas sin revisar o la solución va tarde.
export function needsAttention(c: Cultivo): boolean {
  if (c.finishedTs || c.harvestedTs || !c.germTs) return false
  return checkDue(c) || droopPending(c) || solutionLate(c)
}
// qué pide esa atención, en pocas palabras
export function attentionText(c: Cultivo): string {
  if (c.substrate === 'hidro') return solutionLate(c) ? 'Cambia la solución' : 'Revisa el depósito'
  return 'Revisa la maceta'
}

// ===== guardarraíl de exceso de riego =====
// Si regaste hace poco, mejor esperar (error #1 del principiante). El umbral vive en lib.ts
// (GUARD_HOURS): la misma fuente que usa la caption de la carpa. La app no sabe si el sustrato
// sigue húmedo: dice cuándo fue el último riego anotado y deja "Regar igualmente". Un último riego
// estimado (planta registrada, datos viejos) no frena: nadie lo anotó.
export function overwaterGuard(c: Cultivo): string | null {
  const G = GUARD_HOURS[c.substrate]
  if (G === null || !c.lastWaterTs || c.lastWaterEstimated) return null
  const hrs = (Date.now() - c.lastWaterTs) / 3600000
  if (hrs >= G) return null
  const hace = hrs < 1 ? 'hace menos de una hora' : `hace ${Math.round(hrs)} h`
  const espera = revisaConDedo(c) ? `espera a que los primeros ${dedoCm(c)} cm se sequen` : 'espera a que la maceta pese menos'
  const seca = c.substrate === 'coco' ? 'En coco el sustrato se seca antes que la tierra, pero no en unas horas' : 'En tierra, el sustrato tarda uno o dos días en secarse'
  return `El último riego anotado fue ${hace}. ${seca}: ${espera}. Regar de más ahoga las raíces.`
}
