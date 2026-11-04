import { z } from 'zod'
import { accessibleClient } from '../../../services/access'

/** Merges another client into this one: deals, travelers and data move here, the second phone becomes extra. Irreversible. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'clients')
  const target = await accessibleClient(ctx, getRouterParam(event, 'id')!)
  const { otherId } = await body(event, z.object({ otherId: z.string() }))
  if (otherId === target.id) throw createError({ statusCode: 422, statusMessage: 'Нельзя объединить клиента с самим собой' })
  const other = await accessibleClient(ctx, otherId)

  await prisma.$transaction(async (tx) => {
    await tx.deal.updateMany({ where: { organizationId: ctx.organizationId, clientId: other.id }, data: { clientId: target.id } })
    await tx.traveler.updateMany({ where: { organizationId: ctx.organizationId, clientId: other.id }, data: { clientId: target.id } })
    await tx.client.update({
      where: { id: target.id },
      data: {
        extraPhones: [...new Set([...target.extraPhones, other.phone, ...other.extraPhones])].filter(p => p !== target.phone),
        email: target.email ?? other.email,
        fullName: target.fullName ?? other.fullName,
        iinEnc: target.iinEnc ?? other.iinEnc,
        birthDate: target.birthDate ?? other.birthDate,
        address: target.address ?? other.address,
        tags: [...new Set([...target.tags, ...other.tags])],
        note: [target.note, other.note].filter(Boolean).join('\n') || null,
        pdConsentAt: target.pdConsentAt ?? other.pdConsentAt,
        managerId: target.managerId ?? other.managerId,
      },
    })
    // Keep the row for history but free the unique phone.
    await tx.client.update({ where: { id: other.id }, data: { deletedAt: new Date(), mergedIntoId: target.id, phone: `merged:${other.id}` } })
  })
  await audit({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'client.merge', entity: 'Client', entityId: target.id, meta: { merged: other.id, name: other.name } })
  return { ok: true }
})
