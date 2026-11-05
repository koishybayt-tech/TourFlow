import { dealCreateSchema } from '#shared/schemas/deals'
import { normalizePhone } from '#shared/utils/phone'
import { createDeal } from '../../services/deals'
import { findClientByPhone } from '../../services/clients'
import { assignManager } from '../../services/routing'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'deals')
  const input = await body(event, dealCreateSchema)
  let clientId = input.clientId
  if (!clientId && input.newClient) {
    const phone = normalizePhone(input.newClient.phone)!
    const existing = await findClientByPhone(ctx.db, phone)
    if (existing) throw createError({ statusCode: 409, statusMessage: `Клиент с этим телефоном уже есть: ${existing.name}`, data: { id: existing.id, name: existing.name } })
    clientId = (await ctx.db.client.create({ data: { organizationId: ctx.organizationId, name: input.newClient.name, phone, source: 'MANUAL' } })).id
  }
  const client = await ctx.db.client.findFirst({ where: { id: clientId, deletedAt: null } })
  if (!client) notFound('Клиент')
  // Managers create deals for themselves; otherwise route by direction.
  const routing = ctx.role === 'MANAGER' ? null : await assignManager(ctx, input.title, 'MANUAL')
  const deal = await createDeal(ctx, {
    clientId: client.id,
    pipeline: input.pipeline,
    title: input.title,
    source: client.source,
    directionId: routing?.direction?.id ?? null,
    managerId: ctx.role === 'MANAGER' ? ctx.memberId : routing?.manager.id ?? null,
    departureId: input.departureId ?? null,
    people: input.people ?? 1,
    sourceText: `Заявка создана вручную · ${ctx.name}`,
  })
  return { id: deal.id, number: deal.number }
})
