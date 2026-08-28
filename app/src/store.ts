import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  dexieStorage, addEvent, listEvents, deleteEvents, deleteEvent, pruneEvents,
  addPhoto as dbAddPhoto, deletePhoto, deletePhotos,
  exportBlob, importAll, importAllRaw, wipeDatabase, type PhotoBackup,
} from './db'
import { cloudSignIn, cloudSignOut, cloudHasData, cloudPush, cloudPull } from './sync'
import {
  emptyCultivo, deriveLive, realDay, CONSENT_VERSION,
  type Cultivo, type Substrate, type SeedType, type GrowEvent, type EventType, type MetricKey, type Training, type Guide,
} from './lib'
import { overwaterGuard, needsAttention, metricDef, evalMetric } from './mentor'

type View = 'front' | 'cenital'

function genId(): string {
  return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
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
      training: o.training === 'lst' || o.training === 'lollipop' ? o.training : 'none',
      readings: o.readings && typeof o.readings === 'object' && !Array.isArray(o.readings) ? (o.readings as Cultivo['readings']) : {},
      readingDays: o.readingDays && typeof o.readingDays === 'object' && !Array.isArray(o.readingDays) ? (o.readingDays as Cultivo['readingDays']) : {},
      day: 0, stage: 'remojo', thirst: 0.2,
      health: num(o.health) ?? emptyCultivo.health,
      light: true, fan: true, exhaust: true,
    }
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
  openGrow: (id: string) => void
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
  createGrow: (cfg: { grow: string; plants: number; substrate: Substrate; potL: number; seedType: SeedType }) => void
  registerExisting: (cfg: { grow: string; plants: number; substrate: Substrate; potL: number; seedType: SeedType; weeksAgo: number; flowerWeeksAgo: number | null }) => void
  transplant: (count: number) => void
  resoak: () => void
  updateGrow: (cfg: { grow: string; potL: number; substrate: Substrate; seedType: SeedType }) => void
  applyTraining: (t: Training) => void
  startFlowering: () => void
  setPreview: (d: number | null) => void
  water: (toastOverride?: string, force?: boolean) => void
  wilt: () => void
  harvest: () => void
  finishGrow: (dryWeight: number | null, note?: string) => void
  measure: (key: MetricKey, value: number) => void

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
}

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
      async function log(type: EventType, note?: string, photoId?: number): Promise<GrowEvent | null> {
        const c = selectActive(get())
        if (!c.id) return null
        const ev = await addEvent({ growId: c.id, ts: Date.now(), day: c.day, type, note, photoId })
        set((st) => ({ events: [...st.events, ev] }))
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
        notifyEnabled: false,
        lastNotifiedDay: null,
        cloudOn: false,
        cloudBusy: false,
        cloudError: null,
        lastCloudSyncTs: null,

        // ---- navegación ----
        // OJO: toast y pendingUndo se limpian SIEMPRE al navegar — un "Deshacer" armado
        // en un cultivo no debe reaparecer (ni ejecutarse) sobre otro.
        startNew: () => set({ creating: true, previewDay: null, toast: null, pendingUndo: null }),
        cancelNew: () => set({ creating: false }),
        goHome: () => set({ activeId: null, creating: false, previewDay: null, events: [], toast: null, pendingUndo: null }),

        openGrow: (id) => {
          set({ activeId: id, creating: false, justCreated: false, previewDay: null, view: 'front', events: [], toast: null, pendingUndo: null })
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
        createGrow: ({ grow, plants, substrate, potL, seedType }) => {
          const base: Cultivo = {
            ...emptyCultivo,
            id: genId(),
            grow: grow || 'Carpa A',
            plants,
            pots: Math.min(plants, 3),
            potL,
            substrate,
            seedType,
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
        registerExisting: ({ grow, plants, substrate, potL, seedType, weeksAgo, flowerWeeksAgo }) => {
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
            soakTs: germTs - 2 * 86400000,
            germTs,
            flowerTs: seedType === 'foto' && flowerWeeksAgo != null ? now - flowerWeeksAgo * 7 * 86400000 : null,
            // arranque neutro del reloj de riego: asumimos ~día y medio desde el último riego
            // (sin falsa alarma de atraso; el primer riego real lo sincroniza)
            lastWaterTs: now - 36 * 3600000,
          }
          const live = deriveLive(base)
          const c = { ...base, ...live }
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
              const next = { ...g, plants: n, pots: Math.min(n, 3), germTs: Date.now(), lastWaterTs: Date.now() }
              const live = deriveLive(next)
              return { ...next, ...live }
            },
            { justCreated: true, previewDay: null, toast: `🪴 Transplante · ${n} ${n === 1 ? 'planta' : 'plantas'}`, pendingUndo: null },
          )
          log('transplante', `Transplantadas ${n} ${n === 1 ? 'planta' : 'plantas'}`)
        },

        // ---- editar los datos del cultivo tras crearlo ----
        updateGrow: ({ grow, potL, substrate, seedType }) => {
          const c = selectActive(get())
          if (!c.id) return
          const changes: string[] = []
          if (grow.trim() && grow.trim() !== c.grow) changes.push(`nombre «${grow.trim()}»`)
          if (potL !== c.potL) changes.push(`maceta ${potL} L`)
          if (substrate !== c.substrate) changes.push(`sustrato ${substrate}`)
          // el tipo de semilla solo se corrige mientras no haya floración en marcha
          const seedEditable = !c.flowerTs && !c.harvestedTs
          if (seedEditable && seedType !== c.seedType) changes.push(seedType === 'auto' ? 'autofloreciente' : 'fotoperiódica')
          if (!changes.length) return
          patchActive(
            (g) => {
              const next = { ...g, grow: grow.trim() || g.grow, potL, substrate, seedType: seedEditable ? seedType : g.seedType }
              const live = deriveLive(next) // cambiar el tipo puede recalcular la etapa
              return { ...next, ...live }
            },
            { toast: '✏️ Cultivo actualizado', pendingUndo: null },
          )
          log('nota', 'Editado: ' + changes.join(' · '))
        },

        // ---- ninguna germinó: reiniciar el remojo con semillas nuevas ----
        resoak: () => {
          patchActive((g) => ({ ...g, soakTs: Date.now() }), { toast: '🫘 Remojo reiniciado con semillas nuevas', pendingUndo: null })
          log('sembrado', 'Reinicio del remojo con semillas nuevas')
        },

        // ---- entrenamiento (LST / lollipop) en vegetativo ----
        applyTraining: (t) => {
          patchActive((g) => ({ ...g, training: t }), {
            toast: t === 'none' ? '✂️ Entrenamiento quitado' : t === 'lst' ? '✂️ LST aplicado' : '✂️ Lollipop aplicado',
            pendingUndo: null,
          })
          if (t !== 'none') log('entrenamiento', t === 'lst' ? 'Apliqué LST (low stress training)' : 'Apliqué lollipopping')
        },

        // ---- fotoperiódicas: el usuario cambió la luz a 12/12 → arranca la floración ----
        startFlowering: () => {
          const c = selectActive(get())
          if (c.seedType !== 'foto' || c.flowerTs || c.stage !== 'veg') return
          patchActive(
            (g) => {
              const next = { ...g, flowerTs: Date.now() }
              const live = deriveLive(next)
              return { ...next, ...live }
            },
            { toast: '🌸 A floración · luz 12/12 anotada', pendingUndo: null },
          )
          log('floracion', 'Cambié la luz a 12/12')
        },

        // ---- acciones del cultivo activo ----
        // entrar a preview limpia el toast (comparten franja superior) y su Deshacer;
        // salir NO toca la vista (si estabas en cenital, te quedas en cenital)
        setPreview: (d) => set(d === null ? { previewDay: null } : { previewDay: d, view: 'front', toast: null, pendingUndo: null }),

        water: (toastOverride, force) => {
          const c = selectActive(get())
          const guard = force ? null : overwaterGuard(c)
          if (guard) { set({ toast: guard, pendingUndo: null }); return }
          const id = c.id
          const myToast = toastOverride ?? '💧 Riego anotado en la bitácora'
          const prev = { thirst: c.thirst, lastWaterTs: c.lastWaterTs, health: c.health }
          patchActive(
            (g) => ({ ...g, thirst: 0, lastWaterTs: Date.now(), health: Math.min(99, g.health + 1) }),
            { toast: myToast, pendingUndo: null },
          )
          // el "Deshacer" del toast revierte el estado Y borra el evento de la bitácora.
          // Se arma solo si seguimos en el mismo cultivo Y el toast sigue siendo el de ESTA acción
          // (si otra acción ya puso el suyo, su toast no debe heredar este Deshacer).
          log('riego').then((ev) => {
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

        // demo (solo DEV): simula sed retrasando el reloj de riego — consistente con la
        // derivación real, así recomputeTime no la "cura" al minuto siguiente
        wilt: () => {
          const c = selectActive(get())
          if (c.stage !== 'veg') return
          patchActive(
            (g) => {
              const next = { ...g, lastWaterTs: Date.now() - 96 * 3600000 }
              const live = deriveLive(next)
              return { ...next, ...live }
            },
            { toast: '🥀 Tienen sed · toca las plantas para regar', pendingUndo: null },
          )
          log('sed')
        },

        harvest: () => {
          const id = selectActive(get()).id
          const myToast = '🎉 ¡Cosechado! A secar 7–14 días y luego curar 🫙'
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
            { toast: '🫙 Cultivo terminado · su bitácora queda guardada', pendingUndo: null },
          )
          const parts = [dryWeight ? `Peso seco: ${dryWeight} g` : null, note?.trim() || null].filter(Boolean)
          log('terminado', parts.length ? parts.join(' · ') : undefined)
        },

        measure: (key, value) => {
          const def = metricDef(key)
          const c = selectActive(get())
          const { status } = evalMetric(key, value, c.stage, c.substrate)
          const word = status === 'ok' ? 'en rango' : status === 'warn' ? 'al límite' : 'fuera de rango'
          const u = def.unit ? ' ' + def.unit : ''
          const shown = def.dec ? value.toFixed(def.dec) : Math.round(value).toString()
          patchActive(
            (g) => ({ ...g, readings: { ...g.readings, [key]: value }, readingDays: { ...g.readingDays, [key]: g.day } }),
            { toast: `📊 ${def.label} anotado en la bitácora`, pendingUndo: null },
          )
          log('medicion', `${def.label} ${shown}${u} · ${word}`)
        },

        setGuide: (g) => set({ guide: g }),
        completeOnboarding: (g) => set({ guide: g, onboarded: true }),
        markFirstWaterTip: () => set({ firstWaterTipDone: true }),
        markFirstGermTip: () => set({ firstGermTipDone: true }),
        markCoachDone: () => set({ coachDone: true }),
        setNotify: (v) => set({ notifyEnabled: v }),

        // recordatorio local de riego: máx 1/día, solo con permiso concedido y la app
        // fuera de pantalla (visible ya lo estás viendo). Sin push server (eso llega con F4):
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
          const title = 'zenpai 💧'
          const body = `${g.grow}: toca regar hoy (día ${g.day} · revisa el peso de la maceta)`
          try {
            navigator.serviceWorker?.getRegistration()
              .then((r) => { const icon = import.meta.env.BASE_URL + 'pwa-192.png'; if (r) r.showNotification(title, { body, icon, badge: icon }); else new Notification(title, { body, icon }) })
              .catch(() => { try { new Notification(title, { body }) } catch { /* sin soporte */ } })
          } catch { /* sin soporte */ }
        },

        runUndo: () => {
          const u = get().pendingUndo
          set({ pendingUndo: null, toast: u ? '↩️ Deshecho' : null })
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
            .catch(() => set({ toast: '📷 No se pudo guardar la foto', pendingUndo: null }))
        },

        removeEvent: (evId) => {
          const ev = get().events.find((e) => e.id === evId)
          if (!ev) return
          deleteEvent(evId).catch(() => {})
          if (ev.type === 'foto' && ev.photoId != null) deletePhoto(ev.photoId).catch(() => {})
          const rest = get().events.filter((e) => e.id !== evId)
          set({ events: rest })
          // si borró el riego más reciente, retrocede lastWaterTs al anterior:
          // así el guardarraíl de sobre-riego no queda armado por un registro erróneo.
          // Sin riego anterior NO se deja null a secas (la sed derivada contaría desde
          // germTs → sed 0.9 instantánea): piso neutro de ~36 h, como registerExisting.
          if (ev.type === 'riego' && !rest.some((e) => e.type === 'riego' && e.ts > ev.ts)) {
            const prevW = rest.reduce<number | null>((m, e) => (e.type === 'riego' && (m === null || e.ts > m) ? e.ts : m), null)
            set((st) => ({
              grows: st.grows.map((g) => {
                if (g.id !== ev.growId) return g
                const floor = g.germTs ? Math.max(g.germTs, Date.now() - 36 * 3600000) : null
                return { ...g, lastWaterTs: prevW ?? floor }
              }),
            }))
          }
        },

        setView: (v) => set({ view: v }),
        // cualquier toast puesto "a mano" desarma el Deshacer pendiente: un aviso nuevo
        // (p.ej. el guardarraíl) nunca debe heredar el botón de una acción anterior
        setToast: (t) => set({ toast: t, pendingUndo: null }),

        // mantiene day/stage/thirst de TODOS los cultivos sincronizados con el reloj real
        recomputeTime: () => {
          const grows = get().grows
          let changed = false
          const next = grows.map((g) => {
            if (!g.germTs) return g
            const live = deriveLive(g)
            if (live.day !== g.day || live.stage !== g.stage || Math.abs(live.thirst - g.thirst) > 0.02) {
              changed = true
              return { ...g, ...live }
            }
            return g
          })
          if (changed) set({ grows: next })
        },

        acceptConsent: () => set({ consentV: CONSENT_VERSION }),

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
              toast: '📥 Respaldo importado',
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
              toast: '☁️ Copia restaurada desde la nube',
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
      partialize: (s) => ({ grows: s.grows, consentV: s.consentV, view: s.view, guide: s.guide, onboarded: s.onboarded, firstWaterTipDone: s.firstWaterTipDone, firstGermTipDone: s.firstGermTipDone, coachDone: s.coachDone, notifyEnabled: s.notifyEnabled, lastNotifiedDay: s.lastNotifiedDay, cloudOn: s.cloudOn, lastCloudSyncTs: s.lastCloudSyncTs }) as any,
      // rellena campos nuevos y migra del modelo de cultivo único → lista
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as any
        const raw: any[] = Array.isArray(p.grows) ? p.grows : (p.hasGrow && p.c ? [p.c] : [])
        const grows: Cultivo[] = raw.map((g) => {
          const c: Cultivo = { ...emptyCultivo, ...g, id: g.id || genId() }
          // 'secando' SOLO lo pone harvest() manual → derivar harvestedTs si falta (blob viejo).
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
          // MIGRACIÓN sed derivada: un cultivo vivo sin lastWaterTs (pre-P2 el transplante no
          // lo fijaba y quizá nunca usó el botón de regar) despertaría con sed 0.9 y avisos
          // falsos contando desde germTs. Mismo arranque neutro que registerExisting (~36 h):
          // el primer riego real lo sincroniza.
          if (!c.harvestedTs && c.germTs && c.lastWaterTs == null) {
            c.lastWaterTs = Date.now() - 36 * 3600000
          }
          // thirst ahora es derivada del reloj; 0.2 es solo el placeholder hasta recomputeTime
          c.thirst = 0.2
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
