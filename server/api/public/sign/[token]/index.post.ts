import { z } from 'zod'
import { documentHash, signing } from '../../../../providers/signing'
import { autoAdvance, logDeal, notify } from '../../../../services/deals'
import { loadSignature } from '../../../../services/signing'

/** Signs the document(s) behind a link. The signature itself happens in NCALayer / eGov Mobile; the server verifies the CMS. */
export default defineEventHandler(async (event) => {
  rateLimit(event, 'sign', 10, 60_000)
  const { sig, bundle } = await loadSignature(getRouterParam(event, 'token')!)
  if (sig.signedAt) return { ok: true, already: true }
  const input = await body(event, z.object({ method: z.enum(['ncalayer', 'egov']), cms: z.string().nullable().optional(), memberId: z.string().optional() }))
  const org = sig.contract.organizationId
  let signerName = sig.signerName ?? sig.contract.deal.client.fullName ?? sig.contract.deal.client.name
  if (sig.side === 'agency') {
    const m = input.memberId ? await prisma.member.findFirst({ where: { id: input.memberId, organizationId: org, active: true }, include: { user: { select: { name: true } } } }) : null
    if (!m) throw createError({ statusCode: 422, statusMessage: 'Выберите подписанта агентства' })
    signerName = m.user.name
  }
  const db = scopedDb(org)
  const actor = { organizationId: org, memberId: null, name: 'Система' as const, db }
  for (const doc of bundle) {
    const own = doc.signatures.find(s => s.side === sig.side)
    if (!own || own.signedAt) continue
    const cert = await signing().verify({ cms: input.cms ?? null, documentHash: documentHash(doc.text ?? ''), signerName, method: input.method })
    await prisma.signature.update({ where: { id: own.id }, data: { signedAt: new Date(), method: input.method, signerName, certInfo: cert as object, cms: input.cms ?? null } })
    const all = await prisma.signature.findMany({ where: { contractId: doc.id } })
    if (all.every(s => s.signedAt)) await prisma.contract.update({ where: { id: doc.id }, data: { status: 'SIGNED' } })
    await logDeal(actor, doc.dealId, 'doc', `№ ${doc.number} подписан: ${sig.side === 'client' ? 'клиент' : 'турагентство'} (${signerName}, ${input.method === 'egov' ? 'eGov Mobile' : 'ЭЦП NCALayer'})`)
  }
  if (sig.side === 'client') await notify(org, sig.contract.deal.managerId, 'Клиент подписал документ', `№${sig.contract.deal.number} · ${bundle.map(d => d.number).join(', ')}`, `/deals/${sig.contract.deal.id}`)
  await autoAdvance(actor, sig.contract.deal.id)
  return { ok: true }
})
