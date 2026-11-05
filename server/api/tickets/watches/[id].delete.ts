export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'tickets')
  await ctx.db.priceWatch.deleteMany({ where: { id: getRouterParam(event, 'id')!, userId: ctx.userId } })
  return { ok: true }
})
