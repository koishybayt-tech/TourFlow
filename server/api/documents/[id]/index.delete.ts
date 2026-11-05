import { logDeal } from '../../../services/deals'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'documents')
  const doc = await ctx.db.document.findFirst({ where: { id: getRouterParam(event, 'id')!, deal: { deletedAt: null, ...dealScope(ctx) } } })
  if (!doc) notFound('Документ')
  await ctx.db.document.delete({ where: { id: doc.id } })
  await logDeal(ctx, doc.dealId, 'doc', `Документ удалён: ${doc.type} — ${doc.name}`)
  return { ok: true }
})
