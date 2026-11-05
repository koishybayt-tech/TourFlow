import { travelerSchema } from '#shared/schemas/deals'
import { accessibleDeal } from '../../../services/access'
import { autoAdvance, logDeal } from '../../../services/deals'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'deals')
  const deal = await accessibleDeal(ctx, getRouterParam(event, 'id')!)
  const t = await body(event, travelerSchema)
  const count = await ctx.db.traveler.count({ where: { dealId: deal.id } })
  await ctx.db.traveler.create({
    data: {
      organizationId: ctx.organizationId, dealId: deal.id, clientId: count === 0 ? deal.clientId : null, fullNameLatin: t.fullNameLatin,
      passportNoEnc: encryptPii(t.passportNo || null), passportExpiry: dateOnly(t.passportExpiry), birthDate: dateOnly(t.birthDate),
      isChild: !!t.isChild, childAge: t.childAge ?? null, visaStatus: t.visaStatus ?? null, order: count,
    },
  })
  await logDeal(ctx, deal.id, 'edit', `Турист добавлен: ${t.fullNameLatin}`)
  const advanced = await autoAdvance(ctx, deal.id)
  return { ok: true, advanced }
})
