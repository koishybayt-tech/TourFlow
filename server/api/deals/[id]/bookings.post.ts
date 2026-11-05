import { bookingSchema } from '#shared/schemas/package'
import { formatDate } from '#shared/utils/dates'
import { accessibleDeal } from '../../../services/access'
import { autoAdvance, logDeal } from '../../../services/deals'
import { setPackageRequirement } from '../../../services/package'

/** «Создать бронь у оператора»: status REQUEST, or CONFIRMED when the operator number is known. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'package')
  const deal = await accessibleDeal(ctx, getRouterParam(event, 'id')!)
  const b = await body(event, bookingSchema)
  const offer = await ctx.db.offer.findFirst({ where: { id: b.offerId, dealId: deal.id }, include: { operator: true } })
  if (!offer) notFound('Вариант')
  const active = await ctx.db.operatorBooking.findFirst({ where: { dealId: deal.id, status: { not: 'CANCELLED' } } })
  if (active) throw createError({ statusCode: 409, statusMessage: 'По заявке уже есть активная бронь' })
  const booking = await ctx.db.operatorBooking.create({
    data: { organizationId: ctx.organizationId, dealId: deal.id, offerId: offer.id, operatorId: offer.operatorId, number: b.number || null, status: b.number ? 'CONFIRMED' : 'REQUEST', confirmedAt: b.number ? new Date() : null, comment: b.comment || null, paymentDeadline: dateOnly(b.paymentDeadline)!, net: offer.net },
  })
  if (offer.status !== 'CHOSEN') await ctx.db.offer.update({ where: { id: offer.id }, data: { status: 'CHOSEN' } })
  await logDeal(ctx, deal.id, 'booking', `Бронь у ${offer.operator.name}${b.number ? ` № ${b.number}` : ' (запрос)'} · оплатить оператору до ${formatDate(booking.paymentDeadline, { dateOnly: true })}`)
  if (b.number) await setPackageRequirement(ctx, deal.id, 'value', /брон/i, b.number)
  const advanced = await autoAdvance(ctx, deal.id)
  return { id: booking.id, advanced }
})
