import { pipelineChangeSchema } from '#shared/schemas/deals'
import { PIPELINE_LABELS } from '#shared/domain/types'
import { accessibleDeal } from '../../../services/access'
import { autoAdvance, closeSystemTasks, loadStages, logDeal, openSystemTask } from '../../../services/deals'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'deals')
  const deal = await accessibleDeal(ctx, getRouterParam(event, 'id')!)
  const input = await body(event, pipelineChangeSchema)
  if (input.pipeline === deal.pipeline) throw createError({ statusCode: 422, statusMessage: 'Заявка уже в этой воронке' })
  const stages = await loadStages(ctx.db, input.pipeline)
  const target = stages.find(s => s.order === input.order) ?? stages[0]!
  await closeSystemTasks(ctx, deal.id, deal.stageId, 'Закрыта: заявка переведена в другую воронку')
  await ctx.db.deal.update({ where: { id: deal.id }, data: { pipeline: input.pipeline, stageId: target.id, departureId: input.pipeline === 'GROUP' ? input.departureId ?? deal.departureId : null } })
  await openSystemTask(ctx, deal, target)
  await logDeal(ctx, deal.id, 'stage', `Воронка: ${PIPELINE_LABELS[deal.pipeline]} → ${PIPELINE_LABELS[input.pipeline]}, этап «${target.name}» · ${input.reason}`)
  const advanced = await autoAdvance(ctx, deal.id)
  return { ok: true, advanced }
})
