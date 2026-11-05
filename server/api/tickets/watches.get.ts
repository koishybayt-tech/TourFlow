export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'tickets')
  return ctx.db.priceWatch.findMany({ where: { userId: ctx.userId }, orderBy: { createdAt: 'desc' } })
})
