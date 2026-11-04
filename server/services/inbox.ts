import type { Channel } from '../generated/prisma/client'
import { normalizePhone } from '#shared/utils/phone'
import { prisma } from '../utils/prisma'
import { publish } from '../utils/live'

/** Stores an incoming message (webhook or simulation) and notifies listeners. */
export async function ingestIncoming(organizationId: string, input: { channel: Channel, externalId: string, phone: string, name: string, text: string, at?: Date }) {
  const at = input.at ?? new Date()
  const phone = normalizePhone(input.phone) ?? input.phone
  const conv = await prisma.conversation.upsert({
    where: { organizationId_channel_externalId: { organizationId, channel: input.channel, externalId: input.externalId } },
    create: { organizationId, channel: input.channel, externalId: input.externalId, clientPhone: phone, clientName: input.name, unread: true, lastMessageAt: at },
    update: { unread: true, lastMessageAt: at, clientName: input.name || undefined },
  })
  await prisma.message.create({ data: { conversationId: conv.id, direction: 'in', text: input.text, sentAt: at } })
  publish(organizationId, { type: 'message', conversationId: conv.id })
  return conv
}
