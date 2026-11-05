/** Reveals a passport number. Every view is written to the audit log. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'deals')
  const t = await ctx.db.traveler.findFirst({ where: { id: getRouterParam(event, 'id')!, deal: { deletedAt: null, ...dealScope(ctx) } } })
  if (!t) notFound('Турист')
  await audit({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'pii.view', entity: 'Traveler', entityId: t.id, meta: { field: 'passport' } })
  return { passportNo: decryptPii(t.passportNoEnc) }
})
