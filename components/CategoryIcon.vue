<script setup lang="ts">
// Iconos cute propios por categoría (SVG blanco sobre el gradiente de la tesela).
// Si no hay icono para el slug, cae al emoji de la categoría.
const props = defineProps<{ slug: string; emoji?: string }>()

const icons: Record<string, string> = {
  vibradores: `<svg viewBox="0 0 48 48"><rect x="19" y="9" width="10" height="25" rx="5" fill="#fff"/><rect x="21.4" y="12.5" width="2.6" height="8" rx="1.3" fill="rgba(255,255,255,.45)"/><path d="M13.5 16.5c-2 3.2-2 7.8 0 11" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none"/><path d="M34.5 16.5c2 3.2 2 7.8 0 11" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>`,
  dildos: `<svg viewBox="0 0 48 48"><path d="M24 8c4.1 0 6.6 3 6.6 7 0 2.6-1.6 4-1.6 7.2v8.6c0 3.8-2.2 6.2-5 6.2s-5-2.4-5-6.2v-8.6c0-3.2-1.6-4.6-1.6-7.2C17.4 11 19.9 8 24 8z" fill="#fff"/><path d="M22 13.5c-.8.9-1.2 2-1.1 3.3" stroke="rgba(255,255,255,.5)" stroke-width="2" stroke-linecap="round" fill="none"/></svg>`,
  anal: `<svg viewBox="0 0 48 48"><circle cx="24" cy="35" r="8" fill="#fff"/><circle cx="24" cy="22.5" r="5.6" fill="#fff"/><circle cx="24" cy="13" r="3.6" fill="#fff"/></svg>`,
  bdsm: `<svg viewBox="0 0 48 48"><path d="M9 21c0-2.2 2.1-3.4 5.2-3.4h19.6c3.1 0 5.2 1.2 5.2 3.4 0 6.2-3.3 10.2-8.4 10.2-2.6 0-3.7-1.7-6.6-1.7s-4 1.7-6.6 1.7C12.3 31.2 9 27.2 9 21z" fill="#fff"/><circle cx="18" cy="22.5" r="2.6" fill="rgba(60,20,30,.5)"/><circle cx="30" cy="22.5" r="2.6" fill="rgba(60,20,30,.5)"/></svg>`,
  parejas: `<svg viewBox="0 0 48 48"><path d="M19 15.6c-2.3-2.7-6.8-2.1-8 1.3-.85 2.3.2 4.5 1.8 6.1L19 29.5l6.2-6.5c1.6-1.6 2.65-3.8 1.8-6.1-1.2-3.4-5.7-4-8-1.3z" fill="#fff"/><path d="M31 19.4c-1.9-2.2-5.6-1.7-6.6 1.1-.7 1.9.16 3.7 1.5 5L31 31l5.1-5.5c1.34-1.3 2.2-3.1 1.5-5-1-2.8-4.7-3.3-6.6-1.1z" fill="rgba(255,255,255,.62)"/></svg>`,
  hombre: `<svg viewBox="0 0 48 48"><circle cx="21" cy="27.5" r="8.6" fill="none" stroke="#fff" stroke-width="3.4"/><path d="M28.5 20.5l8.5-8.5m-6.5 0H37v6.5" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  arneses: `<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="6.6" fill="none" stroke="#fff" stroke-width="3.2"/><path d="M19.3 19.3 12 12M28.7 19.3 36 12M19.3 28.7 12 36M28.7 28.7 36 36" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/></svg>`,
  masturbadores: `<svg viewBox="0 0 48 48"><rect x="16" y="11" width="16" height="27" rx="8" fill="#fff"/><ellipse cx="24" cy="15.5" rx="5" ry="2.8" fill="rgba(60,20,30,.45)"/><path d="M19.5 23v9" stroke="rgba(60,20,30,.12)" stroke-width="1.6" stroke-linecap="round"/><path d="M28.5 23v9" stroke="rgba(60,20,30,.12)" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  retardantes: `<svg viewBox="0 0 48 48"><circle cx="24" cy="27" r="11" fill="none" stroke="#fff" stroke-width="3"/><rect x="20.8" y="6.5" width="6.4" height="4.2" rx="1.6" fill="#fff"/><path d="M24 11v3" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M24 21.5v6l4 3" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  lubricantes: `<svg viewBox="0 0 48 48"><path d="M24 8.5c5.2 7.2 9.2 11.3 9.2 16.4a9.2 9.2 0 1 1-18.4 0c0-5.1 4-9.2 9.2-16.4z" fill="#fff"/><path d="M19.5 22.5c-1.5 1.6-2.1 3.7-1.8 5.6" stroke="rgba(60,20,30,.14)" stroke-width="2" stroke-linecap="round" fill="none"/></svg>`,
  // "Oral" no es una categoría del catálogo sino la subcategoría transversal (ver
  // composables/useProducts.ts). Lleva icono propio para que su tesela del mosaico se vea
  // como las demás y no caiga al emoji.
  oral: `<svg viewBox="0 0 48 48"><path d="M11.9 19.6c-1-1.2-.7-2.8.7-3.8 3.6-2.6 8.8-1.2 11.4 2.8 2.6-4 7.8-5.4 11.4-2.8 1.4 1 1.7 2.6.7 3.8z" fill="#fff"/><path d="M12.2 20.9h23.6c-1.9 5.3-6.4 9.1-11.8 9.1s-9.9-3.8-11.8-9.1z" fill="#fff"/></svg>`,
}

const svg = computed(() => icons[props.slug] || '')
</script>

<template>
  <span v-if="svg" class="catsvg" aria-hidden="true" v-html="svg"></span>
  <span v-else class="te">{{ emoji }}</span>
</template>
