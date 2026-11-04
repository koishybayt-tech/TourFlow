import { z } from 'zod'
import { ingestIncoming } from '../../services/inbox'

/** Demo helper (mock provider only): simulates an incoming message from a client. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'inbox')
  if (process.env.MESSAGING_PROVIDER === 'real') throw createError({ statusCode: 404 })
  const data = await body(event, z.object({
    channel: z.enum(['WHATSAPP', 'INSTAGRAM', 'SITE']),
    phone: z.string().min(10),
    name: z.string().trim().min(1),
    text: z.string().trim().min(1),
  }))
  const conv = await ingestIncoming(ctx.organizationId, { ...data, externalId: data.phone.replace(/\D/g, '') })
  return { id: conv.id }
})
