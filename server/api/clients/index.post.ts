import { clientCreateSchema } from '#shared/schemas/clients'
import { normalizePhone } from '#shared/utils/phone'
import { findClientByPhone } from '../../services/clients'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'clients')
  const data = await body(event, clientCreateSchema)
  const phone = normalizePhone(data.phone)!
  const existing = await findClientByPhone(ctx.db, phone)
  if (existing) throw createError({ statusCode: 409, statusMessage: `Клиент с этим телефоном уже есть: ${existing.name}`, data: { id: existing.id, name: existing.name } })
  const client = await ctx.db.client.create({ data: { organizationId: ctx.organizationId, name: data.name, phone, email: data.email || null, source: data.source, managerId: ctx.role === 'MANAGER' ? ctx.memberId : null } })
  return { id: client.id, name: client.name, phone: client.phone }
})
