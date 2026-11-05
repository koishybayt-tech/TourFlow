import { z } from 'zod'
import { formatMonth, formatRange } from '#shared/utils/dates'
import { departureParticipants } from '../../services/departures'

/** Departures plan grouped by month. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'departures')
  const { scope } = queryOf(event, z.object({ scope: z.enum(['upcoming', 'past', 'all']).default('upcoming') }))
  const today = new Date(Date.now() - 86_400_000)
  const where = scope === 'upcoming' ? { endDate: { gte: today } } : scope === 'past' ? { endDate: { lt: today } } : {}
  const deps = await ctx.db.departure.findMany({ where: { ...where, ...(ctx.role === 'GUIDE' ? { guide: { fullName: ctx.name } } : {}) }, include: { guide: { select: { fullName: true } } }, orderBy: { startDate: scope === 'past' ? 'desc' : 'asc' } })
  const parts = await departureParticipants(ctx.db, deps.map(d => d.id))
  const now = Date.now()
  return deps.map((d) => {
    const p = parts[d.id] ?? []
    const ready = p.filter(x => x.ready).length
    const daysLeft = Math.ceil((+d.startDate - now) / 86_400_000)
    return {
      id: d.id, name: d.name, route: d.route, month: formatMonth(d.startDate), dates: formatRange(d.startDate, d.endDate), startDate: d.startDate, daysLeft,
      type: d.type, visa: d.visa, minSeats: d.minSeats, maxSeats: d.maxSeats, price: d.price, guide: d.guide?.fullName ?? null,
      total: p.length, ready, risk: daysLeft >= 0 && daysLeft <= 30 && ready < d.minSeats, tourId: d.tourId,
    }
  })
})
