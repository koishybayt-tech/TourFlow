import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'inbox')
  const id = getRouterParam(event, 'id')!
  const data = await body(event, z.object({
    unread: z.boolean().optional(),
    pipelineOverride: z.enum(['GROUP', 'PACKAGE', 'BASE']).nullable().optional(),
    lead: z.record(z.string(), z.string()).optional(),
  }))
  const r = await ctx.db.conversation.updateMany({ where: { id }, data })
  if (!r.count) notFound('Диалог')
  if (data.unread === false) publish(ctx.organizationId, { type: 'message', conversationId: id })
  return { ok: true }
})
