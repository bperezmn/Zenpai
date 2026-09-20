// ===== tipos =====
export type Substrate = 'tierra' | 'coco' | 'hidro'
export type Stage = 'remojo' | 'germinacion' | 'plantula' | 'veg' | 'flor' | 'cosecha' | 'secando' | 'vacia'
export type MetricKey = 'temp' | 'hr' | 'vpd' | 'ppfd' | 'ph' | 'ec'
export type Training = 'none' | 'lst' | 'lollipop'
export type Guide = 'novato' | 'medio' | 'avanzado'   // nivel de experiencia (se elige al crear el cultivo)
export type SeedType = 'foto' | 'auto'                // fotoperiódica (12/12 la dispara el usuario) o autofloreciente

export interface Cultivo {
  id: string
  grow: string
  plants: number              // en remojo = nº de semillas; tras transplante = nº de plantas que brotaron
  pots: number
  potL: number                // litros por maceta (para calcular cuánto regar)
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
  id: '', grow: 'Carpa A', plants: 3, pots: 3, potL: 11, substrate: 'tierra', seedType: 'foto',
  soakTs: null, germTs: null, flowerTs: null, harvestedTs: null, finishedTs: null, dryWeight: null,
  lastWaterTs: null, training: 'none',
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
export function stageAt(c: Pick<Cultivo, 'seedType' | 'flowerTs' | 'germTs'>, d: number): Stage {
  if (c.seedType === 'auto') {
    if (d < 14) return 'plantula'
    if (d < 32) return 'veg'
    if (d < 75) return 'flor'
    return 'cosecha'
  }
  if (c.flowerTs && c.germTs) {
    const fd = Math.max(0, Math.floor((c.flowerTs - c.germTs) / 86400000))
    if (d >= fd) return d >= fd + 60 ? 'cosecha' : 'flor'
  }
  return d < 18 ? 'plantula' : 'veg'
}

// Etapa para la PREVISUALIZACIÓN (arrastrar la línea de tiempo): usa las reglas reales,
// y para una foto que aún no pasó a 12/12 proyecta la curva típica (es hipotética a propósito).
export function previewStage(c: Cultivo, d: number): Stage {
  if (c.seedType === 'foto' && !c.flowerTs) return stageForDay(d)
  return stageAt(c, d)
}
export const stageLabel: Record<Stage, string> = {
  remojo: 'Germinando', germinacion: 'Germinación', plantula: 'Plántula', veg: 'Vegetativo',
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
  const H = THIRST_HOURS[stage]
  if (!H) return 0
  const ref = c.lastWaterTs ?? c.germTs
  if (!ref) return 0.2
  const hrs = (Date.now() - ref) / 3600000
  return Math.min(0.9, Math.max(0, (hrs / H) * 0.9))
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
export type EventType = 'creado' | 'sembrado' | 'transplante' | 'riego' | 'sed' | 'entrenamiento' | 'floracion' | 'cosecha' | 'terminado' | 'nota' | 'medicion' | 'foto'
export interface GrowEvent {
  id?: number
  growId: string
  ts: number          // cuándo ocurrió (reloj real)
  day: number         // día del cultivo en ese momento
  type: EventType
  note?: string
  photoId?: number    // eventos 'foto': id del blob en la tabla photos
}
export const EVENT_META: Record<EventType, { icon: string; label: string }> = {
  creado: { icon: '🌱', label: 'Cultivo creado' },
  sembrado: { icon: '🫘', label: 'Semillas en remojo' },
  transplante: { icon: '🪴', label: 'Transplante' },
  riego: { icon: '💧', label: 'Riego' },
  sed: { icon: '🥀', label: 'Sed detectada' },
  entrenamiento: { icon: '✂️', label: 'Entrenamiento' },
  floracion: { icon: '🌸', label: 'A floración (12/12)' },
  cosecha: { icon: '🌾', label: 'Cosecha' },
  terminado: { icon: '🫙', label: 'Cultivo terminado' },
  nota: { icon: '📝', label: 'Nota' },
  medicion: { icon: '📊', label: 'Medición' },
  foto: { icon: '📷', label: 'Foto' },
}

// ===== legal: control de edad + consentimiento (versionado para re-consentir si cambian términos) =====
export const CONSENT_VERSION = 1

// ===== arte IA que sigue en uso: el vaso de remojo (la carpa entera es escena 3D, ver abajo) =====
const HAVE = new Set(['agua-1', 'agua-2', 'agua-3', 'agua-1-brote', 'agua-2-brote', 'agua-3-brote'])
// rutas relativas a la base del deploy (BASE_URL termina en '/'): así la app
// funciona igual en raíz (localhost, Vercel) que bajo subcarpeta (GitHub Pages)
const A = (name: string) => `${import.meta.env.BASE_URL}assets/${name}.webp`

// imagen de las semillas en remojo (vaso de agua), según nº de semillas y si ya brotaron
export function waterImg(seeds: number, brote: boolean): string {
  const n = Math.min(Math.max(seeds, 1), 3)
  const name = `agua-${n}${brote ? '-brote' : ''}`
  return A(HAVE.has(name) ? name : `agua-${n}`)
}

// ===== escena 3D v2 (renders de Blender: UNA escena, misma cámara, el interior reacciona) =====
// Estado visual del interior: la luz (día/noche) y el tinte por temperatura (frío/calor).
export type SceneState = 'dia' | 'noche' | 'frio' | 'calor'
const V2 = (name: string) => `${import.meta.env.BASE_URL}assets/v2/${name}.webp`
export const DOOR_FRAMES = 24
// secuencia de apertura de la puerta (carpa vacía: vale para toda etapa y nº de macetas;
// al final las plantas "aparecen" con el fundido a la imagen real)
export const doorFrame = (i: number) => V2(`abrir-${String(Math.min(Math.max(i, 1), DOOR_FRAMES)).padStart(2, '0')}`)

// etapa visual del cultivo dentro de la carpa (null = remojo, que vive en su propia pantalla)
export type V2Stage = 'vacia' | 'germinacion' | 'plantula' | 'veg' | 'flor' | 'cosecha' | 'sed' | 'secando'
export function v2Stage(c: Cultivo): V2Stage | null {
  if (c.stage === 'remojo') return null
  if (c.stage === 'veg') return c.thirst > 0.55 ? 'sed' : 'veg'
  return c.stage
}
// nombre del render: {sustrato-}{etapa}-{estado}-{macetas}p · cenital: top-{etapa}-{estado}-{macetas}p.
// Límites del set: la cenital no distingue sustrato (desde arriba la copa tapa la maceta);
// 'sed' solo de día; 'secando' sin variantes de macetas (y desde arriba no se ven las ramas);
// la carpa vacía frontal es el último fotograma de la apertura; germinación usa macetas de tierra
function v2Name(stage: V2Stage, state: SceneState, pots: number, substrate: Substrate, view: 'front' | 'cenital'): string {
  const p = Math.min(Math.max(pots, 1), 3)
  if (view === 'cenital') return stage === 'vacia' || stage === 'secando' ? `top-vacia-${state}` : `top-${stage}-${state}-${p}p`
  if (stage === 'vacia') return `abrir-${DOOR_FRAMES}`
  if (stage === 'secando') return `secando-${state === 'noche' ? 'noche' : 'dia'}-3p`
  const pre = substrate !== 'tierra' && stage !== 'germinacion' ? `${substrate}-` : ''
  if (stage === 'sed') return `${pre}sed-dia-${p}p`
  return `${pre}${stage}-${state}-${p}p`
}

// imagen de la carpa según etapa / sustrato / sed / nº de macetas / estado de luz y vista
export function frontImg(c: Cultivo, view: 'front' | 'cenital', state: SceneState = 'dia'): string {
  const v2 = v2Stage(c)
  if (!v2) return waterImg(c.plants, hasSprouted(c))
  return V2(v2Name(v2, state, c.pots, c.substrate, view))
}

// posición vertical (%) de cada planta en la vista cenital: cámara a 3.5 m mirando al piso con
// 24 mm de sensor y 50 mm de lente (blender/render_v2.py, modo foto); cuanto más alta la copa,
// más cerca de la cámara y más separadas se ven. Macetas en x = ±0.345 m (3) / ±0.24 m (2)
// — dentro de la bandeja de la foto —; la #1 arriba.
export function cenitalTops(c: Cultivo): string[] {
  const s = v2Stage(c)
  const z = s === 'plantula' || s === 'germinacion' ? 0.24 : s === 'flor' || s === 'cosecha' ? 0.62 : s === 'sed' ? 0.45 : 0.55
  const pct = (x: number) => `${Math.round(50 + (x / (2 * (3.5 - z) * 0.24)) * 100)}%`
  const p = Math.min(Math.max(c.pots, 1), 3)
  return p === 1 ? [pct(0)] : p === 2 ? [pct(-0.24), pct(0.24)] : [pct(-0.345), pct(0), pct(0.345)]
}

// caption de la carpa: estado honesto + la acción disponible (nada de datos inventados)
export function statusText(c: Cultivo, view: 'front' | 'cenital'): string {
  if (view === 'cenital') return 'Vista desde arriba · ' + (c.grow || 'tu carpa')
  if (c.finishedTs) return 'Terminado 🫙 · su bitácora queda guardada'
  if (c.stage === 'secando') return 'Secando · cuelga 7–14 días y luego a curar 🫙'
  if (c.stage === 'cosecha') return 'Lista para cosechar · revisa los tricomas ✂️'
  if (c.thirst > 0.55) return 'Tienen sed · toca las plantas para regar 💧'
  // mismos umbrales que el guardarraíl y los avisos (GUARD_HOURS / WATER_ALERT_DAYS):
  // la caption nunca debe contradecir a la ficha de riego ni al chip de Home
  const H = GUARD_HOURS[c.substrate]
  const hrs = c.lastWaterTs ? (Date.now() - c.lastWaterTs) / 3600000 : null
  if (H !== null && hrs !== null && hrs < H) return 'Regadas hace poco · deja que el sustrato seque 🌿'
  const ref = c.lastWaterTs ?? c.germTs
  const days = ref ? Math.floor((Date.now() - ref) / 86400000) : null
  const alertAt = WATER_ALERT_DAYS[c.stage]
  if (days !== null && alertAt !== undefined && days >= alertAt) {
    return `Hace ${days} días sin riego · si la maceta pesa poco, toca las plantas 💧`
  }
  if (c.stage === 'plantula') return 'Plántulas · riegos pequeños · toca las plantas para regar 💧'
  if (c.stage === 'flor') return 'Cogollos engordando · toca las plantas para regar 💧'
  return 'En vegetativo · toca las plantas para regar 💧'
}

// preload selectivo: solo lo que se va a ver ahora (día, noche, el estado actual y la cenital)
export function preloadFor(c: Cultivo, state: SceneState = 'dia') {
  const urls = new Set<string>([frontImg(c, 'front', 'dia'), frontImg(c, 'front', 'noche'), frontImg(c, 'front', state), frontImg(c, 'cenital', state)])
  urls.forEach((u) => { const i = new Image(); i.src = u })
}
