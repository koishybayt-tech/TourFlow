export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'tours')
  const t = await ctx.db.tour.findFirst({ where: { id: getRouterParam(event, 'id')!, deletedAt: null }, include: { departure: { include: { _count: { select: { participants: true } } } } } })
  if (!t) notFound('Тур')
  if (t.departure?._count.participants) throw createError({ statusCode: 422, statusMessage: 'На выезде есть участники — переведите тур в архив' })
  if (t.departure) await ctx.db.departure.delete({ where: { id: t.departure.id } })
  await ctx.db.tour.update({ where: { id: t.id }, data: { deletedAt: new Date(), slug: `deleted-${t.id}` } })
  await audit({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'tour.delete', entity: 'Tour', entityId: t.id, meta: { name: t.name } })
  return { ok: true }
})
