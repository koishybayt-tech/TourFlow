import { accessibleDeal } from '../../../services/access'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'deals')
  const deal = await accessibleDeal(ctx, getRouterParam(event, 'id')!)
  const rows = await ctx.db.dealEvent.findMany({ where: { dealId: deal.id }, orderBy: { at: 'desc' } })
  return rows.map(e => ({ id: e.id, at: e.at, text: e.text, actor: e.actorLabel, kind: e.kind }))
})
