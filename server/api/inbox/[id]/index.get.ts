import { formatRange } from '#shared/utils/dates'
import { suggestRouting } from '../../../services/routing'
import { findClientByPhone } from '../../../services/clients'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'inbox')
  const id = getRouterParam(event, 'id')!
  const c = await ctx.db.conversation.findFirst({
    where: { id },
    include: { messages: { orderBy: { sentAt: 'asc' } }, deal: { select: { id: true, number: true, title: true, pipeline: true, stage: { select: { name: true } } } } },
  })
  if (!c) notFound('Диалог')
  const inbound = c.messages.filter(m => m.direction === 'in').map(m => m.text).join('\n')
  const routing = await suggestRouting(ctx, inbound, c.channel)
  const client = await findClientByPhone(ctx.db, c.clientPhone)
  const clientDeals = client
    ? await ctx.db.deal.findMany({ where: { clientId: client.id, deletedAt: null, ...dealScope(ctx) }, include: { stage: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 5 })
    : []
  const departures = await ctx.db.departure.findMany({ where: { startDate: { gte: new Date() } }, orderBy: { startDate: 'asc' } })
  return {
    id: c.id,
    name: c.clientName,
    phone: c.clientPhone,
    channel: c.channel,
    unread: c.unread,
    lead: (c.lead ?? {}) as Record<string, string>,
    pipelineOverride: c.pipelineOverride,
    deal: c.deal ? { id: c.deal.id, number: c.deal.number, title: c.deal.title, stage: c.deal.stage.name } : null,
    messages: c.messages.map(m => ({ id: m.id, direction: m.direction, text: m.text, sentAt: m.sentAt, auto: m.auto })),
    routing,
    client: client ? { id: client.id, name: client.name, deals: clientDeals.map(d => ({ id: d.id, number: d.number, title: d.title, stage: d.lostAt ? 'Отказ' : d.wonAt ? 'Завершена' : d.stage.name })) } : null,
    departures: departures.map(d => ({ id: d.id, label: `${d.name} · ${formatRange(d.startDate, d.endDate)}` })),
  }
})
