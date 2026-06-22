<script setup lang="ts">
const { products } = useProducts()
useHead({ title: 'Encuentra tu match — AMANTI' })
useSeoMeta({
  description: 'Responde 4 preguntas y te recomendamos tu juguete ideal. Sin pena, sin tabúes — a tu manera.',
})

interface Answers { who: string; vibe: string; exp: string; budget: string }
const answers = reactive<Answers>({ who: '', vibe: '', exp: '', budget: '' })

const steps = [
  { key: 'who' as const, q: '¿Para quién es?', sub: 'Sin pena — esto queda entre tú y nosotros.', options: [
    { val: 'mi', label: 'Para mí', emoji: '🌙' },
    { val: 'pareja', label: 'En pareja', emoji: '💞' },
    { val: 'sorpresa', label: 'Sorpréndeme', emoji: '✨' },
  ] },
  { key: 'vibe' as const, q: '¿Qué te llama hoy?', sub: 'Elige la vibra que más te late.', options: [
    { val: 'suave', label: 'Suave y sensual', emoji: '🪶' },
    { val: 'intenso', label: 'Intenso', emoji: '🔥' },
    { val: 'explorar', label: 'Explorar algo nuevo', emoji: '🚀' },
    { val: 'discreto', label: 'Discreto y silencioso', emoji: '🤫' },
  ] },
  { key: 'exp' as const, q: '¿Tu experiencia?', sub: 'Todos empezamos en algún punto.', options: [
    { val: 'principiante', label: 'Es mi primera vez', emoji: '🌱' },
    { val: 'medio', label: 'Algo de experiencia', emoji: '😏' },
    { val: 'experto', label: 'Ya sé lo que me gusta', emoji: '🖤' },
  ] },
  { key: 'budget' as const, q: '¿Tu presupuesto?', sub: 'Hay opciones increíbles en todos los rangos.', options: [
    { val: 'bajo', label: 'Hasta $500', emoji: '💸' },
    { val: 'medio', label: '$500 – $1,500', emoji: '💳' },
    { val: 'alto', label: 'Lo mejor, sin límite', emoji: '👑' },
  ] },
]

const stepIdx = ref(0)
const done = ref(false)
const progress = computed(() => Math.round(((done.value ? steps.length : stepIdx.value) / steps.length) * 100))

function choose(key: keyof Answers, val: string) {
  answers[key] = val
  if (stepIdx.value < steps.length - 1) stepIdx.value++
  else done.value = true
}
function back() {
  if (done.value) done.value = false
  else if (stepIdx.value > 0) stepIdx.value--
}
function restart() {
  stepIdx.value = 0
  done.value = false
  ;(Object.keys(answers) as (keyof Answers)[]).forEach((k) => (answers[k] = ''))
}

function score(p: any) {
  let s = p.rating
  const t = (p.name + ' ' + (p.subtitle || '') + ' ' + (p.badges || []).join(' ') + ' ' + (p.description || '')).toLowerCase()
  if (answers.who === 'pareja' && ['parejas', 'anal', 'bdsm', 'dildos', 'arneses'].includes(p.category)) s += 2.5
  if (answers.who === 'mi' && ['vibradores', 'masturbadores', 'hombre', 'retardantes'].includes(p.category)) s += 2.5
  if (answers.vibe === 'suave' && (['vibradores', 'lubricantes'].includes(p.category) || /suave|sensual|cl[ií]toris|bala|caric/.test(t))) s += 2
  if (answers.vibe === 'intenso' && (['masturbadores'].includes(p.category) || /succi|potente|intens|xl|magnum|grande|turbo/.test(t))) s += 2
  if (answers.vibe === 'explorar' && (['anal', 'bdsm', 'arneses'].includes(p.category) || /explora|nuevo|kit|doble|set/.test(t))) s += 2
  if (answers.vibe === 'discreto' && /silenci|discret|bala|mini|l[áa]piz|lipstick|viaje|pocket/.test(t)) s += 2.5
  if (answers.exp === 'principiante' && (/principiante|primera|suave|f[áa]cil|mini|bala/.test(t) || p.price < 700)) s += 2
  if (answers.exp === 'experto' && (['bdsm', 'anal'].includes(p.category) || /xl|monster|intens|avanzad|doble/.test(t))) s += 1.5
  if (answers.budget === 'bajo') s += p.price <= 600 ? 1.8 : -2
  if (answers.budget === 'medio') s += p.price > 600 && p.price <= 1500 ? 1.8 : -0.5
  if (answers.budget === 'alto') s += p.price > 1200 ? 1.2 : 0
  return s
}
const matches = computed(() =>
  [...products].map((p) => ({ p, s: score(p) })).sort((a, b) => b.s - a.s).slice(0, 3).map((x) => x.p),
)
</script>

