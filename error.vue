<script setup lang="ts">
defineProps<{ error: any }>()
const handle = () => clearError({ redirect: '/' })
</script>

<template>
  <NuxtLayout name="default">
    <div class="wrap" style="text-align:center;padding:90px 0 70px">
      <div style="font-size:4rem">🙈</div>
      <h1 style="font-size:clamp(1.8rem,5vw,3rem)">
        {{ error?.statusCode === 404 ? 'Página no encontrada' : 'Algo salió mal' }}
      </h1>
      <p style="opacity:.7;margin:10px 0 22px">
        {{ error?.statusCode === 404
          ? 'La página que buscas no existe o cambió de lugar.'
          : 'Intenta de nuevo en un momento.' }}
      </p>
      <button class="btn" @click="handle">Volver al inicio</button>
    </div>
  </NuxtLayout>
</template>
