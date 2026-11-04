import { directionsSchema } from '#shared/schemas/settings'

/** Replaces the directions list (keeps ids of existing directions so deals stay linked). */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'settings')
  const { directions, defaultManagerId } = await body(event, directionsSchema)
  const existing = await ctx.db.direction.findMany({ select: { id: true } })
  const keep = new Set(directions.map(d => d.id).filter(Boolean))
  await prisma.$transaction(async (tx) => {
    for (const e of existing) if (!keep.has(e.id)) await tx.direction.delete({ where: { id: e.id } })
    for (const [i, d] of directions.entries()) {
      const data = { name: d.name, keywords: d.keywords.map(k => k.toLowerCase()), managerIds: d.managerIds, mode: d.mode, backupId: d.backupId, order: i }
      if (d.id && existing.some(e => e.id === d.id)) await tx.direction.update({ where: { id: d.id }, data })
      else await tx.direction.create({ data: { ...data, organizationId: ctx.organizationId } })
    }
    await tx.organization.update({ where: { id: ctx.organizationId }, data: { defaultManagerId } })
  })
  await audit({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'settings.directions', entity: 'Organization', entityId: ctx.organizationId })
  return { ok: true }
})
