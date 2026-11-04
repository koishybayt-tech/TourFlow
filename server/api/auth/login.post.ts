import { loginSchema } from '#shared/schemas/auth'
import { normalizePhone } from '#shared/utils/phone'

export default defineEventHandler(async (event) => {
  checkFailures(event, 'login', 10)
  const { login, password, remember } = await body(event, loginSchema)
  const phone = login.includes('@') ? null : normalizePhone(login)
  const user = await prisma.user.findFirst({
    where: login.includes('@') ? { email: login.toLowerCase() } : { phone: phone ?? '-' },
    include: { members: { where: { active: true }, orderBy: { createdAt: 'asc' } } },
  })
  if (!user || !(await verifyUserPassword(user.passwordHash, password))) {
    recordFailure(event, 'login', 5 * 60_000)
    throw createError({ statusCode: 401, statusMessage: 'Неверный логин или пароль' })
  }
  const member = user.members[0]
  if (!member) throw createError({ statusCode: 403, statusMessage: 'Доступ к агентству отключён' })
  await setUserSession(event, {
    user: { id: user.id, name: user.name, email: user.email },
    memberId: member.id,
    organizationId: member.organizationId,
  }, { maxAge: remember ? 60 * 60 * 24 * 30 : 60 * 60 * 12 })
  return { ok: true }
})
