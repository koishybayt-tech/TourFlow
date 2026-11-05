import { z } from 'zod'
import { CHANNEL_LABELS } from '#shared/domain/types'
import { accessibleDeal } from '../../../services/access'
import { autoAdvance, logDeal } from '../../../services/deals'
import { setPackageRequirement } from '../../../services/package'
import { messaging } from '../../../providers/messaging'

/** «Отправить подборку»: the edited text goes to the client's channel; offers become SENT. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'package')
  const deal = await accessibleDeal(ctx, getRouterParam(event, 'id')!)
  const { text, offerIds } = await body(event, z.object({ text: z.string().trim().min(5, 'Текст подборки пуст'), offerIds: z.array(z.string()).min(1, 'Выберите варианты') }))
  const client = await ctx.db.client.findFirstOrThrow({ where: { id: deal.clientId } })
  let conv = await ctx.db.conversation.findFirst({ where: { OR: [{ dealId: deal.id }, { clientPhone: client.phone }] }, orderBy: { lastMessageAt: 'desc' } })
  conv ??= await ctx.db.conversation.create({ data: { organizationId: ctx.organizationId, channel: 'WHATSAPP', externalId: client.phone.slice(1), clientPhone: client.phone, clientName: client.name, dealId: deal.id, unread: false, lastMessageAt: new Date() } })
  await messaging().send({ channel: conv.channel, to: client.phone, text })
  await prisma.message.create({ data: { conversationId: conv.id, direction: 'out', text, sentAt: new Date(), authorId: ctx.memberId } })
  await ctx.db.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: new Date(), unread: false } })
  await ctx.db.offer.updateMany({ where: { dealId: deal.id, id: { in: offerIds }, status: 'DRAFT' }, data: { status: 'SENT' } })
  await logDeal(ctx, deal.id, 'offer', `Подборка отправлена клиенту (${CHANNEL_LABELS[conv.channel]}): ${offerIds.length} вар.`)
  await setPackageRequirement(ctx, deal.id, 'check', /подборка отправлена/i, true)
  const advanced = await autoAdvance(ctx, deal.id)
  return { ok: true, advanced }
})
