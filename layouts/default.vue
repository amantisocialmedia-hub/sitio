<template>
  <div>
    <!-- Nebulosa de colores que deriva en el fondo (detrás de todo el contenido) -->
    <div class="nebula" aria-hidden="true">
      <span class="neb n1"></span>
      <span class="neb n2"></span>
      <span class="neb n3"></span>
      <span class="neb n4"></span>
    </div>
    <SiteHeader />
    <main>
      <slot />
    </main>
    <AppFooter />
    <BottomNav />
    <WhatsAppButton />
    <CartDrawer />
    <CookieConsent />
    <AgeGate />
  </div>
</template>
