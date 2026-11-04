import type { H3Event } from 'h3'
import type { z } from 'zod'

/** Reads and validates a JSON body; on failure returns 422 with the first message in Russian. */
export async function body<T extends z.ZodType>(event: H3Event, schema: T): Promise<z.infer<T>> {
  const raw = await readBody(event).catch(() => ({}))
  const r = schema.safeParse(raw ?? {})
  if (!r.success) {
    const issue = r.error.issues[0]
    throw createError({ statusCode: 422, statusMessage: issue?.message || 'Проверьте поля формы', data: { issues: r.error.issues } })
  }
  return r.data
}

export function queryOf<T extends z.ZodType>(event: H3Event, schema: T): z.infer<T> {
  const r = schema.safeParse(getQuery(event))
  if (!r.success) throw createError({ statusCode: 422, statusMessage: r.error.issues[0]?.message || 'Неверные параметры' })
  return r.data
}
