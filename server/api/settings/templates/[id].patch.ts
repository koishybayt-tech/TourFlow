import { z } from 'zod'
import { templateVariableSchema } from '#shared/schemas/settings'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'settings')
  const id = getRouterParam(event, 'id')!
  const d = await body(event, z.object({ enabled: z.boolean().optional(), name: z.string().trim().min(2).optional(), short: z.string().optional(), variables: z.array(templateVariableSchema).optional(), body: z.string().optional() }))
  if (d.variables?.some(v => !v.field)) throw createError({ statusCode: 422, statusMessage: 'Свяжите все переменные с полями' })
  const r = await ctx.db.documentTemplate.updateMany({ where: { id }, data: d })
  if (!r.count) notFound('Шаблон')
  return { ok: true }
})
