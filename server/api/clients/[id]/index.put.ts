import { can } from '#shared/permissions'
import { clientUpdateSchema } from '#shared/schemas/clients'
import { normalizePhone } from '#shared/utils/phone'
import { accessibleClient } from '../../../services/access'
import { findClientByPhone } from '../../../services/clients'
import { autoAdvance } from '../../../services/deals'

/** Client changes apply to all their deals (shared entity) and future contracts. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'clients')
  const client = await accessibleClient(ctx, getRouterParam(event, 'id')!)
  const d = await body(event, clientUpdateSchema)
  const data: Record<string, unknown> = {}
  if (d.name !== undefined) data.name = d.name
  if (d.email !== undefined) data.email = d.email || null
  if (d.fullName !== undefined) data.fullName = d.fullName || null
  if (d.address !== undefined) data.address = d.address || null
  if (d.birthDate !== undefined) data.birthDate = d.birthDate ? new Date(`${d.birthDate.slice(0, 10)}T00:00:00Z`) : null
  if (d.iin !== undefined) data.iinEnc = encryptPii(d.iin || null)
  if (d.tags !== undefined) data.tags = [...new Set(d.tags)]
  if (d.note !== undefined) data.note = d.note || null
  if (d.managerId !== undefined && can(ctx.role, 'deals.reassign')) data.managerId = d.managerId
  if (d.pdConsent !== undefined) data.pdConsentAt = d.pdConsent ? (client.pdConsentAt ?? new Date()) : null
  if (d.extraPhones !== undefined) data.extraPhones = [...new Set(d.extraPhones.map(p => normalizePhone(p)!))]
  if (d.phone !== undefined) {
    const phone = normalizePhone(d.phone)!
    if (phone !== client.phone) {
      const other = await findClientByPhone(ctx.db, phone)
      if (other && other.id !== client.id) throw createError({ statusCode: 409, statusMessage: `Этот телефон уже у клиента ${other.name}. Объедините карточки.` })
      data.phone = phone
    }
  }
  await ctx.db.client.update({ where: { id: client.id }, data })
  if (d.iin !== undefined) await audit({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'pii.update', entity: 'Client', entityId: client.id, meta: { field: 'iin' } })
  // Client data is a stage requirement for contracts — re-check all active deals.
  const deals = await ctx.db.deal.findMany({ where: { clientId: client.id, lostAt: null, wonAt: null, deletedAt: null }, select: { id: true } })
  const advanced = []
  for (const deal of deals) {
    const r = await autoAdvance(ctx, deal.id)
    if (r) advanced.push({ dealId: deal.id, ...r })
  }
  return { ok: true, advanced }
})
