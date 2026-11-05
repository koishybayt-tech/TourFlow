import { z } from 'zod'
import { searchHotels } from '../../providers/travel'

export default defineEventHandler(async (event) => {
  await requireAuth(event, 'tickets')
  const q = await body(event, z.object({ city: z.string().min(2, 'Город?'), checkIn: z.string().min(10), checkOut: z.string().min(10), guests: z.number().int().min(1).max(12) }))
  if (q.checkOut <= q.checkIn) throw createError({ statusCode: 422, statusMessage: 'Дата выезда позже заезда' })
  return searchHotels(q)
})
