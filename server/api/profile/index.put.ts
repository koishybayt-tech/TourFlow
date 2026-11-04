import { z } from 'zod'
import { normalizePhone } from '#shared/utils/phone'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event)
  const data = await body(event, z.object({
    name: z.string().trim().min(2, 'Укажите имя'),
    position: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    telegramChatId: z.string().trim().optional(),
  }))
  const phone = data.phone ? normalizePhone(data.phone) : null
  if (data.phone && !phone) throw createError({ statusCode: 422, statusMessage: 'Телефон: +7 и 10 цифр' })
  await prisma.user.update({ where: { id: ctx.userId }, data: { name: data.name, position: data.position || null, phone, telegramChatId: data.telegramChatId || null } })
  const session = await getUserSession(event)
  await replaceUserSession(event, { ...session, user: { ...session.user!, name: data.name } })
  return { ok: true }
})
