import { stageUpdateSchema } from '#shared/schemas/settings'

/** Edits a stage: name, description («что сделать») and its requirements. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'settings')
  const id = getRouterParam(event, 'id')!
  const stage = await ctx.db.stage.findFirst({ where: { id }, include: { requirements: true } })
  if (!stage) notFound('Этап')
  const d = await body(event, stageUpdateSchema)
  const keep = new Set(d.requirements.map(r => r.id).filter(Boolean))
  await prisma.$transaction(async (tx) => {
    await tx.stage.update({ where: { id }, data: { name: d.name, description: d.description } })
    for (const r of stage.requirements) if (!keep.has(r.id)) await tx.stageRequirement.delete({ where: { id: r.id } })
    for (const [i, r] of d.requirements.entries()) {
      const data = { type: r.type, label: r.label, required: r.required, config: r.config as object, order: i }
      if (r.id && stage.requirements.some(x => x.id === r.id)) await tx.stageRequirement.update({ where: { id: r.id }, data })
      else await tx.stageRequirement.create({ data: { ...data, stageId: id } })
    }
  })
  await audit({ organizationId: ctx.organizationId, userId: ctx.userId, action: 'stage.update', entity: 'Stage', entityId: id })
  return { ok: true }
})
