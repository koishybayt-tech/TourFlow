import { DEFAULT_MODULES, type Modules } from '#shared/permissions'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event)
  const [org, user, members] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId }, select: { id: true, name: true, modules: true, city: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { id: true, name: true, email: true, phone: true, position: true, telegramChatId: true } }),
    ctx.db.member.findMany({ where: { active: true }, include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: 'asc' } }),
  ])
  return {
    user,
    member: { id: ctx.memberId, role: ctx.role },
    org: { id: org.id, name: org.name, city: org.city, modules: { ...DEFAULT_MODULES, ...(org.modules as Partial<Modules>) } },
    members: members.map(m => ({ id: m.id, name: m.user.name, email: m.user.email, role: m.role, onVacation: m.onVacation, signRight: m.signRight })),
  }
})
