export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'settings')
  return prisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
    select: { name: true, bin: true, director: true, legalAddress: true, bank: true, iik: true, bik: true, license: true, phone: true, email: true, instagram: true, refundRule: true, refundHoldPct: true },
  })
})
