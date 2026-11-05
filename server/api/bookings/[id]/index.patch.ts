import { z } from 'zod'
import { formatMoney } from '#shared/utils/money'
import { autoAdvance, logDeal } from '../../../services/deals'
import { setPackageRequirement } from '../../../services/package'

const LABEL = { REQUEST: 'Запрос', CONFIRMED: 'Подтверждена', PAID: 'Оплачена', CANCELLED: 'Аннулирована' }

/** Booking status: Запрос → Подтверждена (number) → Оплачена / Аннулирована (reason, penalty). */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'package')
  const b = await ctx.db.operatorBooking.findFirst({ where: { id: getRouterParam(event, 'id')!, deal: dealScope(ctx) } })
  if (!b) notFound('Бронь')
  const d = await body(event, z.object({ status: z.enum(['REQUEST', 'CONFIRMED', 'PAID', 'CANCELLED']).optional(), number: z.string().trim().optional(), paymentDeadline: z.string().optional(), cancelReason: z.string().trim().optional(), penalty: z.number().int().min(0).optional() }))
  if (d.status === 'CONFIRMED' && !(d.number || b.number)) throw createError({ statusCode: 422, statusMessage: 'Укажите номер брони у оператора' })
  if (d.status === 'CANCELLED' && !d.cancelReason) throw createError({ statusCode: 422, statusMessage: 'Укажите причину аннуляции' })
  await ctx.db.operatorBooking.update({
    where: { id: b.id },
    data: {
      ...(d.status ? { status: d.status } : {}), ...(d.number ? { number: d.number } : {}),
      ...(d.paymentDeadline ? { paymentDeadline: dateOnly(d.paymentDeadline)! } : {}),
      ...(d.status === 'CONFIRMED' && !b.confirmedAt ? { confirmedAt: new Date() } : {}),
      ...(d.status === 'CANCELLED' ? { cancelReason: d.cancelReason, penalty: d.penalty ?? 0 } : {}),
    },
  })
  if (d.status) await logDeal(ctx, b.dealId, 'booking', `Бронь${d.number ?? b.number ? ` № ${d.number ?? b.number}` : ''}: ${LABEL[b.status]} → ${LABEL[d.status]}${d.cancelReason ? ` · ${d.cancelReason}${d.penalty ? `, штраф ${formatMoney(d.penalty)}` : ''}` : ''}`)
  if (d.number) await setPackageRequirement(ctx, b.dealId, 'value', /брон/i, d.number)
  const advanced = await autoAdvance(ctx, b.dealId)
  return { ok: true, advanced }
})
