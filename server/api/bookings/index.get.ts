import { z } from 'zod'

/** Registry of operator bookings with totals (docs/02_FEATURES.md §9.3). */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'package')
  const q = queryOf(event, z.object({ status: z.enum(['active', 'REQUEST', 'CONFIRMED', 'PAID', 'CANCELLED', 'all']).default('active'), operator: z.string().optional() }))
  const where: Record<string, unknown> = { deal: { deletedAt: null, ...dealScope(ctx) } }
  if (q.status === 'active') where.status = { in: ['REQUEST', 'CONFIRMED'] }
  else if (q.status !== 'all') where.status = q.status
  if (q.operator) where.operatorId = q.operator
  const rows = await ctx.db.operatorBooking.findMany({
    where,
    include: { operator: { select: { name: true, commissionPct: true } }, payments: true, offer: { select: { hotel: true, stars: true, fromDate: true, toDate: true, price: true } }, deal: { select: { id: true, number: true, payments: { select: { amount: true } }, client: { select: { name: true } } } } },
    orderBy: { paymentDeadline: 'asc' },
  })
  const week = Date.now() + 7 * 86_400_000
  const list = rows.map((b) => {
    const paidOp = b.payments.reduce((s, p) => s + p.amount, 0)
    const clientPaid = b.deal.payments.reduce((s, p) => s + p.amount, 0)
    return {
      id: b.id, number: b.number, status: b.status, operator: b.operator.name, hotel: `${b.offer.hotel} ${b.offer.stars}★`, dates: { from: b.offer.fromDate, to: b.offer.toDate },
      deal: { id: b.deal.id, number: b.deal.number, client: b.deal.client.name }, net: b.net, paid: paidOp, debt: Math.max(0, b.net - paidOp),
      commission: b.offer.price - b.net, paymentDeadline: b.paymentDeadline, clientPaid, cashGap: b.status !== 'PAID' && b.status !== 'CANCELLED' && clientPaid < b.net - paidOp + paidOp ? Math.max(0, b.net - clientPaid) : 0,
      urgent: b.status !== 'PAID' && b.status !== 'CANCELLED' && +b.paymentDeadline < week,
    }
  })
  const active = list.filter(b => b.status === 'REQUEST' || b.status === 'CONFIRMED')
  const payments7 = active.filter(b => b.urgent).reduce((s, b) => s + b.debt, 0)
  return {
    stats: { active: active.length, debt: active.reduce((s, b) => s + b.debt, 0), payments7, commission: list.filter(b => b.status !== 'CANCELLED').reduce((s, b) => s + b.commission, 0) },
    bookings: list,
  }
})
