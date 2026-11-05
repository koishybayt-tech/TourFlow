import { operatorSchema } from '#shared/schemas/package'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'settings')
  const o = await body(event, operatorSchema)
  const r = await ctx.db.operator.updateMany({ where: { id: getRouterParam(event, 'id')! }, data: { name: o.name, paymentTerms: o.paymentTerms, commissionPct: o.commissionPct, contact: o.contact || null } })
  if (!r.count) notFound('Туроператор')
  return { ok: true }
})
