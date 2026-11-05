import { z } from 'zod'
import { formatMoney } from '#shared/utils/money'
import { autoAdvance, logDeal } from '../../../services/deals'
import { setPackageRequirement } from '../../../services/package'

/** Payment to the operator (partial or full). Fully paid → status PAID and the regulation check. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'payments')
  const b = await ctx.db.operatorBooking.findFirst({ where: { id: getRouterParam(event, 'id')!, deal: dealScope(ctx) }, include: { payments: true } })
  if (!b) notFound('Бронь')
  if (b.status === 'CANCELLED') throw createError({ statusCode: 422, statusMessage: 'Бронь аннулирована' })
  const { amount, method } = await body(event, z.object({ amount: z.number().int().positive('Сумма больше нуля'), method: z.string().default('Перевод на счёт') }))
  await prisma.operatorPayment.create({ data: { bookingId: b.id, amount, method, paidAt: new Date() } })
  const paid = b.payments.reduce((s, p) => s + p.amount, 0) + amount
  if (paid >= b.net) {
    await ctx.db.operatorBooking.update({ where: { id: b.id }, data: { status: 'PAID' } })
    await setPackageRequirement(ctx, b.dealId, 'check', /туроператор/i, true)
  }
  await logDeal(ctx, b.dealId, 'booking', `Оплата туроператору ${formatMoney(amount)} (${method})${paid >= b.net ? ' — оплачено полностью' : `, долг ${formatMoney(b.net - paid)}`}`)
  const advanced = await autoAdvance(ctx, b.dealId)
  return { ok: true, advanced }
})
