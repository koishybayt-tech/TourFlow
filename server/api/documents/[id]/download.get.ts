/** Streams a deal document from storage (access checked by deal scope). */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'documents')
  const doc = await ctx.db.document.findFirst({ where: { id: getRouterParam(event, 'id')!, deal: { deletedAt: null, ...dealScope(ctx) } } })
  if (!doc) notFound('Документ')
  const file = await getFile(doc.fileKey).catch(() => ({ body: simplePdf(doc.name), contentType: 'application/pdf' }))
  setResponseHeader(event, 'Content-Type', file.contentType)
  setResponseHeader(event, 'Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(doc.name)}`)
  return Buffer.from(file.body)
})
