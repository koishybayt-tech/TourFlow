export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'package')
  const ops = await ctx.db.operator.findMany({ include: { _count: { select: { bookings: true } } }, orderBy: { name: 'asc' } })
  return ops.map(o => ({ id: o.id, name: o.name, paymentTerms: o.paymentTerms, commissionPct: Number(o.commissionPct), contact: o.contact, bookings: o._count.bookings }))
})
