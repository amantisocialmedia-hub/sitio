<script setup lang="ts">
// Widget de chat del agente EROS. Llama al proxy /api/chat (que reenvía a n8n) para
// evitar CORS y no exponer la URL del webhook. Sesión persistente por dispositivo.
interface Msg { role: 'user' | 'bot'; text: string }

const open = ref(false)
const busy = ref(false)
const input = ref('')
const sid = ref('')
const listEl = ref<HTMLElement | null>(null)
const messages = ref<Msg[]>([
  { role: 'bot', text: '¡Hola! Soy EROS, tu asistente de AMANTI 💜 ¿Buscas algo en especial o quieres una recomendación? Pregúntame sin pena.' },
])

onMounted(() => {
  try { sid.value = localStorage.getItem('amanti_chat_sid') || '' } catch {}
  if (!sid.value) {
    sid.value = (globalThis.crypto?.randomUUID?.() || 'sid-' + Math.random().toString(36).slice(2) + Date.now().toString(36))
    try { localStorage.setItem('amanti_chat_sid', sid.value) } catch {}
  }
})

async function scrollDown() {
  await nextTick()
  if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
}
function toggle() { open.value = !open.value; if (open.value) scrollDown() }

async function send() {
  const text = input.value.trim()
  if (!text || busy.value) return
  messages.value.push({ role: 'user', text })
  input.value = ''
  busy.value = true
  scrollDown()
  try {
    const r = await $fetch<{ response: string }>('/api/chat', { method: 'POST', body: { message: text, sessionId: sid.value } })
    messages.value.push({ role: 'bot', text: r?.response || 'No pude responder, intenta de nuevo 💜' })
  } catch {
    messages.value.push({ role: 'bot', text: 'Ups, no pude responder. Escríbenos por WhatsApp y te atendemos al instante 💜' })
  } finally {
    busy.value = false
    scrollDown()
  }
}
</script>

<template>
  <ClientOnly>
    <button v-show="!open" class="eros-launcher" @click="toggle" aria-label="Abrir chat con EROS">
      <span class="el-emo">💬</span>
      <span class="el-dot"></span>
    </button>

    <Transition name="eros">
      <section v-if="open" class="eros-panel" role="dialog" aria-label="Chat con EROS">
        <header class="ep-head">
          <div class="ep-id">
            <span class="ep-av">e</span>
            <div>
              <b>EROS</b>
              <span class="ep-sub">Asistente de AMANTI · en línea</span>
            </div>
          </div>
          <button class="ep-x" @click="toggle" aria-label="Cerrar chat">✕</button>
        </header>

        <div ref="listEl" class="ep-list">
          <div v-for="(m, i) in messages" :key="i" class="ep-msg" :class="m.role">
            <p>{{ m.text }}</p>
          </div>
          <div v-if="busy" class="ep-msg bot ep-typing"><span></span><span></span><span></span></div>
        </div>

        <form class="ep-input" @submit.prevent="send">
          <input v-model="input" type="text" maxlength="1000" placeholder="Escribe tu mensaje…" aria-label="Mensaje" :disabled="busy" />
          <button type="submit" class="ep-send" :disabled="busy || !input.trim()" aria-label="Enviar">➤</button>
        </form>
        <a class="ep-wa" :href="`https://wa.me/${$config.public.whatsappPhone}`" target="_blank" rel="noopener">¿Prefieres WhatsApp? Escríbenos →</a>
      </section>
    </Transition>
  </ClientOnly>
</template>

