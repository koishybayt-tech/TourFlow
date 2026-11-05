import { accessibleDeal } from '../../../services/access'
import { closeSystemTasks, loadStages, logDeal } from '../../../services/deals'

/** «Завершить заявку» on the last stage. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'deals')
  const deal = await accessibleDeal(ctx, getRouterParam(event, 'id')!)
  const stages = await loadStages(ctx.db, deal.pipeline)
  const stage = stages.find(s => s.id === deal.stageId)!
  if (stage.order !== stages.length - 1) throw createError({ statusCode: 422, statusMessage: 'Завершить можно только на последнем этапе' })
  await ctx.db.deal.update({ where: { id: deal.id }, data: { wonAt: new Date() } })
  await closeSystemTasks(ctx, deal.id, deal.stageId)
  await logDeal(ctx, deal.id, 'stage', `Этап: ${stage.name} → Заявка успешно завершена`)
  return { ok: true }
})
