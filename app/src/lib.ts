// ===== tipos =====
export type Substrate = 'tierra' | 'coco' | 'hidro'
export type Stage = 'remojo' | 'germinacion' | 'plantula' | 'veg' | 'flor' | 'cosecha' | 'secando' | 'vacia'
export type MetricKey = 'temp' | 'hr' | 'vpd' | 'ppfd' | 'ph' | 'ec'
export type Training = 'none' | 'lst' | 'lollipop' | 'apical'
export type PotType = 'tela' | 'plastico'   // la de tela seca más rápido
export type Guide = 'novato' | 'medio' | 'avanzado'   // nivel de experiencia (se elige al crear el cultivo)
export type SeedType = 'foto' | 'auto'                // fotoperiódica (12/12 la dispara el usuario) o autofloreciente

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
  const base = THIRST_HOURS[stage]
  if (!base) return 0
  // las horas de la tabla son para maceta de tela; la de plástico retiene agua ~20 % más
  const H = base * (c.potType === 'plastico' ? 1.2 : 1)
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
export type EventType = 'creado' | 'sembrado' | 'transplante' | 'riego' | 'sed' | 'entrenamiento' | 'floracion' | 'cosecha' | 'terminado' | 'nota' | 'medicion' | 'foto' | 'defoliacion'
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
  creado: { icon: '', label: 'Cultivo creado'},
  sembrado: { icon: '', label: 'Semillas en remojo'},
  transplante: { icon: '', label: 'Transplante'},
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
}

// ===== legal: control de edad + consentimiento (versionado para re-consentir si cambian términos) =====
export const CONSENT_VERSION = 1

// ===== imágenes de la carpa: el arte IA original (la escena 3D de blender/ quedó apartada,
// junto con su set en app/_assets_v2_3d/, por decisión de Bruno: se veía peor que las fotos) =====
const HAVE = new Set([
  'carpa-vacia', 'carpa-plantula', 'carpa-dia', 'carpa-dia-1p', 'carpa-dia-2p', 'carpa-sedienta',
  'floracion', 'carpa-cenital', 'carpa-cerrada', 'carpa-entreabierta', 'ajar-vacia', 'ajar-flor',
  'coco-plantula', 'coco-veg', 'coco-sed', 'coco-flor', 'hidro-plantula', 'hidro-veg', 'hidro-sed', 'hidro-flor',
  'germinacion', 'cosecha', 'secando', 'carpa-apagada', 'carpa-noche-aire',
  'agua-1', 'agua-2', 'agua-3', 'agua-1-brote', 'agua-2-brote', 'agua-3-brote',
  'veg-temprano', 'veg-lst', 'veg-lollipop', 'veg-apical', 'veg-defoliada', 'flor-lst', 'flor-defoliada',
])
// rutas relativas a la base del deploy (BASE_URL termina en '/'): así la app
// funciona igual en raíz (localhost, Vercel) que bajo subcarpeta (GitHub Pages)
const A = (name: string) => `${import.meta.env.BASE_URL}assets/${name}.webp`

