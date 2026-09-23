// ===== tipos =====
export type Substrate = 'tierra' | 'coco' | 'hidro'
export type Stage = 'remojo' | 'germinacion' | 'plantula' | 'veg' | 'flor' | 'cosecha' | 'secando' | 'vacia'
export type MetricKey = 'temp' | 'hr' | 'vpd' | 'ppfd' | 'ph' | 'ec'
export type Training = 'none' | 'lst' | 'lollipop' | 'apical'
export type PotType = 'tela' | 'plastico'   // la de tela seca más rápido
export type Guide = 'novato' | 'medio' | 'avanzado'   // nivel de experiencia (se elige al crear el cultivo)
export type SeedType = 'foto' | 'auto'                // fotoperiódica (12/12 la dispara el usuario) o autofloreciente

// equipo por categoría: id del catálogo (data/equipos.ts) o nombre libre escrito por el usuario
export interface Equipment { luz?: string; aire?: string; ctrl?: string; vent?: string }

export interface Cultivo {
  id: string
  grow: string
  plants: number              // en remojo = nº de semillas; tras transplante = nº de plantas que brotaron
  pots: number
  potL: number                // litros por maceta (para calcular cuánto regar)
  potType: PotType            // tela seca ~20 % más rápido que plástico (afecta la sed)
  substrate: Substrate
  seedType: SeedType
  soakTs: number | null       // cuándo se pusieron las semillas en remojo (Germinar)
  germTs: number | null       // null mientras está EN REMOJO; se fija al transplantar = día 0 del cultivo
  flowerTs: number | null     // fotoperiódicas: cuándo el usuario pasó la luz a 12/12 (dispara la flor)
  harvestedTs: number | null  // null mientras crece; epoch al cosechar → entra en "secando"
  finishedTs: number | null   // cierre del ciclo tras el secado (el cultivo pasa al archivo)
  dryWeight: number | null    // peso seco opcional que registró el usuario al terminar
  lastWaterTs: number | null  // último riego real
  training: Training           // técnica de entrenamiento aplicada en vegetativo
  defoliatedTs: number | null  // última defoliación (la imagen la muestra unos días)
  nutrientesId: string | null  // línea de nutrientes del catálogo (src/data/nutrientes.ts) o null = solo agua
  // horario de luz: la luz se enciende a lightOnHour y dura lightHours (null = según etapa:
  // 18 h en crecimiento, 12 h en floración). Si el usuario tiene temporizador/controlador
  // no se le avisa; si no, la app le recuerda encender y apagar.
  lightOnHour: number
  lightHours: number | null
  hasController: boolean
  lightOverrideUntil: number | null  // apagado/encendido manual hasta el siguiente cambio programado
  // genética: con las semanas de la variedad, la fecha de cosecha deja de ser genérica
  strain: string | null        // nombre de la variedad ("Northern Lights")
  breeder: string | null       // banco de semillas (opcional)
  flowerWeeks: number | null   // fotoperiódica: semanas de floración desde el 12/12 (null = 8.5, la curva típica de 60 d)
  autoWeeks: number | null     // autofloreciente: semanas de semilla a cosecha (null = ~11, la curva típica de 75 d)
  // equipo: ids del catálogo (src/data/equipos.ts) o texto libre; tentCm = lado de la carpa
  tentCm: number | null
  equipment: Equipment
  readings: Partial<Record<MetricKey, number>>     // últimas mediciones que registró el usuario
  readingDays: Partial<Record<MetricKey, number>>  // día del cultivo en que se tomó cada medición
  // day / stage / thirst son DERIVADOS (caché que el store mantiene sincronizada con el reloj real)
  day: number
  stage: Stage
  thirst: number
  health: number
  light: boolean
  fan: boolean
  exhaust: boolean
}

export const emptyCultivo: Cultivo = {
  id: '', grow: 'Carpa A', plants: 3, pots: 3, potL: 11, potType: 'tela', substrate: 'tierra', seedType: 'foto',
  lightOnHour: 6, lightHours: null, hasController: false, lightOverrideUntil: null,
  strain: null, breeder: null, flowerWeeks: null, autoWeeks: null, tentCm: null, equipment: {},
  soakTs: null, germTs: null, flowerTs: null, harvestedTs: null, finishedTs: null, dryWeight: null,
  lastWaterTs: null, training: 'none', defoliatedTs: null, nutrientesId: null,
  readings: {}, readingDays: {},
  day: 0, stage: 'vacia', thirst: 0.2, health: 92,
  light: true, fan: true, exhaust: true,
}

