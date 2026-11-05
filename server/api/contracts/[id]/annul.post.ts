import { logDeal } from '../../../services/deals'

/** Annul a document — only while nobody has signed it. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'documents')
  const c = await ctx.db.contract.findFirst({ where: { id: getRouterParam(event, 'id')!, deal: dealScope(ctx) }, include: { signatures: true } })
  if (!c) notFound('Документ')
  if (c.signatures.some(s => s.signedAt)) throw createError({ statusCode: 422, statusMessage: 'Документ уже подписан — аннулировать нельзя' })
  await ctx.db.contract.update({ where: { id: c.id }, data: { annulledAt: new Date() } })
  await logDeal(ctx, c.dealId, 'doc', `Документ № ${c.number} аннулирован`)
  return { ok: true }
})
