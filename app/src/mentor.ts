// ===== motor del mentor: rangos agronómicos + guía contextual =====
// Rangos de referencia general (sin CO₂), verificados en investigación. NO son consejo absoluto.
import { GUARD_HOURS, WATER_ALERT_DAYS, type Stage, type Substrate, type MetricKey, type Cultivo, type Guide } from './lib'

// nivel de experiencia (creciente): novato → medio → avanzado
export const LEVELS: Guide[] = ['novato', 'medio', 'avanzado']
export const levelIdx = (g: Guide) => LEVELS.indexOf(g)
export const canTrain = (g: Guide) => g !== 'novato' // podas/entrenamiento solo desde "medio"

export interface Range { lo: number; hi: number }
export interface MetricDef { key: MetricKey; label: string; unit: string; dec: number; min: Guide; step: number }

// cada métrica aparece desde cierto nivel (novato ve lo básico; avanzado ve todo)
export const METRICS: MetricDef[] = [
  { key: 'temp', label: 'Temp', unit: '°C', dec: 0, min: 'novato', step: 1 },
  { key: 'hr', label: 'HR', unit: '%', dec: 0, min: 'novato', step: 1 },
  { key: 'ph', label: 'pH', unit: '', dec: 1, min: 'novato', step: 0.1 },
  { key: 'vpd', label: 'VPD', unit: 'kPa', dec: 1, min: 'medio', step: 0.1 },
  { key: 'ec', label: 'EC', unit: 'mS', dec: 1, min: 'medio', step: 0.1 },
  { key: 'ppfd', label: 'PPFD', unit: 'µmol', dec: 0, min: 'avanzado', step: 50 },
]
export const metricDef = (k: MetricKey) => METRICS.find((m) => m.key === k)!
export const metricsFor = (g: Guide) => METRICS.filter((m) => levelIdx(g) >= levelIdx(m.min))

// ¿cuánto y cuándo regar? aproximado por etapa y tamaño de maceta (litros).
// Regla práctica: ~15–25% del volumen de la maceta por riego, apuntando a 10–20% de drenaje.
export function wateringGuide(c: Cultivo): { amount: string; when: string } | null {
  const L = c.potL || 11
  const txt = (v: number) => {
    const n = Math.round(v * 10) / 10
    return n < 3 ? `~${n} L (unos ${Math.max(1, Math.round(n / 0.25))} vasos)` : `~${n} L`
  }
  if (c.stage === 'plantula') return { amount: '~1 vaso (0.2 L) cerca del tallo', when: 'cuando la capa de arriba (~2 cm) esté seca' }
  if (c.stage === 'veg') return { amount: txt(L * 0.18), when: 'cuando la maceta pese poco al levantarla (≈ cada 2–3 días)' }
  if (c.stage === 'flor') return { amount: txt(L * 0.22), when: 'cuando la maceta pese poco (≈ cada 2–3 días)' }
  if (c.stage === 'cosecha') return { amount: 'a fondo, solo agua (flush)', when: 'mantén el sustrato apenas húmedo' }
  return null
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
  const r = targetFor(key, stage, sub)
  if (!r) return { status: 'ok', range: null }
  if (value >= r.lo && value <= r.hi) return { status: 'ok', range: r }
  const pad = Math.max((r.hi - r.lo) * 0.25, key === 'ph' ? 0.2 : 0)
  if (value >= r.lo - pad && value <= r.hi + pad) return { status: 'warn', range: r }
  return { status: 'bad', range: r }
}

export const STATUS_COLOR: Record<Status, string> = { ok: 'var(--acc)', warn: 'var(--warn)', bad: '#f87171' }

export function fmtRange(r: Range | null, dec: number): string {
  if (!r) return '—'
  const f = (n: number) => (dec ? n.toFixed(dec) : Math.round(n).toString())
  return `${f(r.lo)}–${f(r.hi)}`
}

// consejo del mentor para una medición fuera de rango (incluye guardarraíl de pH)
export function metricTip(key: MetricKey, value: number, status: Status, stage: Stage, sub: Substrate): string {
  const r = targetFor(key, stage, sub)
  if (!r || status === 'ok') return '✓ En rango. Vas bien.'
  const high = value > r.hi
  if (key === 'ph') {
    const banda = sub === 'tierra' ? '6.2–7.0' : '5.5–6.2'
    return `pH ${high ? 'alto' : 'bajo'} → bloqueo de nutrientes. Ajusta a ${banda} para ${sub}; corrige poco a poco.`
  }
  if (key === 'vpd') return high ? 'VPD alto → el aire reseca. Sube humedad o baja temperatura.' : 'VPD bajo → riesgo de hongos. Baja humedad o sube temperatura.'
  if (key === 'temp') return high ? 'Demasiado calor: estrés y bichos. Mejora extracción/ventilación.' : 'Frío: crecimiento lento. Sube la temperatura.'
  if (key === 'hr') return high ? 'Humedad alta → moho, sobre todo en flor. Baja con extracción.' : 'Aire seco → estrés. Sube humedad.'
  if (key === 'ppfd') return high ? 'Mucha luz: blanqueo. Sube la lámpara o baja potencia.' : 'Poca luz: tallos largos y flojos. Acerca la lámpara.'
  if (key === 'ec') return high ? 'EC alta → quemadura de nutrientes. Diluye; si dudas, baja a 1/4 de dosis.' : 'EC baja: poca comida. Sube despacio.'
  return ''
}

