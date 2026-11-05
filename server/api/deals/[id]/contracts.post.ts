import { z } from 'zod'
import { accessibleDeal } from '../../../services/access'
import { createContract, signLinks } from '../../../services/contracts'
import { autoAdvance } from '../../../services/deals'

const CLIENT_FIELDS: Record<string, 'fullName' | 'address' | 'email'> = { 'client.fullName': 'fullName', 'client.address': 'address', 'client.email': 'email' }

/** Sends a document for signing. Manual client data is saved to the client card. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'documents')
  const deal = await accessibleDeal(ctx, getRouterParam(event, 'id')!)
  const { templateId, overrides, saveClient } = await body(event, z.object({ templateId: z.string(), overrides: z.record(z.string(), z.string()).default({}), saveClient: z.boolean().default(true) }))
  if (saveClient) {
    const data: Record<string, unknown> = {}
    for (const [field, col] of Object.entries(CLIENT_FIELDS)) if (overrides[field]) data[col] = overrides[field]
    if (overrides['client.iin'] && /^\d{12}$/.test(overrides['client.iin'])) data.iinEnc = encryptPii(overrides['client.iin'])
    if (overrides['client.birthDate'] && /^\d{2}\.\d{2}\.\d{4}$/.test(overrides['client.birthDate'])) {
      const [d, m, y] = overrides['client.birthDate'].split('.')
      data.birthDate = new Date(`${y}-${m}-${d}T00:00:00Z`)
    }
    if (Object.keys(data).length) await ctx.db.client.update({ where: { id: deal.clientId }, data })
  }
  // A new contract replaces an unsigned one of the same template.
  const old = await ctx.db.contract.findMany({ where: { dealId: deal.id, templateId, annulledAt: null, status: { in: ['NONE', 'SENT'] } }, include: { signatures: true } })
  for (const c of old) if (!c.signatures.some(s => s.signedAt)) await ctx.db.contract.update({ where: { id: c.id }, data: { annulledAt: new Date() } })
  const contract = await createContract(ctx, deal.id, templateId, overrides)
  const advanced = await autoAdvance(ctx, deal.id)
  return { id: contract.id, number: contract.number, links: signLinks(contract), empty: contract.emptyFields, advanced }
})
