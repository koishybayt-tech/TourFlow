/**
 * CSRF protection for cookie-authenticated mutations: the Origin (or Referer) must match the Host.
 * Webhooks and public signing endpoints are excluded — they authenticate differently.
 */
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])
const EXCLUDED = ['/api/webhooks/', '/api/public/']

export default defineEventHandler((event) => {
  const path = event.path || ''
  if (!path.startsWith('/api/') || SAFE.has(event.method)) return
  if (EXCLUDED.some(p => path.startsWith(p))) return
  const host = getRequestHeader(event, 'x-forwarded-host') || getRequestHeader(event, 'host')
  const source = getRequestHeader(event, 'origin') || getRequestHeader(event, 'referer')
  if (!source) return // non-browser clients (no cookies sent cross-site without Origin)
  try {
    if (new URL(source).host === host) return
  }
  catch {
    // malformed Origin/Referer — reject below
  }
  throw createError({ statusCode: 403, statusMessage: 'Запрос отклонён' })
})
