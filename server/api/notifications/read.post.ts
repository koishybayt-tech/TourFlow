import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event)
  const { id } = await body(event, z.object({ id: z.string().optional() }))
  await ctx.db.notification.updateMany({ where: { memberId: ctx.memberId, readAt: null, ...(id ? { id } : {}) }, data: { readAt: new Date() } })
  return { ok: true }
})
