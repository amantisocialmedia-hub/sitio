import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Cliente Supabase con SERVICE_ROLE — SOLO server-side. NUNCA se expone al cliente.
// URL: viene del runtimeConfig público de @nuxtjs/supabase (no es secreto).
// Key: SUPABASE_SERVICE_ROLE_KEY (env de servidor, sin prefijo público).
let _admin: SupabaseClient | null = null

export function supabaseAdmin(): SupabaseClient {
  if (_admin) return _admin
  const config = useRuntimeConfig()
  const url = (config.public as any)?.supabase?.url || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Supabase admin no configurado',
      message: 'Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (server-side).',
    })
  }
  _admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return _admin
}
