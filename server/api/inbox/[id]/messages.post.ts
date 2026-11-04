import { z } from 'zod'
import { CHANNEL_LABELS } from '#shared/domain/types'
import { messaging } from '../../../providers/messaging'
import { logDeal } from '../../../services/deals'

export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'inbox')
  const id = getRouterParam(event, 'id')!
  const { text } = await body(event, z.object({ text: z.string().trim().min(1, 'Введите сообщение').max(4000) }))
  const c = await ctx.db.conversation.findFirst({ where: { id } })
  if (!c) notFound('Диалог')
  await messaging().send({ channel: c.channel, to: c.clientPhone, text })
  const now = new Date()
  const msg = await prisma.message.create({ data: { conversationId: c.id, direction: 'out', text, sentAt: now, authorId: ctx.memberId } })
  await ctx.db.conversation.update({ where: { id: c.id }, data: { unread: false, lastMessageAt: now } })
  if (c.dealId) await logDeal(ctx, c.dealId, 'message', `Сообщение клиенту (${CHANNEL_LABELS[c.channel]}): ${text.length > 120 ? `${text.slice(0, 120)}…` : text}`)
  publish(ctx.organizationId, { type: 'message', conversationId: c.id })
  return { id: msg.id, direction: 'out', text, sentAt: now, auto: false }
})