// ===== consejos del mentor: enseñan según etapa Y nivel =====
// novato = de la mano (cómo/cuándo regar, qué es el pH/EC, sin podas);
// medio = añade técnicas (LST); avanzado = todo, más conciso.
export interface Advice { icon: string; title: string; body: string; tone?: Status }
interface AdviceDef extends Advice { levels: Guide[] }

const ADVICE: Partial<Record<Stage, AdviceDef[]>> = {
  plantula: [
    { levels: ['novato'], icon: '🌱', title: 'Cuidado: bebe poquísimo', body: 'La plántula casi no toma agua. Regar de más ahoga las raíces (el error nº 1). Si dudas, espera un día más.' },
    { levels: ['novato'], icon: '🧪', title: 'Qué es el pH y cómo medirlo', body: 'El pH dice si el agua está ácida o alcalina. Las raíces solo absorben bien entre 6.2–7.0 en tierra (5.5–6.2 en coco/hidro). Mídelo con tiras o un medidor en el agua de riego y ajústalo ANTES de regar.' },
    { levels: ['novato', 'medio'], icon: '🌡️', title: 'Ambiente', body: '22–26° y humedad alta (65–80%). Luz suave y no muy cerca, para no quemarlas.' },
    { levels: ['novato', 'medio', 'avanzado'], icon: '🧪', title: 'Nutrientes', body: 'Si abonas, empieza a 1/4 de dosis para no quemar las raíces. La EC mide cuánto alimento lleva el agua (en plántula ~0.4–0.8); si no tienes medidor, quédate con el 1/4 de dosis.' },
    { levels: ['novato'], icon: '🍃', title: 'Sin podas todavía', body: 'Son muy pequeñas: nada de podar ni entrenar aún, solo déjalas crecer sanas.' },
  ],
  veg: [
    { levels: ['novato'], icon: '🧪', title: 'Qué es la EC', body: 'La EC mide cuánto alimento (sales) hay disuelto en el agua. Más EC = más comida, pero de más quema. En veg apunta ~1.0–1.6 y sube de a poco.' },
    { levels: ['novato', 'medio', 'avanzado'], icon: '💪', title: 'Empújalas', body: 'Crecen rápido: más luz y nitrógeno gradual. Mantén el aire moviéndose para tallos fuertes.' },
    { levels: ['medio', 'avanzado'], icon: '✂️', title: 'LST: abre la copa', body: 'Low Stress Training: dobla con cuidado las ramas hacia afuera y átalas para que la copa quede plana. Llega más luz a más cogollos → más cosecha, sin cortar nada. (aplícalo abajo)' },
    { levels: ['avanzado'], icon: '🪴', title: 'Topping / mainlining', body: 'Cortar la punta sobre un nudo crea 2 colas y una copa uniforme. Combínalo con LST. Solo en veg y con la planta sana.' },
  ],
  flor: [
    { levels: ['novato', 'medio', 'avanzado'], icon: '🌸', title: 'Cambia el abono', body: 'Aparecen los cogollos: baja el nitrógeno y sube fósforo y potasio (P-K), los nutrientes de floración.' },
    { levels: ['novato', 'medio', 'avanzado'], icon: '🍃', title: 'Cuida la humedad', body: 'Baja la humedad a 40–55% y mantén aire circulando: en flor el moho (botrytis) arruina cogollos.' },
    { levels: ['novato'], icon: '🚫', title: 'No la estreses', body: 'Ya no se poda ni entrena fuerte: la planta está concentrada en engordar cogollos.' },
    { levels: ['medio', 'avanzado'], icon: '🍃', title: 'Defoliación selectiva', body: 'Hacia la semana ~3 de flor, quita hojas grandes que tapan cogollos bajos para que entre luz y aire. Poco a poco.' },
    { levels: ['avanzado'], icon: '🔬', title: 'Vigila tricomas', body: 'Hacia el final, revisa con lupa: transparentes (espera), lechosos (potencia), ámbar (efecto relax).' },
  ],
  cosecha: [
    { levels: ['novato', 'medio', 'avanzado'], icon: '🔬', title: 'Cuándo cortar', body: 'Mira los tricomas con una lupa: transparentes = espera; lechosos = potencia máxima; ámbar = efecto más relajante. Corta según el efecto que busques.' },
    { levels: ['novato', 'medio', 'avanzado'], icon: '🚿', title: 'Flush (lavado)', body: 'Las últimas ~1–2 semanas riega solo con agua (sin nutrientes) para limpiar sabores y que la ceniza sea suave.' },
  ],
  secando: [
    { levels: ['novato', 'medio', 'avanzado'], icon: '🌬️', title: 'Secado', body: 'Cuelga las ramas a 18–21° y 55–62% de humedad, en oscuridad y con aire suave (sin viento directo). Tarda ~7–14 días.' },
    { levels: ['novato', 'medio', 'avanzado'], icon: '🫙', title: 'Curado', body: 'Cuando los tallos finos crujan al doblarlos, mete los cogollos en frascos de vidrio y ábrelos un rato cada día durante 2–3 semanas.' },
  ],
}

