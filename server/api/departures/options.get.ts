import { formatRange } from '#shared/utils/dates'

/** Upcoming departures for selects. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event)
  const deps = await ctx.db.departure.findMany({ where: { startDate: { gte: new Date() } }, orderBy: { startDate: 'asc' } })
  return { departures: deps.map(d => ({ id: d.id, label: `${d.name} · ${formatRange(d.startDate, d.endDate)}`, price: d.price })) }
})
