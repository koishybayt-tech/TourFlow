import { travelerSchema } from '#shared/schemas/deals'
import { autoAdvance, logDeal } from '../../../services/deals'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'deals')
  const t = await ctx.db.traveler.findFirst({ where: { id: getRouterParam(event, 'id')!, deal: { deletedAt: null, ...dealScope(ctx) } } })
  if (!t) notFound('Турист')
  const d = await body(event, travelerSchema)
  await ctx.db.traveler.update({
    where: { id: t.id },
    data: {
      fullNameLatin: d.fullNameLatin, passportExpiry: dateOnly(d.passportExpiry), birthDate: dateOnly(d.birthDate), isChild: !!d.isChild, childAge: d.childAge ?? null, visaStatus: d.visaStatus ?? null,
      ...(d.passportNo !== undefined && d.passportNo !== '' ? { passportNoEnc: encryptPii(d.passportNo) } : {}),
    },
  })
  if (d.passportNo) await audit({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'pii.update', entity: 'Traveler', entityId: t.id, meta: { field: 'passport' } })
  await logDeal(ctx, t.dealId, 'edit', `Турист изменён: ${d.fullNameLatin}`)
  const advanced = await autoAdvance(ctx, t.dealId)
  return { ok: true, advanced }
})
