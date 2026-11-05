import { z } from 'zod'
import { normalizePhone } from '#shared/utils/phone'
import { createDeal } from '../../../services/deals'
import { findClientByPhone } from '../../../services/clients'

/** «Создать заявку» for a participant without a deal: client by phone, group pipeline on this departure. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'deals')
  const p = await ctx.db.participant.findFirst({ where: { id: getRouterParam(event, 'id')! }, include: { departure: true } })
  if (!p) notFound('Участник')
  if (p.dealId) throw createError({ statusCode: 409, statusMessage: 'У участника уже есть заявка' })
  const { phone } = await body(event, z.object({ phone: z.string().refine(v => !!normalizePhone(v), 'Телефон: +7 и 10 цифр') }))
  const norm = normalizePhone(phone)!
  const client = await findClientByPhone(ctx.db, norm) ?? await ctx.db.client.create({ data: { organizationId: ctx.organizationId, name: p.name, phone: norm, source: 'MANUAL' } })
  const deal = await createDeal(ctx, { clientId: client.id, pipeline: 'GROUP', title: p.departure.name, source: 'MANUAL', managerId: ctx.role === 'OWNER' ? null : ctx.memberId, departureId: null, people: 1, sourceText: `Заявка создана из выезда «${p.departure.name}»` })
  await ctx.db.deal.update({ where: { id: deal.id }, data: { departureId: p.departureId, price: p.departure.price, fullPayDeadline: p.departure.payDeadline } })
  await ctx.db.participant.update({ where: { id: p.id }, data: { dealId: deal.id } })
  if (p.paid) await ctx.db.payment.create({ data: { organizationId: ctx.organizationId, dealId: deal.id, amount: p.paid, type: 'Предоплата', method: 'Перевод на счёт', comment: 'перенесено из участника выезда', paidAt: new Date(), createdById: ctx.memberId } })
  return { id: deal.id }
})
