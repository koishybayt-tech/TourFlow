import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'tours')
  const { status } = await body(event, z.object({ status: z.enum(['PUBLISHED', 'CLOSED', 'ARCHIVE', 'DRAFT']) }))
  const t = await ctx.db.tour.findFirst({ where: { id: getRouterParam(event, 'id')!, deletedAt: null } })
  if (!t) notFound('Тур')
  if (status === 'PUBLISHED' && t.status === 'DRAFT') throw createError({ statusCode: 422, statusMessage: 'Используйте «Опубликовать» — с проверками' })
  await ctx.db.tour.update({ where: { id: t.id }, data: { status } })
  return { ok: true }
})
