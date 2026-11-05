import { taskPatchSchema } from '#shared/schemas/deals'
import { notify } from '../../../services/deals'
import { accessibleTask, appendLog } from '../../../services/tasks'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'tasks')
  const t = await accessibleTask(ctx, getRouterParam(event, 'id')!)
  const d = await body(event, taskPatchSchema)
  if (t.isSystem && (d.title !== undefined || d.stageId !== undefined)) throw createError({ statusCode: 422, statusMessage: 'Системную задачу этапа нельзя переименовать или отвязать' })
  const data: Record<string, unknown> = {}
  const notes: string[] = []
  if (d.title !== undefined) data.title = d.title
  if (d.description !== undefined) data.description = d.description || null
  if (d.priority !== undefined && d.priority !== t.priority) {
    data.priority = d.priority
    notes.push('Приоритет изменён')
  }
  if (d.dueAt !== undefined) {
    data.dueAt = d.dueAt ? new Date(d.dueAt) : null
    notes.push('Срок изменён')
  }
  if (d.subtasks !== undefined) data.subtasks = d.subtasks
  if (d.stageId !== undefined) data.stageId = d.stageId
  if (d.assigneeId !== undefined && d.assigneeId !== t.assigneeId) {
    data.assigneeId = d.assigneeId
    notes.push('Исполнитель изменён')
    if (d.assigneeId && d.assigneeId !== ctx.memberId) await notify(ctx.organizationId, d.assigneeId, 'Вам назначена задача', t.title, `/tasks?task=${t.id}`)
  }
  if (notes.length) data.log = appendLog(t.log, `${notes.join(', ')} · ${ctx.name}`, ctx.name)
  await ctx.db.task.update({ where: { id: t.id }, data })
  return { ok: true }
})
