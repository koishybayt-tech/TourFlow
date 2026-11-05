import { accessibleTask } from '../../../services/tasks'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'tasks')
  const t = await accessibleTask(ctx, getRouterParam(event, 'id')!)
  if (t.isSystem) throw createError({ statusCode: 422, statusMessage: 'Системную задачу этапа нельзя удалить' })
  await ctx.db.task.delete({ where: { id: t.id } })
  return { ok: true }
})
