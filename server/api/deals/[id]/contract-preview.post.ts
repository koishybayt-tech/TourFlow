import { z } from 'zod'
import { FIELD_BY_KEY } from '#shared/domain/templates'
import { accessibleDeal } from '../../../services/access'
import { previewContract } from '../../../services/contracts'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'documents')
  const deal = await accessibleDeal(ctx, getRouterParam(event, 'id')!)
  const { templateId, overrides } = await body(event, z.object({ templateId: z.string(), overrides: z.record(z.string(), z.string()).default({}) }))
  const p = await previewContract(ctx, deal.id, templateId, overrides)
  const seen = new Set<string>()
  const fields = p.variables.filter(v => v.field && !seen.has(v.field) && seen.add(v.field)).map(v => ({
    placeholder: v.placeholder,
    field: v.field!,
    label: FIELD_BY_KEY[v.field!]?.label ?? v.placeholder,
    group: FIELD_BY_KEY[v.field!]?.group ?? '',
    value: p.values[v.field!] ?? '',
    fromDeal: p.dealValues[v.field!] ?? '',
    manual: overrides[v.field!] !== undefined && overrides[v.field!] !== p.dealValues[v.field!],
    auto: v.field === 'contract.number',
  }))
  return { name: p.template.name, kind: p.template.kind, text: p.text, empty: p.empty, fields }
})
