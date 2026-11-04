import { ingestIncoming } from '../../../services/inbox'

interface WaPayload {
  entry?: { changes?: { value?: { contacts?: { wa_id: string, profile?: { name?: string } }[], messages?: { from: string, id: string, timestamp: string, type: string, text?: { body: string } }[] } }[] }[]
}

/** Incoming WhatsApp messages. URL to register in Meta: /api/webhooks/whatsapp/<organizationId> */
export default defineEventHandler(async (event) => {
  const org = getRouterParam(event, 'org')!
  const raw = await verifyMetaSignature(event, process.env.WHATSAPP_APP_SECRET)
  if (!(await orgExists(org))) throw createError({ statusCode: 404 })
  const payload = JSON.parse(raw) as WaPayload
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const names = new Map((change.value?.contacts ?? []).map(c => [c.wa_id, c.profile?.name ?? '']))
      for (const m of change.value?.messages ?? []) {
        const text = m.type === 'text' ? m.text?.body ?? '' : `[${m.type}]`
        await ingestIncoming(org, { channel: 'WHATSAPP', externalId: m.from, phone: m.from, name: names.get(m.from) || `+${m.from}`, text, at: new Date(Number(m.timestamp) * 1000) })
      }
    }
  }
  return { ok: true }
})
