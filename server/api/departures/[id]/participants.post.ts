import { z } from 'zod'
import { checkDepartureRules } from '../../../services/departures'

/** Adds a participant without a deal (e.g. booked offline). */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'departures')
  const dep = await ctx.db.departure.findFirst({ where: { id: getRouterParam(event, 'id')! }, include: { _count: { select: { participants: true } } } })
  if (!dep) notFound('Выезд')
  if (dep._count.participants >= dep.maxSeats) throw createError({ statusCode: 422, statusMessage: 'Свободных мест нет' })
  const { name, passportNote, paid, step } = await body(event, z.object({ name: z.string().trim().min(2, 'Укажите участника'), passportNote: z.string().optional(), paid: z.number().int().min(0).default(0), step: z.number().int().min(0).default(0) }))
  await ctx.db.participant.create({ data: { organizationId: ctx.organizationId, departureId: dep.id, name, passportNote: passportNote || null, paid, step } })
  await checkDepartureRules(ctx.db, ctx.organizationId, dep.id)
  return { ok: true }
})
