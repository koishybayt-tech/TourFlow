import { randomUUID } from 'node:crypto'
import { autoAdvance, logDeal } from '../../../services/deals'

/** Signed on paper: optional scan upload (multipart «file»), status PAPER. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'documents')
  const c = await ctx.db.contract.findFirst({ where: { id: getRouterParam(event, 'id')!, deal: dealScope(ctx) } })
  if (!c) notFound('Документ')
  const parts = await readMultipartFormData(event).catch(() => undefined)
  const file = parts?.find(p => p.name === 'file' && p.filename)
  if (file) {
    const key = `org/${ctx.organizationId}/deals/${c.dealId}/${randomUUID()}-scan`
    await putFile(key, file.data, file.type || 'application/octet-stream')
    await ctx.db.document.create({ data: { organizationId: ctx.organizationId, dealId: c.dealId, type: c.kind === 'receipt' ? 'Расписка' : 'Подписанный договор', name: `Скан № ${c.number} — ${Buffer.from(file.filename!, 'latin1').toString('utf8')}`, fileKey: key, size: file.data.length, createdById: ctx.memberId } })
  }
  await ctx.db.contract.update({ where: { id: c.id }, data: { status: 'PAPER' } })
  await logDeal(ctx, c.dealId, 'doc', `№ ${c.number} подписан на бумаге${file ? ', скан загружен' : ''}`)
  const advanced = await autoAdvance(ctx, c.dealId)
  return { ok: true, advanced }
})
