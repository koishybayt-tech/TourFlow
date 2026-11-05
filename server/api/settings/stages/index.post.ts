import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'settings')
  const { pipeline, name } = await body(event, z.object({ pipeline: z.enum(['GROUP', 'PACKAGE', 'BASE']), name: z.string().trim().min(2, 'Назовите этап') }))
  const last = await ctx.db.stage.findFirst({ where: { pipeline }, orderBy: { order: 'desc' } })
  const s = await ctx.db.stage.create({ data: { organizationId: ctx.organizationId, pipeline, name, description: '', order: (last?.order ?? -1) + 1 } })
  await audit({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'stage.create', entity: 'Stage', entityId: s.id, meta: { name } })
  return { id: s.id }
})
