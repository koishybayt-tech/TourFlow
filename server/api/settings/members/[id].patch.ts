import { memberPatchSchema } from '#shared/schemas/settings'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'settings')
  const id = getRouterParam(event, 'id')!
  const patch = await body(event, memberPatchSchema)
  if (id === ctx.memberId && ((patch.role && patch.role !== 'OWNER') || patch.active === false)) {
    throw createError({ statusCode: 422, statusMessage: 'Нельзя понизить или отключить самого себя' })
  }
  const r = await ctx.db.member.updateMany({ where: { id }, data: patch })
  if (!r.count) notFound('Сотрудник')
  await audit({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'member.update', entity: 'Member', entityId: id, meta: patch })
  return { ok: true }
})
