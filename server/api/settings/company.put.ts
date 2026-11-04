import { companySchema } from '#shared/schemas/settings'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'settings')
  const data = await body(event, companySchema)
  await prisma.organization.update({ where: { id: ctx.organizationId }, data })
  await audit({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'settings.company', entity: 'Organization', entityId: ctx.organizationId })
  return { ok: true }
})
