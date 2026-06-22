// Personalización "Para ti": guarda las respuestas del quiz y los productos vistos
// recientemente (localStorage) y calcula recomendaciones reutilizando el scoring del quiz.
export interface QuizAnswers { who: string; vibe: string; exp: string; budget: string }

// Scoring puro (mismo criterio que el quiz) — exportado para una sola fuente de verdad.
export function scoreProduct(p: any, a: QuizAnswers): number {
  let s = p.rating
  const t = `${p.name} ${p.subtitle || ''} ${(p.badges || []).join(' ')} ${p.description || ''}`.toLowerCase()
  if (a.who === 'pareja' && ['parejas', 'anal', 'bdsm', 'dildos', 'arneses'].includes(p.category)) s += 2.5
  if (a.who === 'mi' && ['vibradores', 'masturbadores', 'hombre', 'retardantes'].includes(p.category)) s += 2.5
  if (a.vibe === 'suave' && (['vibradores', 'lubricantes'].includes(p.category) || /suave|sensual|cl[ií]toris|bala|caric/.test(t))) s += 2
  if (a.vibe === 'intenso' && (['masturbadores'].includes(p.category) || /succi|potente|intens|xl|magnum|grande|turbo/.test(t))) s += 2
  if (a.vibe === 'explorar' && (['anal', 'bdsm', 'arneses'].includes(p.category) || /explora|nuevo|kit|doble|set/.test(t))) s += 2
  if (a.vibe === 'discreto' && /silenci|discret|bala|mini|l[áa]piz|lipstick|viaje|pocket/.test(t)) s += 2.5
  if (a.exp === 'principiante' && (/principiante|primera|suave|f[áa]cil|mini|bala/.test(t) || p.price < 700)) s += 2
  if (a.exp === 'experto' && (['bdsm', 'anal'].includes(p.category) || /xl|monster|intens|avanzad|doble/.test(t))) s += 1.5
  if (a.budget === 'bajo') s += p.price <= 600 ? 1.8 : -2
  if (a.budget === 'medio') s += p.price > 600 && p.price <= 1500 ? 1.8 : -0.5
  if (a.budget === 'alto') s += p.price > 1200 ? 1.2 : 0
  return s
}

export function usePersonalization() {
  const { products } = useProducts()
  const answers = useState<QuizAnswers | null>('amanti-quiz', () => null)
  const recent = useState<string[]>('amanti-recent', () => [])

  function hydrate() {
    if (!import.meta.client) return
    try { const a = localStorage.getItem('amanti_quiz'); if (a) answers.value = JSON.parse(a) } catch {}
    try { const r = localStorage.getItem('amanti_recent'); if (r) recent.value = JSON.parse(r) } catch {}
  }
  function saveAnswers(a: QuizAnswers) {
    answers.value = { ...a }
    try { localStorage.setItem('amanti_quiz', JSON.stringify(answers.value)) } catch {}
  }
  function addRecent(slug: string) {
    const next = [slug, ...recent.value.filter(s => s !== slug)].slice(0, 12)
    recent.value = next
    try { localStorage.setItem('amanti_recent', JSON.stringify(next)) } catch {}
  }

  const recommendations = computed(() => {
    const a = answers.value
    if (!a) return []
    return [...products]
      .map(p => ({ p, s: scoreProduct(p, a) }))
      .sort((x, y) => y.s - x.s)
      .slice(0, 8)
      .map(x => x.p)
  })
  // Vistos recientemente (resueltos del catálogo, en orden).
  const recentProducts = computed(() =>
    recent.value.map(slug => products.find(p => p.slug === slug)).filter(Boolean) as any[],
  )

  return { answers, recent, hydrate, saveAnswers, addRecent, recommendations, recentProducts }
}
