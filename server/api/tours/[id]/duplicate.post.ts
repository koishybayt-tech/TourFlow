import { TOUR_INCLUDE, saveTour, tourDto, uniqueSlug } from '../../../services/tours'

/** Copy keeps the programme and description; flight, stay and fact prices are cleared. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'tours')
  const t = await ctx.db.tour.findFirst({ where: { id: getRouterParam(event, 'id')!, deletedAt: null }, include: TOUR_INCLUDE })
  if (!t) notFound('Тур')
  const dto = tourDto(t)
  const name = `${t.name} (копия)`
  const copy = await ctx.db.tour.create({ data: { organizationId: ctx.organizationId, slug: await uniqueSlug(ctx.db, name), name, countries: [], route: '', seats: t.seats, price: 0, prepay: t.prepay, description: '', included: [], extra: [], rates: t.rates as object } })
  await saveTour(ctx, copy.id, {
    ...dto, name, startDate: null, endDate: null, price: 0, riseDate: null, riseAmount: null, posts: [], instagramText: null, pricesCheckedAt: null,
    days: dto.days.map(d => ({ ...d, availabilityChecked: false })),
    flights: dto.flights.map(f => ({ ...f, departAt: null, ticket: null, baggage: null })),
    stays: dto.stays.map(s => ({ ...s, checkIn: null, checkOut: null, total: null })),
    costs: dto.costs.map(c => ({ ...c, fact: null })),
  })
  return { id: copy.id }
})
