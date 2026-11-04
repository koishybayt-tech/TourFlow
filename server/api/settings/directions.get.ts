export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'settings')
  const [directions, org] = await Promise.all([
    ctx.db.direction.findMany({ orderBy: { order: 'asc' } }),
    prisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId }, select: { defaultManagerId: true } }),
  ])
  return { directions: directions.map(d => ({ id: d.id, name: d.name, keywords: d.keywords, managerIds: d.managerIds, mode: d.mode, backupId: d.backupId })), defaultManagerId: org.defaultManagerId }
})
