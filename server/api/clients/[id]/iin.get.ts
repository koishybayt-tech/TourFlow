import { accessibleClient } from '../../../services/access'

/** Reveals the decrypted IIN. Every view is written to the audit log. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'clients')
  const client = await accessibleClient(ctx, getRouterParam(event, 'id')!)
  await audit({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'pii.view', entity: 'Client', entityId: client.id, meta: { field: 'iin' } })
  return { iin: decryptPii(client.iinEnc) }
})
