import { loadSignature } from '../../../../services/signing'

export default defineEventHandler(async (event) => {
  rateLimit(event, 'sign-view', 60, 60_000)
  const { sig, bundle } = await loadSignature(getRouterParam(event, 'token')!)
  const c = sig.contract
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: c.organizationId }, select: { name: true, director: true, bin: true } })
  const signers = sig.side === 'agency'
    ? await prisma.member.findMany({ where: { organizationId: c.organizationId, active: true, OR: [{ signRight: true }, { role: 'OWNER' }] }, include: { user: { select: { name: true, position: true } } } })
    : []
  return {
    side: sig.side,
    org: org.name,
    documents: bundle.map(d => ({
      id: d.id, number: d.number, title: d.template.name, kind: d.kind, text: d.text ?? '', createdAt: d.createdAt, hasPdf: !!d.pdfKey, status: d.status,
      signers: d.signatures.map(s => ({ side: s.side, name: s.side === 'agency' ? (s.signerName ?? org.name) : (s.signerName ?? c.deal.client.fullName ?? c.deal.client.name), signedAt: s.signedAt, method: s.method, cert: s.certInfo })),
    })),
    signed: !!sig.signedAt,
    signerName: sig.side === 'client' ? (c.deal.client.fullName ?? c.deal.client.name) : null,
    agencySigners: signers.map(m => ({ id: m.id, name: m.user.name, position: m.user.position ?? (m.role === 'OWNER' ? 'Директор' : 'Ответственный') })),
    expiresAt: sig.expiresAt,
  }
})
