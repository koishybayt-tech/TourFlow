import { z } from 'zod'
import { templateVariableSchema } from '#shared/schemas/settings'
import { dealFieldValues, renderDoc } from '../../../services/documents'

/** Preview on a demo deal: the most recent active deal of the organization. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'settings')
  const t = await body(event, z.object({ body: z.string().nullable().optional(), fileKey: z.string().nullable().optional(), variables: z.array(templateVariableSchema) }))
  const deal = await ctx.db.deal.findFirst({ where: { deletedAt: null, lostAt: null }, orderBy: [{ client: { fullName: { sort: 'asc', nulls: 'last' } } }, { updatedAt: 'desc' }], include: { client: { select: { name: true } } } })
  if (!deal) throw createError({ statusCode: 422, statusMessage: 'Создайте хотя бы одну заявку для предпросмотра' })
  const { values } = await dealFieldValues(ctx.db, ctx.organizationId, deal.id, 'ДТ-ОБРАЗЕЦ')
  const r = await renderDoc({ body: t.body ?? null, fileKey: t.fileKey ?? null, variables: t.variables }, values)
  return { text: r.text, empty: r.empty, deal: `№${deal.number} · ${deal.client.name}` }
})
