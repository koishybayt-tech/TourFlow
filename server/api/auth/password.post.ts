import { changePasswordSchema } from '#shared/schemas/auth'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event)
  const { current, next } = await body(event, changePasswordSchema)
  const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.userId } })
  if (!(await verifyUserPassword(user.passwordHash, current))) {
    throw createError({ statusCode: 422, statusMessage: 'Текущий пароль неверный' })
  }
  await prisma.user.update({ where: { id: ctx.userId }, data: { passwordHash: await hashUserPassword(next) } })
  return { ok: true }
})
