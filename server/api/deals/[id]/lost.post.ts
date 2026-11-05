import { lostSchema } from '#shared/schemas/deals'
import { accessibleDeal } from '../../../services/access'
import { closeSystemTasks, logDeal } from '../../../services/deals'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'deals')
  const deal = await accessibleDeal(ctx, getRouterParam(event, 'id')!)
  const { reason, comment } = await body(event, lostSchema)
  await ctx.db.deal.update({ where: { id: deal.id }, data: { lostAt: new Date(), lostReason: reason, lostComment: comment || null } })
  await closeSystemTasks(ctx, deal.id, deal.stageId, 'Закрыта: отказ по заявке')
  await logDeal(ctx, deal.id, 'lost', `Закрыта с отказом: ${reason}${comment ? ` · ${comment}` : ''}`)
  return { ok: true }
})
