import { routingSchema } from '#shared/schemas/settings'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'settings')
  const routing = await body(event, routingSchema)
  const clean = {
    ...routing,
    keywords: Object.fromEntries(Object.entries(routing.keywords).map(([k, v]) => [k, [...new Set(v.map(x => x.trim().toLowerCase()).filter(Boolean))]])),
  }
  const tags = clean.links.map(l => l.tag.toLowerCase())
  if (new Set(tags).size !== tags.length) throw createError({ statusCode: 422, statusMessage: 'Метки ссылок должны быть разными' })
  await prisma.organization.update({ where: { id: ctx.organizationId }, data: { routing: clean } })
  await audit({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'settings.routing', entity: 'Organization', entityId: ctx.organizationId })
  return { ok: true }
})
