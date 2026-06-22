// Sincroniza la wishlist (Pinia + localStorage) con la cuenta del usuario en Supabase.
// Al iniciar sesión hace MERGE (unión local + nube) para no perder favoritos; después,
// cada cambio se refleja en la nube. Degrada con gracia: si la tabla `wishlist_items`
// no existe o el usuario no está logueado, todo sigue en localStorage como antes.
export default defineNuxtPlugin(() => {
  if (!import.meta.client) return

  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const wishlist = useWishlistStore()

  let cloud = new Set<string>() // lo que sabemos que está en la nube
  let ready = false             // true tras el primer merge correcto

  async function pull() {
    const u = user.value
    if (!u) return
    const { data, error } = await supabase
      .from('wishlist_items')
      .select('slug')
      .eq('user_id', u.id)
    if (error) return // tabla puede no existir aún → seguimos en localStorage
    cloud = new Set((data || []).map((r: { slug: string }) => r.slug))
    // MERGE: unión de lo local y lo de la nube.
    const merged = Array.from(new Set([...wishlist.slugs, ...cloud]))
    const toInsert = merged.filter(s => !cloud.has(s))
    if (toInsert.length) {
      await supabase.from('wishlist_items').upsert(
        toInsert.map(slug => ({ user_id: u.id, slug })),
        { onConflict: 'user_id,slug', ignoreDuplicates: true },
      )
    }
    cloud = new Set(merged)
    wishlist.slugs = merged
    ready = true
  }

  async function push() {
    const u = user.value
    if (!u || !ready) return
    const cur = new Set(wishlist.slugs)
    const toAdd = [...cur].filter(s => !cloud.has(s))
    const toDel = [...cloud].filter(s => !cur.has(s))
    if (!toAdd.length && !toDel.length) return
    if (toAdd.length) {
      await supabase.from('wishlist_items').upsert(
        toAdd.map(slug => ({ user_id: u.id, slug })),
        { onConflict: 'user_id,slug', ignoreDuplicates: true },
      )
    }
    if (toDel.length) {
      await supabase.from('wishlist_items').delete().eq('user_id', u.id).in('slug', toDel)
    }
    cloud = cur
  }

  // Al cambiar la sesión: login → merge; logout → deja de sincronizar (local intacto).
  watch(user, async (u) => {
    if (u) { ready = false; await pull() }
    else { ready = false; cloud = new Set() }
  }, { immediate: true })

  // Cada cambio en la wishlist se propaga a la nube (no-op si no hay sesión/tabla).
  watch(() => [...wishlist.slugs], () => { push() })
})
