import { logDeal } from '../../../services/deals'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'deals')
  const t = await ctx.db.traveler.findFirst({ where: { id: getRouterParam(event, 'id')!, deal: { deletedAt: null, ...dealScope(ctx) } } })
  if (!t) notFound('Турист')
  await ctx.db.traveler.delete({ where: { id: t.id } })
  await logDeal(ctx, t.dealId, 'edit', `Турист удалён: ${t.fullNameLatin}`)
  return { ok: true }
})
