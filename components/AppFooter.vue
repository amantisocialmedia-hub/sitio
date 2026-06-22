<script setup lang="ts">
const news = ref('')
const newsErr = ref('')
const newsOk = ref(false)
function suscribir() {
  newsErr.value = ''
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(news.value)) { newsErr.value = 'Escribe un correo válido.'; return }
  const subject = encodeURIComponent('Suscripción newsletter')
  const body = encodeURIComponent(`Quiero suscribirme al newsletter de AMANTI con el correo: ${news.value.trim()}`)
  window.location.href = `mailto:hola@amanti.mx?subject=${subject}&body=${body}`
  newsOk.value = true
}
</script>
<template>
  <section class="news">
    <div class="wrap">
      <h2>Info &amp; Blog en tu correo</h2>
      <p>Recibe promociones, novedades y ofertas exclusivas. Sin spam.</p>
      <div v-if="!newsOk" class="nf">
        <input v-model="news" type="email" placeholder="Tu email" @keyup.enter="suscribir" />
        <button class="btn" @click="suscribir">Enviar</button>
      </div>
      <p v-if="!newsOk" style="font-size:.8rem;opacity:.8;margin-top:8px">Al suscribirte aceptas nuestro <NuxtLink to="/privacidad" style="color:#5E1B33;text-decoration:underline">Aviso de Privacidad</NuxtLink>.</p>
      <p v-if="newsErr && !newsOk" style="color:#C0341B;font-size:.85rem;margin-top:8px">{{ newsErr }}</p>
      <p v-if="newsOk" style="margin-top:10px;font-weight:600">¡Gracias! Te suscribiremos a hola@amanti.mx 💜</p>
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
          <div class="mark"><span>amanti</span></div>
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