// ===== etapas por día =====
// Día 0 = transplante (la germinación ya ocurrió en agua), así que arranca en plántula
// con sus plántulas visibles en las macetas — no en tierra pelada.
// Curva "típica" de referencia (se usa para la línea de tiempo de previsualización).
export function stageForDay(d: number): Stage {
  if (d < 18) return 'plantula'
  if (d < 46) return 'veg'
  if (d < 105) return 'flor'
  return 'cosecha'
}

// Etapa REAL según el tipo de semilla:
// - autofloreciente: florece sola con un ciclo comprimido (~75 días).
// - fotoperiódica: la flor la dispara EL USUARIO al pasar la luz a 12/12 (flowerTs);
//   sin ese cambio la planta sigue en vegetativo — el calendario no manda.
export type StageInput = Pick<Cultivo, 'seedType' | 'flowerTs' | 'germTs'> & Partial<Pick<Cultivo, 'flowerWeeks' | 'autoWeeks'>>
// días de floración de una fotoperiódica (de 12/12 a cosecha) y ciclo total de una auto
export function flowerDaysOf(c: Partial<Pick<Cultivo, 'flowerWeeks'>>): number {
  return c.flowerWeeks ? Math.round(c.flowerWeeks * 7) : 60
}
export function autoDaysOf(c: Partial<Pick<Cultivo, 'autoWeeks'>>): number {
  return c.autoWeeks ? Math.round(c.autoWeeks * 7) : 75
}
export function stageAt(c: StageInput, d: number): Stage {
  if (c.seedType === 'auto') {
    // la curva típica (14/32/75) escala con el ciclo de la variedad
    const k = autoDaysOf(c) / 75
    if (d < Math.round(14 * k)) return 'plantula'
    if (d < Math.round(32 * k)) return 'veg'
    if (d < autoDaysOf(c)) return 'flor'
    return 'cosecha'
  }
  if (c.flowerTs && c.germTs) {
    const fd = Math.max(0, Math.floor((c.flowerTs - c.germTs) / 86400000))
    if (d >= fd) return d >= fd + flowerDaysOf(c) ? 'cosecha' : 'flor'
  }
  return d < 18 ? 'plantula' : 'veg'
}

// fecha estimada de cosecha (epoch) o null si aún no se puede saber (foto sin 12/12).
// flipTs: para proyectar una fotoperiódica que todavía no pasó a 12/12.
export function harvestEta(c: StageInput, flipTs?: number | null): number | null {
  if (!c.germTs && c.seedType === 'auto') return null
  if (c.seedType === 'auto') return (c.germTs as number) + autoDaysOf(c) * 86400000
  const f = c.flowerTs ?? flipTs ?? null
  return f ? f + flowerDaysOf(c) * 86400000 : null
}

// Etapa para la PREVISUALIZACIÓN (arrastrar la línea de tiempo): usa las reglas reales,
// y para una foto que aún no pasó a 12/12 proyecta la curva típica (es hipotética a propósito).
// La flor proyectada dura lo que dice su genética (semanas de floración), igual que la foto que
// se elige para ese día: así la etiqueta y la imagen de la preview cuentan lo mismo.
export function previewStage(c: Cultivo, d: number): Stage {
  if (c.seedType === 'foto' && !c.flowerTs) {
    if (d < 46) return stageForDay(d)
    return d < 46 + flowerDaysOf(c) ? 'flor' : 'cosecha'
  }
  return stageAt(c, d)
}
export const stageLabel: Record<Stage, string> = {
  remojo: 'En remojo', germinacion: 'Germinando', plantula: 'Plántula', veg: 'Vegetativo',
  flor: 'Floración', cosecha: 'Cosecha', secando: 'Secando', vacia: 'Vacía',
}
export const MAX_DAY = 120

// día real transcurrido desde la germinación (no un slider: el reloj de verdad)
export function realDay(germTs: number | null): number {
  if (!germTs) return 0
  return Math.max(0, Math.floor((Date.now() - germTs) / 86400000))
}

