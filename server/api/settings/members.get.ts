export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'settings')
  const [members, invites] = await Promise.all([
    ctx.db.member.findMany({ include: { user: { select: { name: true, email: true, phone: true, position: true } } }, orderBy: { createdAt: 'asc' } }),
    ctx.db.invite.findMany({ where: { acceptedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } }),
  ])
  return {
    members: members.map(m => ({ id: m.id, name: m.user.name, email: m.user.email, phone: m.user.phone, position: m.user.position, role: m.role, onVacation: m.onVacation, signRight: m.signRight, active: m.active, isMe: m.id === ctx.memberId })),
    invites: invites.map(i => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt })),
  }
})
