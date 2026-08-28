import { supabase } from './supabase'
import { db } from './db'
import type { Cultivo, GrowEvent } from './lib'

// ===== respaldo en la nube (F4 fase 1) =====
// Principios: lo LOCAL manda (offline-first intacto); la nube es una copia privada.
// Cuenta anónima (sin email, fiel a "no pedimos nombre real"): la copia queda ligada
// a este navegador mientras no exista vinculación por correo (fase siguiente).
// Idempotente: cultivos por upsert, eventos con índice único, fotos por nombre.

export interface CloudPull {
  grows: unknown[]
  events: GrowEvent[]
  photos: { id: number; growId: string; ts: number; blob: Blob }[]
}

export const cloudAvailable = supabase !== null

export async function cloudUserId(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

// inicia (o retoma) la sesión anónima; devuelve error legible o null
export async function cloudSignIn(): Promise<string | null> {
  if (!supabase) return 'La nube no está configurada en esta instalación.'
  const { data } = await supabase.auth.getSession()
  if (data.session) return null
  const { error } = await supabase.auth.signInAnonymously()
  if (!error) return null
  if (error.message.toLowerCase().includes('anonymous')) {
    return 'El proyecto de Supabase no tiene activados los accesos anónimos (Authentication → Sign In / Providers).'
  }
  return error.message
}

export async function cloudSignOut(): Promise<void> {
  try { await supabase?.auth.signOut() } catch { /* best-effort */ }
}

// ¿hay datos en la nube? (para decidir restaurar al activar con local vacío)
export async function cloudHasData(): Promise<boolean> {
  if (!supabase) return false
  const { count, error } = await supabase.from('grows').select('id', { count: 'exact', head: true })
  if (error) return false
  return (count ?? 0) > 0
}

// sube TODO el estado local (idempotente); devuelve error legible o null
export async function cloudPush(grows: Cultivo[]): Promise<string | null> {
  if (!supabase) return 'Sin configurar.'
  const uid = await cloudUserId()
  if (!uid) return 'Sin sesión de nube.'

  // 1) cultivos (upsert; el jsonb es el estado completo)
  if (grows.length > 0) {
    const rows = grows.map((g) => ({ id: g.id, user_id: uid, data: g, updated_at: new Date().toISOString() }))
    const { error } = await supabase.from('grows').upsert(rows)
    if (error) return 'Cultivos: ' + error.message
    // los borrados localmente se retiran de la copia (solo si hay algo local:
    // con local vacío jamás barremos la nube — ahí lo correcto es restaurar)
    const inList = '(' + grows.map((g) => `"${g.id}"`).join(',') + ')'
    const { error: delErr } = await supabase.from('grows').delete().not('id', 'in', inList)
    if (delErr) return 'Limpieza: ' + delErr.message
  }

  // 2) bitácora completa (por tandas; duplicados ignorados por el índice único)
  const events = await db.events.toArray()
  for (let i = 0; i < events.length; i += 200) {
    const chunk = events.slice(i, i + 200)
      .filter((e) => e.id != null)
      .map((e) => ({ user_id: uid, grow_id: e.growId, local_id: e.id!, ts: new Date(e.ts).toISOString(), data: e }))
    if (!chunk.length) continue
    const { error } = await supabase.from('events')
      .upsert(chunk, { onConflict: 'user_id,grow_id,local_id', ignoreDuplicates: true })
    if (error) return 'Bitácora: ' + error.message
  }

  // 3) fotos que aún no estén arriba (por nombre {photoId}.jpg en la carpeta del usuario)
  const photos = await db.photos.toArray()
  if (photos.length > 0) {
    const { data: listed, error: listErr } = await supabase.storage.from('photos').list(uid, { limit: 1000 })
    if (listErr) return 'Fotos: ' + listErr.message
    const have = new Set((listed ?? []).map((f) => f.name))
    for (const p of photos) {
      if (p.id == null) continue
      const name = `${p.id}.jpg`
      if (have.has(name)) continue
      const { error } = await supabase.storage.from('photos')
        .upload(`${uid}/${name}`, p.blob, { contentType: 'image/jpeg', upsert: true })
      if (error) return 'Fotos: ' + error.message
    }
  }
  return null
}

// baja la copia completa de la nube (para restaurar en un local vacío)
export async function cloudPull(): Promise<CloudPull | string> {
  if (!supabase) return 'Sin configurar.'
  const uid = await cloudUserId()
  if (!uid) return 'Sin sesión de nube.'

  const { data: growRows, error: gErr } = await supabase.from('grows').select('data')
  if (gErr) return 'Cultivos: ' + gErr.message
  const { data: evRows, error: eErr } = await supabase.from('events').select('data').order('local_id', { ascending: true })
  if (eErr) return 'Bitácora: ' + eErr.message
  const events = (evRows ?? []).map((r) => r.data as GrowEvent)

  // fotos: solo las que la bitácora referencia (metadatos viven en el evento 'foto')
  const photos: CloudPull['photos'] = []
  const refs = events.filter((e) => e.type === 'foto' && e.photoId != null)
  for (const ev of refs) {
    const { data: blob, error } = await supabase.storage.from('photos').download(`${uid}/${ev.photoId}.jpg`)
    if (error || !blob) continue // una foto perdida no debe frenar la restauración
    photos.push({ id: ev.photoId!, growId: ev.growId, ts: ev.ts, blob })
  }
  return { grows: (growRows ?? []).map((r) => r.data), events, photos }
}