// ===== umbrales de riego (fuente ÚNICA: caption, guardarraíl y avisos cuentan la misma historia) =====
// guardarraíl de sobre-riego por sustrato (hidro riega continuo → sin guardarraíl)
export const GUARD_HOURS: Record<Substrate, number | null> = { tierra: 18, coco: 10, hidro: null }
// a partir de cuántos días sin riego avisamos, por etapa (plántula es la más frágil)
export const WATER_ALERT_DAYS: Partial<Record<Stage, number>> = { plantula: 2, veg: 3, flor: 3, cosecha: 4 }

// sed derivada del TIEMPO REAL desde el último riego (o el transplante): horas hasta sed plena
const THIRST_HOURS: Partial<Record<Stage, number>> = { plantula: 110, veg: 96, flor: 84, cosecha: 110 }
function thirstAt(c: Cultivo, stage: Stage): number {
  const base = THIRST_HOURS[stage]
  if (!base) return 0
  // las horas de la tabla son para maceta de tela; la de plástico retiene agua ~20 % más
  const H = base * (c.potType === 'plastico' ? 1.2 : 1)
  const ref = c.lastWaterTs ?? c.germTs
  if (!ref) return 0.2
  const hrs = (Date.now() - ref) / 3600000
  return Math.min(0.9, Math.max(0, (hrs / H) * 0.9))
}

// cuándo tocará regar: el momento en que la sed derivada cruza el umbral de "sed" (0.55),
// contando desde el último riego. null si la etapa no se riega por reloj (remojo, secado…).
export const THIRST_THRESHOLD = 0.55
export function nextWaterTs(c: Cultivo): number | null {
  const base = THIRST_HOURS[c.stage]
  if (!base || c.harvestedTs) return null
  const H = base * (c.potType === 'plastico' ? 1.2 : 1)
  const ref = c.lastWaterTs ?? c.germTs
  if (!ref) return null
  return ref + (THIRST_THRESHOLD / 0.9) * H * 3600000
}

// estado real del cultivo derivado del reloj (cosecha y remojo son eventos manuales, no de tiempo)
export function deriveLive(c: Cultivo): { day: number; stage: Stage; thirst: number } {
  // cosechado → 'secando' con el día CONGELADO al momento de la cosecha (no sigue creciendo)
  if (c.harvestedTs) {
    const d = c.germTs ? Math.max(0, Math.floor((c.harvestedTs - c.germTs) / 86400000)) : c.day
    return { day: d, stage: 'secando', thirst: 0 }
  }
  // sin germTs = aún EN REMOJO (semillas en agua); el día del cultivo no corre todavía
  if (!c.germTs) return { day: 0, stage: 'remojo', thirst: 0.2 }
  const d = realDay(c.germTs)
  const stage = stageAt(c, d)
  return { day: d, stage, thirst: thirstAt(c, stage) }
}

// días que llevan las semillas en remojo (desde soakTs)
export function soakDays(c: Cultivo): number {
  if (!c.soakTs) return 0
  return Math.max(0, Math.floor((Date.now() - c.soakTs) / 86400000))
}
// ¿ya asomó la raíz? (única fuente para card y pantalla de germinación)
// Tiempo REAL de remojo: la raíz tarda ~1–3 días; nunca simular que ya salió.
export function hasSprouted(c: Cultivo): boolean {
  if (!c.soakTs) return false
  return (Date.now() - c.soakTs) / 3600000 >= 30
}

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export function dateForDay(germTs: number | null, d: number): string {
  if (!germTs) return ''
  const x = new Date(germTs + d * 86400000)
  return '· ' + x.getDate() + ' ' + MES[x.getMonth()]
}
export function fmtWhen(ts: number): string {
  const x = new Date(ts)
  const hh = x.getHours().toString().padStart(2, '0')
  const mm = x.getMinutes().toString().padStart(2, '0')
  return `${x.getDate()} ${MES[x.getMonth()]} · ${hh}:${mm}`
}

