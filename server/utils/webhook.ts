import { createHmac, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

/** Verifies Meta's X-Hub-Signature-256 header (HMAC-SHA256 of the raw body with the app secret). */
export async function verifyMetaSignature(event: H3Event, secret: string | undefined): Promise<string> {
  const raw = (await readRawBody(event, 'utf8')) ?? ''
  if (!secret) throw createError({ statusCode: 503, statusMessage: 'Канал не настроен' })
  const header = getRequestHeader(event, 'x-hub-signature-256') ?? ''
  const expected = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`
  const a = Buffer.from(header)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw createError({ statusCode: 401, statusMessage: 'Invalid signature' })
  return raw
}

export async function orgExists(id: string) {
  return !!(await prisma.organization.findUnique({ where: { id }, select: { id: true } }))
}
