import type { H3Event } from 'h3'

/** Simple in-memory fixed-window limiter (one app instance). */
const buckets = new Map<string, { count: number, resetAt: number }>()

function keyOf(event: H3Event, scope: string) {
  return `${scope}:${getRequestIP(event, { xForwardedFor: true }) || 'unknown'}`
}

function tooMany(event: H3Event, resetAt: number): never {
  setResponseHeader(event, 'Retry-After', Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)))
  throw createError({ statusCode: 429, statusMessage: 'Слишком много попыток. Попробуйте через минуту' })
}

/** Counts every request in the window. */
export function rateLimit(event: H3Event, scope: string, limit: number, windowMs: number) {
  const key = keyOf(event, scope)
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return
  }
  if (++b.count > limit) tooMany(event, b.resetAt)
}

/** Throws if too many failures were recorded with recordFailure(). */
export function checkFailures(event: H3Event, scope: string, limit: number) {
  const b = buckets.get(keyOf(event, scope))
  if (b && b.resetAt > Date.now() && b.count >= limit) tooMany(event, b.resetAt)
}

export function recordFailure(event: H3Event, scope: string, windowMs: number) {
  const key = keyOf(event, scope)
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.resetAt < now) buckets.set(key, { count: 1, resetAt: now + windowMs })
  else b.count++
}
