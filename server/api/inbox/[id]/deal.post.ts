import { z } from 'zod'
import { CHANNEL_LABELS } from '#shared/domain/types'
import { createDeal, notify } from '../../../services/deals'
import { findOrCreateClient } from '../../../services/clients'
import { assignManager } from '../../../services/routing'

/** «Создать заявку из диалога»: client by phone, manager by direction, system task of the first stage. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'deals')
  const id = getRouterParam(event, 'id')!
  const input = await body(event, z.object({
    pipeline: z.enum(['GROUP', 'PACKAGE', 'BASE']),
    departureId: z.string().nullable().optional(),
    title: z.string().trim().optional(),
  }))
  const c = await ctx.db.conversation.findFirst({ where: { id }, include: { messages: { where: { direction: 'in' }, orderBy: { sentAt: 'asc' } } } })
  if (!c) notFound('Диалог')
  if (c.dealId) throw createError({ statusCode: 409, statusMessage: 'Заявка по этому диалогу уже создана' })

  const lead = (c.lead ?? {}) as Record<string, string>
  const { client, created } = await findOrCreateClient(ctx.db, ctx.organizationId, c.clientPhone, c.clientName, c.channel)
  const text = c.messages.map(m => m.text).join('\n')
  const routing = await assignManager(ctx, `${text}\n${lead.direction ?? ''}`, c.channel)
  const people = Number.parseInt(lead.people ?? '', 10)
  const departure = input.departureId ? await ctx.db.departure.findFirst({ where: { id: input.departureId } }) : null
  const title = input.title || departure?.name || (lead.direction && lead.direction !== '—' ? lead.direction : 'Новый запрос')

  const deal = await createDeal(ctx, {
    clientId: client.id,
    pipeline: input.pipeline,
    title,
    source: c.channel,
    directionId: routing.direction?.id ?? null,
    managerId: routing.manager.id,
    departureId: departure?.id ?? null,
    people: Number.isFinite(people) && people > 0 ? people : 1,
    dates: lead.dates && lead.dates !== '—' ? lead.dates : null,
    visaHistory: lead.visa && lead.visa !== '—' ? lead.visa : null,
    sourceText: `Заявка создана из ${CHANNEL_LABELS[c.channel]}`,
  })
  await ctx.db.conversation.update({ where: { id: c.id }, data: { dealId: deal.id, unread: false } })
  if (!created && client.managerId && client.managerId !== routing.manager.id) {
    await notify(ctx.organizationId, client.managerId, 'Новая заявка вашего клиента', `${client.name}: №${deal.number} · ${title}`, `/deals/${deal.id}`)
  }
  return { id: deal.id, number: deal.number, clientCreated: created, manager: routing.manager.name }
})
