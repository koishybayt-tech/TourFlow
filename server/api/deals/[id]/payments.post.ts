import { paymentSchema } from '#shared/schemas/deals'
import { formatMoney } from '#shared/utils/money'
import { accessibleDeal } from '../../../services/access'
import { autoAdvance, logDeal, notify } from '../../../services/deals'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'payments')
  const deal = await accessibleDeal(ctx, getRouterParam(event, 'id')!)
  const p = await body(event, paymentSchema)
  await ctx.db.payment.create({ data: { organizationId: ctx.organizationId, dealId: deal.id, amount: p.amount, type: p.type, method: p.method, comment: p.comment || null, paidAt: p.paidAt ? new Date(p.paidAt) : new Date(), createdById: ctx.memberId } })
  await logDeal(ctx, deal.id, 'pay', `Оплата ${formatMoney(p.amount)} (${p.type}, ${p.method})`)
  const owner = await ctx.db.member.findFirst({ where: { role: 'OWNER', active: true, id: { not: ctx.memberId } } })
  await notify(ctx.organizationId, owner?.id, 'Оплата получена', `№${deal.number} · ${formatMoney(p.amount)}`, `/deals/${deal.id}`)
  const advanced = await autoAdvance(ctx, deal.id)
  return { ok: true, advanced }
})
