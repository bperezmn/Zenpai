import type { GrowEvent } from './lib'

// "Tu timelapse": las fotos del propio usuario, una por día del cultivo.
export interface PhotoFrame { day: number; ts: number; photoId: number }

// Una foto por día: la ÚLTIMA de ese día (si repitió la toma, la buena suele ser la última),
// en orden ascendente. Solo cuentan los eventos 'foto': los de 'diagnostico' son primeros
// planos de hojas y romperían el encuadre.
export function photoFrames(events: GrowEvent[]): PhotoFrame[] {
  const byDay = new Map<number, PhotoFrame>()
  for (const e of events) {
    if (e.type !== 'foto' || e.photoId == null) continue
    const prev = byDay.get(e.day)
    if (!prev || e.ts >= prev.ts) byDay.set(e.day, { day: e.day, ts: e.ts, photoId: e.photoId })
  }
  return [...byDay.values()].sort((a, b) => a.day - b.day)
}

// La foto que toca mostrar en un día: la del mayor día ≤ day; antes de la primera foto,
// la primera; sin fotos, null.
export function frameForDay(frames: PhotoFrame[], day: number): PhotoFrame | null {
  if (frames.length === 0) return null
  let hit: PhotoFrame | null = null
  for (const f of frames) {
    if (f.day > day) break
    hit = f
  }
  return hit ?? frames[0]
}

// ¿hay al menos una foto para el timelapse? (para mostrar el selector "Guía | Mis fotos")
export function hasPhotoFrames(events: GrowEvent[]): boolean {
  return events.some((e) => e.type === 'foto' && e.photoId != null)
}
