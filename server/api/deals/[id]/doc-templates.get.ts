import { z } from 'zod'
import type { TemplateVariable } from '#shared/domain/templates'
import { accessibleDeal } from '../../../services/access'
import { dealFieldValues } from '../../../services/documents'

/** Templates for the «Документ на подпись» wizard with «Не хватает данных: N». */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'documents')
  const deal = await accessibleDeal(ctx, getRouterParam(event, 'id')!)
  const { kind } = queryOf(event, z.object({ kind: z.enum(['contract', 'receipt']).default('contract') }))
  const [templates, { values }] = await Promise.all([
    ctx.db.documentTemplate.findMany({ where: { kind, enabled: true }, orderBy: { name: 'asc' } }),
    dealFieldValues(ctx.db, ctx.organizationId, deal.id),
  ])
  return templates.map((t) => {
    const vars = (t.variables ?? []) as unknown as TemplateVariable[]
    const missing = new Set(vars.filter(v => v.field && v.field !== 'contract.number' && !values[v.field]).map(v => v.field))
    return { id: t.id, name: t.name, pipeline: t.pipeline, condition: t.condition, short: t.short, missing: missing.size, forPipeline: !t.pipeline || t.pipeline === deal.pipeline }
  }).sort((a, b) => Number(b.forPipeline) - Number(a.forPipeline) || a.missing - b.missing)
})
