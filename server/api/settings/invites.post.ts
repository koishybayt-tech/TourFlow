import { inviteSchema } from '#shared/schemas/settings'
import { ROLE_LABELS } from '#shared/permissions'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'settings')
  const { email, role } = await body(event, inviteSchema)
  const lower = email.toLowerCase()
  const existing = await ctx.db.member.findFirst({ where: { user: { email: lower } } })
  if (existing) throw createError({ statusCode: 409, statusMessage: 'Этот сотрудник уже в команде' })
  const token = randomToken()
  const invite = await ctx.db.invite.create({ data: { organizationId: ctx.organizationId, email: lower, role, token, expiresAt: new Date(Date.now() + 7 * 86_400_000) } })
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId }, select: { name: true } })
  const url = `${useRuntimeConfig().public.baseUrl}/invite?token=${token}`
  await sendMail(lower, `Приглашение в ${org.name} — Tourflow`, `${ctx.name} приглашает вас в ${org.name} (роль: ${ROLE_LABELS[role]}).\n\nПринять приглашение (действует 7 дней):\n${url}`)
    .catch(e => console.error('mail failed', e))
  return { id: invite.id, url }
})
