import { taskCreateSchema } from '#shared/schemas/deals'
import { logDeal, notify } from '../../services/deals'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'tasks')
  const d = await body(event, taskCreateSchema)
  let stageId = d.stageId ?? null
  if (d.dealId) {
    const deal = await ctx.db.deal.findFirst({ where: { id: d.dealId, deletedAt: null, ...dealScope(ctx) } })
    if (!deal) notFound('Заявка')
    // Tasks created from a deal are linked to its current stage by default.
    if (d.stageId === undefined) stageId = deal.stageId
  }
  const assigneeId = d.assigneeId === undefined ? ctx.memberId : d.assigneeId
  const t = await ctx.db.task.create({
    data: {
      organizationId: ctx.organizationId, title: d.title, description: d.description || null, priority: d.priority, dueAt: d.dueAt ? new Date(d.dueAt) : null,
      assigneeId, authorId: ctx.memberId, dealId: d.dealId ?? null, departureId: d.departureId ?? null, stageId, subtasks: d.subtasks ?? [],
      log: [{ at: new Date().toISOString(), text: `Задача создана · ${ctx.name}`, actor: ctx.name }],
    },
  })
  if (d.dealId) await logDeal(ctx, d.dealId, 'task', `Задача: ${d.title}`)
  if (assigneeId && assigneeId !== ctx.memberId) await notify(ctx.organizationId, assigneeId, 'Вам назначена задача', d.title, `/tasks?task=${t.id}`)
  publish(ctx.organizationId, { type: 'task', taskId: t.id })
  return { id: t.id }
})
