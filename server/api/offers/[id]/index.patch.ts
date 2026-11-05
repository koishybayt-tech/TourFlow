import { offerSchema } from '#shared/schemas/package'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'package')
  const offer = await ctx.db.offer.findFirst({ where: { id: getRouterParam(event, 'id')!, deal: dealScope(ctx) } })
  if (!offer) notFound('Вариант')
  const o = await body(event, offerSchema)
  await ctx.db.offer.update({ where: { id: offer.id }, data: { operatorId: o.operatorId, hotel: o.hotel, stars: o.stars, resort: o.resort, fromDate: dateOnly(o.fromDate)!, toDate: dateOnly(o.toDate)!, meal: o.meal, room: o.room, flight: o.flight, transfer: o.transfer, insurance: o.insurance, net: o.net, price: o.price, note: o.note || null } })
  return { ok: true }
})
