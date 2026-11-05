import { refundSchema } from '#shared/schemas/deals'
import { formatMoney } from '#shared/utils/money'
import { formatRange } from '#shared/utils/dates'
import { accessibleDeal } from '../../../services/access'
import { logDeal } from '../../../services/deals'

/** «Возврат / перенос» (docs/02_FEATURES.md §5.3). A refund is a negative payment. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'payments')
  const deal = await accessibleDeal(ctx, getRouterParam(event, 'id')!)
  const r = await body(event, refundSchema)
  if (r.kind === 'refund') {
    if (!r.amount) throw createError({ statusCode: 422, statusMessage: 'Укажите сумму возврата' })
    await ctx.db.payment.create({ data: { organizationId: ctx.organizationId, dealId: deal.id, amount: -r.amount, type: 'Возврат', method: r.method || 'Перевод на счёт', comment: [r.hold ? `удержано ${formatMoney(r.hold)}` : '', r.comment].filter(Boolean).join(' · ') || null, paidAt: new Date(), createdById: ctx.memberId } })
    await logDeal(ctx, deal.id, 'pay', `Возврат ${formatMoney(r.amount)}${r.hold ? `, удержание ${formatMoney(r.hold)}` : ''}${r.comment ? ` · ${r.comment}` : ''}`)
  }
  else if (r.kind === 'transfer') {
    const dep = r.toDepartureId ? await ctx.db.departure.findFirst({ where: { id: r.toDepartureId } }) : null
    if (!dep) throw createError({ statusCode: 422, statusMessage: 'Выберите выезд для переноса' })
    await ctx.db.deal.update({ where: { id: deal.id }, data: { departureId: dep.id, dates: formatRange(dep.startDate, dep.endDate), fullPayDeadline: dep.payDeadline, price: dep.price * deal.people + r.hold } })
    await ctx.db.participant.updateMany({ where: { dealId: deal.id }, data: { departureId: dep.id } })
    await logDeal(ctx, deal.id, 'system', `Перенос на выезд ${dep.name}, ${formatRange(dep.startDate, dep.endDate)}${r.hold ? ` · удержание ${formatMoney(r.hold)} добавлено к стоимости` : ''}${r.comment ? ` · ${r.comment}` : ''}`)
  }
  else {
    if (!r.replaceName) throw createError({ statusCode: 422, statusMessage: 'Укажите нового туриста' })
    await logDeal(ctx, deal.id, 'system', `Замена туриста на ${r.replaceName}${r.hold ? ` · удержание ${formatMoney(r.hold)}` : ''}${r.comment ? ` · ${r.comment}` : ''}`)
  }
  return { ok: true }
})
