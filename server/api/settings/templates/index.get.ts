export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'settings')
  const rows = await ctx.db.documentTemplate.findMany({ include: { _count: { select: { contracts: true } } }, orderBy: [{ kind: 'asc' }, { name: 'asc' }] })
  return rows.map(t => ({ id: t.id, kind: t.kind, name: t.name, short: t.short, pipeline: t.pipeline, condition: t.condition, enabled: t.enabled, hasFile: !!t.fileKey, body: t.body, fileKey: t.fileKey, variables: t.variables, updatedAt: t.updatedAt, used: t._count.contracts }))
})
