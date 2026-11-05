import { randomUUID } from 'node:crypto'
import { DOC_TYPES } from '#shared/domain/types'
import { accessibleDeal } from '../../../services/access'
import { autoAdvance, logDeal } from '../../../services/deals'

const MAX = 20 * 1024 * 1024

/** Upload a document to the deal (multipart: file, type). Stored in S3. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'documents')
  const deal = await accessibleDeal(ctx, getRouterParam(event, 'id')!)
  const parts = await readMultipartFormData(event)
  const file = parts?.find(p => p.name === 'file' && p.filename)
  const type = parts?.find(p => p.name === 'type')?.data.toString('utf8') ?? 'Другое'
  if (!file) throw createError({ statusCode: 422, statusMessage: 'Выберите файл' })
  if (file.data.length > MAX) throw createError({ statusCode: 413, statusMessage: 'Файл больше 20 МБ' })
  if (!(DOC_TYPES as readonly string[]).includes(type)) throw createError({ statusCode: 422, statusMessage: 'Неизвестный тип документа' })
  const name = Buffer.from(file.filename!, 'latin1').toString('utf8')
  const key = `org/${ctx.organizationId}/deals/${deal.id}/${randomUUID()}-${name.replace(/[^\p{L}\p{N}._ -]/gu, '_')}`
  await putFile(key, file.data, file.type || 'application/octet-stream')
  const doc = await ctx.db.document.create({ data: { organizationId: ctx.organizationId, dealId: deal.id, type, name, fileKey: key, size: file.data.length, createdById: ctx.memberId } })
  await logDeal(ctx, deal.id, 'doc', `Документ загружен: ${type} — ${name}`)
  const advanced = await autoAdvance(ctx, deal.id)
  return { id: doc.id, advanced }
})
