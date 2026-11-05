import { operatorSchema } from '#shared/schemas/package'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'settings')
  const o = await body(event, operatorSchema)
  const row = await ctx.db.operator.create({ data: { organizationId: ctx.organizationId, name: o.name, paymentTerms: o.paymentTerms, commissionPct: o.commissionPct, contact: o.contact || null } })
  return { id: row.id }
})
