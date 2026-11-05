import { z } from 'zod'
import { buildReport } from '../../services/reports'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'reports')
  const q = queryOf(event, z.object({ period: z.enum(['month', 'quarter', 'year', 'all']).default('month'), pipeline: z.enum(['GROUP', 'PACKAGE', 'BASE']).optional(), manager: z.string().optional() }))
  return buildReport(ctx.db, { period: q.period, pipeline: q.pipeline ?? null, managerId: q.manager ?? null })
})
