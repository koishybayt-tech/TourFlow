import { stageMoveSchema } from '#shared/schemas/deals'
import { accessibleDeal } from '../../../services/access'
import { autoAdvance, moveToStage } from '../../../services/deals'

/** Manual stage change (kanban drag or status dropdown). Always allowed, written to history. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'deals')
  const deal = await accessibleDeal(ctx, getRouterParam(event, 'id')!)
  if (deal.wonAt || deal.lostAt) throw createError({ statusCode: 422, statusMessage: 'Заявка закрыта — сначала верните её в работу' })
  const { order, reason } = await body(event, stageMoveSchema)
  await moveToStage(ctx, deal.id, order, { reason: reason ? `вручную: ${reason}` : 'вручную' })
  const advanced = await autoAdvance(ctx, deal.id)
  publish(ctx.organizationId, { type: 'deal', dealId: deal.id })
  return { ok: true, advanced }
})
