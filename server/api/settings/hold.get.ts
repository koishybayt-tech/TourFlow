/** Default refund hold percent (used by the refund dialog for managers too). */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'payments')
  return prisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId }, select: { refundHoldPct: true, refundRule: true } })
})
