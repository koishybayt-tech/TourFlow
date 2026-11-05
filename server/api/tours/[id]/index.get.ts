import { can } from '#shared/permissions'
import { TOUR_INCLUDE, tourDto } from '../../../services/tours'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'tours')
  const t = await ctx.db.tour.findFirst({ where: { id: getRouterParam(event, 'id')!, deletedAt: null }, include: TOUR_INCLUDE })
  if (!t) notFound('Тур')
  const dto = tourDto(t)
  // Finance is visible to the owner only.
  if (!can(ctx.role, 'tours.finance')) {
    dto.costs = []
    dto.flights = dto.flights.map(f => ({ ...f, ticket: null, baggage: null }))
    dto.stays = dto.stays.map(s => ({ ...s, total: null }))
  }
  return { ...dto, canFinance: can(ctx.role, 'tours.finance'), publicUrl: `${useRuntimeConfig().public.baseUrl}/t/${t.slug}` }
})