<style scoped>
.eros-launcher {
  position: fixed; right: 18px; bottom: 84px; z-index: 96; width: 56px; height: 56px; border-radius: 50%;
  border: none; cursor: pointer; background: linear-gradient(150deg, var(--magenta), var(--purple));
  color: #fff; display: grid; place-items: center; box-shadow: 0 14px 30px -12px rgba(94, 27, 51, .7);
  transition: transform .2s var(--ease-out);
}
.eros-launcher:hover { transform: scale(1.08); }
.el-emo { font-size: 1.5rem; line-height: 1; }
.el-dot { position: absolute; top: 10px; right: 12px; width: 10px; height: 10px; border-radius: 50%; background: #3Fd07f; border: 2px solid #fff; }

.eros-panel {
  position: fixed; right: 18px; bottom: 18px; z-index: 1150; width: 372px; max-width: calc(100vw - 24px);
  height: min(560px, 72vh); background: #fff; border-radius: 18px; overflow: hidden;
  display: flex; flex-direction: column; box-shadow: 0 40px 80px -30px rgba(0, 0, 0, .55); border: 1px solid #F0E0D4;
}
.ep-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 16px; background: linear-gradient(135deg, var(--purple), #8E2B4A); color: #fff; }
.ep-id { display: flex; align-items: center; gap: 10px; }
.ep-av { width: 38px; height: 38px; border-radius: 50%; background: rgba(255, 255, 255, .18); display: grid; place-items: center; font-family: var(--fs); font-size: 1.5rem; flex: none; }
.ep-id b { font-family: var(--fh); font-size: 1.05rem; display: block; line-height: 1.1; }
.ep-sub { font-size: .74rem; opacity: .85; }
.ep-x { background: none; border: none; color: #fff; font-size: 1rem; cursor: pointer; width: 36px; height: 36px; border-radius: 50%; }
.ep-x:hover { background: rgba(255, 255, 255, .16); }
.ep-list { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; background: var(--lav2); }
.ep-msg { max-width: 82%; padding: 10px 13px; border-radius: 14px; font-size: .92rem; line-height: 1.4; }
.ep-msg p { margin: 0; white-space: pre-wrap; }
.ep-msg.bot { align-self: flex-start; background: #fff; color: var(--ink); border: 1px solid #F0E0D4; border-bottom-left-radius: 4px; }
.ep-msg.user { align-self: flex-end; background: var(--magenta); color: #fff; border-bottom-right-radius: 4px; }
.ep-typing { display: flex; gap: 4px; align-items: center; }
.ep-typing span { width: 7px; height: 7px; border-radius: 50%; background: #C8A99A; animation: epblink 1s infinite; }
.ep-typing span:nth-child(2) { animation-delay: .2s; }
.ep-typing span:nth-child(3) { animation-delay: .4s; }
@keyframes epblink { 0%, 60%, 100% { opacity: .3; } 30% { opacity: 1; } }
.ep-input { display: flex; gap: 8px; padding: 10px 12px 6px; background: #fff; }
.ep-input input { flex: 1; border: 1px solid #E7D8CC; border-radius: 999px; padding: 11px 16px; font-family: inherit; font-size: .95rem; }
.ep-input input:focus { outline: none; border-color: var(--magenta); box-shadow: 0 0 0 3px rgba(232, 80, 58, .15); }
.ep-send { flex: none; width: 44px; height: 44px; border-radius: 50%; border: none; background: var(--magenta); color: #fff; font-size: 1rem; cursor: pointer; }
.ep-send:disabled { opacity: .45; cursor: not-allowed; }
.ep-wa { display: block; text-align: center; font-size: .78rem; color: var(--magenta); padding: 4px 0 12px; background: #fff; text-decoration: none; }
.ep-wa:hover { text-decoration: underline; }

@media (max-width: 1080px) { .eros-launcher { bottom: 140px; right: 16px; } }
@media (max-width: 480px) {
  .eros-panel { right: 8px; left: 8px; bottom: 8px; width: auto; max-width: none; height: 82vh; }
}
.eros-enter-active, .eros-leave-active { transition: opacity .25s ease, transform .28s var(--ease-out); }
.eros-enter-from, .eros-leave-to { opacity: 0; transform: translateY(18px) scale(.97); }
@media (prefers-reduced-motion: reduce) { .eros-enter-active, .eros-leave-active { transition: opacity .15s; } .eros-enter-from, .eros-leave-to { transform: none; } .ep-typing span { animation: none; } }
</style>
