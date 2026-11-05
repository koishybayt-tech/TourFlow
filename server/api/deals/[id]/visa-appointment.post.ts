import { z } from 'zod'
import { formatDateTime } from '#shared/utils/dates'
import { accessibleDeal } from '../../../services/access'
import { autoAdvance, logDeal } from '../../../services/deals'

/** Visa centre appointment: a calendar event of type «visa» (a stage requirement). */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'deals')
  const deal = await accessibleDeal(ctx, getRouterParam(event, 'id')!)
  const e = await body(event, z.object({ startAt: z.string().min(10, 'Укажите дату и время'), place: z.string().trim().default('Визовый центр, Алматы'), title: z.string().trim().optional() }))
  const client = await ctx.db.client.findFirstOrThrow({ where: { id: deal.clientId } })
  const startAt = new Date(e.startAt)
  await ctx.db.event.create({ data: { organizationId: ctx.organizationId, type: 'visa', title: e.title || `Подача на визу: ${client.name}`, startAt, place: e.place, assigneeId: deal.managerId, dealId: deal.id, remind: 'Клиенту в WhatsApp за 1 день' } })
  await logDeal(ctx, deal.id, 'event', `Запись в визовый центр: ${formatDateTime(startAt)}, ${e.place}`)
  const advanced = await autoAdvance(ctx, deal.id)
  return { ok: true, advanced }
})
