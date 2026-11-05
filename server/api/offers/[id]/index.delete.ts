export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'package')
  const offer = await ctx.db.offer.findFirst({ where: { id: getRouterParam(event, 'id')!, deal: dealScope(ctx) }, include: { _count: { select: { bookings: true } } } })
  if (!offer) notFound('Вариант')
  if (offer._count.bookings) throw createError({ statusCode: 422, statusMessage: 'По варианту есть бронь — сначала аннулируйте её' })
  await ctx.db.offer.delete({ where: { id: offer.id } })
  return { ok: true }
})
