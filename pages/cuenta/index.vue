<script setup lang="ts">
useHead({ title: 'Mi cuenta — AMANTI' })
const { user, signOut } = useAuth()

const sections = [
  { k: 'perfil', label: 'Mi perfil' },
  { k: 'direcciones', label: 'Direcciones' },
  { k: 'pedidos', label: 'Pedidos' },
]
const section = ref('perfil')
const firstName = computed(() => String(user.value?.user_metadata?.full_name || user.value?.email || '').split(' ')[0])

// La sesión de Supabase se restaura en el cliente al iniciar; hasta entonces no decidimos
// login vs dashboard para no "flashear" el formulario a un usuario ya autenticado.
const ready = ref(false)
onMounted(() => { ready.value = true })

async function logout() {
  await signOut()
  section.value = 'perfil'
}
</script>

<template>
  <PageHeader
    title="Mi cuenta"
    :subtitle="user ? `Hola, ${firstName} 👋` : 'Entra o crea tu cuenta AMANTI'"
    current="Cuenta" />

  <div class="acct">
    <!-- Espera a que la sesión cliente se resuelva (evita flash del login) -->
    <p v-if="!ready" class="acct-loading">Cargando…</p>

    <!-- Sin sesión: login/registro en la misma página (protección sin redirect) -->
    <AccountAuth v-else-if="!user" />

    <!-- Con sesión: dashboard -->
    <div v-else class="dash">
      <nav class="dash-tabs">
        <button v-for="s in sections" :key="s.k" :class="{ on: section === s.k }" @click="section = s.k">{{ s.label }}</button>
        <button class="logout" @click="logout">Cerrar sesión</button>
      </nav>
      <AccountProfile v-if="section === 'perfil'" />
      <AccountAddresses v-else-if="section === 'direcciones'" />
      <AccountOrders v-else />
    </div>
  </div>
</template>

<style scoped>
.acct { max-width: 820px; margin: 0 auto 80px; padding: 44px 20px 0; }
.dash-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; align-items: center; }
.dash-tabs button { padding: 9px 16px; border-radius: 999px; border: 1px solid #E7D8CC; background: #fff; color: #5E1B33; font-weight: 600; cursor: pointer; font-family: inherit; font-size: .9rem; }
.dash-tabs button.on { background: #5E1B33; color: #fff; border-color: #5E1B33; }
.dash-tabs .logout { margin-left: auto; border-color: #E8503A; color: #E8503A; }
.dash-tabs .logout:hover { background: #E8503A; color: #fff; }
.acct-loading { color: #b9a39a; text-align: center; padding: 30px 0; }
@media (max-width: 480px) { .dash-tabs .logout { margin-left: 0; } }
</style>
