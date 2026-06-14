// Composable de autenticación AMANTI (Etapa 1) sobre @nuxtjs/supabase.
// Expone signUp / signIn / signInWithGoogle / signOut / resetPassword
// y el usuario actual reactivo (useSupabaseUser).
export const useAuth = () => {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser() // ref reactivo del usuario actual (null si no hay sesión)

  const origin = () => (import.meta.client ? window.location.origin : '')

  /** Registro con email/contraseña. meta -> raw_user_meta_data (full_name, phone) que usa el trigger. */
  const signUp = (email: string, password: string, meta?: { full_name?: string; phone?: string }) =>
    supabase.auth.signUp({
      email,
      password,
      options: { data: meta, emailRedirectTo: `${origin()}/cuenta-test` },
    })

  /** Inicio de sesión con email/contraseña. */
  const signIn = (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password })

  /** Inicio de sesión con Google (OAuth). Google ya habilitado en el dashboard. */
  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${origin()}/cuenta-test` },
    })

  /** Cerrar sesión. */
  const signOut = () => supabase.auth.signOut()

  /** Enviar correo de recuperación de contraseña (email de reset de Supabase). */
  const resetPassword = (email: string) =>
    supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin()}/cuenta-test` })

  return { user, signUp, signIn, signInWithGoogle, signOut, resetPassword }
}
