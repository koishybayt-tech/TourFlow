import { TOUR_INCLUDE, instagramText, tourDto } from '../../../services/tours'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'tours')
  const t = await ctx.db.tour.findFirst({ where: { id: getRouterParam(event, 'id')!, deletedAt: null }, include: TOUR_INCLUDE })
  if (!t) notFound('Тур')
  return { text: instagramText(tourDto(t)) }
})