// días desde el último riego; si nunca regó, cuenta desde el transplante (germTs)
function daysSinceWater(c: Cultivo): number | null {
  const ref = c.lastWaterTs ?? c.germTs
  if (!ref) return null
  return Math.floor((Date.now() - ref) / 86400000)
}

export function mentorAdvice(c: Cultivo, guide: Guide): Advice[] {
  const out: Advice[] = []
  // atención dinámica primero
  if (c.thirst > 0.55) out.push({ icon: '💧', title: 'Tienen sed', body: 'El sustrato está seco. Riega ahora tocando las plantas en la carpa.', tone: 'warn' })
  const days = daysSinceWater(c)
  const alertAt = WATER_ALERT_DAYS[c.stage]
  if (days !== null && alertAt !== undefined && days >= alertAt) {
    out.push({ icon: '⏳', title: `Hace ${days} días sin riego`, body: c.stage === 'plantula' ? 'Las plántulas beben poco pero se secan rápido: dales ~1 vaso cerca del tallo.' : 'Revisa el peso de la maceta; si pesa poco, riega a fondo.', tone: 'warn' })
  }
  // fotoperiodo: la flor no llega sola — recuérdaselo cuando la veg ya está madura
  if (c.stage === 'veg' && c.seedType === 'foto' && !c.flowerTs && c.day >= 30) {
    out.push({ icon: '🌸', title: '¿Pasamos a floración?', body: 'Cuando las plantas llenen ~la mitad de la carpa, cambia tu luz a 12 h de luz / 12 h de oscuridad: eso dispara la flor. Cuando lo hagas, márcalo aquí abajo con "Pasar a floración".' })
  }
  if (c.stage === 'veg' && c.seedType === 'auto' && guide !== 'avanzado') {
    out.push({ icon: '⚡', title: 'Autofloreciente', body: 'Florecerá sola hacia el día ~32, sin cambiar el ciclo de luz. Déjale 18–20 h de luz todo el ciclo.' })
  }
  // RIEGO concreto: cuánto (según litros de maceta) y cuándo
  const w = wateringGuide(c)
  if (w) out.push({ icon: '💧', title: 'Cuánto y cuándo regar', body: `En tu maceta de ${c.potL || 11} L: riega ${w.amount}, ${w.when}. Hazlo despacio en círculo hasta que drene ~10–20% por abajo (tira ese drenaje).` })
  // contenido por etapa filtrado por nivel
  for (const a of ADVICE[c.stage] ?? []) {
    if (a.levels.includes(guide)) out.push({ icon: a.icon, title: a.title, body: a.body, tone: a.tone })
  }
  return out
}

// ¿hay algo que requiera atención? (para el puntito del botón Consejos)
export function needsAttention(c: Cultivo): boolean {
  if (c.finishedTs) return false
  if (c.thirst > 0.55) return true
  const days = daysSinceWater(c)
  const alertAt = WATER_ALERT_DAYS[c.stage]
  return days !== null && alertAt !== undefined && days >= alertAt
}

// ===== guardarraíl de exceso de riego =====
// Si regaste hace poco y no están sedientas, mejor esperar (error #1 del principiante).
// El umbral vive en lib.ts (GUARD_HOURS): la misma fuente que usa la caption de la carpa.
export function overwaterGuard(c: Cultivo): string | null {
  const H = GUARD_HOURS[c.substrate]
  if (H === null || !c.lastWaterTs) return null
  const hrs = (Date.now() - c.lastWaterTs) / 3600000
  if (hrs < H && c.thirst < 0.5) return '💧 El sustrato aún está húmedo. Espera a que la maceta pese menos: el exceso de riego ahoga las raíces.'
  return null
}