// imagen de las semillas en remojo (vaso de agua), según nº de semillas y si ya brotaron
export function waterImg(seeds: number, brote: boolean): string {
  const n = Math.min(Math.max(seeds, 1), 3)
  const name = `agua-${n}${brote ? '-brote' : ''}`
  return A(HAVE.has(name) ? name : `agua-${n}`)
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

// vista desde arriba: tu foto cenital con las plantas de la etapa compuestas encima (assets/top/)
const T = (name: string) => `${import.meta.env.BASE_URL}assets/top/${name}.webp`
export function topImg(c: Cultivo, state: SceneState = 'dia'): string {
  const p = Math.min(Math.max(c.pots, 1), 3)
  if (c.stage === 'remojo' || c.stage === 'vacia' || c.stage === 'secando') return T(`top-vacia-${state}`)
  const stage = c.stage === 'veg' && c.thirst > 0.55 ? 'sed' : c.stage
  return T(`top-${stage}-${state}-${p}p`)
}

// imagen frontal según etapa / sustrato / sed / nº de macetas (respaldo a tierra)
export function frontImg(c: Cultivo, view: 'front' | 'cenital', state: SceneState = 'dia'): string {
  if (view === 'cenital') return topImg(c, state)
  if (c.stage === 'remojo') return waterImg(c.plants, hasSprouted(c))
  if (state === 'noche') return nightImg(c)
  if (c.stage === 'vacia') return A('carpa-vacia')
  if (c.stage === 'secando') return A('secando')
  // vegetativo: arte de entrenamiento / temprano SOLO existe en tierra; coco/hidro conservan su imagen
  if (c.stage === 'veg' && c.thirst <= 0.55 && c.substrate === 'tierra') {
    if (isDefoliated(c)) return A('veg-defoliada')
    if (c.training === 'lst' && HAVE.has('veg-lst')) return A('veg-lst')
    if (c.training === 'lollipop' && HAVE.has('veg-lollipop')) return A('veg-lollipop')
    if (c.training === 'apical' && HAVE.has('veg-apical')) return A('veg-apical')
    if (c.training === 'none' && c.day < 30 && HAVE.has('veg-temprano')) return A('veg-temprano')
  }
  // floración (tierra): la defoliación reciente y el LST también se ven
  if (c.stage === 'flor' && c.thirst <= 0.55 && c.substrate === 'tierra') {
    if (isDefoliated(c)) return A('flor-defoliada')
    if (c.training === 'lst') return A('flor-lst')
  }
  let key: string, tierra: string
  if (c.stage === 'germinacion') { key = 'germinacion'; tierra = 'germinacion' }
  else if (c.stage === 'plantula') { key = 'plantula'; tierra = 'carpa-plantula' }
  else if (c.stage === 'cosecha') { key = 'cosecha'; tierra = 'cosecha' }
  else if (c.stage === 'flor') { key = 'flor'; tierra = 'floracion' }
  else if (c.thirst > 0.55) { key = 'sed'; tierra = 'carpa-sedienta' }
  else { key = 'veg'; tierra = 'carpa-dia' }
  let base = c.substrate !== 'tierra' && HAVE.has(`${c.substrate}-${key}`) ? `${c.substrate}-${key}` : tierra
  const p = Math.min(c.pots, 3)
  if (p < 3 && HAVE.has(`${base}-${p}p`)) base = `${base}-${p}p`
  return A(base)
}

// imagen de noche (luz apagada), con/ sin ventilador
export function nightImg(c: Cultivo): string {
  return c.fan ? A('carpa-noche-aire') : A('carpa-apagada')
}

// cuadro "entreabierta" para la animación de apertura, según etapa
export function ajarImg(c: Cultivo): string {
  if (c.stage === 'flor' || c.stage === 'cosecha') return HAVE.has('ajar-flor') ? A('ajar-flor') : A('carpa-entreabierta')
  if (c.stage === 'veg') return A('carpa-entreabierta')
  return HAVE.has('ajar-vacia') ? A('ajar-vacia') : A('carpa-entreabierta')
}

export const closedImg = A('carpa-cerrada')

// timelapse del ciclo (Seedance, 10 s): plántula → cosecha. La línea de tiempo lo arrastra:
// el día d cae en el segundo d / TIMELAPSE_DAYS × duración. HAS_TIMELAPSE se apaga si el
// archivo no está (assets/timelapse.mp4), y entonces solo se ven las fotos fijas.
export const TIMELAPSE_URL = `${import.meta.env.BASE_URL}assets/timelapse.mp4`
export const TIMELAPSE_DAYS = 105
export const HAS_TIMELAPSE = true

// etiquetas de la vista cenital: donde están las macetas en carpa-cenital
// (cámara a 3.5 m con 24 mm de sensor y 50 mm de lente; macetas a ±0.345 m (3) / ±0.24 m (2);
// cuanto más alta la copa, más cerca de la cámara y más separadas se ven)
export function cenitalTops(c: Cultivo): string[] {
  const s = c.stage
  const z = s === 'plantula' || s === 'germinacion' ? 0.24 : s === 'flor' || s === 'cosecha' ? 0.62 : c.thirst > 0.55 ? 0.45 : 0.55
  const pct = (x: number) => `${Math.round(50 + (x / (2 * (3.5 - z) * 0.24)) * 100)}%`
  const p = Math.min(Math.max(c.pots, 1), 3)
  return p === 1 ? [pct(0)] : p === 2 ? [pct(-0.24), pct(0.24)] : [pct(-0.345), pct(0), pct(0.345)]
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
    return`Hace ${days} días sin riego · si la maceta pesa poco, toca las plantas`
  }
  if (c.stage === 'plantula') return 'Plántulas · riegos pequeños · toca las plantas para regar'
  if (c.stage === 'flor') return 'Cogollos engordando · toca las plantas para regar'
  return 'En vegetativo · toca las plantas para regar'
}

// preload selectivo: solo lo que se va a ver ahora (no las 31 imágenes)
export function preloadFor(c: Cultivo, state: SceneState = 'dia') {
  const urls = new Set<string>([closedImg, ajarImg(c), frontImg(c, 'front', 'dia'), nightImg(c), frontImg(c, 'front', state), A('carpa-cenital')])
  urls.forEach((u) => { const i = new Image(); i.src = u })
}
