import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { cloudSignIn } from './sync'
import { compressImage } from './img'
import type { Stage, Substrate } from './lib'

// ===== diagnóstico de hojas por foto (Premium) =====
// La foto viaja a la función diagnose de Supabase (supabase/functions/diagnose), que
// pregunta a Claude. Usa la misma sesión anónima que el respaldo en la nube.

export type Confianza = 'alta' | 'media' | 'baja'
export interface Diagnosis {
  ok: boolean            // false: la foto no sirve (borrosa, sin planta…)
  probable: string
  confianza: Confianza
  observado: string
  pasos: string[]
  aviso: string
}
export interface DiagnoseCtx { stage: Stage; substrate: Substrate; day: number; strain?: string | null }

const NOT_ACTIVE = 'El diagnóstico todavía no está activado en el servidor.'
const LIMIT = 'Llegaste al límite de diagnósticos de hoy. Vuelve a intentarlo mañana.'
const OFFLINE = 'Sin conexión. El diagnóstico necesita internet.'
const GENERIC = 'No pudimos analizar la foto. Prueba de nuevo en un rato.'

function toBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1] ?? '')
    r.onerror = () => rej(r.error)
    r.readAsDataURL(blob)
  })
}

function isDiagnosis(d: unknown): d is Diagnosis {
  const r = d as Diagnosis | null
  return !!r && typeof r.ok === 'boolean' && typeof r.probable === 'string' && typeof r.observado === 'string'
    && (r.confianza === 'alta' || r.confianza === 'media' || r.confianza === 'baja')
    && Array.isArray(r.pasos) && typeof r.aviso === 'string'
}

export async function diagnoseLeaf(file: File | Blob, ctx: DiagnoseCtx): Promise<{ ok: true; result: Diagnosis } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: NOT_ACTIVE }
  if (!navigator.onLine) return { ok: false, error: OFFLINE }

  let image: string
  try {
    // compressImage solo usa el blob (createObjectURL): un Blob sirve igual que un File
    image = await toBase64(await compressImage(file as File, 1024, 0.8))
  } catch {
    return { ok: false, error: 'No pudimos leer esa imagen. Prueba con otra foto.' }
  }

  const authErr = await cloudSignIn()
  if (authErr) return { ok: false, error: navigator.onLine ? NOT_ACTIVE : OFFLINE }

  const { data, error } = await supabase.functions.invoke('diagnose', {
    body: { image, stage: ctx.stage, substrate: ctx.substrate, day: ctx.day, strain: ctx.strain || undefined },
  })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const res = error.context as Response
      if (res.status === 404) return { ok: false, error: NOT_ACTIVE }
      if (res.status === 429) return { ok: false, error: LIMIT }
      try {
        const body = await res.json() as { error?: unknown }
        if (typeof body.error === 'string' && body.error) return { ok: false, error: body.error }
      } catch { /* sin cuerpo legible */ }
      return { ok: false, error: GENERIC }
    }
    // sin red, o función no desplegada (si su 404 llega sin cabeceras CORS, el navegador lo ve como fallo de red)
    if (error instanceof FunctionsFetchError) return { ok: false, error: navigator.onLine ? NOT_ACTIVE : OFFLINE }
    return { ok: false, error: GENERIC }
  }
  if (!isDiagnosis(data)) return { ok: false, error: GENERIC }
  return { ok: true, result: data }
}