// ===== bitácora (event log) =====
export type EventType = 'creado' | 'sembrado' | 'transplante' | 'riego' | 'sed' | 'entrenamiento' | 'floracion' | 'cosecha' | 'terminado' | 'nota' | 'medicion' | 'foto' | 'defoliacion' | 'diagnostico'
export interface GrowEvent {
  id?: number
  growId: string
  ts: number          // cuándo ocurrió (reloj real)
  day: number         // día del cultivo en ese momento
  type: EventType
  note?: string
  photoId?: number    // eventos 'foto' y 'diagnostico': id del blob en la tabla photos
  metric?: MetricKey  // eventos 'medicion': qué se midió…
  value?: number      // …y el valor numérico (para las gráficas; los viejos solo traen el texto)
}
export const EVENT_META: Record<EventType, { icon: string; label: string }> = {
  creado: { icon: '', label: 'Cultivo creado'},
  sembrado: { icon: '', label: 'Semillas en remojo'},
  transplante: { icon: '', label: 'Trasplante'},
  riego: { icon: '', label: 'Riego'},
  sed: { icon: '', label: 'Sed detectada'},
  entrenamiento: { icon: '', label: 'Entrenamiento'},
  defoliacion: { icon: '', label: 'Defoliación' },
  floracion: { icon: '', label: 'A floración (12/12)'},
  cosecha: { icon: '', label: 'Cosecha'},
  terminado: { icon: '', label: 'Cultivo terminado'},
  nota: { icon: '', label: 'Nota'},
  medicion: { icon: '', label: 'Medición'},
  foto: { icon: '', label: 'Foto'},
  diagnostico: { icon: '', label: 'Diagnóstico'},
}

// ===== legal: control de edad + consentimiento (versionado para re-consentir si cambian términos) =====
export const CONSENT_VERSION = 1

// ===== imágenes de la carpa: el set fotorrealista de Bruno (2026-09-23) =====
// Todas las fotos comparten cámara, encuadre, luz y carpa (1493×2000, 3:4) y viven en assets/carpa/:
//   ciclo/ciclo-dNNN  19 fotos de UNA maceta en tierra: la planta crece foto a foto (día de referencia NNN)
//   frente/           puertas, vacía, sed, coco, hidro, entrenamiento y 2–3 macetas por etapa
//   noche/            luz apagada por etapa y nº de macetas
//   top/              vista desde arriba por etapa, luz (día/noche/frío/calor) y macetas
// El arte anterior quedó archivado en app/_assets_arte_ia/.
// Rutas relativas a la base del deploy (BASE_URL termina en '/'): así la app funciona igual en raíz
// (localhost) que bajo subcarpeta (GitHub Pages). ?v=N obliga al teléfono a pedir la foto de nuevo.
const IMG_V = '?v=6'
const A = (name: string) => `${import.meta.env.BASE_URL}assets/${name}.webp${IMG_V}`
const C = (path: string) => `${import.meta.env.BASE_URL}assets/carpa/${path}.webp${IMG_V}`
export const FOTO_W = 1493
export const FOTO_H = 2000

// imagen de las semillas en remojo (vaso de agua), según nº de semillas y si ya brotaron
export function waterImg(seeds: number, brote: boolean): string {
  const n = Math.min(Math.max(seeds, 1), 3)
  return A(`agua-${n}${brote ? '-brote' : ''}`)
}

// Estado visual del interior: la luz (día/noche) y el tinte por temperatura (frío/calor).
// Noche = las fotos de la carpa apagada; frío/calor = la misma foto de día con un tinte CSS
// dentro de la abertura de la puerta (TentView), como el hero de AC Infinity.
export type SceneState = 'dia' | 'noche' | 'frio' | 'calor'

