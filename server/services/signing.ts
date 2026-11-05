import { prisma } from '../utils/prisma'

/** Loads a signature link with its document (and the other documents of a receipt bundle). */
export async function loadSignature(token: string) {
  const sig = await prisma.signature.findUnique({
    where: { token },
    include: {
      contract: {
        include: {
          signatures: true,
          template: { select: { name: true } },
          deal: { select: { id: true, number: true, managerId: true, organizationId: true, client: { select: { name: true, fullName: true } } } },
        },
      },
    },
  })
  if (!sig || sig.contract.annulledAt) throw createError({ statusCode: 404, statusMessage: 'Ссылка недействительна или документ аннулирован' })
  if (sig.expiresAt && sig.expiresAt < new Date() && !sig.signedAt) throw createError({ statusCode: 410, statusMessage: 'Срок действия ссылки истёк. Попросите менеджера отправить документ заново' })
  const bundle = sig.contract.bundle
    ? await prisma.contract.findMany({ where: { bundle: sig.contract.bundle, annulledAt: null }, include: { signatures: true, template: { select: { name: true } } }, orderBy: { number: 'asc' } })
    : [sig.contract]
  return { sig, bundle }
}
