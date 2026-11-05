import { accessibleDeal } from '../../../services/access'
import { loadStages, logDeal, openSystemTask } from '../../../services/deals'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'deals')
  const deal = await accessibleDeal(ctx, getRouterParam(event, 'id')!)
  await ctx.db.deal.update({ where: { id: deal.id }, data: { lostAt: null, lostReason: null, lostComment: null, wonAt: null } })
  const stage = (await loadStages(ctx.db, deal.pipeline)).find(s => s.id === deal.stageId)
  if (stage) await openSystemTask(ctx, deal, stage)
  await logDeal(ctx, deal.id, 'system', 'Заявка возвращена в работу')
  return { ok: true }
})
