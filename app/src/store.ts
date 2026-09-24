import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  dexieStorage, addEvent, addEventsBulk, listEvents, deleteEvents, deleteEvent, pruneEvents,
  addPhoto as dbAddPhoto, deletePhoto, deletePhotos,
  exportBlob, importAll, importAllRaw, wipeDatabase, type PhotoBackup,
} from './db'
import { cloudSignIn, cloudSignOut, cloudHasData, cloudPush, cloudPull } from './sync'
import {
  emptyCultivo, deriveLive, realDay, CONSENT_VERSION,
  scheduledLight, nextLightChange, checkIntervalH, nextCheckTs, whenText, vegStartOf, revisaConDedo,
  type Cultivo, type Substrate, type SeedType, type GrowEvent, type EventType, type MetricKey, type Training, type Guide, type PotType, type Equipment,
  type Stage, type WaterSample, type TierraAbonada,
} from './lib'
import { overwaterGuard, needsAttention, attentionText, metricDef, evalRange, targetHoy } from './mentor'
import { equipoPorId } from './data/equipos'
import { nutrientesPara, lineaPorId, OTRA_MARCA } from './data/nutrientes'

type View = 'front' | 'cenital'

function genId(): string {
  return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

const D = 86400000
const H = 3600000
const STAGES: Stage[] = ['remojo', 'germinacion', 'plantula', 'veg', 'flor', 'cosecha', 'secando', 'vacia']

// Arranque neutro del reloj cuando no sabemos cuándo se regó (planta registrada, datos viejos, riego
// borrado, cambio de sustrato) o se miró el depósito: la primera revisión cae dentro de un día, sea
// cual sea el intervalo de la etapa. Ni aviso de atraso nada más empezar ni "regadas hace poco"
// inventado: un riego así queda marcado como estimado (lastWaterEstimated).
function neutralTs(c: Cultivo, now = Date.now()): number {
  const iv = checkIntervalH({ ...c, ...deriveLive(c) }) ?? 48
  return Math.max(c.germTs ?? 0, now - Math.max(0, iv - 24) * H)
}
// hidro sin fecha de la última solución: la damos por cambiada hace 3,5 días (a mitad de su
// semana), para no pedir el cambio el primer día sin saberlo
const neutralSolutionTs = (c: Pick<Cultivo, 'germTs'>, now = Date.now()) => Math.max(c.germTs ?? 0, now - 3.5 * D)

// Campos del riego por revisión (2026-09-23) a partir de datos guardados, importados o de la nube:
// valores seguros si faltan o vienen mal. Un cultivo viejo arranca sin ritmo aprendido ni base
// (su primer riego nuevo la fija). Hidro sin fechas del depósito: arranque neutro de la solución
// y de la revisión del nivel (las dos cuentas por separado: el depósito se revisa cada 1–3 días).
function wateringFields(o: Record<string, unknown>, c: Cultivo): Pick<Cultivo, 'lastCheckTs' | 'droopTs' | 'waterSamples' | 'waterBaseTs' | 'lastSolutionTs' | 'wetTipDone' | 'lastWaterEstimated'> {
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const waterSamples = Array.isArray(o.waterSamples)
    ? (o.waterSamples as unknown[]).filter((x): x is WaterSample => {
        const w = x as Record<string, unknown> | null
        return !!w && num(w.ts) != null && num(w.h) != null && (w.h as number) > 0 && STAGES.includes(w.stage as Stage)
      }).slice(-8)
    : []
  const hidroViejo = c.substrate === 'hidro' && !!c.germTs && !c.harvestedTs
  let lastSolutionTs = num(o.lastSolutionTs)
  if (o.lastSolutionTs === undefined && hidroViejo) lastSolutionTs = neutralSolutionTs(c)
  let lastCheckTs = num(o.lastCheckTs)
  if (o.lastCheckTs === undefined && hidroViejo) lastCheckTs = neutralTs(c)
  return { lastCheckTs, droopTs: num(o.droopTs), waterSamples, waterBaseTs: num(o.waterBaseTs), lastSolutionTs, wetTipDone: o.wetTipDone === true, lastWaterEstimated: o.lastWaterEstimated === true }
}

// Abono seguro (2026-09-23): ¿la tierra ya trae abono? Si falta o viene mal, "no sé", que se
// trata como abonada (lo seguro: solo agua unas 3 semanas desde el trasplante; se cambia en Editar).
const tierraAbonadaDe = (v: unknown): TierraAbonada => (v === 'si' || v === 'no' ? v : 'nose')
// El abono de un cultivo guardado, importado o de la nube. Los de antes de la pregunta de la tierra
// (sin el campo tierraAbonada) vienen de cuando null era «Solo agua / otra marca» y la app les
// mostraba la EC objetivo: en tierra pasan a otra marca (guía por EC, lo más parecido a lo que
// veían; null = «solo agua» queda para los que lo eligen con el selector nuevo). Y ya se abonaban:
// con una línea del catálogo, o pasada la plántula, su tierra cuenta como sin abono (cortar el abono
// a mitad de vegetativo los dejaría con hambre sin haber contestado nunca la pregunta).
function abonoFields(o: Record<string, unknown>, c: Pick<Cultivo, 'substrate' | 'germTs' | 'seedType' | 'autoWeeks'>): Pick<Cultivo, 'nutrientesId' | 'tierraAbonada'> {
  const raw = typeof o.nutrientesId === 'string' ? o.nutrientesId : null
  if (o.tierraAbonada !== undefined) return { nutrientesId: nutrientesPara(raw, c.substrate), tierraAbonada: tierraAbonadaDe(o.tierraAbonada) }
  const yaAbonaba = !!lineaPorId(raw) || (!!c.germTs && realDay(c.germTs) >= vegStartOf(c))
  return { nutrientesId: nutrientesPara(raw ?? OTRA_MARCA, c.substrate), tierraAbonada: yaAbonaba ? 'no' : 'nose' }
}
// nombre legible de la elección de abono (bitácora y avisos)
const nombreAbono = (id: string | null) => {
  const l = lineaPorId(id)
  return l ? `${l.marca} · ${l.linea}` : id === OTRA_MARCA ? 'otra marca' : 'solo agua'
}

// Saneo de cultivos venidos de FUERA (respaldo importado o copia de la nube):
// números finitos o null/valores por defecto — nada de "Día NaN" persistido.
function sanitizeGrows(raw: unknown[]): Cultivo[] {
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const grows: Cultivo[] = []
  for (const g of raw) {
    if (!g || typeof g !== 'object' || Array.isArray(g)) continue
    const o = g as Record<string, unknown>
    const c: Cultivo = {
      ...emptyCultivo,
      id: typeof o.id === 'string' && o.id ? o.id : genId(),
      grow: typeof o.grow === 'string' && o.grow.trim() ? o.grow : emptyCultivo.grow,
      plants: num(o.plants) ?? emptyCultivo.plants,
      pots: num(o.pots) ?? emptyCultivo.pots,
      potL: num(o.potL) ?? emptyCultivo.potL,
      substrate: o.substrate === 'coco' || o.substrate === 'hidro' ? o.substrate : 'tierra',
      seedType: o.seedType === 'auto' ? 'auto' : 'foto',
      soakTs: num(o.soakTs),
      germTs: num(o.germTs),
      flowerTs: num(o.flowerTs),
      harvestedTs: num(o.harvestedTs),
      finishedTs: num(o.finishedTs),
      dryWeight: num(o.dryWeight),
      lastWaterTs: num(o.lastWaterTs),
      training: o.training === 'lst' || o.training === 'lollipop' || o.training === 'apical' ? o.training : 'none',
      defoliatedTs: num(o.defoliatedTs),
      potType: o.potType === 'plastico' ? 'plastico' : 'tela',
      lightOnHour: typeof o.lightOnHour === 'number' ? Math.min(23, Math.max(0, Math.floor(o.lightOnHour))) : 6,
      lightHours: typeof o.lightHours === 'number' ? o.lightHours : null,
      hasController: o.hasController === true,
      lightOverrideUntil: num(o.lightOverrideUntil),
      strain: typeof o.strain === 'string' && o.strain.trim() ? o.strain.trim().slice(0, 40) : null,
      breeder: typeof o.breeder === 'string' && o.breeder.trim() ? o.breeder.trim().slice(0, 40) : null,
      flowerWeeks: num(o.flowerWeeks) != null && (o.flowerWeeks as number) >= 5 && (o.flowerWeeks as number) <= 16 ? (o.flowerWeeks as number) : null,
      autoWeeks: num(o.autoWeeks) != null && (o.autoWeeks as number) >= 7 && (o.autoWeeks as number) <= 16 ? (o.autoWeeks as number) : null,
      tentCm: num(o.tentCm),
      equipment: o.equipment && typeof o.equipment === 'object' && !Array.isArray(o.equipment)
        ? Object.fromEntries(Object.entries(o.equipment as Record<string, unknown>).filter(([k, v]) => ['luz', 'aire', 'ctrl', 'vent'].includes(k) && typeof v === 'string').map(([k, v]) => [k, (v as string).slice(0, 60)]))
        : {},
      readings: o.readings && typeof o.readings === 'object' && !Array.isArray(o.readings) ? (o.readings as Cultivo['readings']) : {},
      readingDays: o.readingDays && typeof o.readingDays === 'object' && !Array.isArray(o.readingDays) ? (o.readingDays as Cultivo['readingDays']) : {},
      day: 0, stage: 'remojo',
      health: num(o.health) ?? emptyCultivo.health,
      light: true, fan: true, exhaust: true,
    }
    Object.assign(c, wateringFields(o, c))
    // en coco e hidro no hay "solo agua"; una línea que no es de ese sustrato pasa a "otra marca";
    // un respaldo de antes de la tierra abonada se migra como los datos guardados (ver abonoFields)
    Object.assign(c, abonoFields(o, c))
    const live = deriveLive(c)
    grows.push({ ...c, ...live })
  }
  return grows
}

interface AppState {
  grows: Cultivo[]            // todos los cultivos del usuario
  activeId: string | null     // cultivo cuya carpa está abierta (null = pantalla "Mis cultivos")
  creating: boolean           // true = mostrando el formulario de nuevo cultivo
  justCreated: boolean        // para la animación de apertura solo al crear/entrar nuevo
  view: View
  toast: string | null
  ready: boolean
  loadError: boolean          // datos guardados ilegibles → no pisar el blob, avisar
  events: GrowEvent[]         // bitácora del cultivo ACTIVO
  previewDay: number | null
  consentV: number
  guide: Guide                // nivel de experiencia del USUARIO (ajuste global)
  onboarded: boolean          // ya eligió su experiencia la primera vez
  firstWaterTipDone: boolean  // ya vio el how-to del primer riego
  firstGermTipDone: boolean   // ya vio el how-to de germinar en agua
  coachDone: boolean          // ya vio el coach mark de la carpa (regar + dock)
  pendingUndo: (() => void) | null // deshacer de la última acción (mientras dura el toast)
  pendingCheck: boolean       // al abrir la carpa, abrir la revisión de la maceta (desde el aviso de Home)
  notifyEnabled: boolean      // recordatorios de riego (notificación local, opt-in en Ajustes)
  lastNotifiedDay: string | null // tope de 1 aviso/día

  // respaldo en la nube (Supabase, cuenta anónima)
  cloudOn: boolean            // sincronización activada (persistido)
  cloudBusy: boolean
  cloudError: string | null
  lastCloudSyncTs: number | null

  // navegación
  startNew: () => void
  cancelNew: () => void
  openGrow: (id: string, opts?: { check?: boolean }) => void
  goHome: () => void
  deleteGrow: (id: string) => void

  setGuide: (g: Guide) => void
  completeOnboarding: (g: Guide) => void
  markFirstWaterTip: () => void
  markFirstGermTip: () => void
  markCoachDone: () => void
  setNotify: (v: boolean) => void
  checkWaterReminder: () => void
  runUndo: () => void
  addNote: (text: string) => void
  addPhoto: (blob: Blob) => void
  removeEvent: (id: number) => void

  // acciones del cultivo activo
  createGrow: (cfg: { grow: string; plants: number; substrate: Substrate; potL: number; potType?: PotType; seedType: SeedType; nutrientesId?: string | null; tierraAbonada?: TierraAbonada; lightOnHour?: number; hasController?: boolean; strain?: string | null; breeder?: string | null; flowerWeeks?: number | null; autoWeeks?: number | null; tentCm?: number | null }) => void
  setLightSchedule: (cfg: { lightOnHour: number; lightHours: number | null; hasController: boolean }) => void
  checkLightReminder: () => void
  setNutrientes: (id: string | null) => void
  registerExisting: (cfg: { grow: string; plants: number; substrate: Substrate; potL: number; potType?: PotType; seedType: SeedType; weeksAgo: number; flowerWeeksAgo: number | null; nutrientesId?: string | null; tierraAbonada?: TierraAbonada; lightOnHour?: number; hasController?: boolean; strain?: string | null; breeder?: string | null; flowerWeeks?: number | null; autoWeeks?: number | null; tentCm?: number | null }) => void
  transplant: (count: number) => void
  resoak: () => void
  // nutrientesId: la elección de abono del formulario (sin él se conserva, ajustada al sustrato)
  updateGrow: (cfg: { grow: string; potL: number; potType?: PotType; substrate: Substrate; seedType: SeedType; tierraAbonada?: TierraAbonada; nutrientesId?: string | null }) => void
  toggleLight: () => void
  applyTraining: (t: Training) => void
  defoliate: () => void
  startFlowering: () => void
  setPreview: (d: number | null) => void
  // riego: confirmed = la maceta pesaba poco (o la tierra estaba seca) al revisarla; force = pese al
  // guardarraíl; daysAgo = "Ya regué" hoy/ayer/anteayer (anotado después, con fecha aproximada)
  water: (opts?: { toast?: string; force?: boolean; confirmed?: boolean; daysAgo?: number }) => void
  checkPot: (afterDroop?: boolean) => void // revisó y aún pesa / sigue húmeda (hidro: el nivel está bien)
  reportDroop: () => void       // el usuario ve las hojas caídas
  refillReservoir: () => void   // hidro: rellenó el depósito
  changeSolution: () => void    // hidro: cambió la solución entera
  markWetTip: () => void
  wilt: () => void
  harvest: () => void
  finishGrow: (dryWeight: number | null, note?: string) => void
  measure: (values: Partial<Record<MetricKey, number>>) => void // una o varias lecturas (temp + HR van juntas)
  setGenetics: (g: { strain: string | null; breeder: string | null; flowerWeeks: number | null; autoWeeks: number | null }) => void
  setEquipment: (eq: Equipment, tentCm?: number | null) => void
  addDiagnosis: (blob: Blob, summary: string) => void   // foto + resultado a la bitácora

  // Premium: sin pasarela de pago todavía; el interruptor de prueba lo activa
  premium: boolean
  setPremium: (v: boolean) => void

  setView: (v: View) => void
  setToast: (t: string | null) => void
  recomputeTime: () => void
  acceptConsent: () => void
  hydrate: () => void

  // datos y privacidad
  exportBackup: () => Promise<Blob>
  importBackup: (data: unknown) => Promise<string | null> // null = ok; string = error legible
  wipeAll: () => Promise<void>

  // nube
  enableCloud: () => Promise<void>
  disableCloud: () => void
  syncCloudNow: (auto?: boolean) => Promise<void>

  // datos de ejemplo (demo para explorar la app sin esperar meses)
  seedDemo: () => Promise<void>
}

// último cambio de luz avisado por cultivo (en esta sesión)
const lightNotified = new Map<string, number>()

// selector: el cultivo activo (referencia estable; emptyCultivo como respaldo)
export const selectActive = (s: AppState): Cultivo =>
  s.grows.find((g) => g.id === s.activeId) ?? emptyCultivo

export const useStore = create<AppState>()(
  persist(
    (set, get) => {
      // muta solo el cultivo activo dentro del array
      function patchActive(updater: (c: Cultivo) => Cultivo, extra?: Partial<AppState>) {
        const { grows, activeId } = get()
        set({ grows: grows.map((g) => (g.id === activeId ? updater(g) : g)), ...(extra ?? {}) } as Partial<AppState>)
      }
      // registra un evento (append-only) para el cultivo activo; devuelve el evento creado
      // extra.ts/day: un evento anotado después ("Ya regué ayer") va con su fecha, no con la de ahora
      async function log(type: EventType, note?: string, photoId?: number, extra?: Partial<Pick<GrowEvent, 'metric' | 'value' | 'ts' | 'day'>>): Promise<GrowEvent | null> {
        const c = selectActive(get())
        if (!c.id) return null
        const ev = await addEvent({ growId: c.id, ts: Date.now(), day: c.day, type, note, photoId, ...(extra ?? {}) })
        // la bitácora en memoria sigue en orden cronológico (y solo si seguimos en ese cultivo)
        if (get().activeId === c.id) set((st) => ({ events: [...st.events, ev].sort((a, b) => a.ts - b.ts) }))
        return ev
      }

      return {
        grows: [],
        activeId: null,
        creating: false,
        justCreated: false,
        view: 'front',
        toast: null,
        ready: false,
        loadError: false,
        events: [],
        previewDay: null,
        consentV: 0,
        guide: 'novato',
        onboarded: false,
        firstWaterTipDone: false,
        firstGermTipDone: false,
        coachDone: false,
        pendingUndo: null,
        pendingCheck: false,
        notifyEnabled: false,
        lastNotifiedDay: null,
        premium: false,
        cloudOn: false,
        cloudBusy: false,
        cloudError: null,
        lastCloudSyncTs: null,

        // ---- navegación ----
        // OJO: toast y pendingUndo se limpian SIEMPRE al navegar — un "Deshacer" armado
        // en un cultivo no debe reaparecer (ni ejecutarse) sobre otro.
        startNew: () => set({ creating: true, previewDay: null, toast: null, pendingUndo: null, pendingCheck: false }),
        cancelNew: () => set({ creating: false }),
        goHome: () => set({ activeId: null, creating: false, previewDay: null, events: [], toast: null, pendingUndo: null, pendingCheck: false }),

        openGrow: (id, opts) => {
          set({ activeId: id, creating: false, justCreated: false, previewDay: null, view: 'front', events: [], toast: null, pendingUndo: null, pendingCheck: !!opts?.check })
          get().recomputeTime()
          listEvents(id).then((evs) => { if (get().activeId === id) set({ events: evs }) })
        },

        deleteGrow: (id) => {
          set((st) => ({
            grows: st.grows.filter((g) => g.id !== id),
            activeId: st.activeId === id ? null : st.activeId,
            events: st.activeId === id ? [] : st.events,
            toast: null,
            pendingUndo: null,
          }))
          deleteEvents(id).catch(() => { /* el barrido en hydrate limpiará huérfanos */ })
          deletePhotos(id).catch(() => {})
        },

        // ---- crear (arranca EN REMOJO: semillas en agua, germTs aún null) ----
        createGrow: ({ grow, plants, substrate, potL, potType = 'tela', seedType, nutrientesId = null, tierraAbonada = 'nose', lightOnHour = 6, hasController = false, strain = null, breeder = null, flowerWeeks = null, autoWeeks = null, tentCm = null }) => {
          const base: Cultivo = {
            ...emptyCultivo,
            id: genId(),
            grow: grow || 'Carpa A',
            plants,
            pots: Math.min(plants, 3),
            potL,
            substrate,
            seedType,
            nutrientesId: nutrientesPara(nutrientesId, substrate),
            tierraAbonada,
            potType, lightOnHour, hasController,
            strain: strain?.trim() || null, breeder: breeder?.trim() || null, flowerWeeks, autoWeeks, tentCm,
            soakTs: Date.now(),
            germTs: null,
          }
          const live = deriveLive(base) // → remojo
          const c = { ...base, ...live }
          set((st) => ({
            grows: [...st.grows, c],
            activeId: c.id,
            creating: false,
            justCreated: false, // la apertura de la carpa se reserva para el transplante
            previewDay: null,
            view: 'front',
            events: [],
          }))
          log('sembrado', `${plants} ${plants === 1 ? 'semilla' : 'semillas'} en remojo`)
        },

        // ---- registrar una planta que YA está creciendo (sin pasar por el remojo) ----
        registerExisting: ({ grow, plants, substrate, potL, potType = 'tela', seedType, weeksAgo, flowerWeeksAgo, nutrientesId = null, tierraAbonada = 'nose', lightOnHour = 6, hasController = false, strain = null, breeder = null, flowerWeeks = null, autoWeeks = null, tentCm = null }) => {
          const now = Date.now()
          const germTs = now - weeksAgo * 7 * 86400000
          const base: Cultivo = {
            ...emptyCultivo,
            id: genId(),
            grow: grow || 'Carpa A',
            plants,
            pots: Math.min(plants, 3),
            potL,
            substrate,
            seedType,
            nutrientesId: nutrientesPara(nutrientesId, substrate),
            tierraAbonada,
            potType, lightOnHour, hasController,
            strain: strain?.trim() || null, breeder: breeder?.trim() || null, flowerWeeks, autoWeeks, tentCm,
            soakTs: germTs - 2 * 86400000,
            germTs,
            flowerTs: seedType === 'foto' && flowerWeeksAgo != null ? now - flowerWeeksAgo * 7 * 86400000 : null,
          }
          const live = deriveLive(base)
          // arranque neutro del reloj de riego: no sabemos cuándo regó, así que la primera revisión
          // cae dentro de un día (sin falsa alarma de atraso; el primer riego real lo sincroniza). Es
          // una estimación: no se muestra como riego anotado ni sirve de base para aprender el ritmo
          // (waterBaseTs queda null). Hidro: tampoco sabemos cuándo cambió la solución ni cuándo miró
          // el nivel; cada cuenta con su arranque neutro.
          const hidro = substrate === 'hidro'
          const c: Cultivo = {
            ...base, ...live,
            lastWaterTs: neutralTs(base, now), lastWaterEstimated: true,
            lastSolutionTs: hidro ? neutralSolutionTs(base, now) : null,
            lastCheckTs: hidro ? neutralTs(base, now) : null,
          }
          set((st) => ({
            grows: [...st.grows, c],
            activeId: c.id,
            creating: false,
            justCreated: true, // directo a la carpa, con su animación de apertura
            previewDay: null,
            view: 'front',
            events: [],
          }))
          log('creado', `Registrada con ~${weeksAgo} ${weeksAgo === 1 ? 'semana' : 'semanas'} · día ${c.day}`)
        },

        // ---- transplante: fija cuántas brotaron, arranca el reloj del cultivo y abre la carpa ----
        // Incluye el primer riego ligero (paso 3 del how-to) → lastWaterTs arranca aquí.
        transplant: (count) => {
          const n = Math.max(1, count)
          patchActive(
            (g) => {
              const now = Date.now()
              // el vaso del trasplante es un riego con hora exacta: base del ritmo que se aprende
              const next = { ...g, plants: n, pots: Math.min(n, 3), germTs: now, lastWaterTs: now, lastWaterEstimated: false, waterBaseTs: now, lastCheckTs: null, droopTs: null }
              const live = deriveLive(next)
              return { ...next, ...live }
            },
            { justCreated: true, previewDay: null, toast: `Trasplante · ${n} ${n === 1 ? 'planta' : 'plantas'}`, pendingUndo: null },
          )
          log('transplante', `Trasplantadas ${n} ${n === 1 ? 'planta' : 'plantas'}`)
        },

        // ---- editar los datos del cultivo tras crearlo ----
        updateGrow: ({ grow, potL, potType, substrate, seedType, tierraAbonada, nutrientesId: nutPedido }) => {
          const c = selectActive(get())
          if (!c.id) return
          const changes: string[] = []
          if (grow.trim() && grow.trim() !== c.grow) changes.push(`nombre «${grow.trim()}»`)
          if (potL !== c.potL) changes.push(`maceta ${potL} L`)
          if (potType && potType !== c.potType) changes.push(potType === 'tela' ? 'maceta de tela' : 'maceta de plástico')
          if (substrate !== c.substrate) changes.push(`sustrato ${substrate}`)
          if (tierraAbonada && tierraAbonada !== c.tierraAbonada) changes.push({ si: 'tierra abonada', no: 'tierra sin abono', nose: 'tierra abonada: no sé' }[tierraAbonada])
          // al pasar a coco o hidro no queda "solo agua" (ni una línea que no es de ese sustrato)
          const nutrientesId = nutrientesPara(nutPedido !== undefined ? nutPedido : c.nutrientesId, substrate)
          if (nutrientesId !== c.nutrientesId) changes.push(`abono: ${nombreAbono(nutrientesId)}`)
          // el tipo de semilla solo se corrige mientras no haya floración en marcha
          const seedEditable = !c.flowerTs && !c.harvestedTs
          if (seedEditable && seedType !== c.seedType) changes.push(seedType === 'auto' ? 'autofloreciente' : 'fotoperiódica')
          if (!changes.length) return
          // otra maceta u otro sustrato beben a otro ritmo: lo aprendido ya no vale
          const newRhythm = potL !== c.potL || (!!potType && potType !== c.potType) || substrate !== c.substrate
          // pasar a hidro o salir de hidro: las fechas del otro sistema no valen (en hidro no se riega;
          // fuera de hidro, la revisión del nivel no es un "aún pesa"). Arranque neutro, como al registrar:
          // sin avisos vencidos de algo que la app no sabe.
          const aHidro = substrate === 'hidro' && c.substrate !== 'hidro'
          const deHidro = substrate !== 'hidro' && c.substrate === 'hidro'
          patchActive(
            (g) => {
              const now = Date.now()
              const next = { ...g, grow: grow.trim() || g.grow, potL, potType: potType ?? g.potType, substrate, seedType: seedEditable ? seedType : g.seedType,
                nutrientesId, tierraAbonada: tierraAbonada ?? g.tierraAbonada, ...(newRhythm ? { waterSamples: [] } : {}) }
              const live = deriveLive(next) // cambiar el tipo puede recalcular la etapa
              const out = { ...next, ...live }
              if (aHidro && out.germTs) {
                out.lastSolutionTs = Math.max(g.lastSolutionTs ?? 0, neutralSolutionTs(out, now))
                out.lastCheckTs = Math.max(g.lastCheckTs ?? 0, neutralTs(out, now))
              }
              if (deHidro && out.germTs) {
                const n = neutralTs(out, now)
                if ((g.lastWaterTs ?? 0) < n) { out.lastWaterTs = n; out.lastWaterEstimated = true; out.waterBaseTs = null }
                out.lastCheckTs = null
                out.droopTs = null
              }
              return out
            },
            { toast: 'Cultivo actualizado', pendingUndo: null },
          )
          log('nota', 'Editado: ' + changes.join(' · '))
        },

        // ---- abono del cultivo: una línea del catálogo (el plan sale de su tabla), otra marca
        // (guiada por la EC) o solo agua (solo en tierra: en coco e hidro pasa a otra marca) ----
        setNutrientes: (raw) => {
          const c = selectActive(get())
          const id = nutrientesPara(raw, c.substrate)
          if (!c.id || (c.nutrientesId ?? null) === id) return
          const toast = lineaPorId(id) ? 'Línea de nutrientes guardada' : id === OTRA_MARCA ? 'Otra marca · te guiamos por la EC' : 'Riego solo con agua'
          patchActive((g) => ({ ...g, nutrientesId: id }), { toast, pendingUndo: null })
          log('nota', `Abono: ${nombreAbono(id)}`)
        },

        // ---- luz de la carpa (visual: la escena 3D pasa a noche) ----
        toggleLight: () => {
          const c = selectActive(get())
          patchActive((g) => ({ ...g, light: !g.light, lightOverrideUntil: nextLightChange(g) }), {
            toast: c.light ? 'Luz apagada · hasta el siguiente cambio del horario' : 'Luz encendida · hasta el siguiente cambio del horario',
            pendingUndo: null,
          })
        },

        // ---- horario de luz ----
        setLightSchedule: ({ lightOnHour, lightHours, hasController }) => {
          patchActive((g) => {
            const next = { ...g, lightOnHour, lightHours, hasController, lightOverrideUntil: null }
            return { ...next, light: scheduledLight(next) }
          }, { toast: 'Horario de luz guardado', pendingUndo: null })
          log('nota', `Luz: enciende ${String(lightOnHour).padStart(2, '0')}:00 · ${lightHours != null ? `${lightHours} h` : 'horas automáticas'}${hasController ? ' · con controlador' : ''}`)
        },
        // aviso de encender/apagar (solo sin controlador): toast si la app está a la vista,
        // notificación local si está en segundo plano (y el usuario activó los avisos)
        checkLightReminder: () => {
          const { grows, notifyEnabled } = get()
          const now = Date.now()
          for (const g of grows) {
            if (!g.germTs || g.harvestedTs || g.hasController) continue
            const prev = lightNotified.get(g.id) ?? 0
            const change = nextLightChange(g, new Date(now - 60000)) // el cambio de este último minuto, si lo hubo
            if (change > now || change <= prev) continue
            lightNotified.set(g.id, change)
            const on = scheduledLight(g)
            const body = `${g.grow} · ${on ? 'hora de encender la luz' : 'hora de apagar la luz'}`
            if (document.visibilityState === 'visible') { set({ toast: body, pendingUndo: null }); continue }
            if (!notifyEnabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') continue
            try {
              navigator.serviceWorker?.getRegistration()
                .then((r) => { const icon = import.meta.env.BASE_URL + 'pwa-192.png'; if (r) r.showNotification('zenpai', { body, icon, badge: icon }); else new Notification('zenpai', { body, icon }) })
                .catch(() => { try { new Notification('zenpai', { body }) } catch { /* sin soporte */ } })
            } catch { /* sin soporte */ }
          }
        },

        // ---- ninguna germinó: reiniciar el remojo con semillas nuevas ----
        resoak: () => {
          patchActive((g) =>({ ...g, soakTs: Date.now() }), { toast: 'Remojo reiniciado con semillas nuevas', pendingUndo: null })
          log('sembrado', 'Reinicio del remojo con semillas nuevas')
        },

        // ---- entrenamiento (LST / lollipop) en vegetativo ----
        applyTraining: (t) => {
          const nombre = { none: 'Entrenamiento quitado', lst: 'LST aplicado', lollipop: 'Lollipop aplicado', apical: 'Poda apical aplicada' }[t]
          patchActive((g) => ({ ...g, training: t }), { toast: nombre, pendingUndo: null })
          if (t !== 'none') log('entrenamiento', t === 'lst' ? 'Apliqué LST (low stress training)' : t === 'apical' ? 'Poda apical: corté la punta principal' : 'Apliqué lollipopping')
        },

        // ---- defoliación: se anota y la planta se ve más abierta unos días ----
        defoliate: () => {
          patchActive((g) => ({ ...g, defoliatedTs: Date.now() }), { toast: 'Defoliación anotada', pendingUndo: null })
          log('defoliacion', 'Quité hojas grandes para abrir la copa')
        },

        // ---- fotoperiódicas: el usuario cambió la luz a 12/12 → arranca la floración ----
        // Un horario elegido a mano en vegetativo (18 h, 20 h…) no vale en floración: vuelve a
        // automático, que ahora da 12 h. Si no, la app seguiría avisando de apagar horas tarde.
        // El horario cambia, así que el encendido/apagado manual se descarta (como al guardar un horario).
        startFlowering: () => {
          const c = selectActive(get())
          if (c.seedType !== 'foto' || c.flowerTs || c.stage !== 'veg') return
          const manual = c.lightHours != null && c.lightHours !== 12
          patchActive(
            (g) => {
              const next = { ...g, flowerTs: Date.now(), lightHours: null, lightOverrideUntil: null }
              const out = { ...next, ...deriveLive(next) }
              return { ...out, light: scheduledLight(out) }
            },
            { toast: manual ? 'A floración · horario en automático: 12 h de luz' : 'A floración · luz 12/12 anotada', pendingUndo: null },
          )
          log('floracion', manual ? `Cambié la luz a 12/12 · el horario de ${c.lightHours} h vuelve a automático (12 h)` : 'Cambié la luz a 12/12')
        },

        // ---- acciones del cultivo activo ----
        // entrar a preview limpia el toast (comparten franja superior) y su Deshacer;
        // salir NO toca la vista (si estabas en cenital, te quedas en cenital)
        setPreview: (d) => set(d === null ? { previewDay: null } : { previewDay: d, view: 'front', toast: null, pendingUndo: null }),

        // Riego. Lo normal llega desde la revisión ("pesa poco" / "está seca" → ficha → Regar).
        // El ritmo aprendido solo sale de esos riegos confirmados, a su hora y desde un riego
        // anterior con hora exacta: nunca de uno forzado (copiaría el exceso de riego) ni de uno
        // anotado después (su hora es aproximada). Un hueco de más de 10 días no mide cuánto tarda
        // la maceta en secarse (el cultivo quedó sin anotar): tampoco cuenta. Si "pesa poco" llega
        // en la primera revisión tras el riego (sin un "aún pesa" entre medias), la maceta pudo
        // secarse bastante antes: ese intervalo es un tope y se guarda acortado (×0.75). Si no, el
        // ritmo solo podría alargarse (los riegos suelen llegar con el aviso, nunca antes).
        // Un riego anotado después sustituye a un último riego estimado aunque sea de antes: la
        // próxima revisión cuenta desde él, como promete "Ya regué".
        water: (opts = {}) => {
          const { toast: toastOverride, force = false, confirmed = false, daysAgo } = opts
          const c = selectActive(get())
          if (!c.id || c.substrate === 'hidro') return // en hidro no se riega: se cuida el depósito
          const past = daysAgo != null
          const guard = force || past ? null : overwaterGuard(c)
          if (guard) { set({ toast: guard, pendingUndo: null }); return }
          const id = c.id
          const now = Date.now()
          const ts = past ? now - daysAgo * D : now
          // un riego anotado después no puede ser de antes del trasplante
          if (past && c.germTs && ts < c.germTs) return
          const day = c.germTs ? Math.max(0, Math.floor((ts - c.germTs) / D)) : c.day
          const h = c.waterBaseTs != null ? (ts - c.waterBaseTs) / 3600000 : null
          const primera = c.waterBaseTs != null && !(c.lastCheckTs != null && c.lastCheckTs > c.waterBaseTs)
          const sample: WaterSample | null = confirmed && !force && !past && h != null && h > 0 && h <= 240 ? { ts, h: primera ? h * 0.75 : h, stage: c.stage } : null
          const latest = ts >= (c.lastWaterTs ?? 0) || c.lastWaterEstimated
          const myToast = toastOverride ?? (past ? `Riego de ${['hoy', 'ayer', 'anteayer'][daysAgo] ?? `hace ${daysAgo} días`} anotado` : 'Riego anotado en la bitácora')
          const prev = { lastWaterTs: c.lastWaterTs, lastWaterEstimated: c.lastWaterEstimated, waterBaseTs: c.waterBaseTs, droopTs: c.droopTs, waterSamples: c.waterSamples, health: c.health }
          patchActive(
            (g) => ({
              ...g,
              lastWaterTs: latest ? ts : g.lastWaterTs,
              lastWaterEstimated: latest ? false : g.lastWaterEstimated,
              // base del ritmo = último riego con hora exacta; uno anotado después no la tiene
              waterBaseTs: latest ? (past ? null : ts) : g.waterBaseTs,
              // regar borra las hojas caídas anotadas antes de este riego (las fotos vuelven a sanas)
              droopTs: g.droopTs != null && g.droopTs > ts ? g.droopTs : null,
              waterSamples: sample ? [...g.waterSamples, sample].slice(-8) : g.waterSamples,
              health: past ? g.health : Math.min(99, g.health + 1),
            }),
            { toast: myToast, pendingUndo: null },
          )
          const note = past ? 'Riego anotado después'
            : force ? 'Riego · poco después del anterior'
            : confirmed ? (revisaConDedo(c) ? 'Riego · la tierra estaba seca' : 'Riego · la maceta pesaba poco')
            : undefined
          // el "Deshacer" del toast revierte el estado Y borra el evento de la bitácora.
          // Se arma solo si seguimos en el mismo cultivo Y el toast sigue siendo el de ESTA acción
          // (si otra acción ya puso el suyo, su toast no debe heredar este Deshacer).
          log('riego', note, undefined, { ts, day }).then((ev) => {
            if (get().activeId !== id || get().toast !== myToast) return
            set({
              pendingUndo: () => {
                set((st) => ({
                  grows: st.grows.map((g) => (g.id === id ? { ...g, ...prev } : g)),
                  events: ev?.id != null ? st.events.filter((e) => e.id !== ev.id) : st.events,
                }))
                if (ev?.id != null) deleteEvent(ev.id).catch(() => {})
              },
            })
          })
        },

        // revisó la maceta y aún pesa (plántula: la tierra sigue húmeda; hidro: el nivel está bien).
        // Queda en la bitácora y la siguiente revisión se aplaza: 24 h (hidro, 2–3 días).
        // afterDroop: hojas caídas con la maceta aún pesada = exceso de agua → "no riegues aún"
        checkPot: (afterDroop) => {
          const c = selectActive(get())
          if (!c.id) return
          const ts = Date.now()
          const next = nextCheckTs({ ...c, lastCheckTs: ts })
          const when = next ? whenText(next) : 'mañana'
          patchActive((g) => ({ ...g, lastCheckTs: ts }), { toast: afterDroop ? `No riegues aún · te avisamos ${when}` : `Anotado · te avisamos ${when}`, pendingUndo: null })
          log('revision', c.substrate === 'hidro' ? 'Revisé el depósito: el nivel está bien'
            : revisaConDedo(c) ? 'Revisé la tierra: aún está húmeda' : 'Revisé la maceta: aún pesa', undefined, { ts })
        },

        // hojas caídas: lo ve el usuario, no el reloj. Cambia la foto hasta el siguiente riego.
        // Sin toast: la hoja de revisión sigue con la pregunta (¿sed o exceso de agua?).
        reportDroop: () => {
          const c = selectActive(get())
          if (!c.id || c.substrate === 'hidro') return
          const ts = Date.now()
          patchActive((g) => ({ ...g, droopTs: ts }), { pendingUndo: null })
          log('caida', 'Las hojas se ven caídas', undefined, { ts })
        },

        // hidro: el nivel había bajado y lo rellenó → la siguiente revisión en 2–3 días
        refillReservoir: () => {
          const c = selectActive(get())
          if (!c.id || c.substrate !== 'hidro') return
          const ts = Date.now()
          const next = nextCheckTs({ ...c, lastCheckTs: ts })
          patchActive((g) => ({ ...g, lastCheckTs: ts }), { toast: `Depósito rellenado · te avisamos ${next ? whenText(next) : 'en 2–3 días'}`, pendingUndo: null })
          log('deposito', 'Rellené el depósito', undefined, { ts })
        },

        // hidro: solución nueva (cada 7–10 días); también reinicia la revisión del nivel
        changeSolution: () => {
          const c = selectActive(get())
          if (!c.id || c.substrate !== 'hidro') return
          const ts = Date.now()
          patchActive((g) => ({ ...g, lastSolutionTs: ts }), { toast: 'Solución nueva anotada en la bitácora', pendingUndo: null })
          log('solucion', 'Cambié la solución del depósito', undefined, { ts })
        },

        markWetTip: () => patchActive((g) => ({ ...g, wetTipDone: true })),

        // demo (solo DEV): toca revisar y las hojas se ven caídas (anotado como si lo viera el
        // usuario), para ver la foto de plantas caídas y la revisión sin esperar días
        wilt: () => {
          const c = selectActive(get())
          if (c.stage !== 'veg' || c.substrate === 'hidro') return
          const ts = Date.now()
          const iv = checkIntervalH(c) ?? 60
          patchActive(
            (g) => ({ ...g, lastWaterTs: ts - (iv + 1) * 3600000, lastWaterEstimated: true, waterBaseTs: null, lastCheckTs: null, droopTs: ts }),
            { toast: 'Prueba: toca revisar y las hojas se ven caídas', pendingUndo: null },
          )
          log('caida', 'Las hojas se ven caídas (prueba)', undefined, { ts })
        },

        harvest: () => {
          const id = selectActive(get()).id
          const myToast = '¡Cosechado! A secar 7–14 días y luego curar'
          patchActive(
            (g) => ({ ...g, harvestedTs: Date.now(), stage: 'secando' }),
            { previewDay: null, toast: myToast, pendingUndo: null },
          )
          log('cosecha').then((ev) => {
            if (get().activeId !== id || get().toast !== myToast) return
            set({
              pendingUndo: () => {
                set((st) => ({
                  grows: st.grows.map((g) => {
                    if (g.id !== id) return g
                    const n = { ...g, harvestedTs: null }
                    const live = deriveLive(n)
                    return { ...n, day: live.day, stage: live.stage }
                  }),
                  events: ev?.id != null ? st.events.filter((e) => e.id !== ev.id) : st.events,
                }))
                if (ev?.id != null) deleteEvent(ev.id).catch(() => {})
              },
            })
          })
        },

        // ---- cierre del ciclo tras el secado: el cultivo pasa al archivo con su resumen ----
        finishGrow: (dryWeight, note) => {
          const c = selectActive(get())
          if (c.stage !== 'secando' || c.finishedTs) return
          patchActive(
            (g) => ({ ...g, finishedTs: Date.now(), dryWeight: dryWeight ?? null }),
            { toast: 'Cultivo terminado · su bitácora queda guardada', pendingUndo: null },
          )
          const parts = [dryWeight ? `Peso seco: ${dryWeight} g` : null, note?.trim() || null].filter(Boolean)
          log('terminado', parts.length ? parts.join(' · ') : undefined)
        },

        // lecturas que escribió el usuario (nunca un número puesto por la app). La temperatura y
        // la humedad salen del mismo medidor y pueden llegar juntas: cada valor deja su propio
        // evento en la bitácora, con un solo aviso para todas.
        measure: (values) => {
          const keys = (Object.keys(values) as MetricKey[]).filter((k) => Number.isFinite(values[k]))
          if (!keys.length) return
          const c = selectActive(get())
          const toast = keys.length === 1 ? `${metricDef(keys[0]).label} anotado en la bitácora`
            : keys.every((k) => k === 'temp' || k === 'hr') ? 'Temperatura y humedad anotadas en la bitácora'
            : 'Lecturas anotadas en la bitácora'
          patchActive(
            (g) => ({
              ...g,
              readings: { ...g.readings, ...Object.fromEntries(keys.map((k) => [k, values[k]])) },
              readingDays: { ...g.readingDays, ...Object.fromEntries(keys.map((k) => [k, g.day])) },
            }),
            { toast, pendingUndo: null },
          )
          // se juzga contra el objetivo de HOY (la EC de un día de solo agua no tiene objetivo:
          // se anota sin veredicto)
          const guide = get().guide
          for (const key of keys) {
            const value = values[key]!
            const def = metricDef(key)
            const range = targetHoy(key, c, guide)
            const { status } = evalRange(key, value, range)
            const word = !range ? null : status === 'ok' ? 'en rango' : status === 'warn' ? 'al límite' : 'fuera de rango'
            const u = def.unit ? ' ' + def.unit : ''
            const shown = def.dec ? value.toFixed(def.dec) : Math.round(value).toString()
            log('medicion', `${def.label} ${shown}${u}${word ? ` · ${word}` : ''}`, undefined, { metric: key, value })
          }
        },

        setGenetics: ({ strain, breeder, flowerWeeks, autoWeeks }) => {
          const c = selectActive(get())
          if (!c.id) return
          const s2 = strain?.trim() || null
          const b2 = breeder?.trim() || null
          if (s2 === c.strain && b2 === c.breeder && flowerWeeks === c.flowerWeeks && autoWeeks === c.autoWeeks) return
          patchActive((g) => {
            const next = { ...g, strain: s2, breeder: b2, flowerWeeks, autoWeeks }
            return { ...next, ...deriveLive(next) } // las semanas pueden mover la etapa
          }, { toast: 'Genética guardada', pendingUndo: null })
          const w = c.seedType === 'auto' ? (autoWeeks ? `${autoWeeks} semanas de ciclo` : null) : (flowerWeeks ? `${flowerWeeks} semanas de flor` : null)
          log('nota', ['Genética:', s2 ?? 'sin nombre', b2 ? `(${b2})` : null, w ? `· ${w}` : null].filter(Boolean).join(' '))
        },

        setEquipment: (eq, tentCm) => {
          const c = selectActive(get())
          if (!c.id) return
          const clean: Equipment = {}
          for (const k of ['luz', 'aire', 'ctrl', 'vent'] as const) { const v = eq[k]?.trim(); if (v) clean[k] = v }
          patchActive((g) => ({
            ...g,
            equipment: clean,
            tentCm: tentCm === undefined ? g.tentCm : tentCm,
            // un controlador que gobierna la luz sustituye a los avisos de encendido/apagado
            hasController: equipoPorId(clean.ctrl)?.controlaLuz ? true : g.hasController,
          }), { toast: 'Equipo guardado', pendingUndo: null })
        },

        addDiagnosis: (blob, summary) => {
          const c = selectActive(get())
          if (!c.id) return
          dbAddPhoto({ growId: c.id, ts: Date.now(), blob })
            .then(async (pid) => {
              const ev = await log('diagnostico', summary, pid).catch(() => null)
              if (!ev) deletePhoto(pid).catch(() => {})
              else set({ toast: 'Diagnóstico guardado en la bitácora', pendingUndo: null })
            })
            .catch(() => set({ toast: 'No se pudo guardar el diagnóstico', pendingUndo: null }))
        },

        // sin Premium no hay respaldo en la nube; el toast solo se ve dentro de una carpa
        setPremium: (v) => set({
          premium: v,
          ...(v ? {} : { cloudOn: false }),
          toast: get().activeId ? (v ? 'Premium de prueba activado' : 'Premium desactivado') : null,
          pendingUndo: null,
        }),

        setGuide: (g) => set({ guide: g }),
        completeOnboarding: (g) => set({ guide: g, onboarded: true }),
        markFirstWaterTip: () => set({ firstWaterTipDone: true }),
        markFirstGermTip: () => set({ firstGermTipDone: true }),
        markCoachDone: () => set({ coachDone: true }),
        setNotify: (v) => set({ notifyEnabled: v }),

        // recordatorio local de revisar la maceta (o el depósito): máx 1/día, solo con permiso
        // concedido y la app fuera de pantalla (visible ya lo estás viendo). Sin push server (F4):
        // funciona mientras zenpai esté abierta o en segundo plano.
        checkWaterReminder: () => {
          const { notifyEnabled, lastNotifiedDay, grows } = get()
          if (!notifyEnabled) return
          if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
          if (document.visibilityState === 'visible') return
          const today = new Date().toDateString()
          if (lastNotifiedDay === today) return
          const g = grows.find((x) => needsAttention(x))
          if (!g) return
          set({ lastNotifiedDay: today })
          const title = 'zenpai'
          const t = attentionText(g)
          const body = `${g.grow} · día ${g.day} · ${t.charAt(0).toLowerCase()}${t.slice(1)}`
          try {
            navigator.serviceWorker?.getRegistration()
              .then((r) => { const icon = import.meta.env.BASE_URL + 'pwa-192.png'; if (r) r.showNotification(title, { body, icon, badge: icon }); else new Notification(title, { body, icon }) })
              .catch(() => { try { new Notification(title, { body }) } catch { /* sin soporte */ } })
          } catch { /* sin soporte */ }
        },

        runUndo: () => {
          const u = get().pendingUndo
          set({ pendingUndo: null, toast: u ? 'Deshecho': null })
          if (u) u()
        },

        // sin toast: se guarda desde la hoja de Bitácora (z superior al toast) y la fila
        // nueva apareciendo en la lista ya es el feedback
        addNote: (text) => {
          const t = text.trim()
          if (!t) return
          log('nota', t)
        },

        // foto ya comprimida y sin EXIF (ver img.ts) → tabla photos + evento en la bitácora.
        // Si el evento no llega a escribirse, el blob se limpia: nada de fotos huérfanas.
        addPhoto: (blob) => {
          const c = selectActive(get())
          if (!c.id) return
          dbAddPhoto({ growId: c.id, ts: Date.now(), blob })
            .then(async (pid) => {
              const ev = await log('foto', undefined, pid).catch(() => null)
              if (!ev) deletePhoto(pid).catch(() => {})
            })
            .catch(() =>set({ toast: 'No se pudo guardar la foto', pendingUndo: null }))
        },

        removeEvent: (evId) => {
          const ev = get().events.find((e) => e.id === evId)
          if (!ev) return
          deleteEvent(evId).catch(() => {})
          if ((ev.type === 'foto' || ev.type === 'diagnostico') && ev.photoId != null) deletePhoto(ev.photoId).catch(() => {})
          const rest = get().events.filter((e) => e.id !== evId)
          set({ events: rest })
          // el estado del cultivo que salía de ese registro vuelve al anterior
          const latestOf = (types: EventType[]) => rest.reduce<number | null>((m, e) => (types.includes(e.type) && (m === null || e.ts > m) ? e.ts : m), null)
          let fix: ((g: Cultivo) => Partial<Cultivo>) | null = null
          if (ev.type === 'riego') {
            // los intervalos del ritmo que dependían de ese riego (el suyo y el del riego siguiente) ya no valen
            const nextW = rest.filter((e) => e.type === 'riego' && e.ts > ev.ts).reduce<number | null>((m, e) => (m === null || e.ts < m ? e.ts : m), null)
            const samplesFix = (g: Cultivo) => g.waterSamples.filter((w) => w.ts !== ev.ts && w.ts !== nextW)
            // si borró el riego más reciente, retrocede lastWaterTs al anterior:
            // así el guardarraíl de sobre-riego no queda armado por un registro erróneo.
            // Sin riego anterior NO se deja null a secas (la revisión contaría desde germTs y
            // avisaría de golpe): arranque neutro, como registerExisting, marcado como estimado.
            // La base del ritmo se pierde (no sabemos si el anterior tenía hora exacta): el
            // siguiente riego la fija.
            if (nextW === null) {
              const prevW = latestOf(['riego'])
              fix = (g) => {
                const floor = g.germTs ? neutralTs(g) : null
                return { lastWaterTs: prevW ?? floor, lastWaterEstimated: prevW == null && floor != null, waterBaseTs: null, waterSamples: samplesFix(g) }
              }
            } else fix = (g) => ({ waterSamples: samplesFix(g) })
          } else if (ev.type === 'revision' || ev.type === 'deposito') {
            fix = (g) => (g.lastCheckTs === ev.ts ? { lastCheckTs: latestOf(['revision', 'deposito']) } : {})
          } else if (ev.type === 'caida') {
            fix = (g) => (g.droopTs === ev.ts ? { droopTs: latestOf(['caida']) } : {})
          } else if (ev.type === 'solucion') {
            fix = (g) => (g.lastSolutionTs === ev.ts ? { lastSolutionTs: latestOf(['solucion']) } : {})
          }
          if (fix) {
            const f = fix
            set((st) => ({ grows: st.grows.map((g) => (g.id === ev.growId ? { ...g, ...f(g) } : g)) }))
          }
        },

        setView: (v) => set({ view: v }),
        // cualquier toast puesto "a mano" desarma el Deshacer pendiente: un aviso nuevo
        // (p.ej. el guardarraíl) nunca debe heredar el botón de una acción anterior
        setToast: (t) => set({ toast: t, pendingUndo: null }),

        // mantiene day/stage de TODOS los cultivos sincronizados con el reloj real
        // (la revisión de la maceta se calcula al pintar: nextCheckTs no necesita caché)
        recomputeTime: () => {
          const grows = get().grows
          let changed = false
          const now = Date.now()
          const next = grows.map((g) => {
            if (!g.germTs) return g
            const live = deriveLive(g)
            let out = g
            if (live.day !== g.day || live.stage !== g.stage) { changed = true; out = { ...g, ...live } }
            // luz según horario, salvo apagado/encendido manual vigente
            if (!g.harvestedTs) {
              const override = g.lightOverrideUntil != null && g.lightOverrideUntil > now
              const light = override ? g.light : scheduledLight(out)
              if (light !== g.light || (!override && g.lightOverrideUntil != null)) { changed = true; out = { ...out, light, lightOverrideUntil: override ? g.lightOverrideUntil : null } }
            }
            return out
          })
          if (changed) set({ grows: next })
        },

        acceptConsent: () => set({ consentV: CONSENT_VERSION }),

        // ---- datos de ejemplo: la app llena en un toque, para explorar (demo/socios) ----
        // Cuatro cultivos en momentos distintos del ciclo, con bitácoras verosímiles
        // retrodatadas. Son cultivos normales: se abren, se tocan y se eliminan igual.
        seedDemo: async () => {
          if (get().grows.some((g) => g.grow.startsWith('Demo · '))) {
            set({ toast: 'Los datos de ejemplo ya están en tu lista', pendingUndo: null })
            return
          }
          const now = Date.now()
          const D = 86400000
          const mk = (p: Partial<Cultivo>): Cultivo => {
            const c = { ...emptyCultivo, id: genId(), ...p }
            return { ...c, ...deriveLive(c) }
          }
          // riego por revisión: los riegos confirmados con "pesa poco" dejan su intervalo (ts = el del
          // evento de riego); con 3 en vegetativo, la demo ya muestra el ritmo aprendido (~3 días)
          // abono: la plántula en tierra abonada (solo agua unas 3 semanas desde el trasplante), el
          // vegetativo en tierra sin abono con su marca y la floración en coco con su tabla repartida
          const g1 = mk({ grow: 'Demo · Plántula', plants: 2, pots: 2, potL: 7, substrate: 'tierra', seedType: 'foto', soakTs: now - 5 * D, germTs: now - 3 * D, lastWaterTs: now - 1 * D,
            nutrientesId: 'biobizz', tierraAbonada: 'si',
            waterBaseTs: now - 1 * D, waterSamples: [{ ts: now - 1 * D, h: 48, stage: 'plantula' }] })
          const g2 = mk({ grow: 'Demo · Vegetativo', plants: 3, pots: 3, potL: 11, substrate: 'tierra', seedType: 'foto', training: 'lst', soakTs: now - 30 * D, germTs: now - 28 * D, lastWaterTs: now - 2 * D, readings: { temp: 25, hr: 62, ph: 6.5 }, readingDays: { temp: 27, hr: 27, ph: 27 },
            nutrientesId: 'canna-terra', tierraAbonada: 'no',
            waterBaseTs: now - 2 * D, lastCheckTs: now - 3 * D, wetTipDone: true,
            waterSamples: [{ ts: now - 8 * D, h: 72, stage: 'veg' }, { ts: now - 5 * D, h: 72, stage: 'veg' }, { ts: now - 2 * D, h: 72, stage: 'veg' }] })
          const g3 = mk({ grow: 'Demo · Floración', plants: 3, pots: 3, potL: 19, substrate: 'coco', seedType: 'foto', soakTs: now - 63 * D, germTs: now - 61 * D, flowerTs: now - 21 * D, lastWaterTs: now - 1 * D, readings: { ph: 5.9, hr: 48 }, readingDays: { ph: 55, hr: 58 },
            nutrientesId: 'canna-coco' })
          const g4 = mk({ grow: 'Demo · Terminado', plants: 2, pots: 2, potL: 11, substrate: 'tierra', seedType: 'auto', soakTs: now - 100 * D, germTs: now - 98 * D, harvestedTs: now - 20 * D, finishedTs: now - 6 * D, dryWeight: 85,
            tierraAbonada: 'si' })
          const evs: GrowEvent[] = []
          const ev = (growId: string, daysAgo: number, day: number, type: EventType, note?: string) =>
            evs.push({ growId, ts: now - daysAgo * D, day, type, note })
          // plántula: recién arranca
          ev(g1.id, 5, 0, 'sembrado', '2 semillas en remojo')
          ev(g1.id, 3, 0, 'transplante', 'Trasplantadas 2 plantas')
          ev(g1.id, 1, 2, 'riego', 'Riego · la tierra estaba seca')
          // veg: rutina de revisar la maceta + LST + mediciones
          ev(g2.id, 30, 0, 'sembrado', '3 semillas en remojo')
          ev(g2.id, 28, 0, 'transplante', 'Trasplantadas 3 plantas')
          ev(g2.id, 24, 4, 'riego')
          ev(g2.id, 20, 8, 'riego')
          ev(g2.id, 16, 12, 'medicion', 'pH 6.5 · en rango')
          ev(g2.id, 15, 13, 'riego')
          ev(g2.id, 11, 17, 'riego')
          ev(g2.id, 10, 18, 'entrenamiento', 'Apliqué LST (low stress training)')
          ev(g2.id, 8, 20, 'riego', 'Riego · la maceta pesaba poco')
          ev(g2.id, 8, 20, 'nota', 'Las cuatro ramas ya van en horizontal, la copa se abre bien')
          ev(g2.id, 5, 23, 'riego', 'Riego · la maceta pesaba poco')
          ev(g2.id, 3, 25, 'revision', 'Revisé la maceta: aún pesa')
          ev(g2.id, 2, 26, 'riego', 'Riego · la maceta pesaba poco')
          ev(g2.id, 1, 27, 'medicion', 'Temp 25 °C · en rango')
          // flor: cambio de luz + rutina
          ev(g3.id, 63, 0, 'sembrado', '3 semillas en remojo')
          ev(g3.id, 61, 0, 'transplante', 'Trasplantadas 3 plantas')
          ev(g3.id, 40, 21, 'nota', 'Huelen increíble al abrir la carpa')
          ev(g3.id, 21, 40, 'floracion', 'Cambié la luz a 12/12')
          ev(g3.id, 14, 47, 'riego')
          ev(g3.id, 7, 54, 'medicion', 'pH 5.9 · en rango')
          ev(g3.id, 3, 58, 'medicion', 'HR 48% · en rango')
          ev(g3.id, 1, 60, 'riego')
          // terminado: ciclo completo cerrado
          ev(g4.id, 100, 0, 'sembrado', '2 semillas en remojo')
          ev(g4.id, 98, 0, 'transplante', 'Trasplantadas 2 plantas')
          ev(g4.id, 66, 32, 'nota', 'Autofloreciente: arrancó la flor sola, puntual')
          ev(g4.id, 20, 78, 'cosecha')
          ev(g4.id, 6, 92, 'terminado', 'Peso seco: 85 g · Buen primer ciclo, el próximo con más ventilación')
          await addEventsBulk(evs).catch(() => {})
          set((st) => ({
            grows: [...st.grows, g1, g2, g3, g4],
            toast: 'Cuatro cultivos de ejemplo listos — ábrelos y tócalo todo',
            pendingUndo: null,
          }))
        },

        // ---- datos y privacidad ----
        // El respaldo se arma como Blob incremental (ver db.exportBlob): con muchas fotos,
        // el pico de memoria es ~1 foto, no la bitácora entera.
        exportBackup: async () => {
          const { grows, guide } = get()
          return exportBlob({
            app: 'zenpai',
            schema: 1,
            exportedAt: new Date().toISOString(),
            guide,
            grows,
          })
        },

        // REEMPLAZA todo el contenido por el respaldo (con confirmación previa en la UI).
        // Un JSON con el "sobre" correcto pero contenido corrupto NO debe importarse "con
        // éxito": cada campo se sanea (números finitos o null/valores por defecto) — nada
        // de Día NaN persistido ni bitácoras vaciadas en silencio.
        importBackup: async (data) => {
          const d = data as { app?: string; schema?: number; grows?: unknown; events?: unknown; photos?: unknown; guide?: string }
          if (!d || d.app !== 'zenpai' || !Array.isArray(d.grows)) return 'Ese archivo no es un respaldo de zenpai.'
          if ((d.schema ?? 1) > 1) return 'El respaldo es de una versión más nueva de zenpai. Actualiza la app.'
          if ((d.events !== undefined && !Array.isArray(d.events)) || (d.photos !== undefined && !Array.isArray(d.photos))) {
            return 'No se pudo leer el respaldo. ¿El archivo está completo?'
          }
          try {
            const raw = d.grows as unknown[]
            const grows = sanitizeGrows(raw)
            if (raw.length > 0 && grows.length === 0) return 'El respaldo no contiene cultivos legibles.'
            const events = ((d.events as unknown[]) ?? []).filter((e): e is GrowEvent => {
              const x = e as Record<string, unknown> | null
              return !!x && typeof x.growId === 'string' && typeof x.type === 'string' && typeof x.ts === 'number' && Number.isFinite(x.ts)
            })
            const photos = ((d.photos as unknown[]) ?? []).filter((p): p is PhotoBackup => {
              const x = p as Record<string, unknown> | null
              return !!x && typeof x.growId === 'string' && typeof x.b64 === 'string' && x.b64.length > 0
            })
            await importAll(events, photos)
            const gv = d.guide as Guide
            set({
              grows,
              guide: ['novato', 'medio', 'avanzado'].includes(gv) ? gv : get().guide,
              activeId: null,
              creating: false,
              events: [],
              previewDay: null,
              toast: 'Respaldo importado',
              pendingUndo: null,
            })
            get().recomputeTime()
            return null
          } catch {
            return 'No se pudo leer el respaldo. ¿El archivo está completo?'
          }
        },

        // borrar TODO y volver al inicio (edad + onboarding otra vez).
        // Cierra también la sesión de nube: la copia remota NO se toca (por si era
        // el único respaldo), pero este dispositivo queda desvinculado.
        wipeAll: async () => {
          await cloudSignOut()
          await wipeDatabase()
          location.reload()
        },

        // ---- respaldo en la nube ----
        // Al activar: local CON datos → subir; local VACÍO y nube con copia → restaurar.
        // (Con local vacío jamás se barre la nube: es el orden que no pierde nada.)
        enableCloud: async () => {
          if (get().cloudBusy) return
          set({ cloudBusy: true, cloudError: null })
          const authErr = await cloudSignIn()
          if (authErr) { set({ cloudBusy: false, cloudError: authErr }); return }
          const { grows } = get()
          if (grows.length === 0 && (await cloudHasData())) {
            const pulled = await cloudPull()
            if (typeof pulled === 'string') { set({ cloudBusy: false, cloudError: pulled }); return }
            const clean = sanitizeGrows(pulled.grows)
            await importAllRaw(pulled.events, pulled.photos)
            set({
              grows: clean,
              activeId: null,
              events: [],
              cloudOn: true,
              cloudBusy: false,
              lastCloudSyncTs: Date.now(),
              toast: 'Copia restaurada desde la nube',
              pendingUndo: null,
            })
            get().recomputeTime()
            return
          }
          const pushErr = await cloudPush(grows)
          set({
            cloudOn: pushErr === null,
            cloudBusy: false,
            cloudError: pushErr,
            lastCloudSyncTs: pushErr === null ? Date.now() : get().lastCloudSyncTs,
          })
        },

        // desactivar PAUSA la sincronización; la sesión anónima se conserva
        // (cerrar sesión la perdería para siempre — es anónima) y la copia queda arriba
        disableCloud: () => set({ cloudOn: false, cloudError: null }),

        syncCloudNow: async (auto) => {
          const { cloudOn, cloudBusy, grows } = get()
          if (!cloudOn || cloudBusy) return
          if (auto && typeof navigator !== 'undefined' && navigator.onLine === false) return
          set({ cloudBusy: true, ...(auto ? {} : { cloudError: null }) })
          const err = await cloudPush(grows)
          set({
            cloudBusy: false,
            cloudError: err,
            lastCloudSyncTs: err === null ? Date.now() : get().lastCloudSyncTs,
          })
        },

        hydrate: () => {
          set({ ready: true })
          get().recomputeTime()
          // barrer eventos de cultivos ya borrados (basura tras fallos de borrado)
          pruneEvents(get().grows.map((g) => g.id))
          const id = get().activeId
          if (id) listEvents(id).then((evs) => { if (get().activeId === id) set({ events: evs }) })
        },
      }
    },
    {
      name: 'zenpai-cultivo',
      storage: createJSONStorage(() => dexieStorage),
      // activeId NO se persiste: al recargar se aterriza en "Mis cultivos" (primero eliges)
      partialize: (s) => ({ grows: s.grows, consentV: s.consentV, view: s.view, guide: s.guide, onboarded: s.onboarded, firstWaterTipDone: s.firstWaterTipDone, firstGermTipDone: s.firstGermTipDone, coachDone: s.coachDone, notifyEnabled: s.notifyEnabled, lastNotifiedDay: s.lastNotifiedDay, cloudOn: s.cloudOn, lastCloudSyncTs: s.lastCloudSyncTs, premium: s.premium }) as any,
      // rellena campos nuevos y migra del modelo de cultivo único → lista
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as any
        const raw: any[] = Array.isArray(p.grows) ? p.grows : (p.hasGrow && p.c ? [p.c] : [])
        const grows: Cultivo[] = raw.map((g) => {
          const c: Cultivo = { ...emptyCultivo, ...g, id: g.id || genId() }
          // 'secando'SOLO lo pone harvest() manual → derivar harvestedTs si falta (blob viejo).
          // OJO: 'cosecha' es etapa VIVA derivada por tiempo (day>=105), NO implica cosecha → no tocar.
          if (!c.harvestedTs && c.stage === 'secando') {
            c.harvestedTs = c.germTs ? c.germTs + (c.day || 0) * 86400000 : Date.now()
          }
          // MIGRACIÓN fotoperiodo: los blobs previos no tienen flowerTs. Una foto vieja que ya
          // iba en flor/cosecha por la curva típica (día>=46) NO debe retroceder a veg.
          // Se asume 12/12 en el día 45: así cosecha cae en fd+60 = 105, idéntico a la curva
          // vieja (con 46 habría un día de desfase y un cultivo en día 105 perdería Cosechar).
          if (c.seedType === 'foto' && !c.flowerTs && c.germTs && realDay(c.germTs) >= 46) {
            c.flowerTs = c.germTs + 45 * 86400000
          }
          // riego por revisión: campos nuevos con valores seguros; la vieja "sed" del reloj se va
          Object.assign(c, wateringFields(g, c))
          delete (c as Cultivo & { thirst?: number }).thirst
          // MIGRACIÓN sed derivada: un cultivo vivo sin lastWaterTs (pre-P2 el transplante no
          // lo fijaba y quizá nunca usó el botón de regar) despertaría con avisos falsos contando
          // desde germTs. Mismo arranque neutro que registerExisting, marcado como estimado:
          // el primer riego real lo sincroniza.
          if (!c.harvestedTs && c.germTs && c.lastWaterTs == null) {
            c.lastWaterTs = neutralTs(c)
            c.lastWaterEstimated = true
          }
          // abono seguro: tierra abonada y, en coco e hidro, nada de "solo agua". Los datos de antes
          // de la pregunta de la tierra se migran con lo que ya hacían (ver abonoFields)
          Object.assign(c, abonoFields(g, c))
          if (!c.equipment || typeof c.equipment !== 'object') c.equipment = {}
          if (!c.readings) c.readings = {}
          if (!c.readingDays) c.readingDays = {}
          return c
        })
        // nivel de experiencia global: migra valores viejos (guiado/pro) → novato/avanzado
        const gv = p.guide as string
        const guide: Guide = gv === 'guiado' ? 'novato' : gv === 'pro' ? 'avanzado' : (['novato', 'medio', 'avanzado'].includes(gv) ? gv as Guide : 'novato')
        return { ...current, ...p, grows, guide, onboarded: !!p.onboarded, activeId: null, creating: false, justCreated: false }
      },
      // si el blob guardado es ilegible: NO continuar como si no hubiera datos (evita pisarlo y perder todo)
      onRehydrateStorage: () => (_state, error) => {
        if (error) useStore.setState({ ready: true, loadError: true })
        else useStore.getState().hydrate()
      },
    },
  ),
)
