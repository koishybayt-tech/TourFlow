import { z } from 'zod'
import { detectPipeline } from '#shared/domain/routing'
import { loadRouting } from '../../services/routing'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'inbox')
  const { filter } = queryOf(event, z.object({ filter: z.enum(['all', 'new', 'nopipe', 'WHATSAPP', 'INSTAGRAM', 'SITE']).default('all') }))
  const where: Record<string, unknown> = {}
  if (filter === 'new') where.unread = true
  if (filter === 'nopipe') where.dealId = null
  if (['WHATSAPP', 'INSTAGRAM', 'SITE'].includes(filter)) where.channel = filter
  const [rows, { settings }] = await Promise.all([
    ctx.db.conversation.findMany({
      where,
      include: { messages: { orderBy: { sentAt: 'asc' } }, deal: { select: { id: true, number: true, pipeline: true, stage: { select: { name: true } } } } },
      orderBy: { lastMessageAt: 'desc' },
      take: 200,
    }),
    loadRouting(ctx.organizationId),
  ])
  const list = rows.map((c) => {
    const inbound = c.messages.filter(m => m.direction === 'in').map(m => m.text).join('\n')
    const s = c.dealId ? null : detectPipeline(inbound, c.channel, settings)
    const last = c.messages.at(-1)
    return {
      id: c.id,
      name: c.clientName,
      phone: c.clientPhone,
      channel: c.channel,
      unread: c.unread,
      lastMessageAt: c.lastMessageAt,
      preview: last ? `${last.direction === 'out' ? 'Вы: ' : ''}${last.text}` : '',
      deal: c.deal ? { id: c.deal.id, number: c.deal.number, stage: c.deal.stage.name } : null,
      suggestion: c.pipelineOverride ?? s?.pipeline ?? null,
    }
  })
  return filter === 'nopipe' ? list.filter(c => !c.suggestion) : list
})
