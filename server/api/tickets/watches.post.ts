import { z } from 'zod'
import { currentPrice } from '../../providers/travel'

/** «Следить за ценой»: hourly check, notification when the price drops. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'tickets')
  const { kind, query } = await body(event, z.object({ kind: z.enum(['flight', 'hotel']), query: z.record(z.string(), z.unknown()) }))
  const row = await ctx.db.priceWatch.create({ data: { organizationId: ctx.organizationId, userId: ctx.userId, kind, query: query as object, lastPrice: currentPrice(kind, query) } })
  return { id: row.id, lastPrice: row.lastPrice }
})
