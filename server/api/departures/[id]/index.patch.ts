import { z } from 'zod'
import { checkDepartureRules } from '../../../services/departures'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'departures')
  const id = getRouterParam(event, 'id')!
  const d = await body(event, z.object({ guideId: z.string().nullable().optional(), minSeats: z.number().int().min(1).optional(), maxSeats: z.number().int().min(1).optional(), price: z.number().int().min(0).optional() }))
  const r = await ctx.db.departure.updateMany({ where: { id }, data: d })
  if (!r.count) notFound('Выезд')
  await checkDepartureRules(ctx.db, ctx.organizationId, id)
  return { ok: true }
})
