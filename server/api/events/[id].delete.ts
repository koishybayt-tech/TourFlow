export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'calendar')
  const r = await ctx.db.event.deleteMany({ where: { id: getRouterParam(event, 'id')! } })
  if (!r.count) notFound('Событие')
  return { ok: true }
})
