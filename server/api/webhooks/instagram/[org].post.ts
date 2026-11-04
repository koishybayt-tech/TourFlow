import { ingestIncoming } from '../../../services/inbox'

interface IgPayload {
  entry?: { messaging?: { sender: { id: string }, timestamp: number, message?: { text?: string, is_echo?: boolean } }[] }[]
}

/** Incoming Instagram Direct messages. The client's phone is unknown until they share it. */
export default defineEventHandler(async (event) => {
  const org = getRouterParam(event, 'org')!
  const raw = await verifyMetaSignature(event, process.env.INSTAGRAM_APP_SECRET)
  if (!(await orgExists(org))) throw createError({ statusCode: 404 })
  const payload = JSON.parse(raw) as IgPayload
  for (const entry of payload.entry ?? []) {
    for (const m of entry.messaging ?? []) {
      if (!m.message?.text || m.message.is_echo) continue
      await ingestIncoming(org, { channel: 'INSTAGRAM', externalId: m.sender.id, phone: '', name: `Instagram ${m.sender.id.slice(-4)}`, text: m.message.text, at: new Date(m.timestamp) })
    }
  }
  return { ok: true }
})
