import { offerSchema } from '#shared/schemas/package'
import { formatMoney } from '#shared/utils/money'
import { accessibleDeal } from '../../../services/access'
import { logDeal } from '../../../services/deals'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'package')
  const deal = await accessibleDeal(ctx, getRouterParam(event, 'id')!)
  const o = await body(event, offerSchema)
  const op = await ctx.db.operator.findFirst({ where: { id: o.operatorId } })
  if (!op) notFound('Туроператор')
  const offer = await ctx.db.offer.create({
    data: { organizationId: ctx.organizationId, dealId: deal.id, operatorId: op.id, hotel: o.hotel, stars: o.stars, resort: o.resort, fromDate: dateOnly(o.fromDate)!, toDate: dateOnly(o.toDate)!, meal: o.meal, room: o.room, flight: o.flight, transfer: o.transfer, insurance: o.insurance, net: o.net, price: o.price, note: o.note || null, source: o.source, externalRef: o.externalRef ?? null },
  })
  await logDeal(ctx, deal.id, 'offer', `Вариант в подборку: ${o.hotel} ${o.stars}★, ${op.name} · ${formatMoney(o.price)}`)
  return { id: offer.id }
})
