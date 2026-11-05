import { z } from 'zod'
import { loadStages } from '../../../services/deals'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'settings')
  const { pipeline } = queryOf(event, z.object({ pipeline: z.enum(['GROUP', 'PACKAGE', 'BASE']).default('GROUP') }))
  const stages = await loadStages(ctx.db, pipeline)
  const counts = await ctx.db.deal.groupBy({ by: ['stageId'], where: { pipeline, deletedAt: null }, _count: true })
  return stages.map(s => ({ ...s, deals: counts.find(c => c.stageId === s.id)?._count ?? 0 }))
})
