export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event)
  return ctx.db.notification.findMany({ where: { memberId: ctx.memberId }, orderBy: { createdAt: 'desc' }, take: 30 })
})
