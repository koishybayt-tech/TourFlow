import { templateSchema } from '#shared/schemas/settings'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'settings')
  const t = await body(event, templateSchema)
  if (!t.body && !t.fileKey) throw createError({ statusCode: 422, statusMessage: 'Загрузите файл или вставьте текст шаблона' })
  const unbound = t.variables.filter(v => !v.field)
  if (unbound.length) throw createError({ statusCode: 422, statusMessage: `Свяжите переменные с полями: ${unbound.map(v => `{${v.placeholder}}`).join(', ')}` })
  const row = await ctx.db.documentTemplate.create({
    data: { organizationId: ctx.organizationId, kind: t.kind, name: t.name, short: t.short || null, pipeline: t.kind === 'contract' ? t.pipeline ?? null : null, condition: t.kind === 'receipt' ? t.condition ?? 'all' : null, body: t.body ?? null, fileKey: t.fileKey ?? null, variables: t.variables },
  })
  await audit({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'template.create', entity: 'DocumentTemplate', entityId: row.id, meta: { name: t.name } })
  return { id: row.id }
})
