import { eventSchema } from '#shared/schemas/events'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'calendar')
  const e = await body(event, eventSchema.partial())
  const data: Record<string, unknown> = {}
  for (const k of ['type', 'title', 'description', 'place', 'assigneeId', 'remind'] as const) if (e[k] !== undefined) data[k] = e[k]
  if (e.startAt) {
    data.startAt = new Date(e.startAt)
    data.remindedAt = null
  }
  if (e.endAt !== undefined) data.endAt = e.endAt ? new Date(e.endAt) : null
  const r = await ctx.db.event.updateMany({ where: { id: getRouterParam(event, 'id')! }, data })
  if (!r.count) notFound('Событие')
  return { ok: true }
})
