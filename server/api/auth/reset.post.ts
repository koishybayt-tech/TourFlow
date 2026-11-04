import { resetSchema } from '#shared/schemas/auth'

export default defineEventHandler(async (event) => {
  rateLimit(event, 'reset', 10, 60_000)
  const { token, password } = await body(event, resetSchema)
  const reset = await prisma.passwordReset.findUnique({ where: { token } })
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    throw createError({ statusCode: 400, statusMessage: 'Ссылка устарела. Запросите восстановление ещё раз' })
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: await hashUserPassword(password) } }),
    prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
  ])
  return { ok: true }
})
