import { can } from '#shared/permissions'
import { tourSaveSchema } from '#shared/schemas/tours'
import { TOUR_INCLUDE, saveTour, tourDto } from '../../../services/tours'

/** Autosave of the whole editor state. Managers cannot change finance. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'tours')
  const id = getRouterParam(event, 'id')!
  const t = await ctx.db.tour.findFirst({ where: { id, deletedAt: null }, include: TOUR_INCLUDE })
  if (!t) notFound('Тур')
  const data = await body(event, tourSaveSchema)
  if (!can(ctx.role, 'tours.finance')) {
    const cur = tourDto(t)
    data.costs = cur.costs
    data.flights = data.flights.map((f, i) => ({ ...f, ticket: cur.flights[i]?.ticket ?? null, baggage: cur.flights[i]?.baggage ?? null }))
    data.stays = data.stays.map((s, i) => ({ ...s, total: cur.stays[i]?.total ?? null }))
  }
  await saveTour(ctx, id, data)
  // Keep the departure in sync with the published tour.
  if (t.departure && data.startDate && data.endDate) {
    await ctx.db.departure.update({ where: { id: t.departure.id }, data: { name: data.name, route: data.route, maxSeats: data.seats, price: data.price, startDate: new Date(`${data.startDate}T00:00:00Z`), endDate: new Date(`${data.endDate}T00:00:00Z`) } })
  }
  return { ok: true, savedAt: new Date() }
})
