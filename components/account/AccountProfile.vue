<script setup lang="ts">
// FASE A: vista de solo lectura (datos de la sesión). FASE B la hará editable contra profiles.
const { user } = useAuth()
</script>
<template>
  <div class="acard">
    <h3>Mi perfil</h3>
    <div class="frow"><span class="lab">Correo</span><span>{{ user?.email }}</span></div>
    <div class="frow"><span class="lab">Nombre</span><span>{{ user?.user_metadata?.full_name || '—' }}</span></div>
    <p class="soon">Pronto podrás editar tu nombre y teléfono aquí.</p>
  </div>
</template>
<style scoped>
.acard { background: #fff; border: 1px solid #F0E0D4; border-radius: 12px; padding: 22px; }
.acard h3 { color: #5E1B33; margin: 0 0 14px; }
.frow { display: flex; justify-content: space-between; gap: 16px; padding: 10px 0; border-bottom: 1px solid #F6ECE3; }
.frow .lab { color: #9b8579; font-size: .85rem; }
.soon { margin-top: 14px; font-size: .85rem; color: #b9a39a; }
</style>
