import { modulesSchema } from '#shared/schemas/settings'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'settings')
  const modules = await body(event, modulesSchema)
  await prisma.organization.update({ where: { id: ctx.organizationId }, data: { modules } })
  await audit({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'settings.modules', entity: 'Organization', entityId: ctx.organizationId, meta: modules })
  return { ok: true, modules }
})
