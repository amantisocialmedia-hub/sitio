// POST /api/chat — proxy al agente EROS (n8n). El cliente nunca ve la URL de n8n y así
// evitamos CORS. Reenvía { message, sessionId, userName } y devuelve { response }.
import { defineEventHandler, readBody, createError } from 'h3'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const url = config.n8nChatWebhook as string
  if (!url) throw createError({ statusCode: 503, message: 'El chat no está configurado.' })

  const body = await readBody<{ message?: string; sessionId?: string; userName?: string }>(event)
  const message = (body?.message || '').toString().trim().slice(0, 1000)
  const sessionId = (body?.sessionId || '').toString().trim().slice(0, 64)
  if (!message || !sessionId) throw createError({ statusCode: 400, message: 'Falta el mensaje o la sesión.' })

  const fallback = 'Justo ahora no puedo responder. Escríbenos por WhatsApp y te atendemos al instante 💜'
  try {
    const res = await $fetch<{ success?: boolean; response?: string } | string>(url, {
      method: 'POST',
      body: { message, sessionId, userName: (body?.userName || '').toString().slice(0, 60) },
      timeout: 30000,
    })
    const raw = typeof res === 'string' ? res : (res?.response || '')
    // Limpia markdown que el agente a veces mete pese a las instrucciones (se ve feo en chat plano).
    const clean = (raw || '').toString().trim()
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*\*/g, '')
      .replace(/^#{1,6}\s+/gm, '')
    return { response: clean || fallback }
  } catch {
    // n8n caído / sin credencial / timeout → degradamos con gracia.
    return { response: fallback, degraded: true }
  }
})
