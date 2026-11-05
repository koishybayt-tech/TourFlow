import { eventSchema } from '#shared/schemas/events'
import { formatDateTime } from '#shared/utils/dates'
import { autoAdvance, logDeal } from '../../services/deals'

/** Creates an event with a conflict check for the assignee (overlap within the event or ±1 hour). */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'calendar')
  const e = await body(event, eventSchema)
  const startAt = new Date(e.startAt)
  const endAt = e.endAt ? new Date(e.endAt) : new Date(+startAt + 60 * 60_000)
  const assigneeId = e.assigneeId === undefined ? ctx.memberId : e.assigneeId
  if (e.dealId) {
    const deal = await ctx.db.deal.findFirst({ where: { id: e.dealId, ...dealScope(ctx) } })
    if (!deal) notFound('Заявка')
  }
  if (assigneeId && !e.force) {
    const conflicts = await ctx.db.event.findMany({ where: { assigneeId, startAt: { lt: endAt, gte: new Date(+startAt - 60 * 60_000) } } })
    const real = conflicts.filter(c => +(c.endAt ?? new Date(+c.startAt + 60 * 60_000)) > +startAt)
    if (real.length) throw createError({ statusCode: 409, statusMessage: `Пересечение: ${real.map(c => `${c.title} в ${formatDateTime(c.startAt).slice(11)}`).join(', ')}`, data: { conflicts: real.map(c => ({ id: c.id, title: c.title, startAt: c.startAt })) } })
  }
  const row = await ctx.db.event.create({
    data: { organizationId: ctx.organizationId, type: e.type, title: e.title, description: e.description || null, startAt, endAt: e.endAt ? endAt : null, place: e.place || null, assigneeId, dealId: e.dealId ?? null, departureId: e.departureId ?? null, remind: e.remind ?? null },
  })
  if (e.dealId) {
    await logDeal(ctx, e.dealId, 'event', `Запланировано: ${e.title} — ${formatDateTime(startAt)}`)
    await autoAdvance(ctx, e.dealId)
  }
  return { id: row.id }
})
