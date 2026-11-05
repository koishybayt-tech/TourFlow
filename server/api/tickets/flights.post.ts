import { z } from 'zod'
import { searchFlights } from '../../providers/travel'

export default defineEventHandler(async (event) => {
  await requireAuth(event, 'tickets')
  const q = await body(event, z.object({ from: z.string().min(2, 'Откуда?'), to: z.string().min(2, 'Куда?'), depart: z.string().min(10, 'Дата вылета'), ret: z.string().nullable().optional(), pax: z.number().int().min(1).max(9), cabin: z.enum(['Эконом', 'Бизнес']) }))
  return searchFlights(q)
})
