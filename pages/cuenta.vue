<script setup lang="ts">useHead({ title: 'Mi cuenta — AMANTI' })</script>
<template>
  <PageHeader title="Iniciar Sesión" subtitle="Tu cuenta AMANTI, muy pronto." current="Cuenta" />
  <div class="prose" style="text-align:center;max-width:520px">
    <div style="font-size:3rem">🔐</div>
    <p class="lead">Las cuentas y el inicio de sesión estarán disponibles próximamente.</p>
    <p>Mientras tanto, puedes comprar como invitadx sin crear cuenta, y guardar tus favoritos en este dispositivo.</p>
    <p style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:18px">
      <NuxtLink to="/tienda" class="btn">Ir a la tienda</NuxtLink>
      <NuxtLink to="/favoritos" class="btn outline">Mis favoritos</NuxtLink>
    </p>
  </div>
</template>
