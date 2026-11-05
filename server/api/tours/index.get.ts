import { z } from 'zod'
import { can } from '#shared/permissions'
import { TOUR_INCLUDE, tourCalc, tourDto } from '../../services/tours'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'tours')
  const { status } = queryOf(event, z.object({ status: z.enum(['all', 'DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVE']).default('all') }))
  const tours = await ctx.db.tour.findMany({ where: { deletedAt: null, ...(status !== 'all' ? { status } : {}) }, include: TOUR_INCLUDE, orderBy: [{ startDate: 'asc' }] })
  const finance = can(ctx.role, 'tours.finance')
  return tours.map((t) => {
    const dto = tourDto(t)
    const c = tourCalc(dto)
    return {
      id: t.id, slug: t.slug, name: t.name, flags: t.flags, route: t.route, startDate: dto.startDate, endDate: dto.endDate, seats: t.seats, price: t.price,
      status: t.status, coverKey: t.coverKey, sold: dto.departure?.sold ?? 0,
      profitFull: finance ? c.profit : null, breakEven: finance ? c.breakEven : null, costPer: finance ? c.costPer : null,
    }
  })
})
