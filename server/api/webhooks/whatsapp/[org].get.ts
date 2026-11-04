/** WhatsApp Cloud API webhook verification (hub.challenge). */
export default defineEventHandler((event) => {
  const q = getQuery(event)
  if (q['hub.mode'] === 'subscribe' && q['hub.verify_token'] && q['hub.verify_token'] === process.env.WHATSAPP_VERIFY_TOKEN) {
    return String(q['hub.challenge'] ?? '')
  }
  throw createError({ statusCode: 403 })
})
