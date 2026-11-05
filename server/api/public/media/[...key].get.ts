/** Public tour media (only keys under public/). Cached by browsers and CDN. */
export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, 'key') ?? ''
  if (!key.startsWith('public/') || key.includes('..')) throw createError({ statusCode: 404 })
  const file = await getFile(key).catch(() => null)
  if (!file) throw createError({ statusCode: 404 })
  setResponseHeader(event, 'Content-Type', file.contentType)
  setResponseHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  return Buffer.from(file.body)
})
