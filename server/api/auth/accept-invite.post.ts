import { acceptInviteSchema } from '#shared/schemas/settings'

export default defineEventHandler(async (event) => {
  rateLimit(event, 'invite', 10, 60_000)
  const data = await body(event, acceptInviteSchema)
  const invite = await prisma.invite.findUnique({ where: { token: data.token } })
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) throw createError({ statusCode: 400, statusMessage: 'Приглашение недействительно' })
  let user = await prisma.user.findUnique({ where: { email: invite.email } })
  if (user) {
    if (!(await verifyUserPassword(user.passwordHash, data.password))) throw createError({ statusCode: 422, statusMessage: 'У вас уже есть аккаунт — введите его пароль' })
  }
  else {
    user = await prisma.user.create({ data: { email: invite.email, name: data.name, passwordHash: await hashUserPassword(data.password) } })
  }
  const member = await prisma.member.upsert({
    where: { organizationId_userId: { organizationId: invite.organizationId, userId: user.id } },
    create: { organizationId: invite.organizationId, userId: user.id, role: invite.role },
    update: { active: true, role: invite.role },
  })
  await prisma.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } })
  await setUserSession(event, { user: { id: user.id, name: user.name, email: user.email }, memberId: member.id, organizationId: member.organizationId })
  return { ok: true }
})