<template>
  <div class="quiz-wrap">
    <div class="quiz-card">
      <div class="quiz-top">
        <NuxtLink to="/" class="quiz-brand">amanti</NuxtLink>
        <div class="quiz-bar"><div class="quiz-fill" :style="{ width: progress + '%' }"></div></div>
      </div>

      <Transition name="qfade" mode="out-in">
        <!-- preguntas -->
        <div v-if="!done" :key="stepIdx" class="quiz-step">
          <span class="quiz-eyebrow">Pregunta {{ stepIdx + 1 }} de {{ steps.length }}</span>
          <h1>{{ steps[stepIdx].q }}</h1>
          <p class="quiz-sub">{{ steps[stepIdx].sub }}</p>
          <div class="quiz-opts">
            <button
              v-for="o in steps[stepIdx].options"
              :key="o.val"
              class="quiz-opt"
              :class="{ on: answers[steps[stepIdx].key] === o.val }"
              @click="choose(steps[stepIdx].key, o.val)"
            >
              <span class="qo-emo">{{ o.emoji }}</span>
              <span class="qo-label">{{ o.label }}</span>
            </button>
          </div>
          <button v-if="stepIdx > 0" class="quiz-back" @click="back">← Atrás</button>
        </div>

        <!-- resultado -->
        <div v-else key="result" class="quiz-result">
          <span class="quiz-eyebrow">Tu match ideal 💜</span>
          <h1>Esto es para ti</h1>
          <p class="quiz-sub">Elegimos estos 3 pensando en tus respuestas. ¿Dudas? Escríbenos por WhatsApp, sin pena.</p>
          <div class="quiz-grid grid">
            <ProductCard v-for="(p, i) in matches" :key="p.slug" :product="p" v-reveal :data-reveal-index="i" />
          </div>
          <div class="quiz-actions">
            <NuxtLink to="/tienda" class="btn">Ver toda la tienda</NuxtLink>
            <button class="btn outline" @click="restart">Repetir el quiz</button>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.quiz-wrap { min-height: 70vh; display: grid; place-items: center; padding: 36px 18px 70px; }
.quiz-card { width: 100%; max-width: 720px; background: #fff; border: 1px solid #F0E0D4; border-radius: 22px; padding: 34px 32px 38px; box-shadow: 0 40px 80px -50px rgba(91, 42, 134, .5); }
.quiz-top { display: flex; align-items: center; gap: 16px; margin-bottom: 26px; }
.quiz-brand { font-family: var(--fs); font-size: 1.7rem; color: var(--purple); flex: none; }
.quiz-bar { flex: 1; height: 8px; border-radius: 999px; background: #EFE0D4; overflow: hidden; }
.quiz-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--magenta), var(--pink)); transition: width .4s var(--ease-out); }
.quiz-eyebrow { font-family: var(--fb); font-weight: 700; font-size: .78rem; letter-spacing: .12em; text-transform: uppercase; color: var(--magenta); }
.quiz-step h1, .quiz-result h1 { font-size: clamp(1.7rem, 4vw, 2.5rem); margin: 8px 0 6px; }
.quiz-sub { opacity: .72; margin-bottom: 24px; max-width: 48ch; }
.quiz-opts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.quiz-opt { display: flex; align-items: center; gap: 14px; padding: 18px 20px; border: 2px solid #EEDfD4; border-radius: 14px; background: #fff; cursor: pointer; font-family: inherit; font-size: 1.02rem; font-weight: 600; color: var(--purple); text-align: left; transition: border-color .16s, transform .16s, box-shadow .16s; }
.quiz-opt:hover { border-color: var(--magenta); transform: translateY(-3px); box-shadow: 0 16px 30px -20px rgba(232, 80, 58, .5); }
.quiz-opt.on { border-color: var(--magenta); background: #FFF3EE; }
.qo-emo { font-size: 1.7rem; }
.quiz-back { margin-top: 22px; background: none; border: none; color: var(--magenta); font-weight: 700; cursor: pointer; font-size: .92rem; }
.quiz-grid { margin: 8px 0 24px; }
.quiz-actions { display: flex; gap: 12px; flex-wrap: wrap; }
.qfade-enter-active, .qfade-leave-active { transition: opacity .28s ease, transform .3s var(--ease-out); }
.qfade-enter-from { opacity: 0; transform: translateY(10px); }
.qfade-leave-to { opacity: 0; transform: translateY(-8px); }
@media (max-width: 560px) { .quiz-opts { grid-template-columns: 1fr; } .quiz-card { padding: 24px 20px 30px; } .quiz-grid.grid { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { .qfade-enter-active, .qfade-leave-active { transition: opacity .12s; } .qfade-enter-from, .qfade-leave-to { transform: none; } }
</style>
