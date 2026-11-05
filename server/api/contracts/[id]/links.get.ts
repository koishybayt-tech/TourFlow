import { signLinks } from '../../../services/contracts'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'documents')
  const c = await ctx.db.contract.findFirst({ where: { id: getRouterParam(event, 'id')!, deal: dealScope(ctx) }, include: { signatures: true } })
  if (!c) notFound('Документ')
  return signLinks(c)
})
