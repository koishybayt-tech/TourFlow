import { z } from 'zod'
import { normalizePhone } from '#shared/utils/phone'
import { ingestIncoming } from '../../../services/inbox'

/** Website form: «Оставить заявку». Creates a conversation in the «Сайт» channel. */
export default defineEventHandler(async (event) => {
  rateLimit(event, 'lead', 10, 60_000)
  const org = getRouterParam(event, 'org')!
  const data = await body(event, z.object({
    name: z.string().trim().min(2, 'Укажите имя'),
    phone: z.string().refine(v => !!normalizePhone(v), 'Телефон: +7 и 10 цифр'),
    text: z.string().trim().min(2, 'Опишите запрос').max(2000),
  }))
  if (!(await orgExists(org))) throw createError({ statusCode: 404 })
  const phone = normalizePhone(data.phone)!
  await ingestIncoming(org, { channel: 'SITE', externalId: phone.slice(1), phone, name: data.name, text: data.text })
  return { ok: true }
})
