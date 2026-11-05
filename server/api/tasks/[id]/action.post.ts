import { taskActionSchema } from '#shared/schemas/deals'
import { autoAdvance, loadStages, logDeal, moveToStage } from '../../../services/deals'
import { accessibleTask, appendLog } from '../../../services/tasks'

const LABEL = { TODO: 'Новая', IN_PROGRESS: 'В работе', DONE: 'Выполнена' } as const

/** Task status changes only through these actions: start → complete (result required) → reopen. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'tasks')
  const t = await accessibleTask(ctx, getRouterParam(event, 'id')!)
  const { action, result } = await body(event, taskActionSchema)
  let to: keyof typeof LABEL
  if (action === 'start') {
    if (t.status !== 'TODO') throw createError({ statusCode: 422, statusMessage: 'Задача уже в работе' })
    to = 'IN_PROGRESS'
  }
  else if (action === 'complete') {
    if (t.status === 'DONE') throw createError({ statusCode: 422, statusMessage: 'Задача уже выполнена' })
    if (!result) throw createError({ statusCode: 422, statusMessage: 'Опишите результат выполнения' })
    to = 'DONE'
  }
  else {
    if (t.status !== 'DONE') throw createError({ statusCode: 422, statusMessage: 'Вернуть можно только выполненную задачу' })
    to = 'IN_PROGRESS'
  }
  await ctx.db.task.update({
    where: { id: t.id },
    data: {
      status: to,
      result: action === 'complete' ? result : action === 'reopen' ? null : t.result,
      completedAt: to === 'DONE' ? new Date() : null,
      log: appendLog(t.log, `Статус: ${LABEL[t.status]} → ${LABEL[to]}${result ? ` · ${result}` : ''} · ${ctx.name}`, ctx.name),
    },
  })
  let advanced = null
  let moved = null
  if (t.dealId) {
    if (action === 'complete') await logDeal(ctx, t.dealId, 'task', `Задача выполнена: ${t.title} · ${result}`)
    const deal = await ctx.db.deal.findFirst({ where: { id: t.dealId } })
    // Completing the system task of the current stage moves the deal on, even if the regulation is not fully met.
    if (action === 'complete' && t.isSystem && deal && deal.stageId === t.stageId && !deal.wonAt && !deal.lostAt) {
      const stages = await loadStages(ctx.db, deal.pipeline)
      const cur = stages.find(s => s.id === deal.stageId)!
      const next = stages.find(s => s.order === cur.order + 1)
      if (next) {
        await moveToStage(ctx, deal.id, next.order, { reason: 'системная задача завершена' })
        moved = { from: cur.name, to: next.name }
      }
    }
    advanced = await autoAdvance(ctx, t.dealId)
  }
  publish(ctx.organizationId, { type: 'task', taskId: t.id })
  return { ok: true, status: to, moved, advanced }
})
