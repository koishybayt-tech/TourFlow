import type { Channel } from '../../generated/prisma/client'

/** Outgoing messages to clients. Mock by default; real providers are enabled with MESSAGING_PROVIDER=real and keys in .env. */
export interface MessagingProvider {
  name: string
  send(input: { channel: Channel, to: string, text: string }): Promise<{ externalId: string | null, delivered: boolean }>
}

const mock: MessagingProvider = {
  name: 'mock',
  async send() {
    return { externalId: null, delivered: true }
  },
}

/** WhatsApp Cloud API (Meta). Instagram uses the same Graph API with a page token — added with real keys. */
const whatsappCloud: MessagingProvider = {
  name: 'whatsapp-cloud',
  async send({ channel, to, text }) {
    if (channel !== 'WHATSAPP') return mock.send({ channel, to, text })
    const token = process.env.WHATSAPP_CLOUD_TOKEN
    const phoneId = process.env.WHATSAPP_PHONE_ID
    if (!token || !phoneId) throw createError({ statusCode: 503, statusMessage: 'WhatsApp не подключён: укажите WHATSAPP_CLOUD_TOKEN и WHATSAPP_PHONE_ID' })
    const res = await $fetch<{ messages?: { id: string }[] }>(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { messaging_product: 'whatsapp', to: to.replace(/\D/g, ''), type: 'text', text: { body: text } },
    })
    return { externalId: res.messages?.[0]?.id ?? null, delivered: true }
  },
}

export function messaging(): MessagingProvider {
  return process.env.MESSAGING_PROVIDER === 'real' ? whatsappCloud : mock
}
