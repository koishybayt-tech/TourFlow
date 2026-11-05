export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'settings')
  const id = getRouterParam(event, 'id')!
  const stage = await ctx.db.stage.findFirst({ where: { id } })
  if (!stage) notFound('Этап')
  const deals = await ctx.db.deal.count({ where: { stageId: id } })
  if (deals) throw createError({ statusCode: 422, statusMessage: `На этапе ${deals} заявок — сначала переведите их` })
  const total = await ctx.db.stage.count({ where: { pipeline: stage.pipeline } })
  if (total <= 2) throw createError({ statusCode: 422, statusMessage: 'В воронке должно быть хотя бы два этапа' })
  await prisma.$transaction(async (tx) => {
    await tx.task.updateMany({ where: { stageId: id }, data: { stageId: null } })
    await tx.stage.delete({ where: { id } })
    // Close the gap in ordering.
    const rest = await tx.stage.findMany({ where: { organizationId: ctx.organizationId, pipeline: stage.pipeline }, orderBy: { order: 'asc' } })
    for (const [i, s] of rest.entries()) if (s.order !== i) await tx.stage.update({ where: { id: s.id }, data: { order: i + 1000 } })
    for (const [i, s] of rest.entries()) await tx.stage.update({ where: { id: s.id }, data: { order: i } })
  })
  return { ok: true }
})
