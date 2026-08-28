import Dexie, { type Table } from 'dexie'
import type { StateStorage } from 'zustand/middleware'
import type { GrowEvent } from './lib'

interface KV { key: string; value: string }

// fotos de la bitácora: blobs comprimidos y SIN EXIF (el re-encode en canvas lo elimina)
export interface GrowPhoto { id?: number; growId: string; ts: number; blob: Blob }

class ZenpaiDB extends Dexie {
  kv!: Table<KV, string>
  events!: Table<GrowEvent, number>
  photos!: Table<GrowPhoto, number>
  constructor() {
    super('zenpai')
    this.version(1).stores({ kv: 'key' })
    // v2: bitácora append-only (event log) — fuente de verdad de lo que ocurrió en el cultivo
    this.version(2).stores({ kv: 'key', events: '++id, growId, ts, type' })
    // v3: fotos de la bitácora (offline-first, sin nube)
    this.version(3).stores({ kv: 'key', events: '++id, growId, ts, type', photos: '++id, growId, ts' })
  }
}
export const db = new ZenpaiDB()

// --- bitácora ---
export async function addEvent(ev: GrowEvent): Promise<GrowEvent> {
  const id = await db.events.add(ev)
  return { ...ev, id: id as number }
}
export async function listEvents(growId: string): Promise<GrowEvent[]> {
  if (!growId) return []
  const rows = await db.events.where('growId').equals(growId).toArray()
  return rows.sort((a, b) => a.ts - b.ts) // ascendente (cronológico)
}
export async function deleteEvents(growId: string): Promise<void> {
  if (!growId) return
  await db.events.where('growId').equals(growId).delete()
}
export async function deleteEvent(id: number): Promise<void> {
  await db.events.delete(id)
}
export async function addEventsBulk(evs: GrowEvent[]): Promise<void> {
  if (evs.length) await db.events.bulkAdd(evs)
}
// barrido: elimina eventos/fotos cuyo cultivo ya no existe (basura tras borrados fallidos).
// GUARDIA: si TODO quedaría huérfano de golpe, no es basura — es señal de un import
// interrumpido a mitad (Dexie ya tiene la bitácora nueva pero los cultivos del kv aún son
// los viejos). Podar ahí convertiría una inconsistencia transitoria en pérdida definitiva.
export async function pruneEvents(validGrowIds: string[]): Promise<void> {
  try {
    const total = await db.events.count()
    if (total === 0) return
    const orphan = validGrowIds.length === 0
      ? total
      : await db.events.where('growId').noneOf(validGrowIds).count()
    if (orphan === 0 || orphan === total) return
    await db.events.where('growId').noneOf(validGrowIds).delete()
    await db.photos.where('growId').noneOf(validGrowIds).delete()
  } catch { /* no-op: el barrido es best-effort */ }
}

// --- fotos ---
export async function addPhoto(p: GrowPhoto): Promise<number> {
  return (await db.photos.add(p)) as number
}
export async function getPhoto(id: number): Promise<GrowPhoto | undefined> {
  return db.photos.get(id)
}
export async function deletePhoto(id: number): Promise<void> {
  await db.photos.delete(id)
}
export async function deletePhotos(growId: string): Promise<void> {
  if (!growId) return
  await db.photos.where('growId').equals(growId).delete()
}
export async function countEvents(growId: string): Promise<number> {
  if (!growId) return 0
  return db.events.where('growId').equals(growId).count()
}

// --- respaldo (exportar/importar): eventos + fotos como base64 en un solo JSON ---
export interface PhotoBackup { id?: number; growId: string; ts: number; b64: string }

function blobToB64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res((r.result as string).split(',')[1] ?? '')
    r.onerror = () => rej(new Error('blob ilegible'))
    r.readAsDataURL(blob)
  })
}
function b64ToBlob(b64: string): Blob {
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: 'image/jpeg' })
}

// Construye el respaldo como Blob INCREMENTAL: cada foto se serializa por separado y se
// concatena al Blob (que el navegador puede respaldar a disco). Así el pico de memoria es
// ~1 foto, no la bitácora completa — justo el usuario con más fotos es el que más necesita
// poder exportar.
export async function exportBlob(header: object): Promise<Blob> {
  const events = (await db.events.toArray()).sort((a, b) => a.ts - b.ts)
  const head = JSON.stringify({ ...header, events })
  let blob = new Blob([head.slice(0, -1) + ',"photos":['], { type: 'application/json' })
  const rows = await db.photos.toArray()
  let first = true
  for (const p of rows) {
    try {
      const b64 = await blobToB64(p.blob)
      const chunk = (first ? '' : ',') + JSON.stringify({ id: p.id, growId: p.growId, ts: p.ts, b64 })
      blob = new Blob([blob, chunk], { type: 'application/json' })
      first = false
    } catch { /* una foto corrupta no debe tumbar el respaldo completo */ }
  }
  return new Blob([blob, ']}'], { type: 'application/json' })
}

// importar REEMPLAZA la bitácora completa (los ids originales se conservan para que
// los eventos 'foto' sigan apuntando a su blob)
export async function importAllRaw(events: GrowEvent[], photos: GrowPhoto[]): Promise<void> {
  await db.transaction('rw', db.events, db.photos, async () => {
    await db.events.clear()
    await db.photos.clear()
    if (events.length) await db.events.bulkPut(events)
    if (photos.length) await db.photos.bulkPut(photos)
  })
}
export async function importAll(events: GrowEvent[], photos: PhotoBackup[]): Promise<void> {
  await importAllRaw(events, photos.map((p) => ({ id: p.id, growId: p.growId, ts: p.ts, blob: b64ToBlob(p.b64) })))
}

// borrar TODO (datos y ajustes): cierra la conexión y elimina la base entera
export async function wipeDatabase(): Promise<void> {
  db.close()
  await new Promise<void>((res) => {
    const req = indexedDB.deleteDatabase('zenpai')
    req.onsuccess = () => res()
    req.onerror = () => res()   // best-effort: recargamos igual
    req.onblocked = () => res() // otra pestaña abierta: se completará al cerrarla
  })
}

// adaptador de almacenamiento para zustand/persist → IndexedDB (offline-first)
export const dexieStorage: StateStorage = {
  getItem: async (name) => (await db.kv.get(name))?.value ?? null,
  setItem: async (name, value) => { await db.kv.put({ key: name, value }) },
  removeItem: async (name) => { await db.kv.delete(name) },
}
