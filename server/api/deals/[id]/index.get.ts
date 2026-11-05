import { accessibleDeal } from '../../../services/access'
import { dealView } from '../../../services/dealView'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'deals')
  const deal = await accessibleDeal(ctx, getRouterParam(event, 'id')!)
  return dealView(ctx, deal.id)
})
