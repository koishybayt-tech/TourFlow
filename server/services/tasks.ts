import type { AuthContext } from '../utils/auth'

/** Loads a task the member may see. */
export async function accessibleTask(ctx: AuthContext, id: string) {
  const t = await ctx.db.task.findFirst({
    where: { id, ...(ctx.role !== 'OWNER' ? { OR: [{ assigneeId: ctx.memberId }, { authorId: ctx.memberId }, { deal: { managerId: ctx.memberId } }] } : {}) },
  })
  if (!t) throw createError({ statusCode: 404, statusMessage: 'Задача не найдена' })
  return t
}

export function appendLog(log: unknown, text: string, actor: string) {
  return [...((log ?? []) as object[]), { at: new Date().toISOString(), text, actor }]
}
