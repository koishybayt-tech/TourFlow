import { randomUUID } from 'node:crypto'

/** Cover or day photo/video upload. Served publicly via /api/public/media/... */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'tours')
  const t = await ctx.db.tour.findFirst({ where: { id: getRouterParam(event, 'id')!, deletedAt: null } })
  if (!t) notFound('Тур')
  const parts = await readMultipartFormData(event)
  const file = parts?.find(p => p.name === 'file' && p.filename)
  if (!file) throw createError({ statusCode: 422, statusMessage: 'Выберите файл' })
  if (!/^(image|video)\//.test(file.type ?? '')) throw createError({ statusCode: 422, statusMessage: 'Загрузите фото или видео' })
  if (file.data.length > 50 * 1024 * 1024) throw createError({ statusCode: 413, statusMessage: 'Файл больше 50 МБ' })
  const ext = (file.filename!.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const key = `public/${ctx.organizationId}/tours/${t.id}/${randomUUID()}.${ext}`
  await putFile(key, file.data, file.type!)
  return { key }
})
