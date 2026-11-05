export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'settings')
  const t = await ctx.db.documentTemplate.findFirst({ where: { id: getRouterParam(event, 'id')! }, include: { _count: { select: { contracts: true } } } })
  if (!t) notFound('Шаблон')
  // Used templates are kept for history and only switched off.
  if (t._count.contracts) {
    await ctx.db.documentTemplate.update({ where: { id: t.id }, data: { enabled: false } })
    return { ok: true, disabled: true }
  }
  await ctx.db.documentTemplate.delete({ where: { id: t.id } })
  return { ok: true }
})
