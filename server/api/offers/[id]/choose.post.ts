import { formatMoney } from '#shared/utils/money'
import { formatRange } from '#shared/utils/dates'
import { autoAdvance, logDeal } from '../../../services/deals'
import { setPackageRequirement } from '../../../services/package'

/** «Клиент выбрал»: other offers become «Не выбран», the deal takes the offer price and dates. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'package')
  const offer = await ctx.db.offer.findFirst({ where: { id: getRouterParam(event, 'id')!, deal: dealScope(ctx) }, include: { operator: { select: { name: true } } } })
  if (!offer) notFound('Вариант')
  await ctx.db.offer.updateMany({ where: { dealId: offer.dealId, id: { not: offer.id } }, data: { status: 'REJECTED' } })
  await ctx.db.offer.update({ where: { id: offer.id }, data: { status: 'CHOSEN' } })
  await ctx.db.deal.update({ where: { id: offer.dealId }, data: { price: offer.price, dates: formatRange(offer.fromDate, offer.toDate) } })
  await logDeal(ctx, offer.dealId, 'offer', `Клиент выбрал: ${offer.hotel} ${offer.stars}★, ${offer.operator.name} · ${formatMoney(offer.price)}`)
  await setPackageRequirement(ctx, offer.dealId, 'comment', /какой вариант/i, `${offer.hotel} ${offer.stars}★, ${offer.operator.name}`)
  const advanced = await autoAdvance(ctx, offer.dealId)
  return { ok: true, advanced }
})
