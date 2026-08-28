import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Cliente de Supabase para el respaldo en la nube (F4).
// Sin .env configurado el cliente es null y TODA la funcionalidad de nube desaparece
// de la UI: la app sigue siendo offline-first y funcional al 100 % sin cuenta.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined

export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key) : null
