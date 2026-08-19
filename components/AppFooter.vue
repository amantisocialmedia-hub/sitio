<script setup lang="ts">
// El campo de suscripción era un mailto: abría el correo del visitante y el
// dato no llegaba a ningún lado. Ahora es el formulario de GHL, que es de donde
// César dispara los flujos de correo (ver components/NewsletterForm.vue).
</script>
<template>
  <section class="news">
    <div class="wrap">
      <h2>Info &amp; Blog en tu correo</h2>
      <p>Recibe promociones, novedades y ofertas exclusivas. Sin spam.</p>
      <div class="nf-embed"><NewsletterForm /></div>
      <p style="font-size:.8rem;opacity:.8;margin-top:8px">Al suscribirte aceptas nuestro <NuxtLink to="/privacidad" style="color:#5E1B33;text-decoration:underline">Aviso de Privacidad</NuxtLink>.</p>
      <div class="socials">
        <a href="https://www.facebook.com/profile.php?id=61583596012406" target="_blank" rel="noopener" aria-label="Facebook">f</a>
        <a href="https://www.instagram.com/amanti.wellness/" target="_blank" rel="noopener" aria-label="Instagram">◎</a>
        <a href="https://www.tiktok.com/@amanti.wellness" target="_blank" rel="noopener" aria-label="TikTok">♪</a>
      </div>
    </div>
  </section>

  <footer class="footer">
    <div class="wrap">
      <div class="fg">
        <div>
          <h3>Juguetes Sexuales</h3>
          <ul>
            <li><NuxtLink to="/tienda?cat=vibradores">Vibradores</NuxtLink></li>
            <li><NuxtLink to="/tienda?cat=masturbadores">Masturbadores</NuxtLink></li>
            <li><NuxtLink to="/tienda?cat=dildos">Dildos</NuxtLink></li>
            <li><NuxtLink to="/tienda?cat=anal">Anales</NuxtLink></li>
            <li><NuxtLink to="/tienda?cat=bdsm">BDSM</NuxtLink></li>
            <li><NuxtLink to="/tienda?cat=parejas">Parejas</NuxtLink></li>
            <li><NuxtLink to="/tienda?cat=retardantes">Retardantes</NuxtLink></li>
            <li><NuxtLink to="/tienda?cat=lubricantes">Lubricantes</NuxtLink></li>
            <li><NuxtLink to="/kits">Kits 🎁</NuxtLink></li>
            <li><NuxtLink to="/tienda">Ver todo</NuxtLink></li>
          </ul>
        </div>
        <div>
          <h3>Información</h3>
          <ul>
            <li><NuxtLink to="/envios">Formas de Envío</NuxtLink></li>
            <li><NuxtLink to="/pagos">Formas de Pago</NuxtLink></li>
            <li><NuxtLink to="/garantias">Cambios y Garantías</NuxtLink></li>
            <li><NuxtLink to="/terminos">Términos y Condiciones</NuxtLink></li>
            <li><NuxtLink to="/privacidad">Avisos de Privacidad</NuxtLink></li>
          </ul>
        </div>
        <div>
          <h3>Atención a Clientes</h3>
          <ul>
            <li><NuxtLink to="/nosotros">Nosotros</NuxtLink></li>
            <li><NuxtLink to="/blog">Blog</NuxtLink></li>
            <li><NuxtLink to="/faq">Preguntas Frecuentes</NuxtLink></li>
            <li><NuxtLink to="/contacto">Contáctanos</NuxtLink></li>
            <li><NuxtLink to="/favoritos">Mis Favoritos</NuxtLink></li>
          </ul>
        </div>
        <div class="fbrand">
          <NuxtLink to="/" class="flogo" aria-label="AMANTI — Inicio">
            <span class="flogo-iso" aria-hidden="true"></span>
            <span class="flogo-word">AMANTI<span class="flogo-r" aria-hidden="true">®</span></span>
          </NuxtLink>
          <p>Sex shop en México con juguetes sexuales para mujeres, hombres y parejas. Vibradores, succionadores, juguetes para parejas y más. Envíos discretos a todo el país.</p>
        </div>
      </div>
      <div class="fbottom">
        <span>© 2026 AMANTI · Hecho en México 🇲🇽 · +18</span>
        <div class="pays">
          <span class="pp">Visa</span><span class="pp">Mastercard</span><span class="pp">Amex</span>
          <span class="pp">MercadoPago</span><span class="pp">OXXO</span><span class="pp">MSI</span>
        </div>
      </div>
    </div>
  </footer>
</template>