// ===== horario de luz =====
export function lightHoursFor(c: Cultivo): number {
  if (c.lightHours != null) return c.lightHours
  return c.stage === 'flor' || c.stage === 'cosecha' ? 12 : 18
}
// ¿debería estar encendida ahora según el horario?
export function scheduledLight(c: Cultivo, now = new Date()): boolean {
  const h = now.getHours() + now.getMinutes() / 60
  return ((h - c.lightOnHour + 24) % 24) < lightHoursFor(c)
}
// instante del siguiente cambio programado (encendido o apagado)
export function nextLightChange(c: Cultivo, now = new Date()): number {
  const on = new Date(now); on.setHours(c.lightOnHour, 0, 0, 0)
  const off = new Date(on.getTime() + lightHoursFor(c) * 3600000)
  const cands = [on.getTime(), off.getTime(), on.getTime() + 86400000, off.getTime() - 86400000, on.getTime() - 86400000]
  return Math.min(...cands.filter((t) => t > now.getTime()))
}
export const fmtHour = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`

// una defoliación se nota en la planta unos días; después el follaje vuelve
export const DEFOLIATION_DAYS = 12
export function isDefoliated(c: Cultivo): boolean {
  return c.defoliatedTs != null && Date.now() - c.defoliatedTs < DEFOLIATION_DAYS * 86400000
}

const potsOf = (c: Pick<Cultivo, 'pots'>) => Math.min(Math.max(c.pots, 1), 3)

// ----- el ciclo foto a foto (una maceta en tierra) -----
// Día de la curva de referencia en que se tomó cada foto (plántula 0–17, vegetativo desde el 18,
// 12/12 en el 42, 60 días de flor). Para colocar a TU planta se usa su propio calendario:
// dentro de plántula, la fracción de la etapa; en vegetativo, los días desde que empezó (su
// duración la decide el usuario); en flor, la fracción de SU floración (semanas de la variedad).
const CICLO_PLANTULA = [3, 6, 9, 13]                    // fracción de 18 días
const CICLO_VEG = [[0, 18], [4, 22], [7, 25], [12, 30], [17, 35], [23, 41]] as const   // [días en veg, foto]
const CICLO_FLOR = [48, 56, 63, 70, 77, 84, 91]           // fracción de 60 días desde el 12/12 del día 42
export const CICLO_DIAS = [...CICLO_PLANTULA, ...CICLO_VEG.map(([, f]) => f), ...CICLO_FLOR, 98, 103]
const cicloImg = (d: number) => C(`ciclo/ciclo-d${String(d).padStart(3, '0')}`)
type CicloInput = Pick<Cultivo, 'day' | 'stage' | 'seedType' | 'flowerTs' | 'germTs' | 'flowerWeeks' | 'autoWeeks'>
// día del cultivo en que empieza el vegetativo / la floración, y cuántos días dura la flor
function vegStartOf(c: CicloInput): number {
  return c.seedType === 'auto' ? Math.round((14 * autoDaysOf(c)) / 75) : 18
}
function flipDayOf(c: CicloInput): number {
  if (c.seedType === 'auto') return Math.round((32 * autoDaysOf(c)) / 75)
  if (c.flowerTs && c.germTs) return Math.max(0, Math.floor((c.flowerTs - c.germTs) / 86400000))
  return 46 // fotoperiódica sin 12/12: solo la previsualización llega a flor, con la curva típica
}
function flowerLenOf(c: CicloInput): number {
  return c.seedType === 'auto' ? Math.max(1, autoDaysOf(c) - flipDayOf(c)) : flowerDaysOf(c)
}
export function cicloDia(c: CicloInput): number {
  const pick = (xs: readonly number[], v: number) => xs.reduce((best, x) => (x <= v ? x : best), xs[0])
  const vegFoto = (vd: number) => CICLO_VEG.reduce((best, [d, f]) => (d <= vd ? f : best), CICLO_VEG[0][1] as number)
  if (c.stage === 'secando') return 103
  if (c.stage === 'cosecha') return 98
  if (c.stage === 'flor') {
    const flip = flipDayOf(c)
    const frac = (c.day - flip) / flowerLenOf(c)
    const refs = CICLO_FLOR.map((d) => (d - 42) / 60)
    // primeros días del 12/12: sigue siendo la planta que había al pasar a flor
    if (frac < refs[0]) return vegFoto(flip - vegStartOf(c))
    return CICLO_FLOR[refs.reduce((best, r, i) => (r <= frac ? i : best), 0)]
  }
  if (c.stage === 'veg') return vegFoto(c.day - vegStartOf(c))
  // plántula (y germinación de datos viejos): fracción de su etapa
  const len = c.seedType === 'auto' ? vegStartOf(c) : 18
  return pick(CICLO_PLANTULA, (c.day / len) * 18)
}

// vista desde arriba: la etapa con la luz del momento (frío/calor/noche son tintes de la foto de día)
export function topImg(c: Cultivo, state: SceneState = 'dia'): string {
  const s = c.stage
  const key = s === 'remojo' || s === 'vacia' || s === 'secando' ? 'vacia'
    : s === 'germinacion' || (s === 'plantula' && c.day < 5) ? 'germinacion'
    : s === 'veg' && c.thirst > THIRST_THRESHOLD ? 'sed'
    : s
  return C(`top/top-${key}-${state}-${potsOf(c)}p`)
}

// foto de día según etapa, día, macetas, sustrato, sed y entrenamiento
function dayImg(c: Cultivo): string {
  const s = c.stage
  const p = potsOf(c)
  const thirsty = c.thirst > THIRST_THRESHOLD
  if (s === 'secando') return cicloImg(103)
  if (s === 'vacia' || s === 'germinacion' || s === 'remojo') return C(p === 1 ? 'frente/carpa-vacia' : `frente/vacia-${p}p`)
  const growing = s === 'plantula' || s === 'veg' || s === 'flor'
  // 2–3 macetas: el mismo orden de prioridades con sus propias fotos (la sed solo se ve en vegetativo)
  if (p > 1) {
    if (c.substrate !== 'tierra') {
      const sub = c.substrate
      if (thirsty && s === 'veg') return C(`frente/${sub}-sed-${p}p`)
      if (growing) return C(`frente/${sub}-${s}-${p}p`)
      return C(sub === 'hidro' ? `frente/hidro-flor-${p}p` : `frente/cosecha-${p}p`)
    }
    if (thirsty && s === 'veg') return C(`frente/sed-${p}p`)
    if (s === 'veg') {
      if (isDefoliated(c)) return C(`frente/veg-defoliada-${p}p`)
      if (c.training !== 'none') return C(`frente/veg-${c.training}-${p}p`)
    }
    if (s === 'flor') {
      if (isDefoliated(c)) return C(`frente/flor-defoliada-${p}p`)
      if (c.training === 'lst') return C(`frente/flor-lst-${p}p`)
    }
    return C(`frente/${s}-${p}p`)
  }
  if (c.substrate !== 'tierra') {
    const sub = c.substrate
    if (thirsty && s === 'veg') return C(`frente/${sub}-sed-1p`)
    if (growing) return C(`frente/${sub}-${s}-1p`)
    // cosecha: el cubo de hidro se queda (con la planta en flor); en coco manda la planta madura
    return sub === 'hidro' ? C('frente/hidro-flor-1p') : cicloImg(98)
  }
  if (thirsty && growing) return C(`frente/sed-${s}-1p`)
  if (s === 'veg') {
    if (isDefoliated(c)) return C('frente/veg-defoliada')
    if (c.training !== 'none') return C(`frente/veg-${c.training}`)
  }
  if (s === 'flor') {
    if (isDefoliated(c)) return C('frente/flor-defoliada')
    if (c.training === 'lst') return C('frente/flor-lst')
  }
  return cicloImg(cicloDia(c))
}

// imagen frontal: remojo = el vaso de agua; noche = luz apagada; si no, la foto de día
export function frontImg(c: Cultivo, view: 'front' | 'cenital', state: SceneState = 'dia'): string {
  if (view === 'cenital') return topImg(c, state)
  if (c.stage === 'remojo') return waterImg(c.plants, hasSprouted(c))
  if (state === 'noche') return nightImg(c)
  return dayImg(c)
}

// imagen de noche (luz apagada) por etapa y macetas; el secado ya es una foto con la luz apagada.
// Si de día se ve una foto del ciclo (una maceta en tierra), de noche va SU versión apagada:
// la planta no puede cambiar de tamaño al apagar la luz.
export function nightImg(c: Cultivo): string {
  const s = c.stage
  if (s === 'secando') return cicloImg(103)
  const ciclo = dayImg(c).match(/ciclo\/ciclo-d(\d{3})/)
  if (ciclo) return C(`noche/noche-ciclo-d${ciclo[1]}`)
  const key = s === 'vacia' || s === 'germinacion' || s === 'remojo' ? 'vacia' : s
  return C(`noche/noche-${key}-${potsOf(c)}p`)
}

// cuadro "entreabierta" para la animación de apertura, según etapa y macetas. Por la rendija se
// ve la maceta: en coco e hidro (otro sustrato, otro recipiente) no hay foto entreabierta que
// case con la escena, así que la apertura va directa de cerrada a la carpa (null).
export function ajarImg(c: Pick<Cultivo, 'stage' | 'pots' | 'substrate'>): string | null {
  if (c.substrate !== 'tierra') return null
  const key = c.stage === 'flor' || c.stage === 'cosecha' || c.stage === 'secando' ? 'flor' : c.stage === 'veg' ? 'veg' : 'vacia'
  const p = potsOf(c)
  return C(p === 1 ? `frente/ajar-${key}` : `frente/ajar-${key}-${p}p`)
}

export const closedImg = C('frente/carpa-cerrada')

// las fotos de la puerta se piden mientras el usuario rellena el alta o espera la germinación,
// así la apertura de la carpa ya las tiene en caché cuando toca reproducirla
export function preloadIntro(pots: number, substrate: Substrate, stages: Stage[] = ['plantula', 'veg', 'flor']) {
  const urls = [closedImg, ...stages.map((stage) => ajarImg({ stage, pots, substrate }))]
  urls.forEach((u) => { if (u) { const i = new Image(); i.src = u } })
}

// timelapse del ciclo (Seedance, 10 s): plántula → cosecha. La línea de tiempo lo arrastra:
// el día d cae en el segundo d / TIMELAPSE_DAYS × duración. HAS_TIMELAPSE se apaga si el
// archivo no está (assets/timelapse.mp4), y entonces solo se ven las fotos fijas.
export const TIMELAPSE_URL = `${import.meta.env.BASE_URL}assets/timelapse.mp4`
export const TIMELAPSE_DAYS = 105
// apagado (2026-09-20): el vídeo de Seedance cambia de encuadre y "acerca" la carpa al avanzar
// los días; la previa usa las fotos por etapa, que mantienen el mismo plano. El mp4 vive en
// app/_assets_v2_3d/ por si se regenera con encuadre fijo.
export const HAS_TIMELAPSE = false

// etiquetas de la vista desde arriba: debajo de cada maceta, en % de la foto (medido en top/*:
// macetas en fila de izquierda a derecha, centros a media altura)
export function cenitalLabels(c: Pick<Cultivo, 'pots'>): { x: string; y: string }[] {
  const p = potsOf(c)
  const xs = p === 1 ? [50] : p === 2 ? [33, 67] : [23, 50, 76]
  const y = p === 1 ? 68 : p === 2 ? 65 : 61
  return xs.map((x) => ({ x: `${x}%`, y: `${y}%` }))
}

// caption de la carpa: estado honesto + la acción disponible (nada de datos inventados)
export function statusText(c: Cultivo, view: 'front' | 'cenital'): string {
  if (view === 'cenital') return 'Vista desde arriba · ' + (c.grow || 'tu carpa')
  if (c.finishedTs) return 'Terminado · su bitácora queda guardada'
  if (c.stage === 'secando') return 'Secando · cuelga 7–14 días y luego a curar'
  if (c.stage === 'cosecha') return 'Lista para cosechar · revisa los tricomas'
  if (c.thirst >0.55) return 'Tienen sed · toca las plantas para regar'
  // mismos umbrales que el guardarraíl y los avisos (GUARD_HOURS / WATER_ALERT_DAYS):
  // la caption nunca debe contradecir a la ficha de riego ni al chip de Home
  const H = GUARD_HOURS[c.substrate]
  const hrs = c.lastWaterTs ? (Date.now() - c.lastWaterTs) / 3600000 : null
  if (H !== null && hrs !== null && hrs < H) return 'Regadas hace poco · deja que el sustrato seque'
  const ref = c.lastWaterTs ?? c.germTs
  const days = ref ? Math.floor((Date.now() - ref) / 86400000) : null
  const alertAt = WATER_ALERT_DAYS[c.stage]
  if (days !== null && alertAt !== undefined && days >= alertAt) {
    return `${days} días sin riego · toca las plantas para regar`
  }
  if (c.stage === 'plantula') return 'Plántulas · toca las plantas para regar'
  if (c.stage === 'flor') return 'Cogollos engordando · toca las plantas para regar'
  return 'En vegetativo · toca las plantas para regar'
}

// preload selectivo: solo lo que se va a ver ahora (no las 152 imágenes)
export function preloadFor(c: Cultivo, state: SceneState = 'dia') {
  const urls = new Set<string | null>([closedImg, ajarImg(c), frontImg(c, 'front', 'dia'), nightImg(c), frontImg(c, 'front', state), topImg(c, state)])
  urls.forEach((u) => { if (u) { const i = new Image(); i.src = u } })
}

// al tocar la línea de tiempo: todas las fotos que la previsualización puede mostrar para ESTE
// cultivo (misma regla que TentView: etapa proyectada, sin sed salvo el veg de referencia), así el
// recorrido de días no espera a la red foto por foto
export function preloadPreview(c: Cultivo) {
  const urls = new Set<string>()
  for (let d = 0; d <= MAX_DAY; d++) {
    const stage = previewStage(c, d)
    urls.add(frontImg({ ...c, day: d, stage, thirst: stage === 'veg' ? 0.2 : 0 }, 'front', 'dia'))
  }
  urls.forEach((u) => { const i = new Image(); i.src = u })
}
