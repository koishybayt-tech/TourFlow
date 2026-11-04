import { z } from 'zod'
import { ROLE_LABELS, type Role } from '#shared/permissions'

export default defineEventHandler(async (event) => {
  const { token } = queryOf(event, z.object({ token: z.string().min(10) }))
  const invite = await prisma.invite.findUnique({ where: { token }, include: { organization: { select: { name: true } } } })
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) throw createError({ statusCode: 404, statusMessage: 'Приглашение недействительно' })
  const user = await prisma.user.findUnique({ where: { email: invite.email }, select: { id: true } })
  return { email: invite.email, org: invite.organization.name, role: ROLE_LABELS[invite.role as Role], hasAccount: !!user }
})
